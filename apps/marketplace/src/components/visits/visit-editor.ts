import { html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import {
  VisitStepType,
  ItemReferenceType,
  LanguageLevel,
  LicenseType,
  MarkerType,
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
import { jobsService, type Job } from '../../services/jobs.service';
import { modalService } from '../../services/modal.service';
import { __ } from '../../services/i18n.service';
import { runBatchTranslation } from '../../utils/translation-batch';
import { renderFeedbackAlerts } from '../../utils/feedback-alerts';
import { MuseumAwareMixin, AppBaseElement } from '../../base';
import '../ui/ui-button';
import '../ui/ui-form-actions';
import '../ui/ui-badge';
import '../ui/ui-loading';
import '../ui/ui-alert';
import '../ui/ui-tabs';
import './visit-info-tab';
import './visit-steps-tab';
import './visit-map-tab';
import './visit-audience-tab';
import './visit-settings-tab';

type EditorTab = 'info' | 'steps' | 'map' | 'audience' | 'settings';

/**
 * Editor di una visita: informazioni, percorso, mappa, pubblico e impostazioni.
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
  // La primissima emissione di activeTab corregge solo l'URL (replace), poi ogni cambio è un vero passo di history.
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
  // Piano su cui si sceglie il waypoint per lo step in modifica — solo per filtrare la lista.
  @state() private waypointFloorId = '';
  // Piano mostrato nella tab "Mappa" (anteprima del percorso).
  @state() private mapTabFloorId = '';
  // Marker WAYPOINT creati ad hoc cliccando un punto vuoto della mappa: rimuovere
  // la tappa deve ripulire anche il marker, o resta orfano sulla piantina.
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

  // L'esito di un'azione (es. "Sincronizza traduzioni") appare in cima alla pagina:
  // lo scrolla in vista ogni volta che success/error cambia, o passerebbe inosservato.
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

    // Notifica il genitore (visits-page) ad ogni cambio tab, per la history —
    // la primissima emissione sostituisce invece di aggiungere un passo.
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

  // Marker di tipo waypoint disponibili su un piano, per lo step editor.
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

  // Etichetta leggibile per ogni tipo di marker, quando non ha un'etichetta impostata dal curatore.
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

  // Tutti i marker (tranne WAYPOINT) su tutti i piani, per associare una tappa LOGISTIC/NAVIGATION a un punto della mappa.
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

  // Trova un marker qualsiasi (non solo waypoint) per id, su tutti i piani.
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

  // Risolve gli step ARTWORK/WAYPOINT in punti con coordinate reali sulla mappa, per l'anteprima del percorso.
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

    await runBatchTranslation({
      sourceLanguage: this.language,
      targetLanguages: this.getTargetLanguages(),
      validationErrorMessage: __(
        'Compila titolo e descrizione nella lingua principale prima di tradurre',
      ),
      getFields: (lang) => [
        {
          key: 'title',
          sourceValue: sourceTitle,
          currentValue: this.titleTranslations[lang] || '',
        },
        {
          key: 'description',
          sourceValue: sourceDescription,
          currentValue: this.descriptionTranslations[lang] || '',
        },
      ],
      onFieldTranslated: (lang, key, value) => {
        if (key === 'title') {
          this.titleTranslations = { ...this.titleTranslations, [lang]: value };
        } else {
          this.descriptionTranslations = { ...this.descriptionTranslations, [lang]: value };
        }
      },
      onLanguageTranslatedByAI: (lang) => {
        if (this.translationModeByLang[lang] !== 'manual') {
          this.translationModeByLang = { ...this.translationModeByLang, [lang]: 'ai' };
        }
      },
      onError: (message) => {
        this.error = message;
      },
      onTranslatingChange: (translating) => {
        this.translating = translating;
      },
    });
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

  // Solo item che l'utente autenticato può abbinare, non il catalogo pubblico completo.
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
  private async handleMuseumChange(museumId: string) {
    this.museumId = museumId;
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

    // Il marker è stato creato apposta per questa tappa: rimuoverla senza avvisare
    // lo farebbe sparire dalla piantina senza che sia ovvio perché.
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

  // Toglie dalla piantina un marker creato ad hoc — mai per uno preesistente riusato.
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
    // Uno step "opera" appena aggiunto non ha ancora un'opera selezionata — senza
    // questo controllo l'errore arriverebbe solo dal server, a salvataggio fatto.
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
        <div id="feedback-alert" class="scroll-mt-20">
          ${renderFeedbackAlerts({ error: this.error, success: this.success })}
        </div>

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
        <div class="tab-content">${this.renderActiveTab()}</div>
        <ui-form-actions
          .submitLabel=${this.visitId ? __('Salva Modifiche') : __('Crea Visita')}
          .loading=${this.saving}
          @cancel=${this.handleCancel}
        ></ui-form-actions>
      </form>
    `;
  }

  // ─── Helper di render ──────────────────────────────────────
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
      <visit-info-tab
        .museums=${this.museums}
        .museumId=${this.museumId}
        .loadingMuseums=${this.loadingMuseums}
        .visitTitle=${this.visitTitle}
        .description=${this.description}
        .coverImage=${this.coverImage}
        .targetLanguages=${this.getTargetLanguages()}
        .titleTranslations=${this.titleTranslations}
        .descriptionTranslations=${this.descriptionTranslations}
        .translating=${this.translating}
        .getLanguageLabel=${(lang: AppLanguage) => this.getLanguageLabel(lang)}
        .getTranslationStatus=${(lang: AppLanguage) => this.getTranslationStatus(lang)}
        .costs=${this.costs}
        .ticketInfo=${this.ticketInfo}
        .openingHours=${this.openingHours}
        .accessibility=${this.accessibility}
        .wheelchairAccessible=${this.wheelchairAccessible}
        @info-change=${(e: CustomEvent) => this.handleInfoChange(e)}
        @translation-change=${(e: CustomEvent) => this.handleTranslationChange(e)}
        @translate-missing=${() => this.translateMissingVisitLanguages()}
      ></visit-info-tab>
    `;
  }

  private handleInfoChange(e: CustomEvent<Record<string, unknown>>) {
    const detail = e.detail;
    if ('museumId' in detail) {
      void this.handleMuseumChange(detail.museumId as string);
    }
    if ('visitTitle' in detail) this.visitTitle = detail.visitTitle as string;
    if ('description' in detail) this.description = detail.description as string;
    if ('coverImage' in detail) this.coverImage = detail.coverImage as string;
    if ('costs' in detail) this.costs = detail.costs as string;
    if ('ticketInfo' in detail) this.ticketInfo = detail.ticketInfo as string;
    if ('openingHours' in detail) this.openingHours = detail.openingHours as string;
    if ('accessibility' in detail) this.accessibility = detail.accessibility as string;
    if ('wheelchairAccessible' in detail) {
      this.wheelchairAccessible = detail.wheelchairAccessible as boolean;
    }
  }

  private handleTranslationChange(
    e: CustomEvent<{ lang: AppLanguage; field: 'title' | 'description'; value: string }>,
  ) {
    const { lang, field, value } = e.detail;
    if (field === 'title') {
      this.titleTranslations = { ...this.titleTranslations, [lang]: value };
    } else {
      this.descriptionTranslations = { ...this.descriptionTranslations, [lang]: value };
    }
    this.markLanguageAsManual(lang);
  }

  private renderStepsTab() {
    return html`
      <visit-steps-tab
        .museumId=${this.museumId}
        .artworks=${this.artworks}
        .loadingArtworks=${this.loadingArtworks}
        .floors=${this.floors}
        .loadingFloors=${this.loadingFloors}
        .steps=${this.steps}
        .editingStepIndex=${this.editingStepIndex}
        .draggingIndex=${this.draggingIndex}
        .dragOverIndex=${this.dragOverIndex}
        .availableItems=${this.availableItems}
        .waypointFloorId=${this.waypointFloorId}
        .markerOptions=${this.getAllMarkerOptions()}
        .waypointOptions=${this.waypointFloorId
          ? this.getWaypointOptions(this.waypointFloorId)
          : []}
        .findWaypointMarker=${(id?: string) => this.findWaypointMarker(id)}
        @add-step=${(e: CustomEvent) => this.addStep(e.detail.type)}
        @move-step-up=${(e: CustomEvent) => this.moveStepUp(e.detail.index)}
        @move-step-down=${(e: CustomEvent) => this.moveStepDown(e.detail.index)}
        @remove-step=${(e: CustomEvent) => this.removeStep(e.detail.index)}
        @start-editing-step=${(e: CustomEvent) => this.startEditingStep(e.detail.index)}
        @close-editing-step=${() => (this.editingStepIndex = null)}
        @drag-start=${(e: CustomEvent) => (this.draggingIndex = e.detail.index)}
        @drag-end=${() => {
          this.draggingIndex = null;
          this.dragOverIndex = null;
        }}
        @drag-over=${(e: CustomEvent) => {
          if (this.draggingIndex !== null && this.draggingIndex !== e.detail.index) {
            this.dragOverIndex = e.detail.index;
          }
        }}
        @drag-leave=${() => (this.dragOverIndex = null)}
        @drop-step=${(e: CustomEvent) => this.handleDropStep(e.detail.index)}
        @step-update=${(e: CustomEvent) => this.updateStep(e.detail.index, e.detail.updates)}
        @load-artwork-items=${(e: CustomEvent) => this.loadItemsForArtwork(e.detail.artworkId)}
        @load-reference-items=${(e: CustomEvent) => {
          this.availableItems = [];
          void this.loadUsableItemsByReferenceType(e.detail.referenceType);
        }}
        @waypoint-floor-change=${(e: CustomEvent) => {
          this.waypointFloorId = e.detail.floorId;
          this.updateStep(e.detail.index, { mapMarkerId: undefined });
        }}
      ></visit-steps-tab>
    `;
  }

  private handleDropStep(targetIndex: number) {
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

  private renderMapTab() {
    return html`
      <visit-map-tab
        .loadingFloors=${this.loadingFloors}
        .floors=${this.floors}
        .artworks=${this.artworks}
        .floorId=${this.mapTabFloorId}
        .routePoints=${this.getVisitRoutePoints()}
        .stepsCount=${this.steps.length}
        @floor-change=${(e: CustomEvent) => (this.mapTabFloorId = e.detail.floorId)}
        @undo-last-step=${() => this.undoLastRouteStep()}
        @route-point-add=${(e: CustomEvent) => this.handleRoutePointAdd(e)}
        @route-marker-add=${(e: CustomEvent) => this.handleRouteMarkerAdd(e)}
      ></visit-map-tab>
    `;
  }

  // ─── Azioni (costruzione percorso dalla mappa) ─────────
  // Click su un punto vuoto della mappa nel tab "Mappa": crea una nuova svolta (marker WAYPOINT) sul piano corrente e la accoda…
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
    // Creato apposta per questa tappa: removeStep/undoLastRouteStep lo ripuliscono dalla piantina.
    this.autoCreatedMarkerIds.add(marker.id);

    this.appendStep({
      id: this.generateStepId(),
      order: this.steps.length,
      type: VisitStepType.WAYPOINT,
      isOptional: false,
      mapMarkerId: marker.id,
    });
  }

  // Click su un marker nel tab "Mappa": un'opera diventa tappa ARTWORK, una svolta esistente si riusa come WAYPOINT.
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
    // Stessa pulizia di removeStep ma senza conferma: si sta annullando la propria ultima azione.
    if (
      lastStep.type === VisitStepType.WAYPOINT &&
      lastStep.mapMarkerId &&
      this.autoCreatedMarkerIds.has(lastStep.mapMarkerId)
    ) {
      void this.deleteAutoCreatedMarker(lastStep.mapMarkerId);
    }
  }

  private startEditingStep(index: number) {
    this.editingStepIndex = index;
    const step = this.steps[index];
    if (step?.type === VisitStepType.WAYPOINT) {
      this.waypointFloorId =
        this.findWaypointMarker(step.mapMarkerId)?.floorId || this.floors[0]?.id || '';
    } else if (step?.type === VisitStepType.ARTWORK && step.artworkId) {
      // Senza questo la checklist contenuti resta vuota finché non si riseleziona l'opera.
      void this.loadItemsForArtwork(step.artworkId);
    } else if (step?.type === VisitStepType.CONTENT && step.contentReferenceType) {
      void this.loadUsableItemsByReferenceType(step.contentReferenceType);
    }
  }

  private renderAudienceTab() {
    return html`
      <visit-audience-tab
        .languageLevels=${this.languageLevels}
        .minAge=${this.minAge}
        .maxAge=${this.maxAge}
        .estimatedDuration=${this.estimatedDuration}
        .interests=${this.interests}
        @audience-change=${(e: CustomEvent) => this.handleAudienceChange(e)}
      ></visit-audience-tab>
    `;
  }

  private handleAudienceChange(e: CustomEvent<Record<string, unknown>>) {
    const detail = e.detail;
    if ('languageLevels' in detail) this.languageLevels = detail.languageLevels as LanguageLevel[];
    if ('minAge' in detail) this.minAge = detail.minAge as number | undefined;
    if ('maxAge' in detail) this.maxAge = detail.maxAge as number | undefined;
    if ('estimatedDuration' in detail) this.estimatedDuration = detail.estimatedDuration as number;
    if ('interests' in detail) this.interests = detail.interests as string[];
  }

  private renderSettingsTab() {
    return html`
      <visit-settings-tab
        .visitId=${this.visitId}
        .language=${this.language}
        .activeLanguages=${this.activeLanguages}
        .isFree=${this.isFree}
        .price=${this.price}
        .services=${this.services}
        .tips=${this.tips}
        .jobs=${this.jobs}
        .syncingLanguages=${this.syncingLanguages}
        .generatingAudio=${this.generatingAudio}
        @settings-change=${(e: CustomEvent) => this.handleSettingsChange(e)}
        @sync-languages=${() => this.syncVisitLanguages()}
        @generate-audio=${() => this.generateVisitAudio()}
      ></visit-settings-tab>
    `;
  }

  private handleSettingsChange(e: CustomEvent<Record<string, unknown>>) {
    const detail = e.detail;
    if ('language' in detail) this.language = detail.language as AppLanguage;
    if ('isFree' in detail) this.isFree = detail.isFree as boolean;
    if ('price' in detail) this.price = detail.price as number;
    if ('services' in detail) this.services = detail.services as string[];
    if ('tips' in detail) this.tips = detail.tips as string[];
  }
}
