import { LitElement, html, nothing } from 'lit';
import { customElement, state, property } from 'lit/decorators.js';
import { DeletableMixin, HistorySyncMixin } from '../../base';
import { renderControlsSummaryBadge } from '../../utils/list-controls';
import { renderFeedbackAlerts } from '../../utils/feedback-alerts';
import type { TableColumn, TableAction } from '../ui/ui-table';
import type { CircleMarker as LeafletCircleMarker, Map as LeafletMap } from 'leaflet';
import { museumService } from '../../services/museum.service';
import { uploadService } from '../../services/upload.service';
import { translationService } from '../../services/translation.service';
import { modalService } from '../../services/modal.service';
import { jobsService, type Job } from '../../services/jobs.service';
import type {
  Museum,
  User,
  CreateMuseumData,
  MuseumRoom,
  MuseumService,
  MapMarker,
  MarkerType,
  AppLanguage,
} from '@artaround/shared';
import { MUSEUM_SERVICE_TYPE_OPTIONS, MARKER_TYPE_META } from '@artaround/shared';

import { isMuseumCurator } from '../../services/permissions.service';
import '../ui/ui-button';
import '../ui/ui-form-actions';
import '../ui/ui-view-toggle';
import '../ui/ai-job-action';
import '../ui/ui-panel-section';
import '../ui/ui-icon';
import '../ui/ui-input';
import '../ui/ui-select';
import '../ui/ui-language-select';
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
import '../ui/ui-media-card';
import '../ui/ui-table';
import '../ui/ui-list-controls';
import '../ui/ui-info-tip';
import '../ui/image-editor';
import '../items/wikidata-autocomplete';
import './museum-navigator-configs-panel';
import './museum-curators-page';
import './museum-rooms-panel';
import './museum-languages-panel';
import { type TranslatableService } from './museum-translations-panel';
import './museum-translations-panel';
import { __, i18nService } from '../../services/i18n.service';
import {
  buildTranslationLanguageOptions,
  isLanguageFullyTranslated,
  cleanTranslationMap,
} from '../../utils/translation-fields';
import { getAppLanguageLabel } from '../../utils/language-label';
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
 * Gestione musei: lista e form di modifica/creazione (solo admin crea/elimina).
 */
@customElement('museums-management-page')
export class MuseumsManagementPage extends DeletableMixin(HistorySyncMixin(LitElement)) {
  @property({ type: Object }) currentUser: User | null = null;
  @property({ type: String }) selectedMuseumId = '';
  @property({ type: String }) configMode: 'full' | 'museum' | 'navigator' = 'full';
  // Solo per configMode 'full': quale museo/vista aprire, per la history granulare.
  @property({ type: String }) openingMuseumId = '';
  @property({ type: String }) openingViewMode: ViewMode = 'list';

  @state() private viewMode: ViewMode = 'list';
  @state() private museums: Museum[] = [];
  @state() private selectedMuseum: Museum | null = null;
  @state() private loading = true;
  @state() private saving = false;
  @state() private syncingLanguages = false;
  @state() private generatingAudio = false;
  // Rispecchia jobsService.getJobs() solo per ridisegnare bottone/banner quando un job avanza.
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

  @state() private geocodingLocation = false;
  @state() private geocodingStatus = '';
  @state() private museumTranslationLanguage: AppLanguage | null = null;

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

  // this.jobs (non jobsService.getJobs() diretto) è il motivo per cui Lit ridisegna.
  private handleJobsChanged = (e: Event): void => {
    this.jobs = (e as CustomEvent<Job[]>).detail;
  };

  updated(changedProps: Map<string, unknown>) {
    if (
      (changedProps.has('selectedMuseumId') || changedProps.has('configMode')) &&
      this.configMode !== 'full'
    ) {
      this.loadSelectedMuseumForConfigMode();
    }

    // Solo in modalità 'full' (lista "Gestione Musei"): apertura granulare
    // di un museo per id/vista — stesso schema di artworks-page.ts.
    if (this.configMode === 'full') {
      if (changedProps.has('openingMuseumId') && this.openingMuseumId) {
        void this.loadOpeningMuseum(this.openingMuseumId);
      }
      if (changedProps.has('openingViewMode')) {
        if (this.openingViewMode === 'list') {
          this.selectedMuseum = null;
          this.viewMode = 'list';
        } else if (this.openingViewMode === 'create') {
          this.viewMode = 'create';
        }
        // 'edit'/'curators' li applica loadOpeningMuseum, o mostrerebbero il form con selectedMuseum null.
      }
    }

    if (changedProps.has('viewMode')) {
      window.scrollTo(0, 0);
      this.emitStateChange();
    }

    if (changedProps.has('formData') || changedProps.has('viewMode')) {
      void this.syncLocationMapPreview();
    }
  }

