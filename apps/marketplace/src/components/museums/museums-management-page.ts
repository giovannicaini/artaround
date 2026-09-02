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
import type {
  Museum,
  User,
  CreateMuseumData,
  MuseumCurator,
  MuseumRoom,
  AppLanguage,
} from '@artaround/shared';
import { UserRole, ContextualRole, ResourceType } from '@artaround/shared';
import '../ui/ui-button';
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
  normalizeHexColor,
  isNavigatorConfigLanguageFullyTranslated,
  updateNavigatorConfigTranslationField,
  type NavigatorConfigFormData,
  type NavigatorColorFieldKey,
  type NavigatorTranslationFieldKey,
} from '../../utils/navigator-config';
import 'leaflet/dist/leaflet.css';

type ViewMode = 'list' | 'create' | 'edit' | 'view' | 'curators';
type MuseumListLayout = 'grid' | 'table';
type MuseumSortField = 'name' | 'city' | 'country' | 'status';
type NavigatorImageFieldKey =
  | 'logo'
  | 'splashImage'
  | 'openingImage'
  | 'icon192'
  | 'icon512'
  | 'iconMaskable'
  | 'appleTouchIcon';

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
  navigatorConfigs: NavigatorConfigFormData[];
}

interface NavigatorConfigRaw {
  id: string;
  name: string;
  slug: string;
  branding: {
    logo?: string;
    splashImage?: string;
    primaryColor: string;
    secondaryColor?: string;
  };
  content?: {
    homeTitle?: string;
    homeTitleTranslations?: Partial<Record<AppLanguage, string>>;
    homeSubtitle?: string;
    homeSubtitleTranslations?: Partial<Record<AppLanguage, string>>;
    welcomeText?: string;
    welcomeTextTranslations?: Partial<Record<AppLanguage, string>>;
    openingImage?: string;
  };
  pwa: {
    manifestName: string;
    shortName: string;
    description?: string;
    descriptionTranslations?: Partial<Record<AppLanguage, string>>;
    themeColor: string;
    backgroundColor: string;
    display: NavigatorConfigFormData['display'];
    orientation: NavigatorConfigFormData['orientation'];
    startUrl: string;
    scope: string;
    icon192?: string;
    icon512?: string;
    iconMaskable?: string;
    appleTouchIcon?: string;
  };
}

interface NavigatorImageEditorDefinition {
  key: NavigatorImageFieldKey;
  label: string;
  maxWidth: number;
  maxHeight: number;
  defaultFormat: 'png' | 'webp';
}

@customElement('museums-management-page')
export class MuseumsManagementPage extends LitElement {
  private readonly navigatorImageEditors: NavigatorImageEditorDefinition[] = [
    { key: 'logo', label: __('Logo'), maxWidth: 512, maxHeight: 512, defaultFormat: 'png' },
    {
      key: 'splashImage',
      label: __('Immagine apertura'),
      maxWidth: 1440,
      maxHeight: 2560,
      defaultFormat: 'webp',
    },
    {
      key: 'openingImage',
      label: __('Opening image'),
      maxWidth: 1440,
      maxHeight: 2560,
      defaultFormat: 'webp',
    },
    {
      key: 'icon192',
      label: __('Icon 192x192'),
      maxWidth: 192,
      maxHeight: 192,
      defaultFormat: 'png',
    },
    {
      key: 'icon512',
      label: __('Icon 512x512'),
      maxWidth: 512,
      maxHeight: 512,
      defaultFormat: 'png',
    },
    {
      key: 'iconMaskable',
      label: __('Icon maskable'),
      maxWidth: 512,
      maxHeight: 512,
      defaultFormat: 'png',
    },
    {
      key: 'appleTouchIcon',
      label: __('Apple touch icon'),
      maxWidth: 180,
      maxHeight: 180,
      defaultFormat: 'png',
    },
  ];

  @property({ type: Object }) currentUser: User | null = null;
  @property({ type: String }) selectedMuseumId = '';
  @property({ type: String }) configMode: 'full' | 'museum' | 'navigator' = 'full';

