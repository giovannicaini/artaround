import { LitElement, html, nothing } from 'lit';
import { customElement, state, property } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import type { TableColumn, TableAction } from '../ui/ui-table';
import type { CircleMarker as LeafletCircleMarker, Map as LeafletMap } from 'leaflet';
import { museumService } from '../../services/museum.service';
import { userService } from '../../services/user.service';
import { uploadService } from '../../services/upload.service';
import { translationService } from '../../services/translation.service';
import { modalService } from '../../services/modal.service';
import { navigatorConfigService } from '../../services/navigator-config.service';
import { jobsService, type Job } from '../../services/jobs.service';
import type {
  Museum,
  User,
  CreateMuseumData,
  MuseumCurator,
  MuseumRoom,
  MuseumService,
  MapMarker,
  MarkerType,
  AppLanguage,
  NavigatorConfig,
  CreateNavigatorConfigData,
} from '@artaround/shared';
import { MUSEUM_SERVICE_TYPE_OPTIONS, MARKER_TYPE_META } from '@artaround/shared';

import { isMuseumCurator } from '../../services/permissions.service';
import '../ui/ui-button';
import '../ui/ai-job-action';
import '../ui/ui-card';
import '../ui/ui-icon';
import '../ui/ui-input';
import '../ui/ui-select';
import '../ui/ui-badge';
import '../ui/ui-modal';
import '../ui/ui-image-placeholder';
import '../ui/ui-page-header';
import '../ui/ui-loading';
import '../ui/ui-empty';
import '../ui/ui-alert';
import '../ui/ui-icon-button';
import '../ui/ui-textarea';
import '../ui/ui-checkbox';
import '../ui/ui-data-grid';
import '../ui/ui-table';
import '../ui/ui-list-controls';
import '../ui/ui-color-input';
import '../ui/image-editor';
import '../items/wikidata-autocomplete';
import { __, i18nService } from '../../services/i18n.service';
import {
  buildTranslationLanguageOptions,
  isLanguageFullyTranslated,
} from '../../utils/translation-fields';
import {
  HEX_COLOR_REGEX,
  SLUG_REGEX,
  sanitizeSlug,
  updateNavigatorConfigTranslationField,
  getNavigatorImageEditorDefinitions,
  renderNavigatorImageEditors,
  renderNavigatorColorField,
  renderNavigatorTranslationsSection,
  computeNavigatorMissingTranslations,
  NAVIGATOR_FONT_SELECT_OPTIONS,
  type NavigatorConfigFormData,
  type NavigatorColorFieldKey,
  type NavigatorTranslationFieldKey,
  type NavigatorImageFieldKey,
} from '../../utils/navigator-config';
import 'leaflet/dist/leaflet.css';

type ViewMode = 'list' | 'create' | 'edit' | 'view' | 'curators';
type MuseumListLayout = 'grid' | 'table';
type MuseumSortField = 'name' | 'city' | 'country' | 'status';

interface MuseumFormData {
  wikidataId: string;
  name: string;
  description: string;
  primaryLanguage: AppLanguage;
  nameTranslations: Partial<Record<AppLanguage, string>>;
  descriptionTranslations: Partial<Record<AppLanguage, string>>;
  activeLanguages: AppLanguage[];
  address: string;
  city: string;
  nation: string;
  postalCode: string;
  latitude: number | null;
  longitude: number | null;
  website: string;
  phone: string;
  email: string;
  openingHours: string;
  openingHoursTranslations: Partial<Record<AppLanguage, string>>;
  ticketInfo: string;
  ticketInfoTranslations: Partial<Record<AppLanguage, string>>;
  coverImage: string;
  services: MuseumService[];
}

/**
 * Pagina Gestione Musei
 *
 * Interfaccia admin per gestire musei e assegnazioni curatori.
 * Solo gli admin possono creare/eliminare musei.
 * Admin e curatori possono modificare i musei a cui hanno accesso.
 */
@customElement('museums-management-page')
export class MuseumsManagementPage extends LitElement {
  private readonly navigatorImageEditors = getNavigatorImageEditorDefinitions();

  @property({ type: Object }) currentUser: User | null = null;
  @property({ type: String }) selectedMuseumId = '';
  @property({ type: String }) configMode: 'full' | 'museum' | 'navigator' = 'full';

  @state() private viewMode: ViewMode = 'list';
  @state() private museums: Museum[] = [];
  @state() private selectedMuseum: Museum | null = null;
  @state() private loading = true;
  @state() private saving = false;
  @state() private syncingLanguages = false;
  @state() private generatingAudio = false;
  // Rispecchia jobsService.getJobs() (vedi handleJobsChanged) — reattivo qui
  // solo per far ridisegnare bottone/banner "Genera audio mancante" quando
  // un job parte/avanza/finisce, non è la fonte di verità (quella resta jobsService).
  @state() private jobs: Job[] = jobsService.getJobs();
  @state() private translatingMuseumFields = false;
  @state() private error = '';
  @state() private success = '';

  // Sale (gestione parallela ai marker: titolo/sottotitolo qui, contorno in
  // Piantina e mappa). Es. titolo "Sala I", sottotitolo "Sala del Gladiatore".
  @state() private rooms: MuseumRoom[] = [];
  @state() private newRoomTitle = '';
  @state() private newRoomSubtitle = '';
  @state() private savingRoom = false;
  @state() private renamingRoomId: string | null = null;
  @state() private renameRoomTitle = '';
  @state() private renameRoomSubtitle = '';

  // Search
  @state() private searchQuery = '';
  @state() private controlsCollapsed = true;
  @state() private listLayout: MuseumListLayout = 'grid';
  @state() private sortField: MuseumSortField = 'name';
  @state() private sortDirection: 'asc' | 'desc' = 'asc';
  @state() private visibleColumns: string[] = ['name', 'city', 'country', 'status'];

  // Form data
  @state() private formData: MuseumFormData = this.getEmptyFormData();

  // Delete modal
  @state() private deleteModalOpen = false;
  @state() private museumToDelete: Museum | null = null;
  @state() private deleting = false;

  // Curator management
  @state() private curators: MuseumCurator[] = [];
  @state() private loadingCurators = false;
  @state() private availableUsers: User[] = [];
  @state() private loadingUsers = false;
  @state() private selectedUserId = '';
  @state() private addingCurator = false;
  @state() private removingCuratorId: string | null = null;
  @state() private geocodingLocation = false;
  @state() private geocodingStatus = '';
  @state() private museumTranslationLanguage: AppLanguage | null = null;

  // Configurazioni Navigator del museo: documenti separati, CRUD via
  // /api/navigator-configs — vedi loadNavigatorConfigs/saveNavigatorConfig.
  @state() private navigatorConfigs: NavigatorConfigFormData[] = [];
  @state() private loadingNavigatorConfigs = false;
  @state() private editingNavigatorConfig: NavigatorConfigFormData | null = null;
  @state() private savingNavigatorConfig = false;
  @state() private deletingNavigatorConfigId: string | null = null;
  @state() private translatingNavigatorConfig = false;
  @state() private navigatorConfigTranslationLanguage: AppLanguage | null = null;

  private leafletModule: typeof import('leaflet') | null = null;
  private locationMap: LeafletMap | null = null;
  private locationMarker: LeafletCircleMarker | null = null;
  private mapContainer: HTMLElement | null = null;
  private geocodeDebounceId: number | null = null;

  private get listSortOptions(): Array<{ value: MuseumSortField; label: string }> {
    return [
      { value: 'name', label: __('Nome') },
      { value: 'city', label: __('Città') },
      { value: 'country', label: __('Nazione') },
      { value: 'status', label: __('Stato') },
    ];
  }

  private get listColumnOptions(): Array<{ key: string; label: string }> {
    return [
      { key: 'name', label: __('Nome') },
      { key: 'city', label: __('Città') },
      { key: 'country', label: __('Nazione') },
      { key: 'status', label: __('Stato') },
    ];
  }

  private readonly defaultVisibleColumns = ['name', 'city', 'country', 'status'];

  private get languageOptions(): Array<{ value: AppLanguage; label: string }> {
    return [
      { value: 'it', label: `🇮🇹 ${__('Italiano')}` },
      { value: 'en', label: `🇬🇧 ${__('English')}` },
      { value: 'fr', label: `🇫🇷 ${__('Français')}` },
      { value: 'de', label: `🇩🇪 ${__('Deutsch')}` },
      { value: 'es', label: `🇪🇸 ${__('Español')}` },
    ];
  }

  // ─── Ciclo di vita ───────────────────────────────────────────
  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    if (this.configMode === 'full') {
      this.loadMuseums();
    } else {
      this.loadSelectedMuseumForConfigMode();
    }

