import { html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import {
  LANGUAGE_LEVEL_OPTIONS_EMOJI_IT,
  VisitStepType,
  LanguageLevel,
  LicenseType,
  MarkerType,
  getVisitStepTypeLabel,
  type Artwork,
  type Item,
  type CreateVisitData,
  type UpdateVisitData,
  type VisitStep,
  type VisitGeneralInfo,
  type TargetAudience,
  type Museum,
  type MuseumFloor,
  type AppLanguage,
  isSupportedAppLanguage,
} from '@artaround/shared';
import { visitService } from '../../services/visit.service';
import { museumService } from '../../services/museum.service';
import { artworkService } from '../../services/artwork.service';
import { itemService } from '../../services/item.service';
import { translationService } from '../../services/translation.service';
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
import '../ui/ui-language-select';
import '../museums/svg-map-editor';

type EditorTab = 'info' | 'steps' | 'map' | 'audience' | 'settings';

/**
 * Visit Editor Component
 *
 * Creates and edits visits (percorsi di visita).
 * A visit is an ordered sequence of steps through a museum.
 */
@customElement('visit-editor')
export class VisitEditor extends MuseumAwareMixin(AppBaseElement) {
  @property({ type: String }) visitId = ''; // For edit mode

  @state() private loadingVisit = false;
  @state() private saving = false;
  @state() private translating = false;
  @state() private error = '';
  @state() private success = '';
  @state() private museums: Museum[] = [];
  @state() private loadingMuseums = true;
  @state() private activeTab: EditorTab = 'info';
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

  // ─── Lifecycle ───────────────────────────────────────────
  async connectedCallback() {
    super.connectedCallback();
    window.addEventListener('ui-language-changed', this.handleLanguageChanged as EventListener);
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
    super.disconnectedCallback();
  }

  private handleLanguageChanged = (_event: CustomEvent<{ language: AppLanguage }>) => {
    this.requestUpdate();
  };

  onMuseumChanged(): void {
    if (this.visitId || !this.selectedMuseumId) {
      return;
    }

    this.museumId = this.selectedMuseumId;
    void this.loadMuseumLanguages();
    void this.loadArtworksForMuseum();
    void this.loadFloorsForMuseum();
  }

  // ─── Data Loading ────────────────────────────────────────
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

        // Load artworks for this museum
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

  private findWaypointMarker(mapMarkerId?: string): { floorId: string; label: string } | null {
    if (!mapMarkerId) return null;
    for (const floor of this.floors) {
      const marker = floor.markers?.find((m) => m.id === mapMarkerId);
      if (marker) {
        return { floorId: floor.id, label: marker.label || floor.name };
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

  private async loadItemsForArtwork(artworkId: string) {
    try {
      const result = await itemService.getItems({ referenceId: artworkId, limit: 100 });
      this.availableItems = result.items;
    } catch (e) {
      console.error('Error loading items:', e);
    }
  }

  // ─── Actions (Museum / Steps / Save) ────────────────────
  private async handleMuseumChange(e: CustomEvent) {
    this.museumId = e.detail.value;
    // Reload artworks when museum changes
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

    // Set defaults based on type
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
    // Scroll to new step after render
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

  private removeStep(index: number) {
    this.steps = this.steps.filter((_, i) => i !== index).map((step, i) => ({ ...step, order: i }));
    if (this.editingStepIndex === index) {
      this.editingStepIndex = null;
    }
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

      // Emit saved event
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

  // ─── Render Entry ────────────────────────────────────────
  render() {
    if (this.loadingVisit) {
      return html`<ui-loading size="lg" .text=${__('Caricamento visita...')}></ui-loading>`;
    }

    return html`
      <form @submit=${this.handleFormSubmit} class="space-y-8">
        <!-- Success/Error Messages -->
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
        ${this.success
          ? html`<ui-alert variant="success" .message=${this.success}></ui-alert>`
          : nothing}
        ${this.error
          ? html`<ui-alert variant="danger" .message=${this.error}></ui-alert>`
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

  // ─── Render Helpers ──────────────────────────────────────
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
          .renderContent=${() => html`
            <ui-select
              .label=${__('Seleziona il museo')}
              .value=${this.museumId}
              .options=${this.museums.map((m) => ({ value: m._id, label: m.name }))}
              placeholder=${this.loadingMuseums ? __('Caricamento...') : __('Seleziona il museo')}
              ?disabled=${this.loadingMuseums}
              @select-change=${this.handleMuseumChange}
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

              <ui-input
                .label=${__('Immagine di copertina (URL)')}
                .placeholder=${__('https://example.com/image.jpg')}
                .value=${this.coverImage}
                @input=${(e: InputEvent) =>
                  (this.coverImage = (e.target as HTMLInputElement).value)}
              ></ui-input>

              ${this.coverImage
                ? html`
                    <div
                      class="mt-2 relative max-w-xs h-32 bg-surface-100 dark:bg-surface-800 rounded-lg overflow-hidden"
                    >
                      <img
                        src="${this.coverImage}"
                        alt="Cover preview"
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
                        type="museum"
                        size="md"
                        hidden
                        class="absolute inset-0"
                      ></ui-image-placeholder>
                    </div>
                  `
                : nothing}
            </div>
          `}
        ></ui-panel-section>

        <!-- Practical Info -->
        <ui-panel-section
          .title=${__('Informazioni pratiche')}
          icon="info"
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
        <p class="text-sm text-surface-500 dark:text-surface-400">
          ${__(
            "Anteprima di sola lettura: il percorso segue l'ordine delle tappe nella tab Percorso.",
          )}
        </p>

        ${this.floors.length > 1
          ? html`
              <ui-select
                .label=${__('Piano')}
                .value=${floorId}
                .options=${this.floors.map((f) => ({ value: f.id, label: f.name }))}
                @select-change=${(e: CustomEvent) => (this.mapTabFloorId = e.detail.value)}
              ></ui-select>
            `
          : nothing}

        <svg-map-editor
          .floors=${this.floors}
          .selectedFloorId=${floorId}
          .artworks=${this.artworks}
          .routeStops=${floorPoints}
          ?editMode=${false}
        ></svg-map-editor>

        ${allPoints.length < 2
          ? html`
              <ui-alert
                variant="info"
                .message=${__(
                  'Aggiungi almeno due tappe con una posizione sulla mappa (opere o waypoint) per vedere il percorso disegnato.',
                )}
              ></ui-alert>
            `
          : nothing}
      </div>
    `;
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
    }
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

        ${step.artworkId && this.availableItems.length > 0
          ? html`
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
                            - ${item.duration}, ${item.languageLevel}</span
                          >
                        </span>
                      </label>
                    `,
                  )}
                </div>
              </div>
            `
          : nothing}

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

        <ui-input
          .label=${__('Immagine del percorso (URL)')}
          .placeholder=${__('https://example.com/path.jpg')}
          .value=${step.navigationImage || ''}
          @input=${(e: InputEvent) =>
            this.updateStep(index, { navigationImage: (e.target as HTMLInputElement).value })}
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
          icon="currency"
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
      </div>
    `;
  }
}
