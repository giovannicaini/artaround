import { html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import {
  LANGUAGE_LEVEL_OPTIONS_EMOJI_IT,
  ITEM_REFERENCE_TYPE_OPTIONS_IT,
  VisitStepType,
  ItemReferenceType,
  LanguageLevel,
  LicenseType,
  MarkerType,
  getVisitStepTypeLabel,
  getReferenceTypeLabel,
  type Artwork,
  type Item,
  type CreateVisitData,
  type UpdateVisitData,
  type VisitStep,
  type VisitGeneralInfo,
  type TargetAudience,
  type Museum,
  type MuseumFloor,
  type MapMarker,
  type AppLanguage,
  isSupportedAppLanguage,
} from '@artaround/shared';
import { visitService } from '../../services/visit.service';
import { museumService } from '../../services/museum.service';
import { artworkService } from '../../services/artwork.service';
import { itemService } from '../../services/item.service';
import { translationService } from '../../services/translation.service';
import { jobsService, type Job } from '../../services/jobs.service';
import { modalService } from '../../services/modal.service';
import { __ } from '../../services/i18n.service';
import { MuseumAwareMixin, AppBaseElement } from '../../base';
import '../ui/ui-input';
import '../ui/ui-select';
import '../ui/ui-button';
import '../ui/ui-icon';
import '../ui/ui-card';
import '../ui/ui-textarea';
import '../ui/ui-badge';
import '../ui/ui-image-placeholder';
import '../ui/ui-loading';
import '../ui/ui-alert';
import '../ui/ui-tabs';
import '../ui/ui-checkbox';
import '../ui/ui-icon-button';
import '../ui/ui-tag-input';
import '../ui/ui-panel-section';
import '../ui/ui-info-tip';
import '../ui/ui-language-select';
import '../ui/ui-filter-tabs';
import '../ui/image-editor';
import '../museums/svg-map-editor';

type EditorTab = 'info' | 'steps' | 'map' | 'audience' | 'settings';

// Tipi di riferimento selezionabili per una tappa CONTENT — non ARTWORK,
// che ha la sua tappa dedicata (approfondimento legato a UNA specifica opera).
const CONTENT_STEP_REFERENCE_TYPE_OPTIONS = ITEM_REFERENCE_TYPE_OPTIONS_IT.filter(
  (option) => option.value !== ItemReferenceType.ARTWORK,
);

/**
 * Componente Visit Editor
 *
 * Crea e modifica le visite (percorsi di visita).
 * Una visita è una sequenza ordinata di tappe attraverso un museo.
 */
@customElement('visit-editor')
export class VisitEditor extends MuseumAwareMixin(AppBaseElement) {
  @property({ type: String }) visitId = ''; // For edit mode
  // Tab da cui aprire l'editor (es. tornando da un avanti/indietro del
  // browser su una tab diversa da "info") — vedi emitTabChange().
  @property({ type: String }) openingTab = '';

  @state() private loadingVisit = false;
  @state() private saving = false;
  @state() private translating = false;
  @state() private generatingAudio = false;
  @state() private syncingLanguages = false;
  @state() private isPublished = false;
  @state() private togglingPublish = false;
  // Rispecchia jobsService.getJobs() (vedi handleJobsChanged) — solo per far
  // ridisegnare i blocchi "Strumenti AI" (audio, traduzioni) nelle Impostazioni.
  @state() private jobs: Job[] = jobsService.getJobs();
  @state() private error = '';
  @state() private success = '';
  @state() private museums: Museum[] = [];
  @state() private loadingMuseums = true;
  @state() private activeTab: EditorTab = 'info';
  // La primissima emissione di activeTab (il default 'info' o il tab
  // ripristinato da openingTab) corregge solo l'URL corrente (replace); da lì
  // in poi ogni cambio è un vero passo di history — vedi updated().
  private hasEmittedTabOnce = false;
  @state() private activeLanguages: AppLanguage[] = ['it'];

  // Basic info
  @state() private visitTitle = '';
  @state() private description = '';
  @state() private coverImage = '';
  @state() private museumId = '';

  // Steps
  @state() private steps: VisitStep[] = [];
  @state() private editingStepIndex: number | null = null;
  @state() private draggingIndex: number | null = null;
  @state() private dragOverIndex: number | null = null;
  @state() private artworks: Artwork[] = [];
  @state() private loadingArtworks = false;
  @state() private floors: MuseumFloor[] = [];
  @state() private loadingFloors = false;
  // Piano su cui si sta scegliendo il waypoint per lo step in modifica (non è salvato
  // sullo step: si ricava dal marker una volta scelto, questo serve solo a filtrare
  // la lista finché non l'ha ancora scelto).
  @state() private waypointFloorId = '';
  // Piano mostrato nella tab "Mappa" (anteprima del percorso).
  @state() private mapTabFloorId = '';
  // Marker WAYPOINT creati ad hoc cliccando un punto vuoto della mappa
  // (handleRoutePointAdd) — a differenza di un marker già esistente
  // referenziato da una tappa (scale, ascensore...), questi esistono solo
  // per quel percorso: rimuovere la tappa deve ripulire anche il marker,
  // altrimenti resta orfano sulla piantina del museo per sempre. Non uno
  // @state: non pilota alcun render, solo bookkeeping per removeStep/
  // undoLastRouteStep.
  private autoCreatedMarkerIds = new Set<string>();
  @state() private availableItems: Item[] = [];
  // General Info
  @state() private costs = '';
  @state() private ticketInfo = '';
  @state() private openingHours = '';
  @state() private services: string[] = [];
  @state() private tips: string[] = [];
  @state() private accessibility = '';
  @state() private wheelchairAccessible = false;

  // Target Audience
  @state() private minAge: number | undefined = undefined;
  @state() private maxAge: number | undefined = undefined;
  @state() private languageLevels: LanguageLevel[] = [LanguageLevel.MEDIUM];
  @state() private interests: string[] = [];
  @state() private estimatedDuration = 60;

  // Metadata
  @state() private language: AppLanguage = 'it';
  @state() private titleTranslations: Partial<Record<AppLanguage, string>> = {};
  @state() private descriptionTranslations: Partial<Record<AppLanguage, string>> = {};
  @state() private translationModeByLang: Partial<Record<AppLanguage, 'ai' | 'manual'>> = {};
  @state() private price = 0;
  @state() private isFree = true;
  @state() private license: LicenseType = LicenseType.CC0;

  private get languageLevelOptions() {
    return LANGUAGE_LEVEL_OPTIONS_EMOJI_IT.map((option) => {
      const labelParts = option.label.split(' ');
      const icon = labelParts.shift() || '';
      const text = labelParts.join(' ');
      return {
        ...option,
        label: icon ? `${icon} ${__(text)}` : __(option.label),
      };
    });
  }

  private get logisticIcons() {
    return [
      { value: 'ticket', label: `🎫 ${__('Biglietteria')}` },
      { value: 'info', label: `ℹ️ ${__('Informazioni')}` },
      { value: 'clock', label: `⏰ ${__('Orari')}` },
      { value: 'accessibility', label: `♿ ${__('Accessibilità')}` },
      { value: 'food', label: `🍽️ ${__('Ristoro')}` },
      { value: 'shop', label: `🛍️ ${__('Shop')}` },
      { value: 'toilet', label: `🚻 ${__('Servizi')}` },
      { value: 'wifi', label: `📶 ${__('WiFi')}` },
    ];
  }

  // ─── Ciclo di vita ───────────────────────────────────────────
  async connectedCallback() {
    super.connectedCallback();
    window.addEventListener('ui-language-changed', this.handleLanguageChanged as EventListener);
    window.addEventListener('jobs-changed', this.handleJobsChanged);
    void jobsService.refresh();
    await this.loadMuseums();

    if (!this.visitId && this.selectedMuseumId) {
      this.museumId = this.selectedMuseumId;
      await this.loadMuseumLanguages();
      await this.loadArtworksForMuseum();
      await this.loadFloorsForMuseum();
    }

    if (this.visitId) {
      await this.loadVisit();
    }
  }

  disconnectedCallback(): void {
    window.removeEventListener('ui-language-changed', this.handleLanguageChanged as EventListener);
    window.removeEventListener('jobs-changed', this.handleJobsChanged);
    super.disconnectedCallback();
  }

  // Un'azione lanciata da dentro una tab (es. "Sincronizza traduzioni" nelle
  // Impostazioni) mostra il suo esito in cima alla pagina — se il completamento
  // è quasi istantaneo (nulla da aggiornare) e la pagina è scrollata giù, il
  // riquadro appare fuori schermo e sembra che non sia successo nulla. Lo
  // scrolla in vista ogni volta che success/error cambia a un valore non vuoto.
  updated(changedProps: Map<string, unknown>) {
    if (
      (changedProps.has('success') || changedProps.has('error')) &&
      (this.success || this.error)
    ) {
      this.querySelector('#feedback-alert')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    if (changedProps.has('openingTab') && this.openingTab) {
      this.activeTab = this.openingTab as EditorTab;
    }

    // Notifica il genitore (visits-page) a ogni cambio tab, per la history —
    // stesso schema di artworks-page.ts, un livello più in profondità: qui
    // il "cosa sono" (viewMode/visitId) non lo sa il visit-editor, lo aggiunge
    // visits-page che intercetta questo evento (vedi handleEditorStateChanged).
    // La primissima emissione (il default 'info' del field, o il ripristino
    // di openingTab appena sopra) sostituisce invece di aggiungere un passo —
    // altrimenti aprire l'editor produce da solo un secondo passo di history
    // (visitId+edit, poi +tab) da un unico click.
    if (changedProps.has('activeTab')) {
      const replace = !this.hasEmittedTabOnce;
      this.hasEmittedTabOnce = true;
      this.dispatchEvent(
        new CustomEvent('page-state-changed', {
          detail: { tab: this.activeTab, replace },
          bubbles: true,
          composed: true,
        }),
      );
    }
  }

  private handleLanguageChanged = (_event: CustomEvent<{ language: AppLanguage }>) => {
    this.requestUpdate();
  };

  private handleJobsChanged = (e: Event): void => {
    this.jobs = (e as CustomEvent<Job[]>).detail;
  };

  private async handleGenerateAudioClick(): Promise<void> {
    const confirmed = await modalService.confirm({
      title: __("Generare l'audio di questa visita?"),
      message: __(
        "Genera con OpenAI l'audio mancante degli item e delle tappe di questa visita. Operazione a pagamento (chiama OpenAI per ogni testo): non rigenera l'audio già presente. Segui l'avanzamento dalle notifiche.",
      ),
      variant: 'info',
      confirmLabel: __('Avvia'),
      cancelLabel: __('Annulla'),
    });
    if (!confirmed) return;

    await this.generateVisitAudio();
  }

  private async generateVisitAudio(): Promise<void> {
    if (!this.visitId) return;

    this.generatingAudio = true;
    this.error = '';
    this.success = '';

    try {
      const result = await visitService.generateVisitAudio(this.visitId);
      if (!result.jobId) {
        this.error = result.error || __("Errore durante l'avvio della generazione audio");
        return;
      }
      this.success = __("Generazione audio avviata: segui l'avanzamento dalle notifiche.");
      await jobsService.refresh();
    } finally {
      this.generatingAudio = false;
    }
  }

  private async handleSyncLanguagesClick(): Promise<void> {
    const confirmed = await modalService.confirm({
      title: __('Sincronizzare le traduzioni di questa visita?'),
      message: __(
        "Applica le lingue attive del museo al testo di questa visita e degli item che referenzia: rimuove traduzioni non richieste e genera con AI quelle mancanti. Segui l'avanzamento dalle notifiche.",
      ),
      variant: 'info',
      confirmLabel: __('Avvia'),
      cancelLabel: __('Annulla'),
    });
    if (!confirmed) return;

    await this.syncVisitLanguages();
  }

  private async syncVisitLanguages(): Promise<void> {
    if (!this.visitId) return;

    this.syncingLanguages = true;
    this.error = '';
    this.success = '';

    try {
      const result = await visitService.syncVisitLanguages(this.visitId);
      if (!result.jobId) {
        this.error = result.error || __("Errore durante l'avvio della sincronizzazione lingue");
        return;
      }
      this.success = __("Sincronizzazione lingue avviata: segui l'avanzamento dalle notifiche.");
      await jobsService.refresh();
    } finally {
      this.syncingLanguages = false;
    }
  }

  // Pubblica/rimuove pubblicazione della visita.
  private async handleTogglePublish(): Promise<void> {
    if (!this.visitId) return;

    this.togglingPublish = true;
    this.error = '';
    this.success = '';

    try {
      const updated = this.isPublished
        ? await visitService.unpublish(this.visitId)
        : await visitService.publish(this.visitId);
      this.isPublished = updated.isPublished;
      this.success = this.isPublished
        ? __('Visita pubblicata: ora è visibile ai visitatori.')
        : __('Pubblicazione rimossa: la visita è di nuovo in bozza.');
    } catch (e) {
      this.error =
        e instanceof Error ? e.message : __('Impossibile modificare lo stato di pubblicazione');
    } finally {
      this.togglingPublish = false;
    }
  }

  onMuseumChanged(): void {
    if (this.visitId || !this.selectedMuseumId) {
      return;
    }

    this.museumId = this.selectedMuseumId;
    void this.loadMuseumLanguages();
    void this.loadArtworksForMuseum();
    void this.loadFloorsForMuseum();
  }

  // ─── Caricamento dati ────────────────────────────────────────
  private async loadMuseums() {
    this.loadingMuseums = true;
    try {
      this.museums = await museumService.getMuseums();
    } catch (e) {
      console.error('Error loading museums:', e);
    } finally {
      this.loadingMuseums = false;
    }
  }

  private async loadVisit() {
    if (!this.visitId) return;

    this.loadingVisit = true;
    try {
      const visit = await visitService.getById(this.visitId);
      if (visit) {
        // Basic info
        this.visitTitle = visit.title || '';
        this.description = visit.description || '';
        this.titleTranslations = visit.titleTranslations || {};
        this.descriptionTranslations = visit.descriptionTranslations || {};
        this.coverImage = visit.coverImage || '';
        this.museumId = visit.museumId;
        this.steps = visit.steps || [];
        this.isPublished = visit.isPublished || false;

        // General info
        if (visit.generalInfo) {
          this.costs = visit.generalInfo.costs || '';
          this.ticketInfo = visit.generalInfo.ticketInfo || '';
          this.openingHours = visit.generalInfo.openingHours || '';
          this.services = visit.generalInfo.services || [];
          this.tips = visit.generalInfo.tips || [];
          this.accessibility = visit.generalInfo.accessibility || '';
          this.wheelchairAccessible = visit.generalInfo.wheelchairAccessible || false;
        }

        // Target audience
        if (visit.targetAudience) {
          this.minAge = visit.targetAudience.minAge;
          this.maxAge = visit.targetAudience.maxAge;
          this.languageLevels = visit.targetAudience.languageLevels || [LanguageLevel.MEDIUM];
          this.interests = visit.targetAudience.interests || [];
          this.estimatedDuration = visit.targetAudience.estimatedDuration || 60;
        }

        // Metadata
        if (visit.metadata) {
          this.language = visit.metadata.language || 'it';
          this.price = visit.metadata.price || 0;
          this.isFree = visit.metadata.isFree !== false;
          this.license = (visit.metadata.license as LicenseType) || LicenseType.CC0;
        }

        // Carica le opere di questo museo
        if (this.museumId) {
          await this.loadMuseumLanguages();
          await this.loadArtworksForMuseum();
          await this.loadFloorsForMuseum();
        }
      }
    } catch (e) {
      console.error('Error loading visit:', e);
      this.error = __('Impossibile caricare la visita');
    } finally {
      this.loadingVisit = false;
    }
  }

  private async loadArtworksForMuseum() {
    if (!this.museumId) return;

    this.loadingArtworks = true;
    try {
      const result = await artworkService.getArtworks({ museumId: this.museumId, limit: 100 });
      this.artworks = result.artworks;
    } catch (e) {
      console.error('Error loading artworks:', e);
    } finally {
      this.loadingArtworks = false;
    }
  }

  private async loadFloorsForMuseum() {
    if (!this.museumId) {
      this.floors = [];
      return;
    }

    this.loadingFloors = true;
    try {
      this.floors = await museumService.getFloors(this.museumId);
    } catch (e) {
      console.error('Error loading floors:', e);
      this.floors = [];
    } finally {
      this.loadingFloors = false;
    }
  }

  /** Marker di tipo waypoint disponibili su un piano, per lo step editor. */
  private getWaypointOptions(floorId: string): Array<{ value: string; label: string }> {
    const floor = this.floors.find((f) => f.id === floorId);
    return (floor?.markers || [])
      .filter((marker) => marker.type === MarkerType.WAYPOINT)
      .map((marker) => ({
        value: marker.id,
        label:
          marker.label || `${__('Waypoint')} (${Math.round(marker.x)}, ${Math.round(marker.y)})`,
      }));
  }

  /** Etichetta leggibile per ogni tipo di marker, usata quando il marker
   * stesso non ha un'etichetta impostata dal curatore. */
  private get markerTypeLabels(): Record<string, string> {
    return {
      [MarkerType.ARTWORK]: __('Opera'),
      [MarkerType.SCULPTURE]: __('Scultura'),
      [MarkerType.PAINTING]: __('Dipinto'),
      [MarkerType.ENTRANCE]: __('Ingresso'),
      [MarkerType.EXIT]: __('Uscita'),
      [MarkerType.EMERGENCY_EXIT]: __('Uscita di emergenza'),
      [MarkerType.INFO_POINT]: __('Info Point'),
      [MarkerType.ELEVATOR]: __('Ascensore'),
      [MarkerType.STAIRS]: __('Scale'),
      [MarkerType.ESCALATOR]: __('Scala mobile'),
      [MarkerType.RAMP]: __('Rampa'),
      [MarkerType.TOILETTE]: __('Bagni'),
      [MarkerType.ACCESSIBLE_TOILETTE]: __('Bagni accessibili'),
      [MarkerType.BAR]: __('Bar'),
      [MarkerType.RESTAURANT]: __('Ristorante'),
      [MarkerType.SHOP]: __('Shop'),
      [MarkerType.CLOAKROOM]: __('Guardaroba'),
      [MarkerType.LOCKER]: __('Armadietti'),
      [MarkerType.ROOM]: __('Sala'),
      [MarkerType.GALLERY]: __('Galleria'),
      [MarkerType.ACCESSIBILITY]: __('Accessibilità'),
      [MarkerType.OBSTACLE]: __('Ostacolo'),
      [MarkerType.BENCH]: __('Panchina'),
      [MarkerType.AUDIO_GUIDE]: __('Audioguida'),
      [MarkerType.WIFI]: 'Wi-Fi',
      [MarkerType.WAYPOINT]: __('Waypoint'),
    };
  }

  /**
   * Tutti i marker reali (ogni tipo tranne WAYPOINT, che è un punto muto di
   * solo instradamento e non un punto di interesse) su tutti i piani, per
   * l'associazione facoltativa di una tappa LOGISTIC/NAVIGATION a un punto
   * della mappa — a differenza di getWaypointOptions(), qui il curatore deve
   * poter scegliere anche ingressi, bar, info point ecc., non solo opere.
   */
  private getAllMarkerOptions(): Array<{ value: string; label: string }> {
    const options: Array<{ value: string; label: string }> = [];
    const showFloorPrefix = this.floors.length > 1;
    for (const floor of this.floors) {
      for (const marker of floor.markers || []) {
        if (marker.type === MarkerType.WAYPOINT) continue;
        const markerLabel = marker.label || this.markerTypeLabels[marker.type] || marker.type;
        options.push({
          value: marker.id,
          label: showFloorPrefix ? `${floor.name} — ${markerLabel}` : markerLabel,
        });
      }
    }
    return options;
  }

  /**
   * Trova un marker qualsiasi (non solo waypoint, nonostante il nome storico)
   * per id, su tutti i piani — usata sia per le svolte sia per l'anteprima
   * dell'associazione facoltativa a un punto della mappa di una tappa
   * LOGISTIC/NAVIGATION.
   */
  private findWaypointMarker(mapMarkerId?: string): { floorId: string; label: string } | null {
    if (!mapMarkerId) return null;
    for (const floor of this.floors) {
      const marker = floor.markers?.find((m) => m.id === mapMarkerId);
      if (marker) {
        return {
          floorId: floor.id,
          label: marker.label || this.markerTypeLabels[marker.type] || floor.name,
        };
      }
    }
    return null;
  }

  /**
   * Risolve gli step ARTWORK/WAYPOINT (nell'ordine della visita) in punti con
   * coordinate reali sulla mappa, per l'anteprima del percorso. Gli step senza
   * posizione (LOGISTIC, NAVIGATION testuale, opera non ancora scelta...) sono
   * saltati: la numerazione dei punti resta quindi consecutiva (1, 2, 3...) come
   * si vede davvero camminando, non l'indice grezzo dello step nella visita.
   */
  private getVisitRoutePoints(): Array<{ x: number; y: number; floorId: string; order: number }> {
    const points: Array<{ x: number; y: number; floorId: string; order: number }> = [];
    const orderedSteps = [...this.steps].sort((a, b) => a.order - b.order);

    for (const step of orderedSteps) {
      let resolved: { x: number; y: number; floorId: string } | null = null;

      if (step.type === VisitStepType.ARTWORK && step.artworkId) {
        for (const floor of this.floors) {
          const marker = floor.markers?.find((m) => m.artworkId === step.artworkId);
          if (marker) {
            resolved = { x: marker.x, y: marker.y, floorId: floor.id };
            break;
          }
        }
      } else if (step.type === VisitStepType.WAYPOINT && step.mapMarkerId) {
        for (const floor of this.floors) {
          const marker = floor.markers?.find((m) => m.id === step.mapMarkerId);
          if (marker) {
            resolved = { x: marker.x, y: marker.y, floorId: floor.id };
            break;
          }
        }
      }

      if (resolved) {
        points.push({ ...resolved, order: points.length });
      }
    }

    return points;
  }

  private async loadMuseumLanguages() {
    if (!this.museumId) {
      this.activeLanguages = ['it'];
      return;
    }

    try {
      const museum = await museumService.getMuseum(this.museumId);
      const active = (museum?.activeLanguages || []).filter((lang): lang is AppLanguage =>
        isSupportedAppLanguage(lang),
      );
      const normalizedActive: AppLanguage[] =
        active.length > 0 ? active : (['it'] as AppLanguage[]);
      this.activeLanguages = normalizedActive;
      if (!normalizedActive.includes(this.language)) {
        this.language = normalizedActive[0] || 'it';
      }
    } catch {
      this.activeLanguages = ['it'];
    }
  }

  private getTargetLanguages(): AppLanguage[] {
    return this.activeLanguages.filter((lang) => lang !== this.language);
  }

  private getLanguageLabel(language: AppLanguage): string {
    switch (language) {
      case 'it':
        return __('Italiano');
      case 'en':
        return __('English');
      case 'fr':
        return __('Français');
      case 'de':
        return __('Deutsch');
      case 'es':
        return __('Español');
    }

    return String(language).toUpperCase();
  }

  private async translateMissingVisitLanguages() {
    const sourceTitle = (this.visitTitle || '').trim();
    const sourceDescription = (this.description || '').trim();

    if (!sourceTitle || !sourceDescription) {
      this.error = __('Compila titolo e descrizione nella lingua principale prima di tradurre');
      return;
    }

    this.translating = true;
    this.error = '';

    try {
      const targets = this.getTargetLanguages();
      const batchItems: Array<{ key: string; text: string; targetLang: AppLanguage }> = [];

      for (const lang of targets) {
        if (!this.titleTranslations[lang]?.trim()) {
          batchItems.push({ key: `${lang}:title`, text: sourceTitle, targetLang: lang });
        }
        if (!this.descriptionTranslations[lang]?.trim()) {
          batchItems.push({
            key: `${lang}:description`,
            text: sourceDescription,
            targetLang: lang,
          });
        }
      }

      if (batchItems.length === 0) {
        return;
      }

      const translations = await translationService.translateBatch(this.language, batchItems);

      for (const lang of targets) {
        let translatedByAI = false;
        const titleKey = `${lang}:title`;
        const descriptionKey = `${lang}:description`;

        if (translations[titleKey]) {
          this.titleTranslations = {
            ...this.titleTranslations,
            [lang]: translations[titleKey],
          };
          translatedByAI = true;
        }

        if (translations[descriptionKey]) {
          this.descriptionTranslations = {
            ...this.descriptionTranslations,
            [lang]: translations[descriptionKey],
          };
          translatedByAI = true;
        }

        if (translatedByAI && this.translationModeByLang[lang] !== 'manual') {
          this.translationModeByLang = {
            ...this.translationModeByLang,
            [lang]: 'ai',
          };
        }
      }
    } catch (e) {
      this.error = e instanceof Error ? e.message : __('Traduzione automatica non riuscita');
    } finally {
      this.translating = false;
    }
  }

  private markLanguageAsManual(lang: AppLanguage): void {
    this.translationModeByLang = {
      ...this.translationModeByLang,
      [lang]: 'manual',
    };
  }

  private getTranslationStatus(lang: AppLanguage): 'ai' | 'manual' {
    return this.translationModeByLang[lang] === 'ai' ? 'ai' : 'manual';
  }

  // Solo item che l'utente autenticato può abbinare (propri, gratuiti, già
  // acquistati — vedi ItemController.getUsableItemsForArtwork), non il
  // catalogo pubblico completo.
  private async loadItemsForArtwork(artworkId: string) {
    try {
      this.availableItems = await itemService.getUsableItemsForArtwork(artworkId);
    } catch (e) {
      console.error('Error loading items:', e);
    }
  }

  // Equivalente per le tappe CONTENT: item di questo museo per tipo di
  // riferimento (autore/movimento/periodo/museo), stesso filtro d'uso.
  private async loadUsableItemsByReferenceType(referenceType: ItemReferenceType) {
    try {
      this.availableItems = await itemService.getUsableItemsByReferenceType(
        referenceType,
        this.museumId,
      );
    } catch (e) {
      console.error('Error loading items:', e);
    }
  }

  // ─── Azioni (museo / tappe / salvataggio) ────────────────────
  private async handleMuseumChange(e: CustomEvent) {
    this.museumId = e.detail.value;
    // Ricarica le opere quando cambia il museo
    if (this.museumId) {
      await this.loadMuseumLanguages();
      await this.loadArtworksForMuseum();
      await this.loadFloorsForMuseum();
    } else {
      this.artworks = [];
      this.activeLanguages = ['it'];
      this.floors = [];
    }
  }

  private generateStepId(): string {
    return `step_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private addStep(type: VisitStepType) {
    const newStep: VisitStep = {
      id: this.generateStepId(),
      order: this.steps.length,
      type,
      isOptional: false,
    };

    // Imposta i default in base al tipo
    if (type === VisitStepType.LOGISTIC) {
      newStep.logisticTitle = '';
      newStep.logisticText = '';
      newStep.logisticIcon = 'info';
    } else if (type === VisitStepType.NAVIGATION) {
      newStep.navigationText = '';
      newStep.fromRoom = '';
      newStep.toRoom = '';
    } else if (type === VisitStepType.WAYPOINT) {
      this.waypointFloorId = this.floors[0]?.id || '';
    }

    this.steps = [...this.steps, newStep];
    this.editingStepIndex = this.steps.length - 1;
    // Scorre alla nuova tappa dopo il render
    this.updateComplete.then(() => this.scrollToStep(this.steps.length - 1));
  }

  private scrollToStep(index: number) {
    const stepCards = this.querySelectorAll('.step-card');
    if (stepCards[index]) {
      stepCards[index].scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  private moveStepUp(index: number) {
    if (index === 0) return;
    const newSteps = [...this.steps];
    [newSteps[index - 1], newSteps[index]] = [newSteps[index], newSteps[index - 1]];
    this.steps = newSteps.map((step, i) => ({ ...step, order: i }));
  }

  private moveStepDown(index: number) {
    if (index === this.steps.length - 1) return;
    const newSteps = [...this.steps];
    [newSteps[index], newSteps[index + 1]] = [newSteps[index + 1], newSteps[index]];
    this.steps = newSteps.map((step, i) => ({ ...step, order: i }));
  }

  private async removeStep(index: number) {
    const step = this.steps[index];

    // Il marker è stato creato apposta per questa tappa (non uno già
    // esistente, tipo scale/ascensore, riusato): rimuoverla senza avvisare
    // lo farebbe sparire dalla piantina senza che sia ovvio perché — chiede
    // conferma prima. undoLastRouteStep (sotto) fa la stessa pulizia ma
    // senza conferma: lì si sta annullando la propria ultima azione, non
    // ha senso chiedere di nuovo.
    if (
      step?.type === VisitStepType.WAYPOINT &&
      step.mapMarkerId &&
      this.autoCreatedMarkerIds.has(step.mapMarkerId)
    ) {
      const confirmed = await modalService.confirm({
        title: __('Rimuovere anche il punto dalla piantina?'),
        message: __(
          'Questa svolta è stata creata apposta per questa tappa: rimuovendola, viene tolta anche dalla piantina del museo.',
        ),
        variant: 'danger',
        confirmLabel: __('Rimuovi'),
        cancelLabel: __('Annulla'),
      });
      if (!confirmed) return;

      await this.deleteAutoCreatedMarker(step.mapMarkerId);
    }

    this.steps = this.steps.filter((_, i) => i !== index).map((s, i) => ({ ...s, order: i }));
    if (this.editingStepIndex === index) {
      this.editingStepIndex = null;
    }
  }

  // Toglie dalla piantina un marker creato ad hoc per una tappa (vedi
  // handleRoutePointAdd/autoCreatedMarkerIds) — mai chiamata per un marker
  // preesistente riusato (handleRouteMarkerAdd), che deve restare intatto.
  private async deleteAutoCreatedMarker(markerId: string): Promise<void> {
    const floorId = this.findWaypointMarker(markerId)?.floorId;
    if (floorId) {
      try {
        await museumService.deleteMarker(this.museumId, floorId, markerId);
        this.floors = this.floors.map((f) =>
          f.id === floorId
            ? { ...f, markers: (f.markers || []).filter((m) => m.id !== markerId) }
            : f,
        );
      } catch (err) {
        console.error('Error deleting waypoint marker:', err);
        this.error = __('Impossibile rimuovere il punto dalla piantina');
      }
    }
    this.autoCreatedMarkerIds.delete(markerId);
  }

  private updateStep(index: number, updates: Partial<VisitStep>) {
    this.steps = this.steps.map((step, i) => (i === index ? { ...step, ...updates } : step));
  }

  private handleFormSubmit(e: Event) {
    e.preventDefault();
    this.handleSubmit();
  }

  private async handleSubmit() {
    if (!this.validateForm()) return;

    this.saving = true;
    this.error = '';
    this.success = '';

    try {
      const generalInfo: VisitGeneralInfo = {
        costs: this.costs || undefined,
        ticketInfo: this.ticketInfo || undefined,
        openingHours: this.openingHours || undefined,
        services: this.services.length > 0 ? this.services : undefined,
        tips: this.tips.length > 0 ? this.tips : undefined,
        accessibility: this.accessibility || undefined,
        wheelchairAccessible: this.wheelchairAccessible,
      };

      const targetAudience: TargetAudience = {
        minAge: this.minAge,
        maxAge: this.maxAge,
        languageLevels: this.languageLevels,
        interests: this.interests.length > 0 ? this.interests : undefined,
        estimatedDuration: this.estimatedDuration,
      };

      const visitData: CreateVisitData | UpdateVisitData = {
        museumId: this.museumId,
        title: this.visitTitle,
        description: this.description,
        titleTranslations: this.titleTranslations,
        descriptionTranslations: this.descriptionTranslations,
        coverImage: this.coverImage || undefined,
        steps: this.steps,
        generalInfo,
        targetAudience,
        metadata: {
          language: this.language,
          supportedLanguages: this.activeLanguages,
          price: this.isFree ? 0 : this.price,
          isFree: this.isFree,
          license: this.license,
          estimatedDuration: this.estimatedDuration,
        },
      };

      if (this.visitId) {
        await visitService.update(this.visitId, visitData);
        this.success = __('Visita aggiornata con successo!');
      } else {
        const created = await visitService.create(visitData as CreateVisitData);
        this.success = __('Visita creata con successo!');
        this.visitId = created._id;
      }

      // Emette l'evento di salvataggio
      this.dispatchEvent(
        new CustomEvent('visit-saved', {
          detail: { visitId: this.visitId },
          bubbles: true,
          composed: true,
        }),
      );
    } catch (e) {
      console.error('Error saving visit:', e);
      this.error = e instanceof Error ? e.message : __('Impossibile salvare la visita');
    } finally {
      this.saving = false;
    }
  }

  private validateForm(): boolean {
    if (!(this.visitTitle || '').trim()) {
      this.error = __('Il titolo è obbligatorio');
      this.activeTab = 'info';
      return false;
    }
    if (!(this.description || '').trim()) {
      this.error = __('La descrizione è obbligatoria');
      this.activeTab = 'info';
      return false;
    }
    for (const lang of this.getTargetLanguages()) {
      if (!this.titleTranslations[lang]?.trim() || !this.descriptionTranslations[lang]?.trim()) {
        this.error = `Completa le traduzioni per ${lang.toUpperCase()}`;
        this.activeTab = 'info';
        return false;
      }
    }
    if (!this.museumId) {
      this.error = __('Seleziona un museo');
      this.activeTab = 'info';
      return false;
    }
    if (this.steps.length === 0) {
      this.error = 'Aggiungi almeno un passaggio';
      this.activeTab = 'steps';
      return false;
    }
    // Uno step "opera" appena aggiunto non ha ancora un'opera selezionata (si sceglie
    // da un select subito dopo): senza questo controllo il form lascia passare uno
    // step incompleto e l'errore arriva solo dal server, generico, a salvataggio fatto.
    const incompleteArtworkStepIndex = this.steps.findIndex(
      (step) => step.type === VisitStepType.ARTWORK && !step.artworkId,
    );
    if (incompleteArtworkStepIndex !== -1) {
      this.error = `${__("Seleziona un'opera per il passaggio")} ${incompleteArtworkStepIndex + 1}`;
      this.activeTab = 'steps';
      return false;
    }
    // Stesso motivo del controllo sopra, per le tappe "Approfondimento".
    const incompleteContentStepIndex = this.steps.findIndex(
      (step) => step.type === VisitStepType.CONTENT && !step.contentReferenceType,
    );
    if (incompleteContentStepIndex !== -1) {
      this.error = `${__('Seleziona un tipo di approfondimento per il passaggio')} ${incompleteContentStepIndex + 1}`;
      this.activeTab = 'steps';
      return false;
    }
    if (this.languageLevels.length === 0) {
      this.error = __('Seleziona almeno un livello di linguaggio');
      this.activeTab = 'audience';
      return false;
    }
    return true;
  }

  private handleCancel() {
    this.dispatchEvent(
      new CustomEvent('cancel', {
        bubbles: true,
        composed: true,
      }),
    );
  }

  // ─── Render principale ────────────────────────────────────────
  render() {
    if (this.loadingVisit) {
      return html`<ui-loading size="lg" .text=${__('Caricamento visita...')}></ui-loading>`;
    }

    return html`
      <form @submit=${this.handleFormSubmit} class="space-y-8">
        <!-- Messaggi di successo/errore -->
        ${!this.museumId
          ? html`
              <ui-alert
                variant="warning"
                .message=${__('Seleziona un museo attivo prima di creare la visita.')}
              ></ui-alert>
              <div class="flex justify-end">
                <ui-button
                  variant="secondary"
                  size="sm"
                  .label=${__('Seleziona museo')}
                  @click=${this.emitSelectMuseum}
                ></ui-button>
              </div>
            `
          : nothing}
        <div id="feedback-alert">
          ${this.success
            ? html`<ui-alert variant="success" .message=${this.success}></ui-alert>`
            : nothing}
          ${this.error
            ? html`<ui-alert variant="danger" .message=${this.error}></ui-alert>`
            : nothing}
        </div>

        <!-- Stato pubblicazione: qui e non più come azione a distanza sulla
             card nella lista, così si vede/cambia mentre si sta effettivamente
             guardando la visita. -->
        ${this.visitId
          ? html`
              <div
                class="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl border ${this
                  .isPublished
                  ? 'border-success-200 dark:border-success-900/40 bg-success-50 dark:bg-success-900/10'
                  : 'border-surface-200 dark:border-surface-700'}"
              >
                <div class="flex items-center gap-3">
                  <ui-badge
                    variant=${this.isPublished ? 'success' : 'secondary'}
                    .label=${this.isPublished ? __('Pubblicata') : __('Bozza')}
                  ></ui-badge>
                  <p class="text-sm text-surface-600 dark:text-surface-300">
                    ${this.isPublished
                      ? __('Visibile ai visitatori nel Navigator e nel marketplace.')
                      : __('Non ancora visibile ai visitatori: solo bozza.')}
                  </p>
                </div>
                <ui-button
                  type="button"
                  variant="secondary"
                  size="sm"
                  .label=${this.isPublished ? __('Rimuovi pubblicazione') : __('Pubblica')}
                  .loading=${this.togglingPublish}
                  @click=${this.handleTogglePublish}
                ></ui-button>
              </div>
            `
          : nothing}

        <!-- Tabs -->
        <ui-tabs
          .tabs=${[
            { id: 'info', label: __('Informazioni'), icon: 'document' },
            {
              id: 'steps',
              label: __('Percorso'),
              icon: 'list',
              badge: this.steps.length || undefined,
            },
            { id: 'map', label: __('Mappa'), icon: 'location' },
            { id: 'audience', label: __('Pubblico'), icon: 'users' },
            { id: 'settings', label: __('Impostazioni'), icon: 'cog' },
          ]}
          .activeTab=${this.activeTab}
          @tab-change=${(e: CustomEvent) => (this.activeTab = e.detail.id)}
        ></ui-tabs>

        <!-- Tab Content -->
        <div class="tab-content">${this.renderActiveTab()}</div>

        <!-- Actions -->
        <div
          class="flex items-center justify-end gap-3 pt-6 border-t border-surface-200 dark:border-surface-700"
        >
          <ui-button
            type="button"
            variant="secondary"
            .label=${__('Annulla')}
            @click=${this.handleCancel}
          ></ui-button>
          <ui-button
            type="submit"
            variant="primary"
            .label=${this.visitId ? __('Salva Modifiche') : __('Crea Visita')}
            icon="save"
            .loading=${this.saving}
          ></ui-button>
        </div>
      </form>
    `;
  }

  // ─── Helper di render ──────────────────────────────────────
  private renderActiveTab() {
    switch (this.activeTab) {
      case 'info':
        return this.renderInfoTab();
      case 'steps':
        return this.renderStepsTab();
      case 'map':
        return this.renderMapTab();
      case 'audience':
        return this.renderAudienceTab();
      case 'settings':
        return this.renderSettingsTab();
      default:
        return this.renderInfoTab();
    }
  }

  private renderInfoTab() {
    return html`
      <div class="space-y-8">
        <!-- Museum Selection -->
        <ui-panel-section
          .title=${__('Museo')}
          icon="location"
          .help=${__(
            'Il museo in cui si svolge la visita: determina quali opere, piante e marker sono disponibili nelle tappe del Percorso. Cambiarlo dopo aver già aggiunto delle tappe non le rimuove automaticamente, ma i riferimenti a opere/waypoint del museo precedente restano non validi.',
          )}
          .renderContent=${() => html`
            <ui-select
              .label=${__('Seleziona il museo')}
              .value=${this.museumId}
              .options=${this.museums.map((m) => ({ value: m._id, label: m.name }))}
              placeholder=${this.loadingMuseums ? __('Caricamento...') : __('Seleziona il museo')}
              ?disabled=${this.loadingMuseums}
              @select-change=${(e: CustomEvent) => this.handleMuseumChange(e)}
              required
            ></ui-select>
          `}
        ></ui-panel-section>

        <!-- Basic Info -->
        <ui-panel-section
          .title=${__('Informazioni di base')}
          icon="document"
          .renderContent=${() => html`
            <div class="space-y-4">
              <ui-input
                .label=${__('Titolo della visita')}
                .placeholder=${__('Es. Capolavori del Rinascimento')}
                .value=${this.visitTitle}
                @input=${(e: InputEvent) =>
                  (this.visitTitle = (e.target as HTMLInputElement).value)}
                required
              ></ui-input>

              <ui-textarea
                .label=${__('Descrizione')}
                .placeholder=${__('Descrivi il percorso di visita...')}
                .value=${this.description}
                @input=${(e: InputEvent) =>
                  (this.description = (e.target as HTMLTextAreaElement).value)}
                rows="4"
                required
              ></ui-textarea>

              ${this.getTargetLanguages().length > 0
                ? html`
                    <div
                      class="p-4 rounded-xl border border-surface-200 dark:border-surface-700 space-y-4"
                    >
                      <div class="flex items-center justify-between gap-3">
                        <h4 class="text-sm font-semibold text-surface-800 dark:text-surface-100">
                          ${__('Traduzioni richieste')} (${this.getTargetLanguages().length})
                        </h4>
                        <ui-button
                          type="button"
                          size="sm"
                          variant="secondary"
                          icon="sparkles"
                          .label=${__('Traduci mancanti con AI')}
                          .loading=${this.translating}
                          @click=${() => this.translateMissingVisitLanguages()}
                        ></ui-button>
                      </div>

                      ${this.getTargetLanguages().map((lang) => {
                        const label = this.getLanguageLabel(lang);

                        return html`
                          <div class="space-y-3 p-3 rounded-lg bg-surface-50 dark:bg-surface-800">
                            <div class="flex items-center justify-between gap-2">
                              <p
                                class="text-xs font-semibold text-surface-600 dark:text-surface-300"
                              >
                                ${label}
                              </p>
                              <ui-badge
                                size="sm"
                                variant=${this.getTranslationStatus(lang) === 'ai'
                                  ? 'info'
                                  : 'secondary'}
                                .label=${this.getTranslationStatus(lang) === 'ai'
                                  ? __('AI')
                                  : __('Manuale')}
                              ></ui-badge>
                            </div>
                            <ui-input
                              .label=${`${__('Titolo')} (${lang.toUpperCase()})`}
                              .value=${this.titleTranslations[lang] || ''}
                              @input=${(e: InputEvent) => {
                                this.titleTranslations = {
                                  ...this.titleTranslations,
                                  [lang]: (e.target as HTMLInputElement).value,
                                };
                                this.markLanguageAsManual(lang);
                              }}
                              required
                            ></ui-input>
                            <ui-textarea
                              .label=${`${__('Descrizione')} (${lang.toUpperCase()})`}
                              .value=${this.descriptionTranslations[lang] || ''}
                              @input=${(e: InputEvent) => {
                                this.descriptionTranslations = {
                                  ...this.descriptionTranslations,
                                  [lang]: (e.target as HTMLTextAreaElement).value,
                                };
                                this.markLanguageAsManual(lang);
                              }}
                              rows="3"
                              required
                            ></ui-textarea>
                          </div>
                        `;
                      })}
                    </div>
                  `
                : nothing}

              <image-editor
                .label=${__('Immagine di copertina')}
                category="visits"
                .value=${this.coverImage}
                maxWidth=${1200}
                maxHeight=${800}
                .maxOutputSizeMb=${3}
                defaultFormat="webp"
                @image-saved=${(e: CustomEvent) => {
                  this.coverImage = e.detail.path || '';
                }}
              ></image-editor>
              <p class="text-xs text-surface-500 dark:text-surface-400">
                ${__(
                  "Se non ne carichi una, nel marketplace e nelle card viene mostrata l'immagine del museo.",
                )}
              </p>
            </div>
          `}
        ></ui-panel-section>

        <!-- Practical Info -->
        <ui-panel-section
          .title=${__('Informazioni pratiche')}
          icon="info"
          .help=${__(
            'Specifiche di questa visita, indipendenti da quelle generali del museo (utile per es. per una mostra temporanea con orari o biglietto propri). Lascia vuoto un campo per non mostrarlo nella scheda della visita.',
          )}
          .renderContent=${() => html`
            <div class="space-y-4">
              <ui-input
                .label=${__('Costi')}
                .placeholder=${__('Es. Ingresso €15, ridotto €8')}
                .value=${this.costs}
                @input=${(e: InputEvent) => (this.costs = (e.target as HTMLInputElement).value)}
              ></ui-input>

              <ui-input
                .label=${__('Informazioni biglietti')}
                .placeholder=${__('Es. Prenotazione obbligatoria online')}
                .value=${this.ticketInfo}
                @input=${(e: InputEvent) =>
                  (this.ticketInfo = (e.target as HTMLInputElement).value)}
              ></ui-input>

              <ui-input
                .label=${__('Orari di apertura')}
                .placeholder=${__('Es. Mar-Dom 9:00-19:00')}
                .value=${this.openingHours}
                @input=${(e: InputEvent) =>
                  (this.openingHours = (e.target as HTMLInputElement).value)}
              ></ui-input>

              <ui-textarea
                .label=${__('Accessibilità')}
                .placeholder=${__('Es. Accessibile ai disabili, ascensore disponibile')}
                .value=${this.accessibility}
                @input=${(e: InputEvent) =>
                  (this.accessibility = (e.target as HTMLTextAreaElement).value)}
                rows="2"
              ></ui-textarea>

              <ui-checkbox
                .label=${__('Accessibile in sedia a rotelle')}
                .checked=${this.wheelchairAccessible}
                @checkbox-change=${(e: CustomEvent) =>
                  (this.wheelchairAccessible = e.detail.checked)}
              ></ui-checkbox>
            </div>
          `}
        ></ui-panel-section>
      </div>
    `;
  }

  private renderStepsTab() {
    return html`
      <div class="space-y-8">
        <!-- Add Step Buttons -->
        <div class="flex flex-wrap gap-2">
          <ui-button
            type="button"
            variant="outline"
            size="sm"
            icon="image"
            .label=${__('Aggiungi Opera')}
            @click=${() => this.addStep(VisitStepType.ARTWORK)}
            ?disabled=${!this.museumId || this.artworks.length === 0}
          ></ui-button>
          <span class="inline-flex items-center gap-1">
            <ui-button
              type="button"
              variant="outline"
              size="sm"
              icon="tag"
              .label=${__('Approfondimento')}
              .title=${__(
                'Contenuto su un autore, un movimento, un periodo o il museo stesso — non legato a una singola opera.',
              )}
              @click=${() => this.addStep(VisitStepType.CONTENT)}
            ></ui-button>
            <ui-info-tip
              text=${__(
                'Contenuto su un autore, un movimento, un periodo o il museo stesso — non legato a una singola opera.',
              )}
            ></ui-info-tip>
          </span>
          <ui-button
            type="button"
            variant="outline"
            size="sm"
            icon="info"
            .label=${__('Info logistica')}
            @click=${() => this.addStep(VisitStepType.LOGISTIC)}
          ></ui-button>
          <ui-button
            type="button"
            variant="outline"
            size="sm"
            icon="arrow-right"
            .label=${__('Indicazioni')}
            @click=${() => this.addStep(VisitStepType.NAVIGATION)}
          ></ui-button>
          <span class="inline-flex items-center gap-1">
            <ui-button
              type="button"
              variant="outline"
              size="sm"
              icon="location"
              .label=${__('Svolta percorso')}
              .title=${__(
                'Punto muto per far piegare la linea del percorso sulla mappa (es. una porta su un corridoio): nessun audio, non è una tappa.',
              )}
              @click=${() => this.addStep(VisitStepType.WAYPOINT)}
              ?disabled=${this.loadingFloors || this.floors.length === 0}
            ></ui-button>
            <ui-info-tip
              text=${__(
                'Punto muto per far piegare la linea del percorso sulla mappa (es. una porta su un corridoio): nessun audio, non è una tappa.',
              )}
            ></ui-info-tip>
          </span>
        </div>

        ${this.renderStepsContent()}
      </div>
    `;
  }

  private renderMapTab() {
    if (this.loadingFloors) {
      return html`<ui-loading .text=${__('Caricamento piantina...')}></ui-loading>`;
    }

    if (this.floors.length === 0) {
      return html`
        <div class="text-center py-8 text-surface-500 dark:text-surface-400">
          <ui-icon name="location" size="lg" class="mb-2 opacity-50"></ui-icon>
          <p>${__('Nessuna piantina disponibile per questo museo')}</p>
        </div>
      `;
    }

    const floorId = this.mapTabFloorId || this.floors[0].id;
    const allPoints = this.getVisitRoutePoints();
    const floorPoints = allPoints.filter((p) => p.floorId === floorId);

    return html`
      <div class="space-y-4">
        <ui-alert
          variant="info"
          .message=${__(
            "Costruisci il percorso direttamente sulla mappa: clicca un'opera per aggiungerla come prossima tappa, clicca un punto vuoto per inserire una svolta. Per cambiare piano, clicca le scale o l'ascensore per agganciarci il percorso, poi seleziona l'altro piano dal menu qui sotto e clicca le scale/ascensore corrispondente per continuare da lì. Le tappe vengono numerate nell'ordine dei click; puoi riordinarle o rimuoverle anche dalla tab Percorso.",
          )}
        ></ui-alert>

        <div class="flex items-end justify-between gap-3 flex-wrap">
          ${this.floors.length > 1
            ? html`
                <ui-select
                  .label=${__('Piano')}
                  .value=${floorId}
                  .options=${this.floors.map((f) => ({ value: f.id, label: f.name }))}
                  @select-change=${(e: CustomEvent) => (this.mapTabFloorId = e.detail.value)}
                ></ui-select>
              `
            : html`<div></div>`}

          <ui-button
            type="button"
            variant="secondary"
            size="sm"
            icon="arrow-left"
            .label=${__('Annulla ultima tappa')}
            ?disabled=${this.steps.length === 0}
            @click=${() => this.undoLastRouteStep()}
          ></ui-button>
        </div>

        <svg-map-editor
          .floors=${this.floors}
          .selectedFloorId=${floorId}
          .artworks=${this.artworks}
          .routeStops=${floorPoints}
          ?editMode=${false}
          routeBuildMode
          @route-point-add=${this.handleRoutePointAdd}
          @route-marker-add=${this.handleRouteMarkerAdd}
        ></svg-map-editor>

        ${allPoints.length < 2
          ? html`
              <ui-alert
                variant="warning"
                .message=${__(
                  'Aggiungi almeno due tappe posizionate sulla mappa (opere o svolte) per vedere il percorso disegnato.',
                )}
              ></ui-alert>
            `
          : nothing}
      </div>
    `;
  }

  // ─── Azioni (costruzione percorso dalla mappa) ─────────
  /**
   * Click su un punto vuoto della mappa nel tab "Mappa": crea una nuova
   * svolta (marker WAYPOINT) sul piano corrente e la accoda subito come
   * prossima tappa del percorso, così il segmento si vede disegnato senza
   * dover passare dai select della tab Percorso.
   */
  private async handleRoutePointAdd(e: CustomEvent<{ x: number; y: number }>) {
    const floorId = this.mapTabFloorId || this.floors[0]?.id;
    if (!floorId) return;

    const marker: MapMarker = {
      id: `marker-${Date.now()}`,
      floorId,
      x: e.detail.x,
      y: e.detail.y,
      type: MarkerType.WAYPOINT,
      isVisible: true,
    };

    try {
      await museumService.addMarker(this.museumId, floorId, marker);
    } catch (err) {
      console.error('Error adding waypoint marker:', err);
      this.error = __('Impossibile aggiungere la svolta sulla mappa');
      return;
    }

    this.floors = this.floors.map((f) =>
      f.id === floorId ? { ...f, markers: [...(f.markers || []), marker] } : f,
    );
    // Creato apposta per questa tappa (non un marker preesistente
    // riusato) — vedi removeStep/undoLastRouteStep, che lo ripuliscono
    // dalla piantina se la tappa viene tolta dal percorso.
    this.autoCreatedMarkerIds.add(marker.id);

    this.appendStep({
      id: this.generateStepId(),
      order: this.steps.length,
      type: VisitStepType.WAYPOINT,
      isOptional: false,
      mapMarkerId: marker.id,
    });
  }

  /**
   * Click su un marker esistente nel tab "Mappa": un'opera diventa una tappa
   * ARTWORK, una svolta già presente (piazzata prima, anche da un'altra
   * visita) viene riusata come tappa WAYPOINT invece di duplicarla. Scale,
   * ascensori, scale mobili e rampe collegano due piani: cliccarli fa la
   * stessa cosa di una svolta, così l'ultima opera di un piano si aggancia
   * esattamente alle scale invece di dover piazzare una svolta approssimata
   * lì vicino — poi basta cambiare piano dal menu "Piano" e cliccare le
   * scale/ascensore corrispondente sul piano d'arrivo per continuare il
   * percorso. Gli altri tipi di marker (ingressi, servizi...) restano
   * fuori dal percorso.
   */
  private handleRouteMarkerAdd(e: CustomEvent<MapMarker>) {
    const marker = e.detail;
    const CONNECTOR_TYPES: MarkerType[] = [
      MarkerType.WAYPOINT,
      MarkerType.STAIRS,
      MarkerType.ELEVATOR,
      MarkerType.ESCALATOR,
      MarkerType.RAMP,
    ];

    if (CONNECTOR_TYPES.includes(marker.type)) {
      this.appendStep({
        id: this.generateStepId(),
        order: this.steps.length,
        type: VisitStepType.WAYPOINT,
        isOptional: false,
        mapMarkerId: marker.id,
      });
      return;
    }

    if (!marker.artworkId) return;

    this.appendStep({
      id: this.generateStepId(),
      order: this.steps.length,
      type: VisitStepType.ARTWORK,
      isOptional: false,
      artworkId: marker.artworkId,
    });
  }

  private appendStep(step: VisitStep) {
    this.steps = [...this.steps, step];
  }

  private undoLastRouteStep() {
    if (this.steps.length === 0) return;
    const lastStep = this.steps[this.steps.length - 1];
    this.steps = this.steps.slice(0, -1);
    if (this.editingStepIndex !== null && this.editingStepIndex >= this.steps.length) {
      this.editingStepIndex = null;
    }
    // Stessa pulizia di removeStep ma senza conferma: qui si sta annullando
    // la propria ultima azione (l'ha appena creato lei), non ha senso
    // chiedere di nuovo.
    if (
      lastStep.type === VisitStepType.WAYPOINT &&
      lastStep.mapMarkerId &&
      this.autoCreatedMarkerIds.has(lastStep.mapMarkerId)
    ) {
      void this.deleteAutoCreatedMarker(lastStep.mapMarkerId);
    }
  }

  private renderStepsContent() {
    if (!this.museumId) {
      return html`
        <div class="text-center py-8 text-surface-500 dark:text-surface-400">
          <ui-icon name="location" size="lg" class="mb-2 opacity-50"></ui-icon>
          <p>${__('Seleziona prima un museo nella tab Informazioni')}</p>
        </div>
      `;
    }

    if (this.steps.length === 0) {
      return html`
        <div class="text-center py-8 text-surface-500 dark:text-surface-400">
          <ui-icon name="list" size="lg" class="mb-2 opacity-50"></ui-icon>
          <p>${__('Aggiungi il primo passaggio del percorso')}</p>
        </div>
      `;
    }

    return html`
      <div class="space-y-3">
        ${repeat(
          this.steps,
          (step) => step.id,
          (step, index) => this.renderStepCard(step, index),
        )}
      </div>
    `;
  }

  private handleDragStart(e: DragEvent, index: number) {
    if (this.editingStepIndex !== null) {
      e.preventDefault();
      return;
    }
    this.draggingIndex = index;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', index.toString());
    }
  }

  private handleDragEnd() {
    this.draggingIndex = null;
    this.dragOverIndex = null;
  }

  private handleDragOver(e: DragEvent, index: number) {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move';
    }
    if (this.draggingIndex !== null && this.draggingIndex !== index) {
      this.dragOverIndex = index;
    }
  }

  private handleDragLeave() {
    this.dragOverIndex = null;
  }

  private handleDrop(e: DragEvent, targetIndex: number) {
    e.preventDefault();
    if (this.draggingIndex === null || this.draggingIndex === targetIndex) {
      this.draggingIndex = null;
      this.dragOverIndex = null;
      return;
    }

    const newSteps = [...this.steps];
    const [movedStep] = newSteps.splice(this.draggingIndex, 1);
    newSteps.splice(targetIndex, 0, movedStep);
    this.steps = newSteps;

    this.draggingIndex = null;
    this.dragOverIndex = null;
  }

  private renderStepCard(step: VisitStep, index: number) {
    const isEditing = this.editingStepIndex === index;
    const isDragging = this.draggingIndex === index;
    const isDragOver = this.dragOverIndex === index;
    const stepTypeLabel = getVisitStepTypeLabel(step.type);

    return html`
      <div
        class="step-card p-5 rounded-xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 shadow-soft transition-all duration-200
          ${isEditing ? 'ring-2 ring-brand-500' : ''}
          ${isDragging ? 'opacity-50 scale-95' : ''}
          ${isDragOver ? 'ring-2 ring-brand-400 ring-dashed' : ''}"
        draggable=${isEditing ? 'false' : 'true'}
        @dragstart=${(e: DragEvent) => this.handleDragStart(e, index)}
        @dragend=${() => this.handleDragEnd()}
        @dragover=${(e: DragEvent) => this.handleDragOver(e, index)}
        @dragleave=${() => this.handleDragLeave()}
        @drop=${(e: DragEvent) => this.handleDrop(e, index)}
      >
        <div class="flex items-start gap-4">
          <!-- Drag handle + Order number + Arrows -->
          <div class="flex flex-col items-center gap-1">
            <ui-icon-button
              icon="chevron-up"
              size="xs"
              .title=${__('Sposta su')}
              @click=${(e: Event) => {
                e.preventDefault();
                e.stopPropagation();
                this.moveStepUp(index);
              }}
              .disabled=${index === 0}
            ></ui-icon-button>
            <div
              class="cursor-grab active:cursor-grabbing p-1 rounded hover:bg-surface-100 dark:hover:bg-surface-800 ${isEditing
                ? 'opacity-30 cursor-not-allowed'
                : ''}"
              .title=${__('Trascina per riordinare')}
            >
              <span
                class="w-8 h-8 flex items-center justify-center rounded-full bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 font-semibold text-sm"
              >
                ${index + 1}
              </span>
            </div>
            <ui-icon-button
              icon="chevron-down"
              size="xs"
              .title=${__('Sposta giù')}
              @click=${(e: Event) => {
                e.preventDefault();
                e.stopPropagation();
                this.moveStepDown(index);
              }}
              .disabled=${index === this.steps.length - 1}
            ></ui-icon-button>
          </div>

          <!-- Step content -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-2">
              <ui-badge variant="outline" .label=${stepTypeLabel}></ui-badge>
              ${step.isOptional
                ? html`<ui-badge variant="secondary" .label=${__('Opzionale')}></ui-badge>`
                : nothing}
            </div>

            ${this.renderStepContent(step, index, isEditing)}
          </div>

          <!-- Actions -->
          <div class="flex items-center gap-1">${this.renderStepActions(index, isEditing)}</div>
        </div>
      </div>
    `;
  }

  private renderStepContent(step: VisitStep, index: number, isEditing: boolean) {
    if (isEditing) {
      return this.renderStepEditor(step, index);
    }
    return this.renderStepPreview(step, index);
  }

  private renderStepActions(index: number, isEditing: boolean) {
    if (isEditing) {
      return html`
        <ui-icon-button
          icon="check"
          variant="brand"
          .title=${__('Chiudi')}
          @click=${() => (this.editingStepIndex = null)}
        ></ui-icon-button>
        <ui-icon-button
          icon="trash"
          variant="danger"
          .title=${__('Rimuovi')}
          @click=${() => this.removeStep(index)}
        ></ui-icon-button>
      `;
    }
    return html`
      <ui-icon-button
        icon="edit"
        .title=${__('Modifica')}
        @click=${() => this.startEditingStep(index)}
      ></ui-icon-button>
      <ui-icon-button
        icon="trash"
        variant="danger"
        .title=${__('Rimuovi')}
        @click=${() => this.removeStep(index)}
      ></ui-icon-button>
    `;
  }

  private startEditingStep(index: number) {
    this.editingStepIndex = index;
    const step = this.steps[index];
    if (step?.type === VisitStepType.WAYPOINT) {
      this.waypointFloorId =
        this.findWaypointMarker(step.mapMarkerId)?.floorId || this.floors[0]?.id || '';
    } else if (step?.type === VisitStepType.ARTWORK && step.artworkId) {
      // Senza questo, la checklist contenuti (sotto, gated da
      // availableItems.length > 0) resta vuota finché non si riseleziona
      // l'opera dal menu — anche se la tappa ne ha già una impostata.
      void this.loadItemsForArtwork(step.artworkId);
    } else if (step?.type === VisitStepType.CONTENT && step.contentReferenceType) {
      void this.loadUsableItemsByReferenceType(step.contentReferenceType);
    }
  }

  private renderStepPreview(step: VisitStep, _index: number) {
    switch (step.type) {
      case VisitStepType.ARTWORK: {
        const artwork = this.artworks.find((a) => a.wikidataId === step.artworkId);
        return html`
          <div class="flex items-center gap-3">
            <div
              class="relative w-12 h-12 bg-surface-100 dark:bg-surface-800 rounded overflow-hidden flex-shrink-0"
            >
              ${artwork?.image
                ? html`
                    <img
                      src="${artwork.image}"
                      alt=""
                      class="w-full h-full object-cover"
                      @error=${(e: Event) => {
                        const img = e.target as HTMLImageElement;
                        img.style.display = 'none';
                        img.parentElement
                          ?.querySelector('ui-image-placeholder')
                          ?.removeAttribute('hidden');
                      }}
                    />
                    <ui-image-placeholder
                      type="artwork"
                      size="sm"
                      hidden
                      class="absolute inset-0"
                    ></ui-image-placeholder>
                  `
                : html`<ui-image-placeholder type="artwork" size="sm"></ui-image-placeholder>`}
            </div>
            <div>
              <p class="font-medium text-surface-900 dark:text-white">
                ${artwork?.title || __("Seleziona un'opera")}
              </p>
              ${artwork?.author
                ? html`<p class="text-sm text-surface-500">${artwork.author}</p>`
                : nothing}
            </div>
          </div>
        `;
      }
      case VisitStepType.LOGISTIC:
        return html`
          <div>
            <p class="font-medium text-surface-900 dark:text-white">
              ${step.logisticTitle || __('Info logistica')}
            </p>
            ${step.logisticText
              ? html`<p class="text-sm text-surface-500 line-clamp-2">${step.logisticText}</p>`
              : nothing}
            ${this.renderMapAssociationBadge(step)}
          </div>
        `;
      case VisitStepType.NAVIGATION:
        return html`
          <div>
            <p class="font-medium text-surface-900 dark:text-white">
              ${step.fromRoom && step.toRoom
                ? `${__('Da')} ${step.fromRoom} ${__('a')} ${step.toRoom}`
                : __('Indicazioni di navigazione')}
            </p>
            ${step.navigationText
              ? html`<p class="text-sm text-surface-500 line-clamp-2">${step.navigationText}</p>`
              : nothing}
            ${step.navigationVisual === 'map'
              ? html`<p class="text-xs text-brand-600 dark:text-brand-400 mt-1">
                  🗺️ ${__("Mostra la mappa integrata invece di un'immagine")}
                </p>`
              : nothing}
            ${this.renderMapAssociationBadge(step)}
          </div>
        `;
      case VisitStepType.WAYPOINT: {
        const waypoint = this.findWaypointMarker(step.mapMarkerId);
        const floorName = waypoint
          ? this.floors.find((f) => f.id === waypoint.floorId)?.name || waypoint.floorId
          : null;
        return html`
          <div>
            <p class="font-medium text-surface-900 dark:text-white">
              ${waypoint ? waypoint.label : __('Seleziona un waypoint sulla mappa')}
            </p>
            ${floorName ? html`<p class="text-sm text-surface-500">${floorName}</p>` : nothing}
          </div>
        `;
      }
      case VisitStepType.CONTENT: {
        const count = step.itemIds?.length || 0;
        return html`
          <div>
            <p class="font-medium text-surface-900 dark:text-white">
              ${step.contentReferenceType
                ? getReferenceTypeLabel(step.contentReferenceType)
                : __('Seleziona un tipo di approfondimento')}
            </p>
            ${count > 0
              ? html`<p class="text-sm text-surface-500">
                  ${count} ${count === 1 ? __('contenuto') : __('contenuti')}
                </p>`
              : nothing}
          </div>
        `;
      }
    }
  }

  private renderStepEditor(step: VisitStep, index: number) {
    switch (step.type) {
      case VisitStepType.ARTWORK:
        return this.renderArtworkStepEditor(step, index);
      case VisitStepType.LOGISTIC:
        return this.renderLogisticStepEditor(step, index);
      case VisitStepType.NAVIGATION:
        return this.renderNavigationStepEditor(step, index);
      case VisitStepType.WAYPOINT:
        return this.renderWaypointStepEditor(step, index);
      case VisitStepType.CONTENT:
        return this.renderContentStepEditor(step, index);
    }
  }

  private renderContentStepEditor(step: VisitStep, index: number) {
    return html`
      <div class="space-y-4 mt-3 pt-3 border-t border-surface-200 dark:border-surface-700">
        <ui-select
          .label=${__('Tipo di approfondimento')}
          .help=${__(
            'Determina quali Contenuti sono selezionabili qui sotto: solo quelli creati con lo stesso tipo di riferimento (Opera, Autore, Movimento, Periodo o Museo).',
          )}
          .value=${step.contentReferenceType || ''}
          .options=${CONTENT_STEP_REFERENCE_TYPE_OPTIONS}
          placeholder=${__('Seleziona un tipo')}
          @select-change=${async (e: CustomEvent) => {
            const contentReferenceType = e.detail.value as ItemReferenceType;
            // Cambiare tipo invalida la selezione precedente: gli item di un
            // tipo diverso non hanno senso per questa tappa.
            this.updateStep(index, { contentReferenceType, itemIds: [] });
            this.availableItems = [];
            if (contentReferenceType) {
              await this.loadUsableItemsByReferenceType(contentReferenceType);
            }
          }}
        ></ui-select>

        ${step.contentReferenceType ? this.renderItemChecklist(step, index) : nothing}

        <ui-input
          type="number"
          .label=${__('Durata stimata (secondi)')}
          .placeholder=${__('Es. 180')}
          .value=${String(step.estimatedDuration || '')}
          @input=${(e: InputEvent) =>
            this.updateStep(index, {
              estimatedDuration: parseInt((e.target as HTMLInputElement).value) || undefined,
            })}
        ></ui-input>

        <ui-checkbox
          .label=${__('Passaggio opzionale')}
          .checked=${step.isOptional}
          @checkbox-change=${(e: CustomEvent) =>
            this.updateStep(index, { isOptional: e.detail.checked })}
        ></ui-checkbox>
      </div>
    `;
  }

  private renderArtworkStepEditor(step: VisitStep, index: number) {
    return html`
      <div class="space-y-4 mt-3 pt-3 border-t border-surface-200 dark:border-surface-700">
        <ui-select
          .label=${__('Opera')}
          .value=${step.artworkId || ''}
          .options=${this.artworks.map((a) => ({
            value: a.wikidataId,
            label: `${a.title} - ${a.author || __('Autore sconosciuto')}`,
          }))}
          placeholder=${this.loadingArtworks ? __('Caricamento...') : __("Seleziona un'opera")}
          ?disabled=${this.loadingArtworks}
          @select-change=${async (e: CustomEvent) => {
            const artworkId = e.detail.value;
            this.updateStep(index, { artworkId });
            if (artworkId) {
              await this.loadItemsForArtwork(artworkId);
            }
          }}
        ></ui-select>

        ${step.artworkId ? this.renderItemChecklist(step, index) : nothing}

        <ui-input
          type="number"
          .label=${__('Durata stimata (secondi)')}
          .placeholder=${__('Es. 180')}
          .value=${String(step.estimatedDuration || '')}
          @input=${(e: InputEvent) =>
            this.updateStep(index, {
              estimatedDuration: parseInt((e.target as HTMLInputElement).value) || undefined,
            })}
        ></ui-input>

        <ui-checkbox
          .label=${__('Passaggio opzionale')}
          .checked=${step.isOptional}
          @checkbox-change=${(e: CustomEvent) =>
            this.updateStep(index, { isOptional: e.detail.checked })}
        ></ui-checkbox>
      </div>
    `;
  }

  // Checklist contenuti condivisa tra tappe ARTWORK e CONTENT: entrambe
  // scelgono da this.availableItems (caricato da loadItemsForArtwork /
  // loadUsableItemsByReferenceType a seconda del tipo) verso step.itemIds.
  private renderItemChecklist(step: VisitStep, index: number) {
    if (this.availableItems.length === 0) return nothing;
    return html`
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <label class="block text-sm font-medium text-surface-700 dark:text-surface-300">
            ${__('Contenuti disponibili')}
          </label>
          <div class="flex gap-2">
            <ui-button
              type="button"
              variant="ghost"
              size="xs"
              .label=${__('Seleziona tutti')}
              @click=${() => {
                const allIds = this.availableItems.map((item) => item._id);
                this.updateStep(index, { itemIds: allIds });
              }}
            ></ui-button>
            <span class="text-surface-300">|</span>
            <ui-button
              type="button"
              variant="ghost"
              size="xs"
              .label=${__('Deseleziona tutti')}
              @click=${() => this.updateStep(index, { itemIds: [] })}
            ></ui-button>
          </div>
        </div>
        <div class="space-y-2">
          ${this.availableItems.map(
            (item) => html`
              <label
                class="flex items-center gap-2 p-2 rounded border border-surface-200 dark:border-surface-700 cursor-pointer hover:bg-surface-50 dark:hover:bg-surface-800"
              >
                <ui-checkbox
                  .checked=${step.itemIds?.includes(item._id)}
                  @checkbox-change=${(e: CustomEvent) => {
                    const checked = e.detail.checked;
                    const currentIds = step.itemIds || [];
                    const newIds = checked
                      ? [...currentIds, item._id]
                      : currentIds.filter((id) => id !== item._id);
                    this.updateStep(index, { itemIds: newIds });
                  }}
                ></ui-checkbox>
                <span class="flex-1 text-sm">
                  ${item.title}
                  <span class="text-surface-500">
                    - ${item.duration},
                    ${item.languageLevel}${item.authorName
                      ? html` · ${__('di')} ${item.authorName}`
                      : nothing}</span
                  >
                </span>
              </label>
            `,
          )}
        </div>
      </div>
    `;
  }

  /** Riga "📍 associato a: X" nell'anteprima di una tappa LOGISTIC/NAVIGATION,
   * solo quando è stato scelto un punto sulla mappa. */
  private renderMapAssociationBadge(step: VisitStep) {
    if (!step.mapMarkerId) return nothing;
    const marker = this.findWaypointMarker(step.mapMarkerId);
    return html`<p class="text-xs text-surface-400 mt-1">
      📍 ${__('Associato a')}: ${marker?.label || __('punto sulla mappa')}
    </p>`;
  }

  /**
   * Associazione facoltativa a un punto della mappa, condivisa da LOGISTIC e
   * NAVIGATION: a differenza della svolta (sempre un waypoint muto), qui il
   * curatore può scegliere un punto di interesse qualsiasi — un ingresso, un
   * bar, un info point, un'opera — che il Navigator userà per mostrare/
   * evidenziare quel punto sulla mappa a questa tappa.
   */
  private renderMapMarkerPicker(step: VisitStep, index: number) {
    const options = this.getAllMarkerOptions();
    return html`
      <ui-select
        .label=${__('Punto sulla mappa (opzionale)')}
        .value=${step.mapMarkerId || ''}
        .options=${options}
        clearable
        placeholder=${this.loadingFloors
          ? __('Caricamento piani...')
          : options.length === 0
            ? __('Nessun marker sulla piantina di questo museo')
            : __('Nessuno')}
        ?disabled=${this.loadingFloors || options.length === 0}
        @select-change=${(e: CustomEvent) =>
          this.updateStep(index, { mapMarkerId: e.detail.value || undefined })}
      ></ui-select>
    `;
  }

  private renderLogisticStepEditor(step: VisitStep, index: number) {
    return html`
      <div class="space-y-4 mt-3 pt-3 border-t border-surface-200 dark:border-surface-700">
        <ui-input
          .label=${__('Titolo')}
          .placeholder=${__('Es. Informazioni utili')}
          .value=${step.logisticTitle || ''}
          @input=${(e: InputEvent) =>
            this.updateStep(index, { logisticTitle: (e.target as HTMLInputElement).value })}
        ></ui-input>

        <ui-textarea
          .label=${__('Testo')}
          .placeholder=${__('Descrivi le informazioni logistiche...')}
          .value=${step.logisticText || ''}
          @input=${(e: InputEvent) =>
            this.updateStep(index, { logisticText: (e.target as HTMLTextAreaElement).value })}
          rows="3"
        ></ui-textarea>

        <ui-select
          .label=${__('Icona')}
          .value=${step.logisticIcon || 'info'}
          .options=${this.logisticIcons}
          @select-change=${(e: CustomEvent) =>
            this.updateStep(index, { logisticIcon: e.detail.value })}
        ></ui-select>

        ${this.renderMapMarkerPicker(step, index)}

        <ui-checkbox
          .label=${__('Passaggio opzionale')}
          .checked=${step.isOptional}
          @checkbox-change=${(e: CustomEvent) =>
            this.updateStep(index, { isOptional: e.detail.checked })}
        ></ui-checkbox>
      </div>
    `;
  }

  private renderNavigationStepEditor(step: VisitStep, index: number) {
    const visual = step.navigationVisual || 'image';
    return html`
      <div class="space-y-4 mt-3 pt-3 border-t border-surface-200 dark:border-surface-700">
        <div class="grid grid-cols-2 gap-4">
          <ui-input
            .label=${__('Da (sala/area)')}
            .placeholder=${__('Es. Sala 1')}
            .value=${step.fromRoom || ''}
            @input=${(e: InputEvent) =>
              this.updateStep(index, { fromRoom: (e.target as HTMLInputElement).value })}
          ></ui-input>

          <ui-input
            .label=${__('A (sala/area)')}
            .placeholder=${__('Es. Sala 3')}
            .value=${step.toRoom || ''}
            @input=${(e: InputEvent) =>
              this.updateStep(index, { toRoom: (e.target as HTMLInputElement).value })}
          ></ui-input>
        </div>

        <ui-textarea
          .label=${__('Indicazioni')}
          .placeholder=${__('Es. Prosegui dritto, alla fine del corridoio gira a sinistra...')}
          .value=${step.navigationText || ''}
          @input=${(e: InputEvent) =>
            this.updateStep(index, { navigationText: (e.target as HTMLTextAreaElement).value })}
          rows="3"
        ></ui-textarea>

        ${this.renderMapMarkerPicker(step, index)}

        <div>
          <p class="text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
            ${__('Immagine della tappa')}
          </p>
          <ui-filter-tabs
            .tabs=${[
              { value: 'image', label: __('Immagine') },
              { value: 'map', label: __('Mappa integrata') },
            ]}
            .value=${visual}
            @filter-change=${(e: CustomEvent) => {
              const nextVisual = e.detail.value as 'image' | 'map';
              // "Oppure": le due modalità sono alternative, non sommabili —
              // passando a "Mappa" l'immagine caricata smette di avere senso
              // (e viceversa non serve azzerare il punto sulla mappa, resta
              // utile anche in modalità immagine per il "Vedi sulla mappa").
              this.updateStep(index, {
                navigationVisual: nextVisual,
                navigationImage: nextVisual === 'map' ? undefined : step.navigationImage,
              });
            }}
          ></ui-filter-tabs>
        </div>

        ${visual === 'image'
          ? html`
              <image-editor
                .label=${__('Immagine del percorso')}
                category="visits"
                .value=${step.navigationImage || ''}
                maxWidth=${1600}
                maxHeight=${1200}
                .maxOutputSizeMb=${1}
                defaultFormat="webp"
                @image-saved=${(e: CustomEvent) =>
                  this.updateStep(index, { navigationImage: e.detail.path || '' })}
              ></image-editor>
            `
          : html`
              <p class="text-sm text-surface-500 dark:text-surface-400">
                ${step.mapMarkerId
                  ? __(
                      "A questa tappa il Navigator mostrerà la mappa del museo centrata sul punto scelto sopra, invece di un'immagine.",
                    )
                  : __(
                      "A questa tappa il Navigator mostrerà la mappa del museo invece di un'immagine. Scegli anche un punto qui sopra per centrarla su un posto preciso.",
                    )}
              </p>
            `}

        <ui-checkbox
          .label=${__('Passaggio opzionale')}
          .checked=${step.isOptional}
          @checkbox-change=${(e: CustomEvent) =>
            this.updateStep(index, { isOptional: e.detail.checked })}
        ></ui-checkbox>
      </div>
    `;
  }

  private renderWaypointStepEditor(step: VisitStep, index: number) {
    const waypointOptions = this.waypointFloorId
      ? this.getWaypointOptions(this.waypointFloorId)
      : [];

    return html`
      <div class="space-y-4 mt-3 pt-3 border-t border-surface-200 dark:border-surface-700">
        <p class="text-sm text-surface-500 dark:text-surface-400">
          ${__(
            'Punto muto, senza audio: serve solo a far piegare la linea del percorso sulla mappa (es. una porta su un corridoio) invece di tagliare dritto attraverso un muro.',
          )}
        </p>

        ${this.floors.length > 1
          ? html`
              <ui-select
                .label=${__('Piano')}
                .value=${this.waypointFloorId}
                .options=${this.floors.map((f) => ({ value: f.id, label: f.name }))}
                @select-change=${(e: CustomEvent) => {
                  this.waypointFloorId = e.detail.value;
                  this.updateStep(index, { mapMarkerId: undefined });
                }}
              ></ui-select>
            `
          : nothing}

        <ui-select
          .label=${__('Waypoint')}
          .value=${step.mapMarkerId || ''}
          .options=${waypointOptions}
          placeholder=${this.loadingFloors
            ? __('Caricamento piani...')
            : waypointOptions.length === 0
              ? __('Nessun waypoint su questo piano: creane uno da Piantina e mappa')
              : __('Seleziona un waypoint')}
          ?disabled=${this.loadingFloors || waypointOptions.length === 0}
          @select-change=${(e: CustomEvent) =>
            this.updateStep(index, { mapMarkerId: e.detail.value })}
        ></ui-select>
      </div>
    `;
  }

  private renderAudienceTab() {
    return html`
      <div class="space-y-8">
        <ui-panel-section
          .title=${__('Livelli di linguaggio supportati')}
          icon="document"
          .description=${__('Seleziona i livelli per cui questa visita è adatta')}
          .renderContent=${() => html`
            <div class="space-y-2">
              ${this.languageLevelOptions.map(
                (option) => html`
                  <label
                    class="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-surface-50 dark:hover:bg-surface-800"
                  >
                    <ui-checkbox
                      .checked=${this.languageLevels.includes(option.value)}
                      @checkbox-change=${(e: CustomEvent) => {
                        const checked = e.detail.checked;
                        if (checked) {
                          this.languageLevels = [...this.languageLevels, option.value];
                        } else {
                          this.languageLevels = this.languageLevels.filter(
                            (l) => l !== option.value,
                          );
                        }
                      }}
                    ></ui-checkbox>
                    <span class="text-sm text-surface-700 dark:text-surface-300"
                      >${option.label}</span
                    >
                  </label>
                `,
              )}
            </div>
          `}
        ></ui-panel-section>

        <ui-panel-section
          .title=${__("Fascia d'età")}
          icon="users"
          .renderContent=${() => html`
            <div class="grid grid-cols-2 gap-4">
              <ui-input
                type="number"
                .label=${__('Età minima')}
                .placeholder=${__('Es. 8')}
                .value=${String(this.minAge || '')}
                @input=${(e: InputEvent) =>
                  (this.minAge = parseInt((e.target as HTMLInputElement).value) || undefined)}
              ></ui-input>
              <ui-input
                type="number"
                .label=${__('Età massima')}
                .placeholder=${__('Es. 99')}
                .value=${String(this.maxAge || '')}
                @input=${(e: InputEvent) =>
                  (this.maxAge = parseInt((e.target as HTMLInputElement).value) || undefined)}
              ></ui-input>
            </div>
          `}
        ></ui-panel-section>

        <ui-panel-section
          .title=${__('Durata stimata')}
          icon="clock"
          .renderContent=${() => html`
            <ui-input
              type="number"
              .label=${__('Durata (minuti)')}
              .placeholder=${__('Es. 60')}
              .value=${String(this.estimatedDuration)}
              @input=${(e: InputEvent) =>
                (this.estimatedDuration = parseInt((e.target as HTMLInputElement).value) || 60)}
            ></ui-input>
          `}
        ></ui-panel-section>

        <ui-panel-section
          .title=${__('Interessi correlati')}
          icon="tag"
          .renderContent=${() => html`
            <ui-tag-input
              .placeholder=${__('Es. Arte barocca')}
              .tags=${this.interests}
              .lowercase=${false}
              .emptyText=${__('Nessun interesse aggiunto')}
              @tags-change=${(e: CustomEvent<{ tags: string[] }>) => {
                this.interests = e.detail.tags;
              }}
            ></ui-tag-input>
          `}
        ></ui-panel-section>
      </div>
    `;
  }

  private renderSettingsTab() {
    return html`
      <div class="space-y-8">
        <ui-panel-section
          .title=${__('Lingua')}
          icon="globe"
          .renderContent=${() => html`
            <ui-language-select
              .label=${__('Lingua principale')}
              .value=${this.language}
              .languages=${this.activeLanguages}
              @select-change=${(e: CustomEvent) =>
                (this.language = (e.detail.value || 'it') as AppLanguage)}
            ></ui-language-select>
          `}
        ></ui-panel-section>

        <ui-panel-section
          .title=${__('Prezzo')}
          icon="euro"
          .renderContent=${() => html`
            <div class="space-y-4">
              <ui-checkbox
                .label=${__('Visita gratuita')}
                .checked=${this.isFree}
                @checkbox-change=${(e: CustomEvent) => (this.isFree = e.detail.checked)}
              ></ui-checkbox>

              ${!this.isFree
                ? html`
                    <ui-input
                      type="number"
                      .label=${__('Prezzo (€)')}
                      .placeholder=${__('Es. 4.99')}
                      .value=${String(this.price)}
                      @input=${(e: InputEvent) =>
                        (this.price = parseFloat((e.target as HTMLInputElement).value) || 0)}
                      step="0.01"
                      min="0"
                    ></ui-input>
                  `
                : nothing}
            </div>
          `}
        ></ui-panel-section>

        <ui-panel-section
          .title=${__('Servizi disponibili')}
          icon="cog"
          .help=${__(
            'Testo libero mostrato nella scheda della visita — non collegato ai "Servizi del museo" (quelli strutturati, con marker sulla mappa) gestiti in Gestione Musei.',
          )}
          .renderContent=${() => html`
            <ui-tag-input
              .placeholder=${__('Es. Bar, Guardaroba, WiFi')}
              .tags=${this.services}
              .lowercase=${false}
              .emptyText=${__('Nessun servizio aggiunto')}
              @tags-change=${(e: CustomEvent<{ tags: string[] }>) => {
                this.services = e.detail.tags;
              }}
            ></ui-tag-input>
          `}
        ></ui-panel-section>

        <ui-panel-section
          .title=${__('Consigli per i visitatori')}
          icon="info"
          .renderContent=${() => html`
            <ui-tag-input
              .placeholder=${__('Es. Arrivare con 15 minuti di anticipo')}
              .tags=${this.tips}
              .lowercase=${false}
              .emptyText=${__('Nessun consiglio aggiunto')}
              @tags-change=${(e: CustomEvent<{ tags: string[] }>) => {
                this.tips = e.detail.tags;
              }}
            ></ui-tag-input>
          `}
        ></ui-panel-section>

        ${this.visitId
          ? html`
              <ui-panel-section
                .title=${__('Strumenti AI')}
                icon="sparkles"
                .renderContent=${() => html`
                  <div class="divide-y divide-surface-100 dark:divide-surface-800">
                    <div class="pb-4">${this.renderTranslationSyncBlock()}</div>
                    <div class="pt-4">${this.renderAudioGenerationBlock()}</div>
                  </div>
                `}
              ></ui-panel-section>
            `
          : nothing}
      </div>
    `;
  }

  // Blocco traduzioni: sezione dedicata nelle Impostazioni, separata dal
  // blocco audio sotto.
  private renderTranslationSyncBlock() {
    const activeJob = this.jobs.find(
      (job) =>
        job.status === 'running' && job.type === 'sync-languages' && job.visitId === this.visitId,
    );
    const blockedElsewhere =
      !activeJob &&
      this.jobs.some((job) => job.status === 'running' && job.type === 'sync-languages');

    return html`
      <div class="space-y-3">
        <h4 class="text-sm font-semibold text-surface-800 dark:text-surface-100">
          ${__('Traduzioni')}
        </h4>
        <p class="text-sm text-surface-500 dark:text-surface-400">
          ${__(
            'Applica le lingue attive del museo al testo di questa visita e degli item che referenzia: rimuove traduzioni non richieste e genera con AI quelle mancanti.',
          )}
        </p>
        ${activeJob
          ? html`
              <div
                class="flex items-center gap-2 text-sm font-medium text-brand-600 dark:text-brand-400"
              >
                <span class="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse"></span>
                ${__("Sincronizzazione in corso — segui l'avanzamento dalle notifiche.")}
              </div>
            `
          : html`
              <div class="flex items-center gap-3">
                <ui-button
                  type="button"
                  variant="secondary"
                  size="sm"
                  icon="translate"
                  .label=${__('Sincronizza traduzioni')}
                  .loading=${this.syncingLanguages}
                  .disabled=${blockedElsewhere}
                  @click=${() => this.handleSyncLanguagesClick()}
                ></ui-button>
                ${blockedElsewhere
                  ? html`
                      <p class="text-xs text-amber-600 dark:text-amber-400">
                        ${__(
                          "Un'altra sincronizzazione è già in corso altrove: attendi che finisca (vedi notifiche).",
                        )}
                      </p>
                    `
                  : nothing}
              </div>
            `}
      </div>
    `;
  }

  private renderAudioGenerationBlock() {
    const activeJob = this.jobs.find(
      (job) =>
        job.status === 'running' && job.type === 'generate-audio' && job.visitId === this.visitId,
    );
    const blockedElsewhere =
      !activeJob &&
      this.jobs.some((job) => job.status === 'running' && job.type === 'generate-audio');

    return html`
      <div class="space-y-3">
        <h4 class="text-sm font-semibold text-surface-800 dark:text-surface-100">${__('Audio')}</h4>
        <p class="text-sm text-surface-500 dark:text-surface-400">
          ${__(
            "Genera con OpenAI (voce naturale + evidenziazione sincronizzata nel Navigator) l'audio mancante degli item e delle tappe Info/Indicazioni di questa visita — non rigenera l'audio già presente.",
          )}
        </p>
        ${activeJob
          ? html`
              <div
                class="flex items-center gap-2 text-sm font-medium text-brand-600 dark:text-brand-400"
              >
                <span class="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse"></span>
                ${__("Generazione in corso — segui l'avanzamento dalle notifiche.")}
              </div>
            `
          : html`
              <div class="flex items-center gap-3">
                <ui-button
                  type="button"
                  variant="secondary"
                  size="sm"
                  icon="sparkles"
                  .label=${__('Genera audio mancante')}
                  .loading=${this.generatingAudio}
                  .disabled=${blockedElsewhere}
                  @click=${() => this.handleGenerateAudioClick()}
                ></ui-button>
                ${blockedElsewhere
                  ? html`
                      <p class="text-xs text-amber-600 dark:text-amber-400">
                        ${__(
                          "Un'altra generazione è già in corso altrove: attendi che finisca (vedi notifiche).",
                        )}
                      </p>
                    `
                  : nothing}
              </div>
            `}
      </div>
    `;
  }
}