    window.addEventListener('jobs-changed', this.handleJobsChanged);
    void jobsService.refresh();
  }

  // this.jobs (non jobsService.getJobs() direttamente) è anche il motivo per
  // cui Lit ridisegna quando jobsService avanza — i due ai-job-action nel
  // template leggono `.jobs` e calcolano da sé banner/disabled per tipo.
  private handleJobsChanged = (e: Event): void => {
    this.jobs = (e as CustomEvent<Job[]>).detail;
  };

  updated(changedProps: Map<string, unknown>) {
    if (changedProps.has('viewMode')) {
      window.scrollTo(0, 0);
    }
    if (
      (changedProps.has('selectedMuseumId') || changedProps.has('configMode')) &&
      this.configMode !== 'full'
    ) {
      this.loadSelectedMuseumForConfigMode();
    }

    if (changedProps.has('formData') || changedProps.has('viewMode')) {
      void this.syncLocationMapPreview();
    }
  }

  disconnectedCallback() {
    window.removeEventListener('jobs-changed', this.handleJobsChanged);

    if (this.geocodeDebounceId) {
      window.clearTimeout(this.geocodeDebounceId);
      this.geocodeDebounceId = null;
    }

    if (this.locationMap) {
      this.locationMap.remove();
      this.locationMap = null;
      this.locationMarker = null;
      this.mapContainer = null;
    }

    super.disconnectedCallback();
  }

  // ─── Helper form e Navigator ────────────────────────────
  private getEmptyFormData(): MuseumFormData {
    return {
      wikidataId: '',
      name: '',
      description: '',
      primaryLanguage: 'it',
      nameTranslations: {},
      descriptionTranslations: {},
      activeLanguages: ['it'],
      address: '',
      city: '',
      nation: 'Italia',
      postalCode: '',
      latitude: null,
      longitude: null,
      website: '',
      phone: '',
      email: '',
      openingHours: '',
      openingHoursTranslations: {},
      ticketInfo: '',
      ticketInfoTranslations: {},
      coverImage: '',
      services: [],
    };
  }

  // Form vuoto per una nuova NavigatorConfig di questo museo (applicability
  // 'museum'), salvata via navigatorConfigService.create.
  private getEmptyNavigatorConfigFormData(): NavigatorConfigFormData {
    return {
      id: '',
      name: '',
      slug: '',
      applicability: 'museum',
      museumId: this.selectedMuseumId,
      logo: '',
      splashImage: '',
      primaryColor: '#0ea5e9',
      secondaryColor: '#1f2937',
      appBackgroundColor: '',
      displayFont: '',
      bodyFont: '',
      homeTitle: '',
      homeTitleTranslations: {},
      homeSubtitle: '',
      homeSubtitleTranslations: {},
      welcomeText: '',
      welcomeTextTranslations: {},
      openingImage: '',
      featuredMuseumId: '',
      manifestName: '',
      shortName: '',
      manifestDescription: '',
      manifestDescriptionTranslations: {},
      themeColor: '#0ea5e9',
      backgroundColor: '#ffffff',
      display: 'standalone',
      orientation: 'portrait',
      startUrl: '/',
      scope: '/',
      icon192: '',
      icon512: '',
      iconMaskable: '',
      appleTouchIcon: '',
    };
  }

  private normalizeIncomingNavigatorTranslations(
    value: Partial<Record<AppLanguage, string>> | Map<string, string> | undefined,
  ): Partial<Record<AppLanguage, string>> {
    if (!value) return {};
    if (value instanceof Map) {
      return Object.fromEntries(value.entries()) as Partial<Record<AppLanguage, string>>;
    }
    return value;
  }

  private mapNavigatorConfigToFormData(config: NavigatorConfig): NavigatorConfigFormData {
    return {
      id: config._id,
      name: config.name,
      slug: config.slug,
      applicability: config.applicability,
      museumId: config.museumId || '',
      logo: config.branding.logo || '',
      splashImage: config.branding.splashImage || '',
      primaryColor: config.branding.primaryColor,
      secondaryColor: config.branding.secondaryColor || '',
      appBackgroundColor: config.branding.backgroundColor || '',
      displayFont: config.branding.displayFont || '',
      bodyFont: config.branding.bodyFont || '',
      homeTitle: config.content?.homeTitle || '',
      homeTitleTranslations: this.normalizeIncomingNavigatorTranslations(
        config.content?.homeTitleTranslations,
      ),
      homeSubtitle: config.content?.homeSubtitle || '',
      homeSubtitleTranslations: this.normalizeIncomingNavigatorTranslations(
        config.content?.homeSubtitleTranslations,
      ),
      welcomeText: config.content?.welcomeText || '',
      welcomeTextTranslations: this.normalizeIncomingNavigatorTranslations(
        config.content?.welcomeTextTranslations,
      ),
      openingImage: config.content?.openingImage || '',
      featuredMuseumId: config.content?.featuredMuseumId || '',
      manifestName: config.pwa.manifestName,
      shortName: config.pwa.shortName,
      manifestDescription: config.pwa.description || '',
      manifestDescriptionTranslations: this.normalizeIncomingNavigatorTranslations(
        config.pwa.descriptionTranslations,
      ),
      themeColor: config.pwa.themeColor,
      backgroundColor: config.pwa.backgroundColor,
      display: config.pwa.display,
      orientation: config.pwa.orientation,
      startUrl: config.pwa.startUrl,
      scope: config.pwa.scope,
      icon192: config.pwa.icon192 || '',
      icon512: config.pwa.icon512 || '',
      iconMaskable: config.pwa.iconMaskable || '',
      appleTouchIcon: config.pwa.appleTouchIcon || '',
    };
  }

  private async loadNavigatorConfigs() {
    if (!this.selectedMuseumId) return;

    this.loadingNavigatorConfigs = true;
    try {
      const all = await navigatorConfigService.list();
      // list() è già filtrata dal server per i curatori; per un admin include
      // le config di TUTTI i musei, quindi il filtro per museumId qui serve
      // comunque a mostrare solo quelle di questo museo.
      this.navigatorConfigs = all
        .filter((c) => c.applicability === 'museum' && c.museumId === this.selectedMuseumId)
        .map((c) => this.mapNavigatorConfigToFormData(c));
    } catch (e) {
      console.error('Error loading navigator configs:', e);
      this.error = __('Errore nel caricamento delle configurazioni navigator');
    } finally {
      this.loadingNavigatorConfigs = false;
    }
  }

  private hasRequiredLocationForGeocoding(): boolean {
    return Boolean(
      this.formData.address.trim() && this.formData.city.trim() && this.formData.nation.trim(),
    );
  }

  private updateLocationField(field: 'address' | 'city' | 'postalCode' | 'nation', value: string) {
    this.formData = {
      ...this.formData,
      [field]: value,
      latitude: null,
      longitude: null,
    };
    this.geocodingStatus = '';
    this.scheduleGeocodeFromLocation();
  }

  private scheduleGeocodeFromLocation() {
    if (this.geocodeDebounceId) {
      window.clearTimeout(this.geocodeDebounceId);
      this.geocodeDebounceId = null;
    }

    if (!this.hasRequiredLocationForGeocoding()) {
      return;
    }

    this.geocodeDebounceId = window.setTimeout(() => {
      void this.geocodeFromCurrentLocation();
    }, 700);
  }

  private async geocodeFromCurrentLocation() {
    if (!this.hasRequiredLocationForGeocoding()) {
      return;
    }

    this.geocodingLocation = true;
    this.geocodingStatus = '';

    try {
      const result = await museumService.geocodeMuseumLocation({
        address: this.formData.address,
        city: this.formData.city,
        postalCode: this.formData.postalCode,
        nation: this.formData.nation,
      });

      if (!result.data) {
        this.formData = {
          ...this.formData,
          latitude: null,
          longitude: null,
        };
        this.geocodingStatus = __('Posizione non trovata con i dati inseriti');
        return;
      }

      this.formData = {
        ...this.formData,
        latitude: result.data.lat,
        longitude: result.data.lng,
      };
      this.geocodingStatus = __('Mappa aggiornata automaticamente');
    } catch {
      this.geocodingStatus = __('Errore durante aggiornamento automatico della mappa');
    } finally {
      this.geocodingLocation = false;
    }
  }

  private getCurrentCoordinates(): { lat: number; lng: number } | null {
    const { latitude, longitude } = this.formData;

    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return null;
    }

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return null;
    }

    return { lat: latitude, lng: longitude };
  }

  private async syncLocationMapPreview() {
    if (this.viewMode !== 'create' && this.viewMode !== 'edit') {
      return;
    }

    const container = document.getElementById('museum-location-map');
    if (!container) {
      return;
    }

    if (this.mapContainer !== container) {
      if (this.locationMap) {
        this.locationMap.remove();
        this.locationMap = null;
        this.locationMarker = null;
      }
      this.mapContainer = container;
    }

    if (!this.leafletModule) {
      this.leafletModule = await import('leaflet');
    }

    const L = this.leafletModule;

    if (!this.locationMap) {
      this.locationMap = L.map(container, {
        zoomControl: true,
      }).setView([41.9028, 12.4964], 5);

      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
        {
          attribution:
            'Tiles &copy; Esri &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap contributors',
          maxZoom: 19,
        },
      ).addTo(this.locationMap);
    }

    const coordinates = this.getCurrentCoordinates();

    if (!coordinates) {
      if (this.locationMarker) {
        this.locationMarker.remove();
        this.locationMarker = null;
      }
      this.locationMap.setView([41.9028, 12.4964], 5);
      window.requestAnimationFrame(() => this.locationMap?.invalidateSize());
      return;
    }

    if (!this.locationMarker) {
      this.locationMarker = L.circleMarker([coordinates.lat, coordinates.lng], {
        radius: 8,
        weight: 2,
        fillOpacity: 0.75,
      }).addTo(this.locationMap);
    } else {
      this.locationMarker.setLatLng([coordinates.lat, coordinates.lng]);
    }

    this.locationMap.setView([coordinates.lat, coordinates.lng], 15);
    window.requestAnimationFrame(() => this.locationMap?.invalidateSize());
  }

  private getActiveSourceLanguage(): AppLanguage {
    return this.formData.primaryLanguage || 'it';
  }

  private getMuseumTargetLanguages(): AppLanguage[] {
    const source = this.getActiveSourceLanguage();
    return this.formData.activeLanguages.filter((lang) => lang !== source);
  }

  private isMuseumLanguageFullyTranslated(language: AppLanguage): boolean {
    const fields = [
      {
        source: this.formData.name,
        translations: this.formData.nameTranslations,
      },
      {
        source: this.formData.description,
        translations: this.formData.descriptionTranslations,
      },
      {
        source: this.formData.openingHours,
        translations: this.formData.openingHoursTranslations,
      },
      {
        source: this.formData.ticketInfo,
        translations: this.formData.ticketInfoTranslations,
      },
      ...this.formData.services
        .filter((service) => service.active && service.description?.trim())
        .map((service) => ({
          source: service.description || '',
          translations: service.descriptionTranslations || {},
        })),
    ];

    return isLanguageFullyTranslated(fields, language);
  }

  private setPrimaryLanguage(lang: AppLanguage) {
    const additional = this.formData.activeLanguages.filter((value) => value !== lang);
    this.formData = {
      ...this.formData,
      primaryLanguage: lang,
      activeLanguages: [lang, ...additional],
    };
  }

  private normalizeTranslationMap(
    values: Partial<Record<AppLanguage, string>>,
  ): Partial<Record<AppLanguage, string>> | undefined {
    const source = this.getActiveSourceLanguage();
    const targets = new Set(this.getMuseumTargetLanguages());
    const cleaned: Partial<Record<AppLanguage, string>> = {};

    for (const [langRaw, valueRaw] of Object.entries(values)) {
      const lang = langRaw as AppLanguage;
      const value = String(valueRaw || '').trim();

      if (!value) continue;
      if (lang === source) continue;
      if (!targets.has(lang)) continue;

      cleaned[lang] = value;
    }

    return Object.keys(cleaned).length > 0 ? cleaned : undefined;
  }

  private getLocalizedMuseumName(museum: Museum | null): string {
    if (!museum) return '';

    const currentLanguage = i18nService.getLanguage();
    if (currentLanguage === 'it') {
      return museum.name;
    }

    return museum.nameTranslations?.[currentLanguage] || museum.name;
  }

  private async translateMissingMuseumFields() {
    const sourceLanguage = this.getActiveSourceLanguage();
    const targets = this.getMuseumTargetLanguages();

    if (targets.length === 0) {
      this.error = __('Seleziona almeno una lingua aggiuntiva per tradurre');
      return;
    }

    const batchItems: Array<{ key: string; text: string; targetLang: AppLanguage }> = [];
    const translatableServices = this.formData.services.filter(
      (service) => service.active && service.description?.trim(),
    );

    for (const lang of targets) {
      if (this.formData.name.trim() && !this.formData.nameTranslations[lang]?.trim()) {
        batchItems.push({ key: `${lang}:name`, text: this.formData.name, targetLang: lang });
      }
      if (
        this.formData.description.trim() &&
        !this.formData.descriptionTranslations[lang]?.trim()
      ) {
        batchItems.push({
          key: `${lang}:description`,
          text: this.formData.description,
          targetLang: lang,
        });
      }
      if (
        this.formData.openingHours.trim() &&
        !this.formData.openingHoursTranslations[lang]?.trim()
      ) {
        batchItems.push({
          key: `${lang}:openingHours`,
          text: this.formData.openingHours,
          targetLang: lang,
        });
      }
      if (this.formData.ticketInfo.trim() && !this.formData.ticketInfoTranslations[lang]?.trim()) {
        batchItems.push({
          key: `${lang}:ticketInfo`,
          text: this.formData.ticketInfo,
          targetLang: lang,
        });
      }
      for (const service of translatableServices) {
        if (!service.descriptionTranslations?.[lang]?.trim()) {
          batchItems.push({
            key: `${lang}:service:${service.type}`,
            text: service.description as string,
            targetLang: lang,
          });
        }
      }
    }

    if (batchItems.length === 0) {
      this.success = __('Le traduzioni del museo sono già complete');
      return;
    }

    this.translatingMuseumFields = true;
    this.error = '';

    try {
      const translations = await translationService.translateBatch(sourceLanguage, batchItems);

      const nextNameTranslations = { ...this.formData.nameTranslations };
      const nextDescriptionTranslations = { ...this.formData.descriptionTranslations };
      const nextOpeningHoursTranslations = { ...this.formData.openingHoursTranslations };
      const nextTicketInfoTranslations = { ...this.formData.ticketInfoTranslations };
      const nextServices = this.formData.services.map((service) => ({ ...service }));

      for (const lang of targets) {
        const nameKey = `${lang}:name`;
        const descriptionKey = `${lang}:description`;
        const openingHoursKey = `${lang}:openingHours`;
        const ticketInfoKey = `${lang}:ticketInfo`;

        if (translations[nameKey]) {
          nextNameTranslations[lang] = translations[nameKey];
        }
        if (translations[descriptionKey]) {
          nextDescriptionTranslations[lang] = translations[descriptionKey];
        }
        if (translations[openingHoursKey]) {
          nextOpeningHoursTranslations[lang] = translations[openingHoursKey];
        }
        if (translations[ticketInfoKey]) {
          nextTicketInfoTranslations[lang] = translations[ticketInfoKey];
        }
        for (const service of nextServices) {
          const serviceKey = `${lang}:service:${service.type}`;
          if (translations[serviceKey]) {
            service.descriptionTranslations = {
              ...service.descriptionTranslations,
              [lang]: translations[serviceKey],
            };
          }
        }
      }

      this.formData = {
        ...this.formData,
        nameTranslations: nextNameTranslations,
        descriptionTranslations: nextDescriptionTranslations,
        openingHoursTranslations: nextOpeningHoursTranslations,
        ticketInfoTranslations: nextTicketInfoTranslations,
        services: nextServices,
      };

      this.success = __('Traduzioni del museo generate con successo');
    } catch {
      this.error = __('Traduzione automatica non riuscita');
    } finally {
      this.translatingMuseumFields = false;
    }
  }

  // ─── Configurazioni Navigator (CRUD via /api/navigator-configs) ────
  private openNewNavigatorConfig() {
    this.editingNavigatorConfig = this.getEmptyNavigatorConfigFormData();
    this.navigatorConfigTranslationLanguage = null;
    this.error = '';
    this.success = '';
  }

  private openEditNavigatorConfig(config: NavigatorConfigFormData) {
    this.editingNavigatorConfig = { ...config };
    this.navigatorConfigTranslationLanguage = null;
    this.error = '';
    this.success = '';
  }

  private cancelEditNavigatorConfig() {
    this.editingNavigatorConfig = null;
  }

  private updateEditingNavigatorConfig(patch: Partial<NavigatorConfigFormData>) {
    if (!this.editingNavigatorConfig) return;
    this.editingNavigatorConfig = { ...this.editingNavigatorConfig, ...patch };
  }

  private updateEditingNavigatorTranslationField(
    field: NavigatorTranslationFieldKey,
    language: AppLanguage,
    value: string,
  ) {
    if (!this.editingNavigatorConfig) return;
    const [updated] = updateNavigatorConfigTranslationField(
      [this.editingNavigatorConfig],
      this.editingNavigatorConfig.id,
      field,
      language,
      value,
    );
    this.editingNavigatorConfig = updated;
  }

  private async translateMissingNavigatorFields() {
    const config = this.editingNavigatorConfig;
    if (!config) return;

    const sourceLanguage = this.getActiveSourceLanguage();
    const targets = this.getMuseumTargetLanguages();

    if (targets.length === 0) {
      this.error = __('Seleziona almeno una lingua aggiuntiva per tradurre il navigator');
      return;
    }

    this.translatingNavigatorConfig = true;
    this.error = '';

    try {
      const patch = await computeNavigatorMissingTranslations(config, sourceLanguage, targets);
      if (!patch) {
        this.success = __('Le traduzioni navigator sono già complete');
        return;
      }

      this.editingNavigatorConfig = { ...config, ...patch };
      this.success = __('Traduzioni navigator generate con successo');
    } catch {
      this.error = __('Traduzione automatica non riuscita');
    } finally {
      this.translatingNavigatorConfig = false;
    }
  }

  private validateNavigatorConfigBeforeSave(): string | null {
    const config = this.editingNavigatorConfig;
    if (!config) return __('Nessuna configurazione da salvare');

    if (!config.name.trim()) return __('Il nome è obbligatorio');

    const slug = sanitizeSlug(config.slug);
    if (!slug || !SLUG_REGEX.test(slug)) return __('Slug non valido');

    if (!config.manifestName.trim() || !config.shortName.trim()) {
      return __('Nome manifest e nome breve manifest sono obbligatori');
    }

    const colors = [
      config.primaryColor,
      config.themeColor,
      config.backgroundColor,
      config.secondaryColor,
      config.appBackgroundColor,
    ].filter(Boolean);

    for (const color of colors) {
      if (!HEX_COLOR_REGEX.test(color.trim())) {
        return `${__('Colore non valido')}. ${__('Usa formato HEX (es. #0ea5e9)')}`;
      }
    }

    return null;
  }

  private toNavigatorConfigPayload(): CreateNavigatorConfigData {
    const config = this.editingNavigatorConfig!;
    return {
      name: config.name,
      slug: sanitizeSlug(config.slug),
      applicability: 'museum',
      museumId: this.selectedMuseumId,
      branding: {
        logo: config.logo || undefined,
        splashImage: config.splashImage || undefined,
        primaryColor: config.primaryColor,
        secondaryColor: config.secondaryColor || undefined,
        backgroundColor: config.appBackgroundColor || undefined,
        displayFont: (config.displayFont ||
          undefined) as CreateNavigatorConfigData['branding']['displayFont'],
        bodyFont: (config.bodyFont ||
          undefined) as CreateNavigatorConfigData['branding']['bodyFont'],
      },
      content: {
        homeTitle: config.homeTitle || undefined,
        homeTitleTranslations: this.normalizeTranslationMap(config.homeTitleTranslations),
        homeSubtitle: config.homeSubtitle || undefined,
        homeSubtitleTranslations: this.normalizeTranslationMap(config.homeSubtitleTranslations),
        welcomeText: config.welcomeText || undefined,
        welcomeTextTranslations: this.normalizeTranslationMap(config.welcomeTextTranslations),
        openingImage: config.openingImage || undefined,
      },
      pwa: {
        manifestName: config.manifestName,
        shortName: config.shortName,
        description: config.manifestDescription || undefined,
        descriptionTranslations: this.normalizeTranslationMap(
          config.manifestDescriptionTranslations,
        ),
        themeColor: config.themeColor,
        backgroundColor: config.backgroundColor,
        display: config.display,
        orientation: config.orientation,
        startUrl: config.startUrl || '/',
        scope: config.scope || '/',
        icon192: config.icon192 || undefined,
        icon512: config.icon512 || undefined,
        iconMaskable: config.iconMaskable || undefined,
        appleTouchIcon: config.appleTouchIcon || undefined,
      },
    };
  }

  private async saveNavigatorConfig() {
    this.error = '';
    this.success = '';

    const validationError = this.validateNavigatorConfigBeforeSave();
    if (validationError) {
      this.error = validationError;
      return;
    }

    this.savingNavigatorConfig = true;
    try {
      const payload = this.toNavigatorConfigPayload();
      const isNew = !this.editingNavigatorConfig!.id;
      // applicability/museumId sono immutabili dopo la creazione: in update
      // non vanno inviati (UpdateNavigatorConfigData non li accetta nemmeno).
      const result = isNew
        ? await navigatorConfigService.create(payload)
        : await navigatorConfigService.update(this.editingNavigatorConfig!.id, {
            name: payload.name,
            slug: payload.slug,
            branding: payload.branding,
            content: payload.content,
            pwa: payload.pwa,
          });

      if (result.error || !result.data) {
        this.error = result.error || __('Errore durante il salvataggio della configurazione');
      } else {
        this.success = __('Configurazione salvata con successo');
        this.editingNavigatorConfig = null;
        await this.loadNavigatorConfigs();
      }
    } finally {
      this.savingNavigatorConfig = false;
    }
  }

  private async deleteNavigatorConfig(config: NavigatorConfigFormData) {
    const confirmed = await modalService.confirm({
      title: __('Elimina configurazione'),
      message: `${__('Sei sicuro di voler eliminare la configurazione')} "${config.name}"? ${__('Questa azione è irreversibile.')}`,
      confirmLabel: __('Elimina'),
      variant: 'danger',
    });
    if (!confirmed) return;

    this.deletingNavigatorConfigId = config.id;
    this.error = '';
    try {
      const result = await navigatorConfigService.delete(config.id);
      if (result.success) {
        this.success = __('Configurazione eliminata con successo');
        if (this.editingNavigatorConfig?.id === config.id) {
          this.editingNavigatorConfig = null;
        }
        await this.loadNavigatorConfigs();
      } else {
        this.error = result.error || __("Errore durante l'eliminazione della configurazione");
      }
    } catch {
      this.error = __("Errore durante l'eliminazione della configurazione");
    } finally {
      this.deletingNavigatorConfigId = null;
    }
  }

  private openNavigatorManifestPreview(config: NavigatorConfigFormData) {
    if (!config.slug) return;
    window.open(
      `/api/navigator-configs/manifest?slug=${encodeURIComponent(config.slug)}`,
      '_blank',
    );
  }

  // Apre l'app Navigator vera e propria con questa config attiva (?ncfg=slug,
  // stesso parametro letto da navigatorConfigStore.ts lato Navigator) — a
  // differenza dell'anteprima manifest, qui si vede davvero l'app.
  private openNavigatorPreview(config: NavigatorConfigFormData) {
    if (!config.slug) return;
    window.open(`/navigator/?ncfg=${encodeURIComponent(config.slug)}`, '_blank');
  }

  private get isAdmin(): boolean {
    return !!this.currentUser?.isAdmin;
  }

  private canEditMuseum(museum: Museum): boolean {
    return isMuseumCurator(this.currentUser, museum._id);
  }

  // ─── Caricamento dati ────────────────────────────────────────
  private async loadMuseums() {
    this.loading = true;
    this.error = '';

    try {
      this.museums = await museumService.getMuseums();
    } catch (e) {
      console.error('Error loading museums:', e);
      this.error = __('Errore nel caricamento dei musei');
    } finally {
      this.loading = false;
    }
  }

  private get filteredMuseums(): Museum[] {
    if (!this.searchQuery) return this.museums;
    const query = this.searchQuery.toLowerCase();
    return this.museums.filter(
      (m) =>
        m.name.toLowerCase().includes(query) ||
        m.location?.city?.toLowerCase().includes(query) ||
        m.description?.toLowerCase().includes(query),
    );
  }

  private get sortedMuseums(): Museum[] {
    const items = [...this.filteredMuseums];
    const multiplier = this.sortDirection === 'asc' ? 1 : -1;

    return items.sort((left, right) => {
      const leftCity = left.location?.city || '';
      const rightCity = right.location?.city || '';
      const leftCountry = left.location?.nation || left.location?.country || '';
      const rightCountry = right.location?.nation || right.location?.country || '';

      let result = 0;
      if (this.sortField === 'name') {
        result = left.name.localeCompare(right.name, 'it', { sensitivity: 'base' });
      } else if (this.sortField === 'city') {
        result = leftCity.localeCompare(rightCity, 'it', { sensitivity: 'base' });
      } else if (this.sortField === 'country') {
        result = leftCountry.localeCompare(rightCountry, 'it', { sensitivity: 'base' });
      } else {
        const leftActive = left.isActive ? 1 : 0;
        const rightActive = right.isActive ? 1 : 0;
        result = leftActive - rightActive;
      }

      if (result === 0) {
        result = left.name.localeCompare(right.name, 'it', { sensitivity: 'base' });
      }

      return result * multiplier;
    });
  }

  private get activeFilterCount(): number {
    return this.searchQuery.trim() ? 1 : 0;
  }

  private hasVisibleColumn(column: string): boolean {
    return this.visibleColumns.includes(column);
  }

  private toggleColumnVisibility(column: string, visible: boolean) {
    if (!visible && this.visibleColumns.length <= 1) {
      return;
    }

    if (visible) {
      this.visibleColumns = [...new Set([...this.visibleColumns, column])];
      return;
    }

    this.visibleColumns = this.visibleColumns.filter((key) => key !== column);
  }

  private resetListControls() {
    this.searchQuery = '';
    this.sortField = 'name';
    this.sortDirection = 'asc';
    this.listLayout = 'grid';
    this.visibleColumns = [...this.defaultVisibleColumns];
  }

  private renderListControlsSummary() {
    return html`
      <ui-badge
        variant=${this.activeFilterCount > 0 ? 'primary' : 'secondary'}
        .label=${`${this.activeFilterCount} ${__('filtri')}`}
      ></ui-badge>
    `;
  }

  private renderListControlsContent() {
    return html`
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <ui-input
          .label=${__('Ricerca')}
          .placeholder=${__('Nome museo, città, descrizione...')}
          .value=${this.searchQuery}
          @input-change=${(e: CustomEvent<{ value: string }>) =>
            (this.searchQuery = e.detail.value)}
        ></ui-input>

        <ui-select
          .label=${__('Ordina per')}
          .value=${this.sortField}
          .options=${this.listSortOptions}
          @select-change=${(e: CustomEvent<{ value: MuseumSortField }>) =>
            (this.sortField = e.detail.value)}
        ></ui-select>

        <ui-select
          .label=${__('Direzione')}
          .value=${this.sortDirection}
          .options=${[
            { value: 'asc', label: __('Crescente') },
            { value: 'desc', label: __('Decrescente') },
          ]}
          @select-change=${(e: CustomEvent<{ value: 'asc' | 'desc' }>) =>
            (this.sortDirection = e.detail.value)}
        ></ui-select>

        <div>
          <p class="text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">
            ${__('Vista')}
          </p>
          <div class="flex items-center gap-2">
            <ui-button
              size="xs"
              .variant=${this.listLayout === 'grid' ? 'primary' : 'secondary'}
              .label=${__('Griglia')}
              @click=${() => (this.listLayout = 'grid')}
            ></ui-button>
            <ui-button
              size="xs"
              .variant=${this.listLayout === 'table' ? 'primary' : 'secondary'}
              .label=${__('Tabella')}
              @click=${() => (this.listLayout = 'table')}
            ></ui-button>
          </div>
        </div>
      </div>

      <div class="space-y-2">
        <p class="text-sm font-medium text-surface-700 dark:text-surface-300">
          ${__('Campi visibili')}
        </p>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
          ${this.listColumnOptions.map(
            (column) => html`
              <label class="flex items-center gap-2 text-sm text-surface-700 dark:text-surface-300">
                <ui-checkbox
                  .checked=${this.visibleColumns.includes(column.key)}
                  @checkbox-change=${(e: CustomEvent<{ checked: boolean }>) =>
                    this.toggleColumnVisibility(column.key, e.detail.checked)}
                ></ui-checkbox>
                <span>${column.label}</span>
              </label>
            `,
          )}
        </div>
      </div>

      <div class="flex items-center gap-2">
        <ui-button
          variant="secondary"
          size="sm"
          .label=${__('Reset')}
          @click=${() => this.resetListControls()}
        ></ui-button>
      </div>
    `;
  }

  private buildTableColumns(): TableColumn[] {
    const columns: TableColumn[] = [];

    if (this.hasVisibleColumn('name')) {
      columns.push({ key: 'name', label: __('Nome') });
    }
    if (this.hasVisibleColumn('city')) {
      columns.push({ key: 'city', label: __('Città') });
    }
    if (this.hasVisibleColumn('country')) {
      columns.push({ key: 'country', label: __('Nazione') });
    }
    if (this.hasVisibleColumn('status')) {
      columns.push({
        key: 'status',
        label: __('Stato'),
        render: (_value, row) => {
          const museum = row.__museum as Museum;
          return museum.isActive
            ? html`<ui-badge variant="success" .label=${__('Attivo')}></ui-badge>`
            : html`<ui-badge variant="secondary" .label=${__('Inattivo')}></ui-badge>`;
        },
      });
    }

    return columns;
  }

  private buildTableRows(items: Museum[]): Record<string, unknown>[] {
    return items.map((museum) => ({
      name: museum.name,
      city: museum.location?.city || '—',
      country: museum.location?.nation || museum.location?.country || '—',
      status: museum.isActive ? __('Attivo') : __('Inattivo'),
      __museum: museum,
    }));
  }

  private buildTableActions(): TableAction[] {
    const actions: TableAction[] = [];

    if (this.isAdmin) {
      actions.push({ icon: 'users', label: __('Gestisci Curatori'), action: 'curators' });
    }

    actions.push({
      icon: 'edit',
      label: __('Modifica'),
      action: 'edit',
      condition: (row) => this.canEditMuseum(row.__museum as Museum),
    });

    if (this.isAdmin) {
      actions.push({ icon: 'trash', label: __('Elimina'), action: 'delete', variant: 'danger' });
    }

    return actions;
  }

  private handleTableAction(e: CustomEvent<{ action: string; row: Record<string, unknown> }>) {
    const museum = e.detail.row.__museum as Museum | undefined;
    if (!museum) return;

    if (e.detail.action === 'edit' && this.canEditMuseum(museum)) {
      this.openEditForm(museum);
    } else if (e.detail.action === 'curators' && this.isAdmin) {
      this.openCuratorsView(museum);
    } else if (e.detail.action === 'delete' && this.isAdmin) {
      this.openDeleteModal(museum);
    }
  }

  private renderTable(items: Museum[]) {
    return html`
      <ui-table
        .columns=${this.buildTableColumns()}
        .data=${this.buildTableRows(items)}
        .actions=${this.buildTableActions()}
        compact
        striped
        @row-action=${this.handleTableAction}
      ></ui-table>
    `;
  }

  // ─── Azioni (modalità / curatori / CRUD) ───────────────────
  private openCreateForm() {
    this.formData = this.getEmptyFormData();
    this.viewMode = 'create';
    this.error = '';
    this.success = '';
  }

  private async loadSelectedMuseumForConfigMode() {
    if (!this.selectedMuseumId) {
      this.viewMode = 'edit';
      this.selectedMuseum = null;
      this.error = __('Seleziona prima un museo dalla dashboard');
      return;
    }

    this.loading = true;
    this.error = '';

    try {
      const museum = await museumService.getMuseum(this.selectedMuseumId);
      if (!museum) {
        this.error = __('Museo non trovato');
        return;
      }

      if (!this.canEditMuseum(museum)) {
        this.error = __('Non hai i permessi per configurare questo museo');
        return;
      }

      this.openEditForm(museum);
    } catch (e) {
      console.error('Error loading museum configuration:', e);
      this.error = __('Errore nel caricamento del museo');
    } finally {
      this.loading = false;
    }
  }

  private openEditForm(museum: Museum) {
    const inferredPrimaryLanguage: AppLanguage =
      museum.activeLanguages && museum.activeLanguages.length > 0
        ? museum.activeLanguages[0]
        : 'it';
    const normalizedActiveLanguages =
      museum.activeLanguages && museum.activeLanguages.length > 0
        ? (Array.from(
            new Set([inferredPrimaryLanguage, ...museum.activeLanguages]),
          ) as AppLanguage[])
        : (['it'] as AppLanguage[]);

    this.selectedMuseum = museum;
    this.rooms = museum.rooms || [];
    this.formData = {
      wikidataId: museum.wikidataId || '',
      name: museum.name,
      description: museum.description || '',
      primaryLanguage: inferredPrimaryLanguage,
      nameTranslations: museum.nameTranslations || {},
      descriptionTranslations: museum.descriptionTranslations || {},
      activeLanguages: normalizedActiveLanguages,
      address: museum.location?.address || '',
      city: museum.location?.city || '',
      nation: museum.location?.nation || museum.location?.country || 'Italia',
      postalCode: museum.location?.postalCode || '',
      latitude: museum.location?.coordinates?.lat ?? null,
      longitude: museum.location?.coordinates?.lng ?? null,
      website: museum.services?.website || '',
      phone: museum.services?.phone || '',
      email: museum.services?.email || '',
      openingHours: museum.services?.openingHours || '',
      openingHoursTranslations: museum.services?.openingHoursTranslations || {},
      ticketInfo: museum.services?.ticketInfo || '',
      ticketInfoTranslations: museum.services?.ticketInfoTranslations || {},
      coverImage: museum.coverImage || '',
      services: museum.services?.services || [],
    };
    this.viewMode = 'edit';
    this.error = '';
    this.success = '';

    if (this.configMode === 'navigator') {
      this.editingNavigatorConfig = null;
      void this.loadNavigatorConfigs();
    }
  }

  private toggleActiveLanguage(lang: AppLanguage, checked: boolean) {
    if (lang === this.formData.primaryLanguage) {
      return;
    }

    const current = new Set(this.formData.activeLanguages);

    if (checked) {
      current.add(lang);
    } else {
      current.delete(lang);
    }

    const next = Array.from(current).filter((value) => value !== this.formData.primaryLanguage);
    this.formData = {
      ...this.formData,
      activeLanguages: [this.formData.primaryLanguage, ...next],
    };
  }

  // Marker di tutti i piani del museo in modifica — per collegare un
  // servizio a un punto già piazzato in Piantina e mappa.
  private get museumMarkers(): MapMarker[] {
    return (this.selectedMuseum?.floors || []).flatMap((floor) => floor.markers || []);
  }

  private markerOptionsForType(type: MarkerType): Array<{ value: string; label: string }> {
    const matches = this.museumMarkers.filter((marker) => marker.type === type);
    return [
      { value: '', label: __('Nessuno') },
      ...matches.map((marker) => ({
        value: marker.id,
        label: marker.label || MARKER_TYPE_META[type].label,
      })),
    ];
  }

  private getService(type: MarkerType): MuseumService {
    return (
      this.formData.services.find((service) => service.type === type) || { type, active: false }
    );
  }

  private updateService(type: MarkerType, patch: Partial<MuseumService>) {
    const updated = { ...this.getService(type), ...patch };
    const others = this.formData.services.filter((service) => service.type !== type);
    this.formData = { ...this.formData, services: [...others, updated] };
  }

  private async syncMuseumLanguages() {
    if (!this.selectedMuseum) {
      this.error = __('Seleziona prima un museo da modificare');
      return;
    }

    this.syncingLanguages = true;
    this.error = '';
    this.success = '';

    try {
      const result = await museumService.syncMuseumLanguages(
        this.selectedMuseum._id,
        this.formData.activeLanguages,
      );

      if (!result.data) {
        this.error = result.error || __('Errore durante sincronizzazione lingue');
        return;
      }

      this.success = __("Sincronizzazione lingue avviata: segui l'avanzamento dalle notifiche.");
      await jobsService.refresh();

      await this.loadMuseums();
      const refreshed = await museumService.getMuseum(this.selectedMuseum._id);
      if (refreshed) {
        this.openEditForm(refreshed);
      }
    } finally {
      this.syncingLanguages = false;
    }
  }

  private async generateMuseumAudio() {
    if (!this.selectedMuseum) {
      this.error = __('Seleziona prima un museo da modificare');
      return;
    }

    this.generatingAudio = true;
    this.error = '';
    this.success = '';

    try {
      const result = await museumService.generateMuseumAudio(this.selectedMuseum._id);

      if (!result.data) {
        this.error = result.error || __("Errore durante la generazione dell'audio");
        return;
      }

      this.success = __("Generazione audio avviata: segui l'avanzamento dalle notifiche.");
      await jobsService.refresh();
    } finally {
      this.generatingAudio = false;
    }
  }

  private async openCuratorsView(museum: Museum) {
    this.selectedMuseum = museum;
    this.viewMode = 'curators';
    this.error = '';
    this.success = '';
    await this.loadCurators(museum._id);
    await this.loadAvailableUsers();
  }

  private async loadCurators(museumId: string) {
    this.loadingCurators = true;
    try {
      this.curators = await museumService.getCurators(museumId);
    } catch (e) {
      console.error('Error loading curators:', e);
      this.error = __('Errore nel caricamento dei curatori');
    } finally {
      this.loadingCurators = false;
    }
  }

  private async loadAvailableUsers() {
    this.loadingUsers = true;
    try {
      const response = await userService.getUsers({ limit: 100, isActive: true });
      // Esclude gli utenti già curatori
      const curatorIds = new Set(this.curators.map((c) => c._id));
      this.availableUsers = response.users.filter((u) => !curatorIds.has(u._id));
    } catch (e) {
      console.error('Error loading users:', e);
    } finally {
      this.loadingUsers = false;
    }
  }

  private async handleAddCurator() {
    if (!this.selectedUserId || !this.selectedMuseum) return;

    this.addingCurator = true;
    this.error = '';

    try {
      const result = await museumService.addCurator(this.selectedMuseum._id, this.selectedUserId);
      if (result.success) {
        this.success = __('Curatore aggiunto con successo');
        this.selectedUserId = '';
        await this.loadCurators(this.selectedMuseum._id);
        await this.loadAvailableUsers();
      } else {
        this.error = result.error || "Errore durante l'aggiunta del curatore";
      }
    } catch {
      this.error = __("Errore durante l'aggiunta del curatore");
    } finally {
      this.addingCurator = false;
    }
  }

  private async handleRemoveCurator(userId: string) {
    if (!this.selectedMuseum) return;

    this.removingCuratorId = userId;
    this.error = '';

    try {
      const result = await museumService.removeCurator(this.selectedMuseum._id, userId);
      if (result.success) {
        this.success = __('Curatore rimosso con successo');
        await this.loadCurators(this.selectedMuseum._id);
        await this.loadAvailableUsers();
      } else {
        this.error = result.error || 'Errore durante la rimozione del curatore';
      }
    } catch {
      this.error = __('Errore durante la rimozione del curatore');
    } finally {
      this.removingCuratorId = null;
    }
  }

  private backToList() {
    if (this.configMode !== 'full') {
      this.dispatchEvent(
        new CustomEvent('navigate', {
          detail: { route: 'dashboard' },
          bubbles: true,
          composed: true,
        }),
      );
      return;
    }

    this.viewMode = 'list';
    this.selectedMuseum = null;
    this.error = '';
    this.success = '';
  }

  private async handleSubmit(e: Event) {
    e.preventDefault();
    this.error = '';

    // Validazione: wikidataId è obbligatorio per i nuovi musei
    if (this.viewMode === 'create' && !this.formData.wikidataId) {
      this.error = __('Seleziona un museo da Wikidata prima di continuare');
      return;
    }

    this.saving = true;

    try {
      const normalizedActiveLanguages =
        this.formData.activeLanguages.length > 0
          ? Array.from(
              new Set([
                this.formData.primaryLanguage,
                ...this.formData.activeLanguages.filter(
                  (lang) => lang !== this.formData.primaryLanguage,
                ),
              ]),
            )
          : (['it'] as AppLanguage[]);

      const data: CreateMuseumData = {
        wikidataId: this.formData.wikidataId,
        name: this.formData.name,
        description: this.formData.description,
        nameTranslations: this.normalizeTranslationMap(this.formData.nameTranslations),
        descriptionTranslations: this.normalizeTranslationMap(
          this.formData.descriptionTranslations,
        ),
        activeLanguages: normalizedActiveLanguages,
        location: {
          address: this.formData.address,
          city: this.formData.city,
          nation: this.formData.nation,
          postalCode: this.formData.postalCode || undefined,
          coordinates: this.getCurrentCoordinates() || undefined,
        },
        coverImage: this.formData.coverImage || undefined,
        services: {
          website: this.formData.website || undefined,
          phone: this.formData.phone || undefined,
          email: this.formData.email || undefined,
          openingHours: this.formData.openingHours || undefined,
          openingHoursTranslations: this.normalizeTranslationMap(
            this.formData.openingHoursTranslations,
          ),
          ticketInfo: this.formData.ticketInfo || undefined,
          ticketInfoTranslations: this.normalizeTranslationMap(
            this.formData.ticketInfoTranslations,
          ),
          services: this.formData.services,
        },
      };

      if (this.viewMode === 'create') {
        const result = await museumService.createMuseum(data);
        if (result.data) {
          this.success = __('Museo creato con successo');
          await this.loadMuseums();
          this.backToList();
        } else {
          this.error = result.error || 'Errore durante la creazione';
        }
      } else if (this.viewMode === 'edit' && this.selectedMuseum) {
        const result = await museumService.updateMuseum(this.selectedMuseum._id, data);
        if (result.data) {
          this.success = __('Museo aggiornato con successo');
          await this.loadMuseums();
          this.backToList();
        } else {
          this.error = result.error || "Errore durante l'aggiornamento";
        }
      }
    } catch {
      this.error = __('Errore durante il salvataggio');
    } finally {
      this.saving = false;
    }
  }

  private handleWikidataSelect(e: CustomEvent) {
    const { id, label, description, imageUrl } = e.detail;
    this.formData = {
      ...this.formData,
      wikidataId: id,
      name: label || '',
      description: description || '',
      primaryLanguage: this.formData.primaryLanguage || 'it',
      nameTranslations: {},
      descriptionTranslations: {},
      coverImage: imageUrl || '',
    };
  }

  private openDeleteModal(museum: Museum) {
    this.museumToDelete = museum;
    this.deleteModalOpen = true;
  }

  private closeDeleteModal() {
    this.deleteModalOpen = false;
    this.museumToDelete = null;
  }

  private async confirmDelete() {
    if (!this.museumToDelete) return;

    this.deleting = true;
    this.error = '';

    try {
      const result = await museumService.deleteMuseum(this.museumToDelete._id);
      if (result.success) {
        this.success = __('Museo eliminato con successo');
        await this.loadMuseums();
        this.closeDeleteModal();
      } else {
        this.error = result.error || "Errore durante l'eliminazione";
      }
    } catch {
      this.error = __("Errore durante l'eliminazione");
    } finally {
      this.deleting = false;
    }
  }

  // ─── Helper di render ──────────────────────────────────────
  private renderNavigatorColorField(
    config: NavigatorConfigFormData,
    key: NavigatorColorFieldKey,
    label: string,
    fallback: string,
  ) {
    return renderNavigatorColorField(config, key, label, fallback, (patch) =>
      this.updateEditingNavigatorConfig(patch),
    );
  }

  private updateNavigatorImageField(key: NavigatorImageFieldKey, path: string | undefined) {
    this.updateEditingNavigatorConfig({
      [key]: path || '',
    } as Partial<NavigatorConfigFormData>);
  }

  private renderNavigatorImageEditors(config: NavigatorConfigFormData) {
    return renderNavigatorImageEditors(config, this.navigatorImageEditors, (key, path) =>
      this.updateNavigatorImageField(key, path),
    );
  }

  private renderNavigatorTranslationsForConfig(
    config: NavigatorConfigFormData,
    sourceLanguageLabel: string,
  ) {
    const targetLanguages = this.getMuseumTargetLanguages();
    return renderNavigatorTranslationsSection({
      config,
      sourceLanguageLabel,
      targetLanguages,
      selectedLanguage: this.navigatorConfigTranslationLanguage || targetLanguages[0] || null,
      getLanguageLabel: (lang) =>
        this.languageOptions.find((option) => option.value === lang)?.label || lang.toUpperCase(),
      onSelectLanguage: (lang) => {
        this.navigatorConfigTranslationLanguage = lang;
      },
      onUpdateField: (field, lang, value) =>
        this.updateEditingNavigatorTranslationField(field, lang, value),
      emptyTargetsMessage: __(
        'Aggiungi almeno una lingua aggiuntiva nelle Lingue attive del museo per gestire le traduzioni navigator.',
      ),
      // Il Sottotitolo Home non ha effetto per una config di museo (vedi
      // NavigatorConfigFormData/renderNavigatorTranslationsSection).
      showHomeSubtitle: false,
      translateMissing: {
        label: __('Traduci campi navigator mancanti con AI'),
        loading: this.translatingNavigatorConfig,
        disabled: targetLanguages.length === 0,
        onClick: () => this.translateMissingNavigatorFields(),
      },
    });
  }

  // ─── Sale (gestione parallela ai marker) ─────────────────
  private roomLabel(room: MuseumRoom): string {
    return room.subtitle ? `${room.title} — ${room.subtitle}` : room.title;
  }

  private async handleAddRoom() {
    const title = this.newRoomTitle.trim();
    if (!title || !this.selectedMuseum) return;

    this.savingRoom = true;
    this.error = '';
    try {
      const id = `room-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const result = await museumService.createRoom(this.selectedMuseum._id, {
        id,
        title,
        subtitle: this.newRoomSubtitle.trim() || undefined,
      });
      if (result.data) {
        this.rooms = [...this.rooms, result.data];
        this.newRoomTitle = '';
        this.newRoomSubtitle = '';
      } else {
        this.error = result.error || __('Errore durante la creazione della sala');
      }
    } catch {
      this.error = __('Errore di connessione durante la creazione della sala');
    } finally {
      this.savingRoom = false;
    }
  }

  private startRenameRoom(room: MuseumRoom) {
    this.renamingRoomId = room.id;
    this.renameRoomTitle = room.title;
    this.renameRoomSubtitle = room.subtitle || '';
  }

  private cancelRenameRoom() {
    this.renamingRoomId = null;
    this.renameRoomTitle = '';
    this.renameRoomSubtitle = '';
  }

  private async handleRenameRoom(roomId: string) {
    const title = this.renameRoomTitle.trim();
    if (!title || !this.selectedMuseum) return;

    this.savingRoom = true;
    this.error = '';
    try {
      const result = await museumService.renameRoom(
        this.selectedMuseum._id,
        roomId,
        title,
        this.renameRoomSubtitle.trim() || undefined,
      );
      if (result.data) {
        this.rooms = this.rooms.map((r) => (r.id === roomId ? result.data! : r));
        this.cancelRenameRoom();
      } else {
        this.error = result.error || __('Errore durante la modifica della sala');
      }
    } catch {
      this.error = __('Errore di connessione durante la modifica della sala');
    } finally {
      this.savingRoom = false;
    }
  }

  private async handleDeleteRoom(room: MuseumRoom) {
    if (!this.selectedMuseum) return;

    const confirmed = await modalService.confirm({
      title: __('Elimina sala'),
      message: `${__('Sei sicuro di voler eliminare la sala')} "${this.roomLabel(room)}"? ${__('Le opere assegnate resteranno senza sala.')}`,
      confirmLabel: __('Elimina'),
      variant: 'danger',
    });
    if (!confirmed) return;

    try {
      const ok = await museumService.deleteRoom(this.selectedMuseum._id, room.id);
      if (ok) {
        this.rooms = this.rooms.filter((r) => r.id !== room.id);
      } else {
        this.error = __("Errore durante l'eliminazione della sala");
      }
    } catch {
      this.error = __("Errore di connessione durante l'eliminazione della sala");
    }
  }

  private renderRoomsSection() {
    return html`
      <section>
        <h3
          class="text-lg font-semibold text-surface-900 dark:text-white mb-4 flex items-center gap-2"
        >
          <ui-icon name="grid" size="sm" class="text-indigo-500"></ui-icon>
          ${__('Sale')}
        </h3>
        <ui-card padding="none">
          <div class="p-6 space-y-4">
            <p class="text-sm text-surface-500 dark:text-surface-400">
              ${__(
                'Crea qui le sale del museo: un titolo (es. "Sala I") e un sottotitolo facoltativo (es. "Sala del Gladiatore"). Il contorno sulla piantina si disegna dopo, in "Piantina e mappa". Ogni opera va assegnata a una di queste sale.',
              )}
            </p>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
              <ui-input
                .label=${__('Titolo sala')}
                .placeholder=${__('Es. Sala I')}
                .value=${this.newRoomTitle}
                @input-change=${(e: CustomEvent) => (this.newRoomTitle = e.detail.value)}
                @keydown=${(e: KeyboardEvent) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    this.handleAddRoom();
                  }
                }}
              ></ui-input>
              <ui-input
                .label=${__('Sottotitolo (facoltativo)')}
                .placeholder=${__('Es. Sala del Gladiatore')}
                .value=${this.newRoomSubtitle}
                @input-change=${(e: CustomEvent) => (this.newRoomSubtitle = e.detail.value)}
                @keydown=${(e: KeyboardEvent) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    this.handleAddRoom();
                  }
                }}
              ></ui-input>
            </div>
            <div class="flex justify-end">
              <ui-button
                type="button"
                variant="primary"
                icon="plus"
                .label=${__('Aggiungi sala')}
                ?disabled=${!this.newRoomTitle.trim()}
                .loading=${this.savingRoom}
                @click=${this.handleAddRoom}
              ></ui-button>
            </div>

            ${this.rooms.length === 0
              ? html`
                  <p class="text-sm text-surface-400 dark:text-surface-500 italic">
                    ${__('Nessuna sala creata')}
                  </p>
                `
              : html`
                  <ul
                    class="max-h-[28rem] overflow-y-auto divide-y divide-surface-200 dark:divide-surface-700"
                  >
                    ${this.rooms.map(
                      (room) => html`
                        <li class="flex items-center justify-between gap-3 py-2.5">
                          ${this.renamingRoomId === room.id
                            ? html`
                                <div class="flex-1 grid grid-cols-2 gap-2 items-center">
                                  <ui-input
                                    .label=${__('Titolo')}
                                    .value=${this.renameRoomTitle}
                                    @input-change=${(e: CustomEvent) =>
                                      (this.renameRoomTitle = e.detail.value)}
                                  ></ui-input>
                                  <ui-input
                                    .label=${__('Sottotitolo')}
                                    .value=${this.renameRoomSubtitle}
                                    @input-change=${(e: CustomEvent) =>
                                      (this.renameRoomSubtitle = e.detail.value)}
                                  ></ui-input>
                                </div>
                                <ui-icon-button
                                  icon="check"
                                  variant="brand"
                                  .title=${__('Salva')}
                                  .loading=${this.savingRoom}
                                  @click=${() => this.handleRenameRoom(room.id)}
                                ></ui-icon-button>
                                <ui-icon-button
                                  icon="x"
                                  .title=${__('Annulla')}
                                  @click=${this.cancelRenameRoom}
                                ></ui-icon-button>
                              `
                            : html`
                                <div class="min-w-0">
                                  <div class="flex items-center gap-2">
                                    <span class="font-medium text-surface-900 dark:text-white"
                                      >${room.title}</span
                                    >
                                    ${room.polygon && room.polygon.length > 0
                                      ? html`<ui-badge
                                          variant="success"
                                          size="sm"
                                          .label=${__('Contornata')}
                                        ></ui-badge>`
                                      : html`<ui-badge
                                          variant="secondary"
                                          size="sm"
                                          .label=${__('Da contornare')}
                                        ></ui-badge>`}
                                  </div>
                                  ${room.subtitle
                                    ? html`<p
                                        class="text-sm text-surface-500 dark:text-surface-400 truncate m-0"
                                      >
                                        ${room.subtitle}
                                      </p>`
                                    : nothing}
                                </div>
                                <div class="flex items-center gap-1 flex-shrink-0">
                                  <ui-icon-button
                                    icon="edit"
                                    size="sm"
                                    .title=${__('Rinomina')}
                                    @click=${() => this.startRenameRoom(room)}
                                  ></ui-icon-button>
                                  <ui-icon-button
                                    icon="trash"
                                    size="sm"
                                    variant="danger"
                                    .title=${__('Elimina')}
                                    @click=${() => this.handleDeleteRoom(room)}
                                  ></ui-icon-button>
                                </div>
                              `}
                        </li>
                      `,
                    )}
                  </ul>
                `}
          </div>
        </ui-card>
      </section>
    `;
  }

  private renderActiveLanguagesSection() {
    return html`
      <section>
        <h3
          class="text-lg font-semibold text-surface-900 dark:text-white mb-4 flex items-center gap-2"
        >
          <ui-icon name="globe" size="sm" class="text-indigo-500"></ui-icon>
          ${__('Lingue attive')}
        </h3>
        <ui-card padding="none">
          <div class="p-6 space-y-4">
            <ui-select
              .label=${__('Lingua principale del museo')}
              .value=${this.formData.primaryLanguage}
              .options=${this.languageOptions}
              @select-change=${(e: CustomEvent<{ value: AppLanguage }>) =>
                this.setPrimaryLanguage(e.detail.value)}
            ></ui-select>

            <label class="block text-sm font-medium text-surface-700 dark:text-surface-300"
              >${__('Lingue aggiuntive del museo')}</label
            >
            <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
              ${this.languageOptions
                .filter((option) => option.value !== this.formData.primaryLanguage)
                .map(
                  (option) => html`
                    <ui-checkbox
                      .label=${option.label}
                      .checked=${this.formData.activeLanguages.includes(option.value)}
                      @checkbox-change=${(e: CustomEvent) =>
                        this.toggleActiveLanguage(option.value, Boolean(e.detail.checked))}
                    ></ui-checkbox>
                  `,
                )}
            </div>
            <p class="text-xs text-surface-500 dark:text-surface-400">
              ${__(
                'La lingua principale è quella usata per scrivere i contenuti di base. Le lingue aggiuntive saranno usate per traduzioni e contenuti multilingua.',
              )}
            </p>

            ${this.viewMode === 'edit' && this.selectedMuseum
              ? html`
                  <div class="pt-2 border-t border-surface-200 dark:border-surface-700">
                    <h4
                      class="text-xs font-semibold uppercase tracking-wide text-surface-400 dark:text-surface-500"
                    >
                      ${__('Strumenti AI')}
                    </h4>
                    <div class="divide-y divide-surface-100 dark:divide-surface-800">
                      <ai-job-action
                        icon="translate"
                        jobType="sync-languages"
                        .museumId=${this.selectedMuseum._id}
                        .jobs=${this.jobs}
                        .loading=${this.syncingLanguages}
                        .label=${__('Sincronizza traduzioni esistenti')}
                        .description=${__(
                          'Applica le lingue attive ai contenuti e visite già presenti: rimuove traduzioni non richieste e genera con AI quelle mancanti.',
                        )}
                        .confirmTitle=${__('Sincronizzare le traduzioni?')}
                        .confirmMessage=${__(
                          "Applica le lingue attive ai contenuti e visite già presenti: rimuove traduzioni non richieste e genera con AI quelle mancanti. Può richiedere qualche minuto su un catalogo grande — segui l'avanzamento dalle notifiche.",
                        )}
                        @start=${this.syncMuseumLanguages}
                      ></ai-job-action>
                      <ai-job-action
                        icon="sparkles"
                        jobType="generate-audio"
                        .museumId=${this.selectedMuseum._id}
                        .jobs=${this.jobs}
                        .loading=${this.generatingAudio}
                        .label=${__('Genera audio mancante')}
                        .description=${__(
                          "Genera con OpenAI (voce naturale + evidenziazione sincronizzata nel Navigator) l'audio mancante degli item davvero usati nelle visite del museo e delle tappe Info/Indicazioni — non tutto il catalogo, solo ciò che i visitatori ascoltano davvero.",
                        )}
                        .confirmTitle=${__("Generare l'audio mancante?")}
                        .confirmMessage=${__(
                          "Genera con OpenAI l'audio mancante degli item davvero usati nelle visite del museo. Operazione lunga e a pagamento (chiama OpenAI per ogni testo): non rigenera l'audio già presente. Segui l'avanzamento dalle notifiche.",
                        )}
                        @start=${this.generateMuseumAudio}
                      ></ai-job-action>
                    </div>
                  </div>
                `
              : nothing}
          </div>
        </ui-card>
      </section>
    `;
  }

  private renderMuseumTranslationsSection(sourceLanguageLabel: string) {
    const targetLanguages = this.getMuseumTargetLanguages();
    const selectedLanguage = this.museumTranslationLanguage || targetLanguages[0] || null;
    const selectedLanguageLabel = selectedLanguage
      ? this.languageOptions.find((option) => option.value === selectedLanguage)?.label
      : null;
    const translationLanguageOptions = buildTranslationLanguageOptions(
      targetLanguages,
      (lang) =>
        this.languageOptions.find((option) => option.value === lang)?.label || lang.toUpperCase(),
      (lang) => this.isMuseumLanguageFullyTranslated(lang),
      {
        translated: __('Tradotta'),
        toTranslate: __('Da tradurre'),
      },
    );

    return html`
      <section>
        <h3
          class="text-lg font-semibold text-surface-900 dark:text-white mb-4 flex items-center gap-2"
        >
          <ui-icon name="languages" size="sm" class="text-violet-500"></ui-icon>
          ${__('Traduzioni museo')}
        </h3>
        <ui-card padding="none">
          <div
            class="p-6 space-y-5 rounded-lg border border-violet-300 dark:border-violet-700 bg-violet-100/80 dark:bg-violet-900/25"
          >
            <div
              class="flex flex-wrap items-center gap-3 p-3 rounded-lg border border-violet-300 dark:border-violet-700 bg-violet-50 dark:bg-violet-950/30"
            >
              <ui-button
                type="button"
                variant="secondary"
                icon="sparkles"
                .label=${__('Traduci campi mancanti con AI')}
                .loading=${this.translatingMuseumFields}
                .disabled=${this.getMuseumTargetLanguages().length === 0}
                @click=${this.translateMissingMuseumFields}
              ></ui-button>
              <ui-badge
                variant="secondary"
                .label=${`${__('Lingua sorgente')}: ${sourceLanguageLabel}`}
              ></ui-badge>
              <p class="text-xs text-surface-500 dark:text-surface-400">
                ${__(
                  'Compila automaticamente nome, descrizione, orari e biglietti per le lingue aggiuntive non ancora tradotte.',
                )}
              </p>
            </div>

            ${targetLanguages.length === 0
              ? html`<p class="text-sm text-surface-600 dark:text-surface-300">
                  ${__(
                    'Aggiungi almeno una lingua aggiuntiva per inserire o generare traduzioni del museo.',
                  )}
                </p>`
              : nothing}
            ${targetLanguages.length > 0
              ? html`
                  <div class="space-y-3">
                    <ui-select
                      .label=${__('Lingua traduzione')}
                      .value=${selectedLanguage || ''}
                      .options=${translationLanguageOptions}
                      @select-change=${(e: CustomEvent<{ value: AppLanguage }>) =>
                        (this.museumTranslationLanguage = e.detail.value)}
                    ></ui-select>

                    ${selectedLanguage
                      ? html`
                          <div
                            class="p-4 rounded-lg border border-violet-300 dark:border-violet-700 bg-violet-50 dark:bg-violet-950/30 space-y-4"
                          >
                            <h4 class="font-medium text-surface-900 dark:text-white">
                              ${__('Traduzioni in')}
                              ${selectedLanguageLabel || selectedLanguage.toUpperCase()}
                            </h4>

                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <ui-input
                                .label=${__('Nome museo')}
                                .value=${this.formData.nameTranslations[selectedLanguage] || ''}
                                @input-change=${(e: CustomEvent) =>
                                  (this.formData = {
                                    ...this.formData,
                                    nameTranslations: {
                                      ...this.formData.nameTranslations,
                                      [selectedLanguage]: e.detail.value,
                                    },
                                  })}
                              ></ui-input>
                            </div>

                            <ui-textarea
                              .label=${__('Descrizione')}
                              .value=${this.formData.descriptionTranslations[selectedLanguage] ||
                              ''}
                              @textarea-change=${(e: CustomEvent) =>
                                (this.formData = {
                                  ...this.formData,
                                  descriptionTranslations: {
                                    ...this.formData.descriptionTranslations,
                                    [selectedLanguage]: e.detail.value,
                                  },
                                })}
                              rows="3"
                            ></ui-textarea>

                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <ui-textarea
                                .label=${__('Orari di apertura')}
                                .value=${this.formData.openingHoursTranslations[selectedLanguage] ||
                                ''}
                                @textarea-change=${(e: CustomEvent) =>
                                  (this.formData = {
                                    ...this.formData,
                                    openingHoursTranslations: {
                                      ...this.formData.openingHoursTranslations,
                                      [selectedLanguage]: e.detail.value,
                                    },
                                  })}
                                rows="3"
                              ></ui-textarea>

                              <ui-textarea
                                .label=${__('Informazioni biglietti')}
                                .value=${this.formData.ticketInfoTranslations[selectedLanguage] ||
                                ''}
                                @textarea-change=${(e: CustomEvent) =>
                                  (this.formData = {
                                    ...this.formData,
                                    ticketInfoTranslations: {
                                      ...this.formData.ticketInfoTranslations,
                                      [selectedLanguage]: e.detail.value,
                                    },
                                  })}
                                rows="3"
                              ></ui-textarea>
                            </div>

                            ${(() => {
                              const translatableServices = this.formData.services.filter(
                                (service) => service.active && service.description?.trim(),
                              );
                              return translatableServices.length > 0
                                ? html`
                                    <div
                                      class="space-y-3 pt-3 border-t border-violet-300 dark:border-violet-700"
                                    >
                                      <h5
                                        class="text-sm font-medium text-surface-900 dark:text-white"
                                      >
                                        ${__('Servizi del museo')}
                                      </h5>
                                      ${translatableServices.map(
                                        (service) => html`
                                          <ui-textarea
                                            .label=${MARKER_TYPE_META[service.type].label}
                                            .value=${service.descriptionTranslations?.[
                                              selectedLanguage
                                            ] || ''}
                                            @textarea-change=${(e: CustomEvent) =>
                                              this.updateService(service.type, {
                                                descriptionTranslations: {
                                                  ...service.descriptionTranslations,
                                                  [selectedLanguage]: e.detail.value,
                                                },
                                              })}
                                            rows="2"
                                          ></ui-textarea>
                                        `,
                                      )}
                                    </div>
                                  `
                                : nothing;
                            })()}
                          </div>
                        `
                      : nothing}
                  </div>
                `
              : nothing}
          </div>
        </ui-card>
      </section>
    `;
  }

  // ─── Render principale ────────────────────────────────────────
  render() {
    const isFocusedConfigMode = this.configMode !== 'full';

    return html`
      <div class="space-y-6 animate-fade-in">
        ${this.error
          ? html`<ui-alert
              variant="error"
              message=${this.error}
              dismissible
              @dismiss=${() => (this.error = '')}
            ></ui-alert>`
          : nothing}
        ${this.success
          ? html`<ui-alert
              variant="success"
              message=${this.success}
              dismissible
              @dismiss=${() => (this.success = '')}
            ></ui-alert>`
          : nothing}
        ${!isFocusedConfigMode && this.viewMode === 'list' ? this.renderList() : nothing}
        ${this.viewMode === 'create' || this.viewMode === 'edit' ? this.renderForm() : nothing}
        ${this.viewMode === 'curators' ? this.renderCurators() : nothing}

        <!-- Delete Modal -->
        <ui-modal
          .open=${this.deleteModalOpen}
          .title=${__('Elimina Museo')}
          message="Sei sicuro di voler eliminare ${this.museumToDelete
            ?.name}? Questa azione è irreversibile."
          variant="danger"
          .confirmLabel=${__('Elimina')}
          .loading=${this.deleting}
          @confirm=${this.confirmDelete}
          @cancel=${this.closeDeleteModal}
        ></ui-modal>
      </div>
    `;
  }

  // ─── Renderer delle viste ──────────────────────────────────────
  private renderList() {
    const museums = this.sortedMuseums;

    return html`
      <ui-page-header .title=${__('Gestione Musei')} description="">
        ${this.isAdmin
          ? html`
              <ui-button
                slot="actions"
                variant="primary"
                icon="plus"
                .label=${__('Nuovo Museo')}
                @click=${this.openCreateForm}
              ></ui-button>
            `
          : nothing}
      </ui-page-header>

      <ui-list-controls
        .title=${__('Filtri e visualizzazione')}
        .description=${__('Espandi per cercare, ordinare e cambiare layout')}
        .collapsed=${this.controlsCollapsed}
        .renderSummary=${() => this.renderListControlsSummary()}
        .renderContent=${() => this.renderListControlsContent()}
        @collapsed-change=${(e: CustomEvent<{ collapsed: boolean }>) =>
          (this.controlsCollapsed = e.detail.collapsed)}
      ></ui-list-controls>

      <!-- Museums Content -->
      ${this.loading
        ? html`<ui-loading></ui-loading>`
        : museums.length === 0
          ? html`<ui-empty
              .title=${__('Nessun museo trovato')}
              description=${this.searchQuery
                ? __('Prova a modificare la ricerca')
                : __('Crea il primo museo per iniziare')}
              icon="folder"
            ></ui-empty>`
          : this.listLayout === 'grid'
            ? html`
                <ui-data-grid
                  .items=${museums}
                  .columns=${3}
                  .renderItem=${(museum: Museum) => this.renderMuseumCard(museum)}
                ></ui-data-grid>
              `
            : this.renderTable(museums)}
    `;
  }

  private renderMuseumCard(museum: Museum) {
    const canEdit = this.canEditMuseum(museum);
    const imageAttrs = museum.coverImage
      ? uploadService.getResponsiveImageAttrs(museum.coverImage, {
          widths: [480, 768, 1200],
          sizes: '(max-width: 1024px) 50vw, 33vw',
        })
      : null;

    return html`
      <ui-card class="overflow-hidden">
        <!-- Cover Image -->
        <div class="aspect-video bg-surface-100 dark:bg-surface-800 relative">
          ${museum.coverImage
            ? html`<img
                src=${imageAttrs?.src}
                srcset=${ifDefined(imageAttrs?.srcset)}
                sizes=${ifDefined(imageAttrs?.sizes)}
                alt=${museum.name}
                class="w-full h-full object-cover"
              />`
            : html`<div class="w-full h-full flex items-center justify-center">
                <ui-icon name="image" size="xl" class="text-surface-300"></ui-icon>
              </div>`}
        </div>

        <div class="p-4">
          <h3 class="font-semibold text-surface-900 dark:text-white text-lg mb-1">
            ${museum.name}
          </h3>
          ${this.hasVisibleColumn('city') || this.hasVisibleColumn('country')
            ? html`
                <p class="text-sm text-surface-500 dark:text-surface-400 mb-3">
                  ${this.hasVisibleColumn('city') ? museum.location?.city || '' : ''}
                  ${this.hasVisibleColumn('city') && this.hasVisibleColumn('country') ? ', ' : ''}
                  ${this.hasVisibleColumn('country')
                    ? museum.location?.nation || museum.location?.country || ''
                    : ''}
                </p>
              `
            : nothing}

          <div class="flex items-center justify-between">
            <div class="flex gap-1">
              ${canEdit
                ? html`
                    <ui-icon-button
                      icon="edit"
                      .title=${__('Modifica')}
                      @click=${() => this.openEditForm(museum)}
                    ></ui-icon-button>
                  `
                : nothing}
              ${this.isAdmin
                ? html`
                    <ui-icon-button
                      icon="users"
                      .title=${__('Gestisci Curatori')}
                      @click=${() => this.openCuratorsView(museum)}
                    ></ui-icon-button>
                    <ui-icon-button
                      icon="trash"
                      variant="danger"
                      .title=${__('Elimina')}
                      @click=${() => this.openDeleteModal(museum)}
                    ></ui-icon-button>
                  `
                : nothing}
            </div>
            ${this.hasVisibleColumn('status')
              ? museum.isActive
                ? html`<ui-badge variant="success" .label=${__('Attivo')}></ui-badge>`
                : html`<ui-badge variant="secondary" .label=${__('Inattivo')}></ui-badge>`
              : nothing}
          </div>
        </div>
      </ui-card>
    `;
  }

  private renderForm() {
    const isCreate = this.viewMode === 'create';
    const isMuseumOnlyMode = this.configMode === 'museum';
    const isNavigatorOnlyMode = this.configMode === 'navigator';
    const showBaseSections = !isNavigatorOnlyMode;
    const showNavigatorSection = isNavigatorOnlyMode;
    const sourceLanguage = this.getActiveSourceLanguage();
    const sourceLanguageLabel =
      this.languageOptions.find((option) => option.value === sourceLanguage)?.label ||
      sourceLanguage.toUpperCase();
    const localizedMuseumName = this.getLocalizedMuseumName(this.selectedMuseum);
    const formTitle = isCreate
      ? __('Nuovo Museo')
      : isMuseumOnlyMode
        ? `${__('Modifica Museo')} ${localizedMuseumName || ''}`
        : isNavigatorOnlyMode
          ? `${__('Configurazioni Navigator')} - ${localizedMuseumName || ''}`
          : `${__('Modifica')} ${localizedMuseumName}`;
    const formDescription = isCreate
      ? __('Crea un nuovo museo nel sistema')
      : isMuseumOnlyMode
        ? __('Aggiorna dati e servizi del museo selezionato')
        : isNavigatorOnlyMode
          ? __('Gestisci branding, manifest e asset PWA del navigator')
          : __('Modifica le informazioni del museo');

    if (this.loading && this.configMode !== 'full') {
      return html`<ui-loading></ui-loading>`;
    }

    if (this.configMode !== 'full' && !this.selectedMuseum) {
      return html`
        <ui-empty
          .title=${__('Museo non disponibile')}
          .description=${__('Seleziona un museo dalla dashboard per accedere a questa sezione')}
          icon="folder"
        ></ui-empty>
      `;
    }
    const navigatorDisplayOptions = [
      { value: 'standalone', label: __('Standalone') },
      { value: 'fullscreen', label: __('Fullscreen') },
      { value: 'minimal-ui', label: __('Minimal UI') },
      { value: 'browser', label: __('Browser') },
    ];

    const navigatorOrientationOptions = [
      { value: 'portrait', label: __('Portrait') },
      { value: 'landscape', label: __('Landscape') },
      { value: 'natural', label: __('Natural') },
      { value: 'any', label: __('Any') },
    ];

    return html`
      <ui-page-header
        title=${formTitle}
        description=${formDescription}
        ?showBack=${this.configMode === 'full'}
        @back=${this.backToList}
      ></ui-page-header>

      <form @submit=${this.handleSubmit} class="space-y-6">
        <section ?hidden=${!showBaseSections}>
          <h3
            class="text-lg font-semibold text-surface-900 dark:text-white mb-4 flex items-center gap-2"
          >
            <ui-icon name="link" size="sm" class="text-blue-500"></ui-icon>
            ${__('Riferimento Wikidata')}
          </h3>
          <ui-card padding="none">
            <div class="p-6 space-y-4">
              ${isCreate
                ? html`
                    <wikidata-autocomplete
                      .label=${__('Cerca museo su Wikidata')}
                      .placeholder=${__('Cerca il museo su Wikidata...')}
                      searchType="museum"
                      required
                      @wikidata-select=${this.handleWikidataSelect}
                    ></wikidata-autocomplete>
                  `
                : html`
                    <div
                      class="p-3 rounded-lg bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700"
                    >
                      <label
                        class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1"
                        >${__('ID Wikidata')}</label
                      >
                      <div class="flex items-center gap-2">
                        <ui-badge variant="secondary" .label=${this.formData.wikidataId}></ui-badge>
                        <a
                          href="https://www.wikidata.org/wiki/${this.formData.wikidataId}"
                          target="_blank"
                          rel="noopener noreferrer"
                          class="text-sm text-brand-600 dark:text-brand-400 hover:underline"
                        >
                          ${__('Vedi su Wikidata')} →
                        </a>
                        <span class="text-xs text-surface-500">(${__('non modificabile')})</span>
                      </div>
                    </div>
                  `}
              ${this.formData.wikidataId
                ? html`
                    <div
                      class="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg"
                    >
                      <ui-badge variant="outline" .label=${this.formData.wikidataId}></ui-badge>
                      <span class="text-sm text-blue-700 dark:text-blue-300"
                        >${this.formData.name}</span
                      >
                      <a
                        href="https://www.wikidata.org/wiki/${this.formData.wikidataId}"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-sm text-blue-600 dark:text-blue-400 hover:underline ml-auto"
                      >
                        ${__('Vedi su Wikidata')} →
                      </a>
                    </div>
                  `
                : nothing}
            </div>
          </ui-card>
        </section>

        <section ?hidden=${!showBaseSections}>
          <h3
            class="text-lg font-semibold text-surface-900 dark:text-white mb-4 flex items-center gap-2"
          >
            <ui-icon name="image" size="sm" class="text-brand-500"></ui-icon>
            ${__('Informazioni Base')}
          </h3>
          <ui-card padding="none">
            <div class="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ui-input
                .label=${__('Nome *')}
                .placeholder=${__('Nome del museo')}
                .value=${this.formData.name}
                @input-change=${(e: CustomEvent) =>
                  (this.formData = { ...this.formData, name: e.detail.value })}
                required
              ></ui-input>

              <image-editor
                .label=${__('Immagine di copertina')}
                category="museums"
                .value=${this.formData.coverImage}
                maxWidth=${1200}
                maxHeight=${800}
                .maxOutputSizeMb=${3}
                defaultFormat="webp"
                @image-saved=${(e: CustomEvent) => {
                  this.formData = { ...this.formData, coverImage: e.detail.path || '' };
                }}
              ></image-editor>

              <div class="lg:col-span-2">
                <ui-textarea
                  .label=${__('Descrizione')}
                  .placeholder=${__('Descrizione del museo...')}
                  .value=${this.formData.description}
                  @textarea-change=${(e: CustomEvent) =>
                    (this.formData = { ...this.formData, description: e.detail.value })}
                  rows="4"
                ></ui-textarea>
              </div>
            </div>
          </ui-card>
        </section>

        <section ?hidden=${!showBaseSections}>
          <h3
            class="text-lg font-semibold text-surface-900 dark:text-white mb-4 flex items-center gap-2"
          >
            <ui-icon name="location" size="sm" class="text-emerald-500"></ui-icon>
            ${__('Posizione')}
          </h3>
          <ui-card padding="none">
            <div class="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <ui-input
                .label=${__('Indirizzo *')}
                .placeholder=${__('Via...')}
                .value=${this.formData.address}
                @input-change=${(e: CustomEvent) =>
                  this.updateLocationField('address', e.detail.value)}
                required
              ></ui-input>

              <ui-input
                .label=${__('Città *')}
                .placeholder=${__('Città')}
                .value=${this.formData.city}
                @input-change=${(e: CustomEvent) =>
                  this.updateLocationField('city', e.detail.value)}
                required
              ></ui-input>

              <ui-input
                .label=${__('CAP')}
                .placeholder=${__('00000')}
                .value=${this.formData.postalCode}
                @input-change=${(e: CustomEvent) =>
                  this.updateLocationField('postalCode', e.detail.value)}
              ></ui-input>

              <ui-input
                .label=${__('Nazione *')}
                .placeholder=${__('Italia')}
                .value=${this.formData.nation}
                @input-change=${(e: CustomEvent) =>
                  this.updateLocationField('nation', e.detail.value)}
                required
              ></ui-input>

              <div class="md:col-span-2 space-y-2">
                <div
                  id="museum-location-map"
                  class="h-72 rounded-lg border border-surface-200 dark:border-surface-700 overflow-hidden"
                ></div>
                <div
                  class="flex flex-wrap items-center justify-between gap-2 text-xs text-surface-500 dark:text-surface-400"
                >
                  <span>
                    ${this.formData.latitude !== null && this.formData.longitude !== null
                      ? `${__('Coordinate')}: ${this.formData.latitude.toFixed(6)}, ${this.formData.longitude.toFixed(6)}`
                      : __('Inserisci indirizzo, città, CAP e nazione per aggiornare la mappa')}
                  </span>
                  <span>
                    ${this.geocodingLocation
                      ? __('Aggiornamento mappa in corso...')
                      : this.geocodingStatus}
                  </span>
                </div>
              </div>
            </div>
          </ui-card>
        </section>

        <section ?hidden=${!showBaseSections}>
          <h3
            class="text-lg font-semibold text-surface-900 dark:text-white mb-4 flex items-center gap-2"
          >
            <ui-icon name="globe" size="sm" class="text-amber-500"></ui-icon>
            ${__('Contatti e Servizi')}
          </h3>
          <ui-card padding="none">
            <div class="p-6 space-y-4">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ui-input
                  .label=${__('Sito Web')}
                  .placeholder=${__('https://...')}
                  .value=${this.formData.website}
                  @input-change=${(e: CustomEvent) =>
                    (this.formData = { ...this.formData, website: e.detail.value })}
                ></ui-input>
                <ui-input
                  .label=${__('Telefono')}
                  .placeholder=${__('+39...')}
                  .value=${this.formData.phone}
                  @input-change=${(e: CustomEvent) =>
                    (this.formData = { ...this.formData, phone: e.detail.value })}
                ></ui-input>
                <ui-input
                  .label=${__('Email')}
                  type="email"
                  .placeholder=${__('info@museo.it')}
                  .value=${this.formData.email}
                  @input-change=${(e: CustomEvent) =>
                    (this.formData = { ...this.formData, email: e.detail.value })}
                ></ui-input>
              </div>

              <ui-textarea
                .label=${__('Orari di apertura')}
                .placeholder=${__('Lun-Ven: 9-18...')}
                .value=${this.formData.openingHours}
                @textarea-change=${(e: CustomEvent) =>
                  (this.formData = { ...this.formData, openingHours: e.detail.value })}
                rows="3"
              ></ui-textarea>

              <ui-textarea
                .label=${__('Informazioni biglietti')}
                .placeholder=${__('Prezzo intero, ridotto...')}
                .value=${this.formData.ticketInfo}
                @textarea-change=${(e: CustomEvent) =>
                  (this.formData = { ...this.formData, ticketInfo: e.detail.value })}
                rows="3"
              ></ui-textarea>
            </div>
          </ui-card>
        </section>

        <section ?hidden=${!showBaseSections}>
          <h3
            class="text-lg font-semibold text-surface-900 dark:text-white mb-4 flex items-center gap-2"
          >
            <ui-icon name="map-pin" size="sm" class="text-emerald-500"></ui-icon>
            ${__('Servizi del museo')}
          </h3>
          <ui-card padding="none">
            <div class="p-6 space-y-3">
              <p class="text-xs text-surface-500 dark:text-surface-400">
                ${__(
                  'Solo i servizi attivati qui compaiono nel Navigator. Collegali a un punto già inserito in Piantina e mappa per mostrare "Vedi sulla mappa".',
                )}
              </p>
              ${MUSEUM_SERVICE_TYPE_OPTIONS.map((option) => {
                const service = this.getService(option.type);
                return html`
                  <div
                    class="border border-surface-200 dark:border-surface-700 rounded-lg p-4 space-y-3"
                  >
                    <ui-checkbox
                      .label=${`${option.icon} ${option.label}`}
                      .checked=${service.active}
                      @checkbox-change=${(e: CustomEvent) =>
                        this.updateService(option.type, { active: Boolean(e.detail.checked) })}
                    ></ui-checkbox>
                    ${service.active
                      ? html`
                          <ui-textarea
                            .label=${__('Descrizione (opzionale)')}
                            .value=${service.description || ''}
                            rows="2"
                            @textarea-change=${(e: CustomEvent) =>
                              this.updateService(option.type, { description: e.detail.value })}
                          ></ui-textarea>
                          <ui-select
                            .label=${__('Punto sulla mappa (opzionale)')}
                            .value=${service.mapMarkerId || ''}
                            .options=${this.markerOptionsForType(option.type)}
                            @select-change=${(e: CustomEvent<{ value: string }>) =>
                              this.updateService(option.type, {
                                mapMarkerId: e.detail.value || undefined,
                              })}
                          ></ui-select>
                        `
                      : nothing}
                  </div>
                `;
              })}
            </div>
          </ui-card>
        </section>

        <section ?hidden=${!showNavigatorSection}>
          <div class="flex items-center justify-between mb-4">
            <h3
              class="text-lg font-semibold text-surface-900 dark:text-white flex items-center gap-2"
            >
              <ui-icon name="cog" size="sm" class="text-purple-500"></ui-icon>
              ${__('Configurazioni Navigator')}
            </h3>
            ${!this.editingNavigatorConfig
              ? html`<ui-button
                  type="button"
                  variant="secondary"
                  size="sm"
                  icon="plus"
                  .label=${__('Nuova configurazione')}
                  @click=${this.openNewNavigatorConfig}
                ></ui-button>`
              : nothing}
          </div>

          ${this.loadingNavigatorConfigs ? html`<ui-loading></ui-loading>` : nothing}
          ${!this.loadingNavigatorConfigs && !this.editingNavigatorConfig
            ? this.renderNavigatorConfigsList()
            : nothing}
          ${this.editingNavigatorConfig
            ? this.renderNavigatorConfigEditor(
                this.editingNavigatorConfig,
                sourceLanguageLabel,
                navigatorDisplayOptions,
                navigatorOrientationOptions,
              )
            : nothing}
        </section>

        ${showBaseSections ? this.renderActiveLanguagesSection() : nothing}
        ${showBaseSections && !isCreate ? this.renderRoomsSection() : nothing}
        ${showBaseSections ? this.renderMuseumTranslationsSection(sourceLanguageLabel) : nothing}
        ${!isNavigatorOnlyMode
          ? html`
              <div class="flex justify-end gap-3">
                <ui-button
                  variant="secondary"
                  .label=${__('Annulla')}
                  @click=${this.backToList}
                ></ui-button>
                <ui-button
                  type="submit"
                  variant="primary"
                  .label=${isCreate ? __('Crea Museo') : __('Salva Modifiche')}
                  icon="check"
                  .loading=${this.saving}
                ></ui-button>
              </div>
            `
          : nothing}
      </form>
    `;
  }

  // ─── Configurazioni Navigator (lista + editor) ─────────────
  private renderNavigatorConfigsList() {
    if (this.navigatorConfigs.length === 0) {
      return html`<ui-empty
        .title=${__('Nessuna personalizzazione navigator')}
        .description=${__(
          'Questo museo non ha configurazioni navigator personalizzate. Usa "Nuova configurazione" per crearne una.',
        )}
        icon="cog"
      ></ui-empty>`;
    }

    return html`
      <div class="space-y-3">
        ${this.navigatorConfigs.map(
          (config) => html`
            <ui-card padding="none">
              <div class="p-4 flex items-center justify-between gap-3 flex-wrap">
                <div class="flex items-center gap-3 flex-wrap">
                  <span class="font-medium text-surface-900 dark:text-white">${config.name}</span>
                  <ui-badge variant="secondary" .label=${config.slug}></ui-badge>
                </div>
                <div class="flex items-center gap-2">
                  <ui-button
                    type="button"
                    variant="secondary"
                    size="sm"
                    icon="download"
                    .label=${__('Anteprima manifest')}
                    @click=${() => this.openNavigatorManifestPreview(config)}
                  ></ui-button>
                  <ui-button
                    type="button"
                    variant="secondary"
                    size="sm"
                    icon="link"
                    .label=${__('Apri Navigator')}
                    @click=${() => this.openNavigatorPreview(config)}
                  ></ui-button>
                  <ui-icon-button
                    icon="edit"
                    .title=${__('Modifica')}
                    @click=${() => this.openEditNavigatorConfig(config)}
                  ></ui-icon-button>
                  <ui-icon-button
                    icon="trash"
                    variant="danger"
                    .title=${__('Elimina')}
                    .loading=${this.deletingNavigatorConfigId === config.id}
                    @click=${() => this.deleteNavigatorConfig(config)}
                  ></ui-icon-button>
                </div>
              </div>
            </ui-card>
          `,
        )}
      </div>
    `;
  }

  private renderNavigatorConfigEditor(
    config: NavigatorConfigFormData,
    sourceLanguageLabel: string,
    displayOptions: Array<{ value: string; label: string }>,
    orientationOptions: Array<{ value: string; label: string }>,
  ) {
    return html`
      <ui-card padding="none">
        <div class="p-6 space-y-5">
          <div class="flex items-center justify-between">
            <h4 class="font-semibold text-surface-900 dark:text-white">
              ${config.id ? __('Modifica configurazione') : __('Nuova configurazione')}
            </h4>
            <div class="flex items-center gap-2">
              <ui-button
                type="button"
                variant="secondary"
                size="sm"
                icon="download"
                .label=${__('Anteprima manifest')}
                ?disabled=${!config.id}
                @click=${() => this.openNavigatorManifestPreview(config)}
              ></ui-button>
              <ui-button
                type="button"
                variant="secondary"
                size="sm"
                icon="link"
                .label=${__('Apri Navigator')}
                ?disabled=${!config.id}
                @click=${() => this.openNavigatorPreview(config)}
              ></ui-button>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ui-input
              .label=${__('Nome Config *')}
              .value=${config.name}
              @input-change=${(e: CustomEvent) =>
                this.updateEditingNavigatorConfig({ name: e.detail.value })}
              required
            ></ui-input>
            <ui-input
              .label=${__('Slug *')}
              .value=${config.slug}
              @input-change=${(e: CustomEvent) =>
                this.updateEditingNavigatorConfig({ slug: sanitizeSlug(e.detail.value) })}
              required
            ></ui-input>
            <ui-input
              .label=${__('Titolo di benvenuto')}
              .value=${config.homeTitle}
              @input-change=${(e: CustomEvent) =>
                this.updateEditingNavigatorConfig({ homeTitle: e.detail.value })}
            ></ui-input>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ui-input
              .label=${__('Nome manifest *')}
              .value=${config.manifestName}
              @input-change=${(e: CustomEvent) =>
                this.updateEditingNavigatorConfig({ manifestName: e.detail.value })}
              required
            ></ui-input>
            <ui-input
              .label=${__('Nome breve manifest *')}
              .value=${config.shortName}
              @input-change=${(e: CustomEvent) =>
                this.updateEditingNavigatorConfig({ shortName: e.detail.value })}
              required
            ></ui-input>
            ${this.renderNavigatorColorField(
              config,
              'primaryColor',
              __('Colore primario'),
              '#0ea5e9',
            )}
            ${this.renderNavigatorColorField(
              config,
              'secondaryColor',
              __('Colore secondario'),
              '#1f2937',
            )}
            ${this.renderNavigatorColorField(
              config,
              'appBackgroundColor',
              __('Colore sfondo app'),
              '#0b0813',
            )}
            ${this.renderNavigatorColorField(config, 'themeColor', __('Colore tema'), '#0ea5e9')}
            ${this.renderNavigatorColorField(
              config,
              'backgroundColor',
              __('Colore sfondo manifest/splash'),
              '#ffffff',
            )}
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ui-select
              .label=${__('Font titoli')}
              .value=${config.displayFont}
              .options=${NAVIGATOR_FONT_SELECT_OPTIONS}
              placeholder=${__('Predefinito')}
              @select-change=${(e: CustomEvent) =>
                this.updateEditingNavigatorConfig({ displayFont: e.detail.value })}
            ></ui-select>
            <ui-select
              .label=${__('Font testo')}
              .value=${config.bodyFont}
              .options=${NAVIGATOR_FONT_SELECT_OPTIONS}
              placeholder=${__('Predefinito')}
              @select-change=${(e: CustomEvent) =>
                this.updateEditingNavigatorConfig({ bodyFont: e.detail.value })}
            ></ui-select>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ui-select
              .label=${__('Visualizzazione')}
              .value=${config.display}
              .options=${displayOptions}
              @select-change=${(e: CustomEvent) =>
                this.updateEditingNavigatorConfig({
                  display: e.detail.value as NavigatorConfigFormData['display'],
                })}
            ></ui-select>
            <ui-select
              .label=${__('Orientamento')}
              .value=${config.orientation}
              .options=${orientationOptions}
              @select-change=${(e: CustomEvent) =>
                this.updateEditingNavigatorConfig({
                  orientation: e.detail.value as NavigatorConfigFormData['orientation'],
                })}
            ></ui-select>
            <ui-input
              .label=${__('URL iniziale')}
              .value=${config.startUrl}
              @input-change=${(e: CustomEvent) =>
                this.updateEditingNavigatorConfig({ startUrl: e.detail.value || '/' })}
            ></ui-input>
            <ui-input
              .label=${__('Ambito')}
              .value=${config.scope}
              @input-change=${(e: CustomEvent) =>
                this.updateEditingNavigatorConfig({ scope: e.detail.value || '/' })}
            ></ui-input>
          </div>

          <ui-textarea
            .label=${__('Testo di benvenuto')}
            .value=${config.welcomeText}
            @textarea-change=${(e: CustomEvent) =>
              this.updateEditingNavigatorConfig({ welcomeText: e.detail.value })}
            rows="3"
          ></ui-textarea>

          <ui-textarea
            .label=${__('Descrizione manifest')}
            .value=${config.manifestDescription}
            @textarea-change=${(e: CustomEvent) =>
              this.updateEditingNavigatorConfig({ manifestDescription: e.detail.value })}
            rows="2"
          ></ui-textarea>

          ${this.renderNavigatorTranslationsForConfig(config, sourceLanguageLabel)}

          <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
            ${this.renderNavigatorImageEditors(config)}
          </div>

          <div
            class="flex justify-end gap-3 pt-4 border-t border-surface-200 dark:border-surface-700"
          >
            <ui-button
              type="button"
              variant="secondary"
              .label=${__('Annulla')}
              @click=${this.cancelEditNavigatorConfig}
            ></ui-button>
            <ui-button
              type="button"
              variant="primary"
              icon="check"
              .label=${__('Salva configurazione')}
              .loading=${this.savingNavigatorConfig}
              @click=${this.saveNavigatorConfig}
            ></ui-button>
          </div>
        </div>
      </ui-card>
    `;
  }

  private renderCurators() {
    return html`
      <ui-page-header
        title="${__('Curatori')} - ${this.selectedMuseum?.name}"
        .description=${__('Gestisci i curatori che possono modificare questo museo')}
        showBack
        @back=${this.backToList}
      ></ui-page-header>

      <ui-card padding="none">
        <div class="p-6 space-y-6">
          <!-- Add Curator -->
          <ui-section
            .title=${__('Aggiungi Curatore')}
            .description=${__('Assegna un nuovo curatore a questo museo')}
            .renderContent=${() => html`
              <div class="flex gap-3 items-end">
                <div class="flex-1">
                  <ui-select
                    .label=${__('Seleziona utente')}
                    placeholder=${this.loadingUsers ? __('Caricamento...') : __('Scegli un utente')}
                    .value=${this.selectedUserId}
                    .options=${this.availableUsers.map((u) => ({
                      value: u._id,
                      label: `${u.username} (${u.email})`,
                    }))}
                    @select-change=${(e: CustomEvent) => (this.selectedUserId = e.detail.value)}
                    ?disabled=${this.loadingUsers}
                  ></ui-select>
                </div>
                <ui-button
                  variant="primary"
                  .label=${__('Aggiungi')}
                  icon="plus"
                  .loading=${this.addingCurator}
                  ?disabled=${!this.selectedUserId}
                  @click=${() => this.handleAddCurator()}
                ></ui-button>
              </div>
            `}
          ></ui-section>

          <!-- Curators List -->
          <ui-section
            .title=${__('Curatori Attuali')}
            .description=${__('Utenti con permesso di modifica')}
            .renderContent=${() =>
              this.loadingCurators
                ? html`<ui-loading></ui-loading>`
                : this.curators.length === 0
                  ? html`<p class="text-surface-500 text-sm">${__('Nessun curatore assegnato')}</p>`
                  : html`
                      <div class="space-y-3">
                        ${this.curators.map(
                          (curator) => html`
                            <div
                              class="flex items-center justify-between p-3 rounded-lg bg-surface-50 dark:bg-surface-800"
                            >
                              <div class="flex items-center gap-3">
                                <div
                                  class="w-10 h-10 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center"
                                >
                                  <span class="text-brand-700 dark:text-brand-300 font-medium">
                                    ${curator.username.charAt(0).toUpperCase()}
                                  </span>
                                </div>
                                <div>
                                  <p class="font-medium text-surface-900 dark:text-white">
                                    ${curator.username}
                                  </p>
                                  <p class="text-sm text-surface-500">${curator.email}</p>
                                </div>
                              </div>
                              <ui-button
                                variant="ghost"
                                size="sm"
                                .label=${__('Rimuovi')}
                                icon="trash"
                                .loading=${this.removingCuratorId === curator._id}
                                @click=${() => this.handleRemoveCurator(curator._id)}
                              ></ui-button>
                            </div>
                          `,
                        )}
                      </div>
                    `}
          ></ui-section>
        </div>
      </ui-card>
    `;
  }
}