  @state() private viewMode: ViewMode = 'list';
  @state() private museums: Museum[] = [];
  @state() private selectedMuseum: Museum | null = null;
  @state() private loading = true;
  @state() private saving = false;
  @state() private syncingLanguages = false;
  @state() private translatingMuseumFields = false;
  @state() private translatingNavigatorConfigId: string | null = null;
  @state() private error = '';
  @state() private success = '';

  // titolo/sottotitolo qui, il contorno si disegna in Piantina e mappa
  @state() private rooms: MuseumRoom[] = [];
  @state() private newRoomTitle = '';
  @state() private newRoomSubtitle = '';
  @state() private savingRoom = false;
  @state() private renamingRoomId: string | null = null;
  @state() private renameRoomTitle = '';
  @state() private renameRoomSubtitle = '';

  @state() private searchQuery = '';
  @state() private controlsCollapsed = true;
  @state() private listLayout: MuseumListLayout = 'grid';
  @state() private sortField: MuseumSortField = 'name';
  @state() private sortDirection: 'asc' | 'desc' = 'asc';
  @state() private visibleColumns: string[] = ['name', 'city', 'country', 'status'];

  @state() private formData: MuseumFormData = this.getEmptyFormData();

  @state() private deleteModalOpen = false;
  @state() private museumToDelete: Museum | null = null;
  @state() private deleting = false;

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
  @state() private navigatorTranslationLanguageByConfig: Partial<Record<string, AppLanguage>> = {};

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
  }

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
      navigatorConfigs: [this.getEmptyNavigatorConfig(1)],
    };
  }

  private getEmptyNavigatorConfig(index: number): NavigatorConfigFormData {
    return {
      id: `cfg-${Date.now()}-${index}`,
      name: `Navigator ${index}`,
      slug: `navigator-${index}`,
      logo: '',
      splashImage: '',
      primaryColor: '#0ea5e9',
      secondaryColor: '#1f2937',
      homeTitle: '',
      homeTitleTranslations: {},
      homeSubtitle: '',
      homeSubtitleTranslations: {},
      welcomeText: '',
      welcomeTextTranslations: {},
      openingImage: '',
      manifestName: `ArtAround Navigator ${index}`,
      shortName: `AANav ${index}`,
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

  private mapNavigatorConfigsFromMuseum(museum: Museum): NavigatorConfigFormData[] {
    const navigatorConfigs = (museum as Museum & { navigatorConfigs?: NavigatorConfigRaw[] })
      .navigatorConfigs;

    if (!navigatorConfigs || navigatorConfigs.length === 0) {
      return [];
    }

    return navigatorConfigs.map((config) => ({
      id: config.id,
      name: config.name,
      slug: config.slug,
      logo: config.branding.logo || '',
      splashImage: config.branding.splashImage || '',
      primaryColor: config.branding.primaryColor,
      secondaryColor: config.branding.secondaryColor || '',
      homeTitle: config.content?.homeTitle || '',
      homeTitleTranslations: config.content?.homeTitleTranslations || {},
      homeSubtitle: config.content?.homeSubtitle || '',
      homeSubtitleTranslations: config.content?.homeSubtitleTranslations || {},
      welcomeText: config.content?.welcomeText || '',
      welcomeTextTranslations: config.content?.welcomeTextTranslations || {},
      openingImage: config.content?.openingImage || '',
      manifestName: config.pwa.manifestName,
      shortName: config.pwa.shortName,
      manifestDescription: config.pwa.description || '',
      manifestDescriptionTranslations: config.pwa.descriptionTranslations || {},
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
    })) as NavigatorConfigFormData[];
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

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(this.locationMap);
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
      }

      this.formData = {
        ...this.formData,
        nameTranslations: nextNameTranslations,
        descriptionTranslations: nextDescriptionTranslations,
        openingHoursTranslations: nextOpeningHoursTranslations,
        ticketInfoTranslations: nextTicketInfoTranslations,
      };

      this.success = __('Traduzioni del museo generate con successo');
    } catch {
      this.error = __('Traduzione automatica non riuscita');
    } finally {
      this.translatingMuseumFields = false;
    }
  }

  private async translateMissingNavigatorFields(configId: string) {
    const sourceLanguage = this.getActiveSourceLanguage();
    const targets = this.getMuseumTargetLanguages();

    if (targets.length === 0) {
      this.error = __('Seleziona almeno una lingua aggiuntiva per tradurre il navigator');
      return;
    }

    const config = this.formData.navigatorConfigs.find((item) => item.id === configId);
    if (!config) {
      return;
    }

    const batchItems: Array<{ key: string; text: string; targetLang: AppLanguage }> = [];

    for (const lang of targets) {
      if (config.homeTitle.trim() && !config.homeTitleTranslations[lang]?.trim()) {
        batchItems.push({ key: `${lang}:homeTitle`, text: config.homeTitle, targetLang: lang });
      }
      if (config.homeSubtitle.trim() && !config.homeSubtitleTranslations[lang]?.trim()) {
        batchItems.push({
          key: `${lang}:homeSubtitle`,
          text: config.homeSubtitle,
          targetLang: lang,
        });
      }
      if (config.welcomeText.trim() && !config.welcomeTextTranslations[lang]?.trim()) {
        batchItems.push({
          key: `${lang}:welcomeText`,
          text: config.welcomeText,
          targetLang: lang,
        });
      }
      if (
        config.manifestDescription.trim() &&
        !config.manifestDescriptionTranslations[lang]?.trim()
      ) {
        batchItems.push({
          key: `${lang}:manifestDescription`,
          text: config.manifestDescription,
          targetLang: lang,
        });
      }
    }

    if (batchItems.length === 0) {
      this.success = __('Le traduzioni navigator sono già complete');
      return;
    }

    this.translatingNavigatorConfigId = configId;
    this.error = '';

    try {
      const translations = await translationService.translateBatch(sourceLanguage, batchItems);

      const updatedConfigs = this.formData.navigatorConfigs.map((item) => {
        if (item.id !== configId) {
          return item;
        }

        const nextHomeTitleTranslations = { ...item.homeTitleTranslations };
        const nextHomeSubtitleTranslations = { ...item.homeSubtitleTranslations };
        const nextWelcomeTextTranslations = { ...item.welcomeTextTranslations };
        const nextManifestDescriptionTranslations = { ...item.manifestDescriptionTranslations };

        for (const lang of targets) {
          const homeTitleKey = `${lang}:homeTitle`;
          const homeSubtitleKey = `${lang}:homeSubtitle`;
          const welcomeTextKey = `${lang}:welcomeText`;
          const manifestDescriptionKey = `${lang}:manifestDescription`;

          if (translations[homeTitleKey]) {
            nextHomeTitleTranslations[lang] = translations[homeTitleKey];
          }
          if (translations[homeSubtitleKey]) {
            nextHomeSubtitleTranslations[lang] = translations[homeSubtitleKey];
          }
          if (translations[welcomeTextKey]) {
            nextWelcomeTextTranslations[lang] = translations[welcomeTextKey];
          }
          if (translations[manifestDescriptionKey]) {
            nextManifestDescriptionTranslations[lang] = translations[manifestDescriptionKey];
          }
        }

        return {
          ...item,
          homeTitleTranslations: nextHomeTitleTranslations,
          homeSubtitleTranslations: nextHomeSubtitleTranslations,
          welcomeTextTranslations: nextWelcomeTextTranslations,
          manifestDescriptionTranslations: nextManifestDescriptionTranslations,
        };
      });

      this.formData = {
        ...this.formData,
        navigatorConfigs: updatedConfigs,
      };

      this.success = __('Traduzioni navigator generate con successo');
    } catch {
      this.error = __('Traduzione automatica non riuscita');
    } finally {
      this.translatingNavigatorConfigId = null;
    }
  }

  private addNavigatorConfig() {
    const nextIndex = this.formData.navigatorConfigs.length + 1;
    this.formData = {
      ...this.formData,
      navigatorConfigs: [
        ...this.formData.navigatorConfigs,
        this.getEmptyNavigatorConfig(nextIndex),
      ],
    };
  }

  private removeNavigatorConfig(id: string) {
    const remaining = this.formData.navigatorConfigs.filter((config) => config.id !== id);
    this.formData = { ...this.formData, navigatorConfigs: remaining };
    const nextLanguageMap = { ...this.navigatorTranslationLanguageByConfig };
    delete nextLanguageMap[id];
    this.navigatorTranslationLanguageByConfig = nextLanguageMap;
  }

  private updateNavigatorConfig(id: string, patch: Partial<NavigatorConfigFormData>) {
    const updated = this.formData.navigatorConfigs.map((config) => {
      if (config.id !== id) {
        return config;
      }

      return {
        ...config,
        ...patch,
      };
    });

    this.formData = { ...this.formData, navigatorConfigs: updated };
  }

  private updateNavigatorTranslationField(
    configId: string,
    field: NavigatorTranslationFieldKey,
    language: AppLanguage,
    value: string,
  ) {
    const updated = updateNavigatorConfigTranslationField(
      this.formData.navigatorConfigs,
      configId,
      field,
      language,
      value,
    );

    this.formData = { ...this.formData, navigatorConfigs: updated };
  }

  private updateNavigatorColor(
    id: string,
    key: 'primaryColor' | 'secondaryColor' | 'themeColor' | 'backgroundColor',
    value: string,
  ) {
    this.updateNavigatorConfig(id, {
      [key]: value,
    } as Partial<NavigatorConfigFormData>);
  }

  private validateNavigatorConfigsBeforeSubmit(): string | null {
    const configs = this.formData.navigatorConfigs;
    if (!configs.length) {
      return null;
    }

    const slugSet = new Set<string>();

    for (const config of configs) {
      if (!config.id.trim() || !config.name.trim()) {
        return __('Ogni configurazione deve avere ID e nome');
      }

      const slug = sanitizeSlug(config.slug);
      if (!slug || !SLUG_REGEX.test(slug)) {
        return `${__('Slug non valido per')} "${config.name}" (${__('usa solo lettere minuscole, numeri e trattini')})`;
      }

      if (slugSet.has(slug)) {
        return `${__('Slug duplicato')}: ${slug}`;
      }
      slugSet.add(slug);

      if (!config.manifestName.trim() || !config.shortName.trim()) {
        return `${__('Manifest name e short name sono obbligatori per')} "${config.name}"`;
      }

      if (!config.startUrl.trim() || !config.scope.trim()) {
        return `${__('Start URL e scope sono obbligatori per')} "${config.name}"`;
      }

      if (!config.icon192.trim() || !config.icon512.trim()) {
        return `${__('Le icone 192x192 e 512x512 sono obbligatorie per')} "${config.name}"`;
      }

      const colors = [
        { label: __('Colore primario'), value: config.primaryColor },
        { label: __('Colore tema'), value: config.themeColor },
        { label: __('Colore sfondo'), value: config.backgroundColor },
      ];

      if (config.secondaryColor.trim()) {
        colors.push({ label: __('Colore secondario'), value: config.secondaryColor });
      }

      for (const color of colors) {
        if (!HEX_COLOR_REGEX.test(color.value.trim())) {
          return `${color.label} ${__('non valido in')} "${config.name}". ${__('Usa formato HEX (es. #0ea5e9)')}`;
        }
      }
    }

    return null;
  }

  private buildNavigatorManifest(config: NavigatorConfigFormData) {
    const icons = [
      config.icon192
        ? {
            src: config.icon192,
            sizes: '192x192',
            type: 'image/png',
          }
        : null,
      config.icon512
        ? {
            src: config.icon512,
            sizes: '512x512',
            type: 'image/png',
          }
        : null,
      config.iconMaskable
        ? {
            src: config.iconMaskable,
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          }
        : null,
      config.appleTouchIcon
        ? {
            src: config.appleTouchIcon,
            sizes: '180x180',
            type: 'image/png',
          }
        : null,
    ].filter(Boolean);

    return {
      name: config.manifestName,
      short_name: config.shortName,
      description: config.manifestDescription || undefined,
      start_url: config.startUrl,
      scope: config.scope,
      display: config.display,
      orientation: config.orientation,
      theme_color: config.themeColor,
      background_color: config.backgroundColor,
      icons,
    };
  }

  private exportNavigatorManifest(config: NavigatorConfigFormData) {
    const validationError = this.validateNavigatorConfigsBeforeSubmit();
    if (validationError) {
      this.error = validationError;
      return;
    }

    const manifest = this.buildNavigatorManifest(config);
    const blob = new Blob([JSON.stringify(manifest, null, 2)], {
      type: 'application/manifest+json',
    });
    const downloadUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = downloadUrl;
    anchor.download = `${config.slug || 'navigator'}-manifest.webmanifest`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(downloadUrl);
  }

  private get isAdmin(): boolean {
    return this.currentUser?.role === UserRole.ADMIN;
  }

  private canEditMuseum(museum: Museum): boolean {
    if (!this.currentUser) return false;
    if (this.currentUser.role === UserRole.ADMIN) return true;

    return (
      this.currentUser.roleAssignments?.some(
        (assignment) =>
          assignment.resourceType === ResourceType.MUSEUM &&
          assignment.resourceId === museum._id &&
          assignment.role === ContextualRole.MANAGER,
      ) ?? false
    );
  }

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
          @click=${this.resetListControls}
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
      navigatorConfigs: this.mapNavigatorConfigsFromMuseum(museum),
    };
    this.viewMode = 'edit';
    this.error = '';
    this.success = '';
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
        this.error = result.error || 'Errore durante sincronizzazione lingue';
        return;
      }

      this.success = `Sincronizzazione completata. Contenuti: aggiornati ${result.data.items.updated}, traduzioni AI ${result.data.items.generated}, rimosse ${result.data.items.removed}. Visite: aggiornate ${result.data.visits.updated}, traduzioni AI ${result.data.visits.generated}, rimosse ${result.data.visits.removed}.`;

      await this.loadMuseums();
      const refreshed = await museumService.getMuseum(this.selectedMuseum._id);
      if (refreshed) {
        this.openEditForm(refreshed);
      }
    } finally {
      this.syncingLanguages = false;
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

    if (this.viewMode === 'create' && !this.formData.wikidataId) {
      this.error = __('Seleziona un museo da Wikidata prima di continuare');
      return;
    }

    const navigatorValidationError = this.validateNavigatorConfigsBeforeSubmit();
    if (navigatorValidationError) {
      this.error = navigatorValidationError;
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

      const data: CreateMuseumData & { navigatorConfigs?: unknown[] } = {
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
        },
        navigatorConfigs:
          this.formData.navigatorConfigs.length > 0
            ? this.formData.navigatorConfigs.map((config) => ({
                id: config.id,
                name: config.name,
                slug: sanitizeSlug(config.slug),
                branding: {
                  logo: config.logo || undefined,
                  splashImage: config.splashImage || undefined,
                  primaryColor: config.primaryColor,
                  secondaryColor: config.secondaryColor || undefined,
                },
                content: {
                  homeTitle: config.homeTitle || undefined,
                  homeTitleTranslations: this.normalizeTranslationMap(config.homeTitleTranslations),
                  homeSubtitle: config.homeSubtitle || undefined,
                  homeSubtitleTranslations: this.normalizeTranslationMap(
                    config.homeSubtitleTranslations,
                  ),
                  welcomeText: config.welcomeText || undefined,
                  welcomeTextTranslations: this.normalizeTranslationMap(
                    config.welcomeTextTranslations,
                  ),
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
                  startUrl: config.startUrl,
                  scope: config.scope,
                  icon192: config.icon192 || undefined,
                  icon512: config.icon512 || undefined,
                  iconMaskable: config.iconMaskable || undefined,
                  appleTouchIcon: config.appleTouchIcon || undefined,
                },
              }))
            : undefined,
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

  private renderNavigatorColorField(
    config: NavigatorConfigFormData,
    key: NavigatorColorFieldKey,
    label: string,
    fallback: string,
  ) {
    return html`
      <div class="space-y-1.5">
        <label class="block text-sm font-medium text-surface-700 dark:text-surface-300">
          ${label}
        </label>
        <div class="flex items-center gap-2">
          <ui-color-input
            .value=${normalizeHexColor(config[key], fallback)}
            @input-change=${(e: CustomEvent) =>
              this.updateNavigatorColor(config.id, key, e.detail.value)}
          ></ui-color-input>
          <div class="flex-1">
            <ui-input
              .value=${config[key]}
              @input-change=${(e: CustomEvent) =>
                this.updateNavigatorColor(config.id, key, e.detail.value)}
            ></ui-input>
          </div>
        </div>
      </div>
    `;
  }

  private updateNavigatorImageField(
    configId: string,
    key: NavigatorImageFieldKey,
    path: string | undefined,
  ) {
    this.updateNavigatorConfig(configId, {
      [key]: path || '',
    } as Partial<NavigatorConfigFormData>);
  }

  private renderNavigatorImageEditors(config: NavigatorConfigFormData) {
    return this.navigatorImageEditors.map(
      (definition) => html`
        <image-editor
          label=${definition.label}
          category="misc"
          .value=${config[definition.key]}
          maxWidth=${definition.maxWidth}
          maxHeight=${definition.maxHeight}
          defaultFormat=${definition.defaultFormat}
          @image-saved=${(e: CustomEvent) =>
            this.updateNavigatorImageField(config.id, definition.key, e.detail.path)}
        ></image-editor>
      `,
    );
  }

  private renderNavigatorTranslationsForConfig(
    config: NavigatorConfigFormData,
    sourceLanguageLabel: string,
  ) {
    const targetLanguages = this.getMuseumTargetLanguages();
    const selectedLanguage =
      this.navigatorTranslationLanguageByConfig[config.id] || targetLanguages[0] || null;

    const selectedLanguageLabel = selectedLanguage
      ? this.languageOptions.find((option) => option.value === selectedLanguage)?.label
      : null;

    const translationLanguageOptions = buildTranslationLanguageOptions(
      targetLanguages,
      (lang) =>
        this.languageOptions.find((option) => option.value === lang)?.label || lang.toUpperCase(),
      (lang) => isNavigatorConfigLanguageFullyTranslated(config, lang),
      {
        translated: __('Tradotta'),
        toTranslate: __('Da tradurre'),
      },
    );

    return html`
      <div class="pt-4 border-t border-surface-200 dark:border-surface-700">
        <div
          class="space-y-4 rounded-lg border border-violet-300 dark:border-violet-700 bg-violet-100/80 dark:bg-violet-900/25 p-4"
        >
          <div class="flex items-center justify-between flex-wrap gap-2">
            <h5 class="font-medium text-surface-900 dark:text-white">
              ${__('Traduzioni navigator')}
            </h5>
            <div class="flex items-center gap-2 flex-wrap">
              <ui-badge
                variant="secondary"
                .label=${`${__('Lingua sorgente')}: ${sourceLanguageLabel}`}
              ></ui-badge>
              <ui-button
                type="button"
                variant="secondary"
                size="xs"
                icon="sparkles"
                .label=${__('Traduci campi navigator mancanti con AI')}
                .loading=${this.translatingNavigatorConfigId === config.id}
                .disabled=${targetLanguages.length === 0}
                @click=${() => this.translateMissingNavigatorFields(config.id)}
              ></ui-button>
            </div>
          </div>

          ${targetLanguages.length === 0
            ? html`<p class="text-xs text-surface-500 dark:text-surface-400">
                ${__(
                  'Aggiungi almeno una lingua aggiuntiva nelle Lingue attive del museo per gestire le traduzioni navigator.',
                )}
              </p>`
            : html`
                <div class="space-y-3">
                  <ui-select
                    .label=${__('Lingua traduzione')}
                    .value=${selectedLanguage || ''}
                    .options=${translationLanguageOptions}
                    @select-change=${(e: CustomEvent<{ value: AppLanguage }>) => {
                      this.navigatorTranslationLanguageByConfig = {
                        ...this.navigatorTranslationLanguageByConfig,
                        [config.id]: e.detail.value,
                      };
                    }}
                  ></ui-select>

                  ${selectedLanguage
                    ? html`
                        <div
                          class="p-4 rounded-lg border border-violet-300 dark:border-violet-700 bg-violet-50 dark:bg-violet-950/30 space-y-3"
                        >
                          <h6 class="text-sm font-semibold text-surface-800 dark:text-surface-100">
                            ${__('Traduzioni in')}
                            ${selectedLanguageLabel || selectedLanguage.toUpperCase()}
                          </h6>

                          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <ui-input
                              .label=${__('Titolo Home')}
                              .value=${config.homeTitleTranslations[selectedLanguage] || ''}
                              @input-change=${(e: CustomEvent) =>
                                this.updateNavigatorTranslationField(
                                  config.id,
                                  'homeTitleTranslations',
                                  selectedLanguage,
                                  e.detail.value,
                                )}
                            ></ui-input>

                            <ui-input
                              .label=${__('Sottotitolo Home')}
                              .value=${config.homeSubtitleTranslations[selectedLanguage] || ''}
                              @input-change=${(e: CustomEvent) =>
                                this.updateNavigatorTranslationField(
                                  config.id,
                                  'homeSubtitleTranslations',
                                  selectedLanguage,
                                  e.detail.value,
                                )}
                            ></ui-input>
                          </div>

                          <ui-textarea
                            .label=${__('Testo di benvenuto')}
                            .value=${config.welcomeTextTranslations[selectedLanguage] || ''}
                            @textarea-change=${(e: CustomEvent) =>
                              this.updateNavigatorTranslationField(
                                config.id,
                                'welcomeTextTranslations',
                                selectedLanguage,
                                e.detail.value,
                              )}
                            rows="3"
                          ></ui-textarea>

                          <ui-textarea
                            .label=${__('Descrizione manifest')}
                            .value=${config.manifestDescriptionTranslations[selectedLanguage] || ''}
                            @textarea-change=${(e: CustomEvent) =>
                              this.updateNavigatorTranslationField(
                                config.id,
                                'manifestDescriptionTranslations',
                                selectedLanguage,
                                e.detail.value,
                              )}
                            rows="2"
                          ></ui-textarea>
                        </div>
                      `
                    : nothing}
                </div>
              `}
        </div>
      </div>
    `;
  }

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
                    <ui-button
                      type="button"
                      variant="secondary"
                      icon="sparkles"
                      .label=${__('Sincronizza traduzioni esistenti')}
                      .loading=${this.syncingLanguages}
                      @click=${this.syncMuseumLanguages}
                    ></ui-button>
                    <p class="mt-2 text-xs text-surface-500 dark:text-surface-400">
                      ${__(
                        'Applica le lingue attive ai contenuti e visite già presenti: rimuove traduzioni non richieste e genera con AI quelle mancanti.',
                      )}
                    </p>
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
    const canManageNavigatorConfigs = true;
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

        <section ?hidden=${!showNavigatorSection}>
          <div class="flex items-center justify-between mb-4">
            <h3
              class="text-lg font-semibold text-surface-900 dark:text-white flex items-center gap-2"
            >
              <ui-icon name="cog" size="sm" class="text-purple-500"></ui-icon>
              ${__('Configurazioni Navigator')}
            </h3>
            ${canManageNavigatorConfigs
              ? html`<ui-button
                  type="button"
                  variant="secondary"
                  size="sm"
                  icon="plus"
                  .label=${__('Aggiungi Config')}
                  @click=${this.addNavigatorConfig}
                ></ui-button>`
              : nothing}
          </div>

          ${isNavigatorOnlyMode && this.formData.navigatorConfigs.length === 0
            ? html`<ui-empty
                .title=${__('Nessuna personalizzazione navigator')}
                .description=${__(
                  'Questo museo non ha configurazioni navigator personalizzate. Usa Aggiungi Config per crearne una.',
                )}
                icon="cog"
              ></ui-empty>`
            : nothing}

          <div class="space-y-4" ?hidden=${this.formData.navigatorConfigs.length === 0}>
            ${this.formData.navigatorConfigs.map(
              (config, index) => html`
                <ui-card padding="none">
                  <div class="p-6 space-y-5">
                    <div class="flex items-center justify-between">
                      <h4 class="font-semibold text-surface-900 dark:text-white">
                        Configurazione ${index + 1}
                      </h4>
                      <div class="flex items-center gap-2">
                        <ui-button
                          type="button"
                          variant="secondary"
                          size="sm"
                          icon="download"
                          .label=${__('Esporta manifest')}
                          @click=${() => this.exportNavigatorManifest(config)}
                        ></ui-button>
                        ${canManageNavigatorConfigs
                          ? html`<ui-icon-button
                              icon="trash"
                              variant="danger"
                              .title=${__('Rimuovi configurazione')}
                              @click=${() => this.removeNavigatorConfig(config.id)}
                            ></ui-icon-button>`
                          : nothing}
                      </div>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <ui-input
                        .label=${__('Nome Config *')}
                        .value=${config.name}
                        @input-change=${(e: CustomEvent) =>
                          this.updateNavigatorConfig(config.id, { name: e.detail.value })}
                        required
                      ></ui-input>
                      <ui-input
                        .label=${__('Slug *')}
                        .value=${config.slug}
                        @input-change=${(e: CustomEvent) =>
                          this.updateNavigatorConfig(config.id, {
                            slug: sanitizeSlug(e.detail.value),
                          })}
                        required
                      ></ui-input>
                      <ui-input
                        .label=${__('Titolo Home')}
                        .value=${config.homeTitle}
                        @input-change=${(e: CustomEvent) =>
                          this.updateNavigatorConfig(config.id, { homeTitle: e.detail.value })}
                      ></ui-input>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <ui-input
                        .label=${__('Sottotitolo Home')}
                        .value=${config.homeSubtitle}
                        @input-change=${(e: CustomEvent) =>
                          this.updateNavigatorConfig(config.id, { homeSubtitle: e.detail.value })}
                      ></ui-input>
                      <ui-input
                        .label=${__('Nome manifest *')}
                        .value=${config.manifestName}
                        @input-change=${(e: CustomEvent) =>
                          this.updateNavigatorConfig(config.id, { manifestName: e.detail.value })}
                        required
                      ></ui-input>
                      <ui-input
                        .label=${__('Nome breve manifest *')}
                        .value=${config.shortName}
                        @input-change=${(e: CustomEvent) =>
                          this.updateNavigatorConfig(config.id, { shortName: e.detail.value })}
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
                        'themeColor',
                        __('Colore tema'),
                        '#0ea5e9',
                      )}
                      ${this.renderNavigatorColorField(
                        config,
                        'backgroundColor',
                        __('Colore sfondo'),
                        '#ffffff',
                      )}
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <ui-select
                        .label=${__('Visualizzazione')}
                        .value=${config.display}
                        .options=${navigatorDisplayOptions}
                        @select-change=${(e: CustomEvent) =>
                          this.updateNavigatorConfig(config.id, {
                            display: e.detail.value as NavigatorConfigFormData['display'],
                          })}
                      ></ui-select>
                      <ui-select
                        .label=${__('Orientamento')}
                        .value=${config.orientation}
                        .options=${navigatorOrientationOptions}
                        @select-change=${(e: CustomEvent) =>
                          this.updateNavigatorConfig(config.id, {
                            orientation: e.detail.value as NavigatorConfigFormData['orientation'],
                          })}
                      ></ui-select>
                      <ui-input
                        .label=${__('URL iniziale')}
                        .value=${config.startUrl}
                        @input-change=${(e: CustomEvent) =>
                          this.updateNavigatorConfig(config.id, {
                            startUrl: e.detail.value || '/',
                          })}
                      ></ui-input>
                      <ui-input
                        .label=${__('Ambito')}
                        .value=${config.scope}
                        @input-change=${(e: CustomEvent) =>
                          this.updateNavigatorConfig(config.id, { scope: e.detail.value || '/' })}
                      ></ui-input>
                    </div>

                    <ui-textarea
                      .label=${__('Testo di benvenuto')}
                      .value=${config.welcomeText}
                      @textarea-change=${(e: CustomEvent) =>
                        this.updateNavigatorConfig(config.id, { welcomeText: e.detail.value })}
                      rows="3"
                    ></ui-textarea>

                    <ui-textarea
                      .label=${__('Descrizione manifest')}
                      .value=${config.manifestDescription}
                      @textarea-change=${(e: CustomEvent) =>
                        this.updateNavigatorConfig(config.id, {
                          manifestDescription: e.detail.value,
                        })}
                      rows="2"
                    ></ui-textarea>

                    ${this.renderNavigatorTranslationsForConfig(config, sourceLanguageLabel)}

                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      ${this.renderNavigatorImageEditors(config)}
                    </div>
                  </div>
                </ui-card>
              `,
            )}
          </div>
        </section>

        ${showBaseSections ? this.renderActiveLanguagesSection() : nothing}
        ${showBaseSections ? this.renderMuseumTranslationsSection(sourceLanguageLabel) : nothing}
        ${showBaseSections && !isCreate ? this.renderRoomsSection() : nothing}

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
      </form>
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
                  @click=${this.handleAddCurator}
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