  private async loadOpeningMuseum(museumId: string) {
    try {
      const museum = await museumService.getMuseum(museumId);
      if (!museum) return;

      if (this.openingViewMode === 'curators') {
        void this.openCuratorsView(museum);
      } else {
        this.openEditForm(museum);
      }
    } catch (e) {
      console.error('Error loading museum:', e);
    }
  }

  // Stato granulare (viewMode + museo) verso app-root, per la history —
  // solo in modalità 'full', dove esiste una lista da cui tornare.
  private emitStateChange(): void {
    if (this.configMode !== 'full') return;

    const hasMuseumContext = this.viewMode === 'edit' || this.viewMode === 'curators';
    const museumId = hasMuseumContext ? this.selectedMuseum?._id || this.openingMuseumId || '' : '';
    this.emitPageStateChange({ viewMode: this.viewMode, museumId });
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
    return cleanTranslationMap(
      values,
      this.getActiveSourceLanguage(),
      this.getMuseumTargetLanguages(),
    );
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

        <ui-view-toggle
          .value=${this.listLayout}
          @layout-change=${(e: CustomEvent<{ value: MuseumListLayout }>) => {
            this.listLayout = e.detail.value;
          }}
        ></ui-view-toggle>
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

  private openCuratorsView(museum: Museum) {
    this.selectedMuseum = museum;
    this.viewMode = 'curators';
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
          // Resta sul form dopo il salvataggio: si esce solo con "Indietro"/"Annulla".
          this.success = __('Museo aggiornato con successo');
          await this.loadMuseums();
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
    const { id, label, description, imageUrl, address, postalCode, city, country, coordinates } =
      e.detail;
    this.formData = {
      ...this.formData,
      wikidataId: id,
      name: label || '',
      description: description || '',
      primaryLanguage: this.formData.primaryLanguage || 'it',
      nameTranslations: {},
      descriptionTranslations: {},
      coverImage: imageUrl || '',
      // Da Wikidata solo se assenti in un campo già compilato a mano.
      address: this.formData.address.trim() || address || '',
      city: this.formData.city.trim() || city || '',
      nation: this.formData.nation.trim() || country || '',
      postalCode: this.formData.postalCode.trim() || postalCode || '',
      latitude: coordinates?.lat ?? this.formData.latitude,
      longitude: coordinates?.lng ?? this.formData.longitude,
    };

    // Coordinate già note da Wikidata: niente bisogno di geocodificare
    // dall'indirizzo, altrimenti lo sovrascriverebbe con quelle stimate.
    if (!coordinates && this.hasRequiredLocationForGeocoding()) {
      this.scheduleGeocodeFromLocation();
    }
  }

  private async confirmDelete() {
    const museum = this.entityToDelete as Museum | null;
    if (!museum) return;

    this.deleting = true;
    this.error = '';

    try {
      const result = await museumService.deleteMuseum(museum._id);
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
      <museum-rooms-panel
        .rooms=${this.rooms}
        .newRoomTitle=${this.newRoomTitle}
        .newRoomSubtitle=${this.newRoomSubtitle}
        .savingRoom=${this.savingRoom}
        .renamingRoomId=${this.renamingRoomId}
        .renameRoomTitle=${this.renameRoomTitle}
        .renameRoomSubtitle=${this.renameRoomSubtitle}
        @new-room-title-change=${(e: CustomEvent) => (this.newRoomTitle = e.detail.value)}
        @new-room-subtitle-change=${(e: CustomEvent) => (this.newRoomSubtitle = e.detail.value)}
        @add-room=${() => this.handleAddRoom()}
        @start-rename-room=${(e: CustomEvent) => this.startRenameRoom(e.detail.room)}
        @cancel-rename-room=${() => this.cancelRenameRoom()}
        @rename-room-title-change=${(e: CustomEvent) => (this.renameRoomTitle = e.detail.value)}
        @rename-room-subtitle-change=${(e: CustomEvent) =>
          (this.renameRoomSubtitle = e.detail.value)}
        @rename-room=${(e: CustomEvent) => this.handleRenameRoom(e.detail.roomId)}
        @delete-room=${(e: CustomEvent) => this.handleDeleteRoom(e.detail.room)}
      ></museum-rooms-panel>
    `;
  }

  private renderActiveLanguagesSection() {
    return html`
      <museum-languages-panel
        .primaryLanguage=${this.formData.primaryLanguage}
        .activeLanguages=${this.formData.activeLanguages}
        .showAiTools=${this.viewMode === 'edit' && !!this.selectedMuseum}
        .museumId=${this.selectedMuseum?._id || ''}
        .jobs=${this.jobs}
        .syncingLanguages=${this.syncingLanguages}
        .generatingAudio=${this.generatingAudio}
        @primary-language-change=${(e: CustomEvent) => this.setPrimaryLanguage(e.detail.value)}
        @active-language-toggle=${(e: CustomEvent) =>
          this.toggleActiveLanguage(e.detail.lang, e.detail.checked)}
        @sync-languages=${() => this.syncMuseumLanguages()}
        @generate-audio=${() => this.generateMuseumAudio()}
      ></museum-languages-panel>
    `;
  }

  private renderMuseumTranslationsSection(sourceLanguageLabel: string) {
    const targetLanguages = this.getMuseumTargetLanguages();
    const selectedLanguage = this.museumTranslationLanguage || targetLanguages[0] || null;
    const selectedLanguageLabel = selectedLanguage ? getAppLanguageLabel(selectedLanguage) : null;
    const translationLanguageOptions = buildTranslationLanguageOptions(
      targetLanguages,
      (lang) => getAppLanguageLabel(lang),
      (lang) => this.isMuseumLanguageFullyTranslated(lang),
      {
        translated: __('Tradotta'),
        toTranslate: __('Da tradurre'),
      },
    );
    const translatableServices: TranslatableService[] = selectedLanguage
      ? this.formData.services
          .filter((service) => service.active && service.description?.trim())
          .map((service) => ({
            type: service.type,
            label: MARKER_TYPE_META[service.type].label,
            value: service.descriptionTranslations?.[selectedLanguage] || '',
          }))
      : [];

    return html`
      <museum-translations-panel
        .targetLanguages=${targetLanguages}
        .selectedLanguage=${selectedLanguage}
        .selectedLanguageLabel=${selectedLanguageLabel}
        .languageOptions=${translationLanguageOptions}
        .sourceLanguageLabel=${sourceLanguageLabel}
        .translating=${this.translatingMuseumFields}
        .nameValue=${(selectedLanguage && this.formData.nameTranslations[selectedLanguage]) || ''}
        .descriptionValue=${(selectedLanguage &&
          this.formData.descriptionTranslations[selectedLanguage]) ||
        ''}
        .openingHoursValue=${(selectedLanguage &&
          this.formData.openingHoursTranslations[selectedLanguage]) ||
        ''}
        .ticketInfoValue=${(selectedLanguage &&
          this.formData.ticketInfoTranslations[selectedLanguage]) ||
        ''}
        .translatableServices=${translatableServices}
        @translate-missing=${() => this.translateMissingMuseumFields()}
        @language-change=${(e: CustomEvent) => (this.museumTranslationLanguage = e.detail.value)}
        @field-change=${(e: CustomEvent) => this.handleMuseumTranslationFieldChange(e)}
        @service-translation-change=${(e: CustomEvent) =>
          this.handleServiceTranslationChange(e, selectedLanguage)}
      ></museum-translations-panel>
    `;
  }

  private handleMuseumTranslationFieldChange(
    e: CustomEvent<{
      field: 'name' | 'description' | 'openingHours' | 'ticketInfo';
      value: string;
    }>,
  ) {
    const selectedLanguage = this.museumTranslationLanguage || this.getMuseumTargetLanguages()[0];
    if (!selectedLanguage) return;
    const { field, value } = e.detail;
    const mapKey = `${field}Translations` as
      | 'nameTranslations'
      | 'descriptionTranslations'
      | 'openingHoursTranslations'
      | 'ticketInfoTranslations';
    this.formData = {
      ...this.formData,
      [mapKey]: { ...this.formData[mapKey], [selectedLanguage]: value },
    };
  }

  private handleServiceTranslationChange(
    e: CustomEvent<{ type: MarkerType; value: string }>,
    selectedLanguage: AppLanguage | null,
  ) {
    if (!selectedLanguage) return;
    const { type, value } = e.detail;
    const service = this.getService(type);
    this.updateService(type, {
      descriptionTranslations: { ...service.descriptionTranslations, [selectedLanguage]: value },
    });
  }

  // ─── Render principale ────────────────────────────────────────
  render() {
    const isFocusedConfigMode = this.configMode !== 'full';

    return html`
      <div class="space-y-6 animate-fade-in">
        ${renderFeedbackAlerts({
          error: this.error,
          success: this.success,
          dismissible: true,
          onDismissError: () => (this.error = ''),
          onDismissSuccess: () => (this.success = ''),
        })}
        ${!isFocusedConfigMode && this.viewMode === 'list' ? this.renderList() : nothing}
        ${this.viewMode === 'create' || this.viewMode === 'edit' ? this.renderForm() : nothing}
        ${this.viewMode === 'curators'
          ? html`
              <museum-curators-page
                .museum=${this.selectedMuseum}
                @back=${this.backToList}
              ></museum-curators-page>
            `
          : nothing}
        <ui-modal
          .open=${this.deleteModalOpen}
          .title=${__('Elimina Museo')}
          message="Sei sicuro di voler eliminare ${(this.entityToDelete as Museum | null)
            ?.name}? Questa azione è irreversibile."
          variant="danger"
          .confirmLabel=${__('Elimina')}
          .loading=${this.deleting}
          @confirm=${this.confirmDelete}
          @cancel=${() => this.closeDeleteModal()}
        ></ui-modal>
      </div>
    `;
  }

  // ─── Renderer delle viste ──────────────────────────────────────
  private renderList() {
    const museums = this.sortedMuseums;

    return html`
      <ui-page-header
        .title=${__('Gestione Musei')}
        description=""
        .help=${__(
          'Crea e modifica la scheda di ogni museo: dati generali, sale, servizi, piantine e configurazioni Navigator dedicate. Per assegnare curatori e autori usa "Gestisci Curatori" dalla card del museo.',
        )}
      >
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
        .renderSummary=${() => renderControlsSummaryBadge(this.activeFilterCount)}
        .renderContent=${() => this.renderListControlsContent()}
        @collapsed-change=${(e: CustomEvent<{ collapsed: boolean }>) =>
          (this.controlsCollapsed = e.detail.collapsed)}
      ></ui-list-controls>
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
    const location = [
      this.hasVisibleColumn('city') ? museum.location?.city : '',
      this.hasVisibleColumn('country') ? museum.location?.nation || museum.location?.country : '',
    ]
      .filter(Boolean)
      .join(', ');

    return html`
      <ui-media-card
        .imageSrc=${imageAttrs?.src || ''}
        .imageSrcset=${imageAttrs?.srcset || ''}
        .imageSizes=${imageAttrs?.sizes || ''}
        .imageAlt=${museum.name}
        aspectClass="aspect-video"
        placeholderType="museum"
        placeholderSize="lg"
        bodyClass="p-4"
        .renderTopLeft=${museum.wikidataId
          ? () =>
              html`<a
                href="https://www.wikidata.org/wiki/${museum.wikidataId}"
                target="_blank"
                rel="noopener noreferrer"
                @click=${(e: Event) => e.stopPropagation()}
                title=${__('Vedi su Wikidata')}
              >
                <ui-badge variant="primary" size="sm" .label=${museum.wikidataId}></ui-badge>
              </a>`
          : null}
        .renderTopRight=${this.hasVisibleColumn('status')
          ? () =>
              museum.isActive
                ? html`<ui-badge variant="success" size="sm" .label=${__('Attivo')}></ui-badge>`
                : html`<ui-badge variant="secondary" size="sm" .label=${__('Inattivo')}></ui-badge>`
          : null}
        .renderContent=${() => html`
          <h3 class="font-semibold text-surface-900 dark:text-white mb-1 line-clamp-2">
            ${museum.name}
          </h3>

          ${location
            ? html`<p class="text-sm text-surface-500 dark:text-surface-400 mb-2">${location}</p>`
            : nothing}

          <div
            class="flex items-center justify-end gap-1 pt-3 border-t border-surface-100 dark:border-surface-800"
          >
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
        `}
      ></ui-media-card>
    `;
  }

  private renderForm() {
    const isCreate = this.viewMode === 'create';
    const isMuseumOnlyMode = this.configMode === 'museum';
    const isNavigatorOnlyMode = this.configMode === 'navigator';
    const showBaseSections = !isNavigatorOnlyMode;
    const showNavigatorSection = isNavigatorOnlyMode;
    const sourceLanguage = this.getActiveSourceLanguage();
    const sourceLanguageLabel = getAppLanguageLabel(sourceLanguage);
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
    return html`
      <ui-page-header
        title=${formTitle}
        description=${formDescription}
        ?showBack=${this.configMode === 'full'}
        @back=${this.backToList}
      ></ui-page-header>

      <form @submit=${this.handleSubmit} class="space-y-6">
        <section ?hidden=${!showBaseSections}>
          <ui-panel-section
            icon="link"
            iconColor="text-blue-500"
            cardPadding="lg"
            .title=${__('Riferimento Wikidata')}
            .renderContent=${() => html`
              <div class="space-y-4">
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
                          <ui-badge
                            variant="secondary"
                            .label=${this.formData.wikidataId}
                          ></ui-badge>
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
            `}
          ></ui-panel-section>
        </section>

        <section ?hidden=${!showBaseSections}>
          <ui-panel-section
            icon="image"
            iconColor="text-brand-500"
            cardPadding="lg"
            .title=${__('Informazioni Base')}
            .renderContent=${() => html`
              <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
            `}
          ></ui-panel-section>
        </section>

        <section ?hidden=${!showBaseSections}>
          <ui-panel-section
            icon="location"
            iconColor="text-emerald-500"
            cardPadding="lg"
            .title=${__('Posizione')}
            .help=${__(
              'La mappa qui sotto si aggiorna da sola cercando le coordinate di Indirizzo+Città+CAP+Nazione (geocoding automatico) qualche istante dopo aver smesso di digitare — non serve inserire le coordinate a mano.',
            )}
            .renderContent=${() => html`
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            `}
          ></ui-panel-section>
        </section>

        <section ?hidden=${!showBaseSections}>
          <ui-panel-section
            icon="globe"
            iconColor="text-amber-500"
            cardPadding="lg"
            .title=${__('Contatti e Servizi')}
            .help=${__(
              'Solo informazioni di contatto testuali. Per i servizi mostrati come schede nel Navigator (bagni, bar, uscite...) vedi la sezione "Servizi del museo" qui sotto.',
            )}
            .renderContent=${() => html`
              <div class="space-y-4">
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
            `}
          ></ui-panel-section>
        </section>

        <section ?hidden=${!showBaseSections}>
          <ui-panel-section
            icon="map-pin"
            iconColor="text-emerald-500"
            cardPadding="lg"
            .title=${__('Servizi del museo')}
            .renderContent=${() => html`
              <div class="space-y-3">
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
            `}
          ></ui-panel-section>
        </section>

        <section ?hidden=${!showNavigatorSection}>
          ${showNavigatorSection
            ? html`
                <museum-navigator-configs-panel
                  .museumId=${this.selectedMuseumId}
                  .sourceLanguage=${sourceLanguage}
                  .targetLanguages=${this.getMuseumTargetLanguages()}
                ></museum-navigator-configs-panel>
              `
            : nothing}
        </section>

        ${showBaseSections ? this.renderActiveLanguagesSection() : nothing}
        ${showBaseSections && !isCreate ? this.renderRoomsSection() : nothing}
        ${showBaseSections ? this.renderMuseumTranslationsSection(sourceLanguageLabel) : nothing}
        ${!isNavigatorOnlyMode
          ? html`
              <ui-form-actions
                .submitLabel=${isCreate ? __('Crea Museo') : __('Salva Modifiche')}
                submitIcon="check"
                .loading=${this.saving}
                @cancel=${this.backToList}
              ></ui-form-actions>
            `
          : nothing}
      </form>
    `;
  }
}
