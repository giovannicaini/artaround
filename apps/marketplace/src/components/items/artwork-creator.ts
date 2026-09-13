import { html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import {
  ArtworkType,
  ARTWORK_TYPE_OPTIONS_IT,
  getArtworkTypeIcon,
  getArtworkTypeLabel,
  type CreateArtworkData,
  type UpdateArtworkData,
  type Museum,
} from '@artaround/shared';
import { artworkService } from '../../services/artwork.service';
import { museumService } from '../../services/museum.service';
import { MuseumAwareMixin, AppBaseElement } from '../../base';
import { modalService } from '../../services/modal.service';
import { wikidataService } from '../../services/wikidata.service';
import './wikidata-autocomplete';
import '../ui/ui-input';
import '../ui/ui-select';
import '../ui/ui-button';
import '../ui/ui-icon';
import '../ui/ui-card';
import '../ui/ui-textarea';
import '../ui/ui-alert';
import '../ui/ui-loading';
import '../ui/image-editor';
import '../ui/ui-tag-input';
import '../ui/ui-museum-required-notice';
import { __ } from '../../services/i18n.service';

/**
 * Componente Artwork Creator/Editor
 *
 * Usato per creare nuove opere fisiche o modificare quelle esistenti.
 * Supporta l'integrazione con Wikidata per precompilare le info dell'opera.
 */
@customElement('artwork-creator')
export class ArtworkCreator extends MuseumAwareMixin(AppBaseElement) {
  @property({ type: String }) artworkId = ''; // For edit mode

  @state() private loading = false;
  @state() private loadingArtwork = false;
  @state() private error = '';
  @state() private success = '';
  @state() private museums: Museum[] = [];
  @state() private pendingWikidataFields: string[] = [];

  // Wikidata reference
  @state() private wikidataId = '';

  // Basic info
  @state() private artworkTitle = '';
  @state() private description = '';

  // Museum
  @state() private museumId = ''; // Wikidata ID of museum

  // Author
  @state() private author = '';
  @state() private authorWikidataId = '';

  // Dating
  @state() private year = '';

  // Classification
  @state() private artworkType: ArtworkType = ArtworkType.Painting;
  @state() private movement = '';
  @state() private movementWikidataId = '';
  @state() private technique = '';

  // Physical properties
  @state() private materials: string[] = [];
  @state() private dimensionHeight: number | undefined = undefined;
  @state() private dimensionWidth: number | undefined = undefined;
  @state() private dimensionDepth: number | undefined = undefined;
  @state() private dimensionUnit: 'cm' | 'm' = 'cm';

  // Media
  @state() private image = '';

  // Location
  @state() private roomId = ''; // Riferimento a Museum.rooms[].id — sala vera dell'opera
  @state() private room = ''; // testo libero legacy, tenuto come fallback/nota aggiuntiva
  @state() private floor = '';

  // Sale del museo selezionato (create in "Modifica Museo"): l'opera deve
  // appartenere a una di queste.
  private get availableRooms() {
    const museum = this.museums.find(
      (m) => m._id === this.museumId || m.wikidataId === this.museumId,
    );
    return museum?.rooms || [];
  }

  private get artworkTypeOptions() {
    return ARTWORK_TYPE_OPTIONS_IT.map((option) => {
      const icon = getArtworkTypeIcon(option.value);
      const label = __(getArtworkTypeLabel(option.value));
      return {
        ...option,
        label: `${icon} ${label}`,
      };
    });
  }

  private get dimensionUnitOptions() {
    return [
      { value: 'cm', label: __('Centimetri (cm)') },
      { value: 'm', label: __('Metri (m)') },
    ];
  }

  // ─── Ciclo di vita ───────────────────────────────────────────
  async connectedCallback() {
    super.connectedCallback();
    await this.loadMuseums();

    if (!this.artworkId && this.selectedMuseumId) {
      this.museumId = this.selectedMuseumId;
    }

    if (this.artworkId) {
      await this.loadArtwork();
    }
  }

  onMuseumChanged(): void {
    if (!this.artworkId && this.selectedMuseumId) {
      this.museumId = this.selectedMuseumId;
    }
  }

  // ─── Caricamento dati ────────────────────────────────────────
  private async loadMuseums() {
    try {
      this.museums = await museumService.getMuseums();
    } catch (e) {
      console.error('Error loading museums:', e);
    }
  }

  private async loadArtwork() {
    if (!this.artworkId) return;

    this.loadingArtwork = true;
    try {
      const artwork = await artworkService.getArtwork(this.artworkId);
      if (artwork) {
        this.wikidataId = artwork.wikidataId;
        this.artworkTitle = artwork.title;
        this.description = artwork.description || '';
        this.museumId = artwork.museumId;
        this.author = artwork.author || '';
        this.authorWikidataId = artwork.authorWikidataId || '';
        this.year = artwork.year || '';
        this.artworkType = artwork.artworkType;
        this.movement = artwork.movement || '';
        this.movementWikidataId = artwork.movementWikidataId || '';
        this.technique = artwork.technique || '';
        this.materials = artwork.materials || [];
        this.image = artwork.image || '';
        this.roomId = artwork.roomId || '';
        this.room = artwork.room || '';
        this.floor = artwork.floor || '';

        if (artwork.dimensions) {
          this.dimensionHeight = artwork.dimensions.height;
          this.dimensionWidth = artwork.dimensions.width;
          this.dimensionDepth = artwork.dimensions.depth;
          this.dimensionUnit = artwork.dimensions.unit || 'cm';
        }
      }
    } catch (e) {
      console.error('Error loading artwork:', e);
      this.error = __("Errore durante il caricamento dell'opera");
    } finally {
      this.loadingArtwork = false;
    }
  }

  // ─── Helper Wikidata ────────────────────────────────────
  private clearWikidataAutocomplete() {
    const autocomplete = this.querySelector('wikidata-autocomplete') as {
      clearSelection?: () => void;
    } | null;
    autocomplete?.clearSelection?.();
  }

  private async isArtworkDuplicateForMuseum(wikidataId: string): Promise<boolean> {
    if (!this.museumId || !wikidataId) return false;

    const artworksInMuseum = await artworkService.getArtworksByMuseum(this.museumId);

    return artworksInMuseum.some((artwork) => {
      if (artwork.wikidataId !== wikidataId) return false;

      if (!this.artworkId) return true;

      const isCurrentArtwork = artwork._id === this.artworkId;
      return !isCurrentArtwork;
    });
  }

  private inferFloorFromLocation(location?: string): string | undefined {
    if (!location) return undefined;

    const normalized = location.toLowerCase();
    if (normalized.includes('piano terra') || normalized.includes('ground floor')) {
      return 'Piano Terra';
    }
    if (normalized.includes('primo piano') || normalized.includes('first floor')) {
      return 'Primo Piano';
    }
    if (normalized.includes('secondo piano') || normalized.includes('second floor')) {
      return 'Secondo Piano';
    }

    return undefined;
  }

  private extractTechniqueFromDescription(description: string): string | undefined {
    const match = description.match(/(?:dipinto|opera)\s+a\s+([^,.]+)/i);
    if (match?.[1]) {
      return match[1].trim();
    }

    const genericMatch = description.match(/(olio su [^,.]+|tempera su [^,.]+|affresco|mosaico)/i);
    return genericMatch?.[1]?.trim();
  }

  private extractMaterialsFromDescription(description: string): string[] {
    const extracted: string[] = [];

    const suMatch = description.match(/su\s+([^,.]+)/i);
    if (suMatch?.[1]) {
      extracted.push(suMatch[1].trim());
    }

    if (/pioppo/i.test(description)) extracted.push('Pioppo');
    if (/tela/i.test(description)) extracted.push('Tela');
    if (/legno/i.test(description)) extracted.push('Legno');
    if (/marmo/i.test(description)) extracted.push('Marmo');
    if (/bronzo/i.test(description)) extracted.push('Bronzo');

    return Array.from(new Set(extracted.filter(Boolean)));
  }

  private extractLocationFromDescription(description: string): string | undefined {
    const parts = description
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
    if (parts.length < 2) return undefined;

    return parts[parts.length - 1];
  }

  private addPendingWikidataFields(fields: string[]) {
    if (this.artworkId || fields.length === 0) return;
    this.pendingWikidataFields = Array.from(new Set([...this.pendingWikidataFields, ...fields]));
  }

  private clearPendingWikidataField(field: string) {
    if (!this.pendingWikidataFields.includes(field)) return;
    this.pendingWikidataFields = this.pendingWikidataFields.filter((entry) => entry !== field);
  }

  private hasPendingWikidataField(field: string): boolean {
    return this.pendingWikidataFields.includes(field);
  }

  private renderAutofillBanner(field: string) {
    if (this.artworkId || !this.hasPendingWikidataField(field)) return nothing;

    return html`
      <div
        class="flex items-start gap-2 p-2 rounded-md bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300"
      >
        <ui-icon name="warning" size="xs" class="mt-0.5"></ui-icon>
        <p class="text-xs">
          Campo compilato automaticamente da Wikidata: controllare il contenuto.
        </p>
      </div>
    `;
  }

  private renderFieldWithBanner(field: string, content: unknown, containerClass = '') {
    const classes = containerClass ? `${containerClass} space-y-2` : 'space-y-2';

    return html` <div class=${classes}>${content} ${this.renderAutofillBanner(field)}</div> `;
  }

  private applyWikidataData(data: Record<string, unknown>) {
    const getString = (key: string): string => {
      const value = data[key];
      return typeof value === 'string' ? value.trim() : '';
    };

    const getNumber = (key: string): number | undefined => {
      const value = data[key];
      if (typeof value === 'number' && !Number.isNaN(value)) return value;
      if (typeof value === 'string') {
        const parsed = Number(value);
        return Number.isNaN(parsed) ? undefined : parsed;
      }
      return undefined;
    };

    const autofilledFields: string[] = [];

    const title = getString('label');
    if (title) {
      this.artworkTitle = title;
      autofilledFields.push('artworkTitle');
    }

    const description = getString('description');
    if (description) {
      this.description = description;
      autofilledFields.push('description');
    }

    const imageUrl = getString('imageUrl');
    if (imageUrl) {
      this.image = imageUrl;
      autofilledFields.push('image');
    }

    const author = getString('author');
    if (author) {
      this.author = author;
      autofilledFields.push('author');
    }

    const authorId = getString('authorId');
    if (authorId) {
      this.authorWikidataId = authorId;
      autofilledFields.push('authorWikidataId');
    }

    const movement = getString('movement') || getString('style') || getString('period');
    if (movement) {
      this.movement = movement;
      autofilledFields.push('movement');
    }

    const movementId = getString('movementId') || getString('styleId') || getString('periodId');
    if (movementId) {
      this.movementWikidataId = movementId;
      autofilledFields.push('movementWikidataId');
    }

    const year =
      getString('year') || getString('inception') || getString('epoch') || getString('period');
    if (year) {
      this.year = year;
      autofilledFields.push('year');
    }

    const technique = getString('technique');
    const fallbackTechnique =
      !technique && description ? this.extractTechniqueFromDescription(description) : undefined;
    if (technique || fallbackTechnique) {
      this.technique = technique || fallbackTechnique || '';
      autofilledFields.push('technique');
    }

    const materials = data.materials;
    if (Array.isArray(materials)) {
      const normalizedMaterials = materials
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.trim())
        .filter(Boolean);
      if (normalizedMaterials.length > 0) {
        this.materials = Array.from(new Set(normalizedMaterials));
        autofilledFields.push('materials');
      }
    } else if (description) {
      const parsedMaterials = this.extractMaterialsFromDescription(description);
      if (parsedMaterials.length > 0) {
        this.materials = parsedMaterials;
        autofilledFields.push('materials');
      }
    }

    const dimensionHeight = getNumber('dimensionHeight');
    const dimensionWidth = getNumber('dimensionWidth');
    const dimensionDepth = getNumber('dimensionDepth');
    const dimensionUnit = getString('dimensionUnit');

    if (dimensionHeight !== undefined) {
      this.dimensionHeight = dimensionHeight;
      autofilledFields.push('dimensionHeight');
    }
    if (dimensionWidth !== undefined) {
      this.dimensionWidth = dimensionWidth;
      autofilledFields.push('dimensionWidth');
    }
    if (dimensionDepth !== undefined) {
      this.dimensionDepth = dimensionDepth;
      autofilledFields.push('dimensionDepth');
    }
    if (dimensionUnit === 'cm' || dimensionUnit === 'm') {
      this.dimensionUnit = dimensionUnit;
      autofilledFields.push('dimensionUnit');
    }

    const room =
      getString('room') ||
      getString('location') ||
      (description ? this.extractLocationFromDescription(description) : '');
    if (room) {
      this.room = room;
      autofilledFields.push('room');
    }

    const floor = getString('floor') || this.inferFloorFromLocation(room);
    if (floor) {
      this.floor = floor;
      autofilledFields.push('floor');
    }

    this.addPendingWikidataFields(autofilledFields);
  }

  private async handleWikidataSelect(e: CustomEvent) {
    const selectedWikidataId = (e.detail.id || '').trim();
    if (!selectedWikidataId) return;

    const isDuplicate = await this.isArtworkDuplicateForMuseum(selectedWikidataId);
    if (isDuplicate) {
      this.wikidataId = '';
      this.clearWikidataAutocomplete();
      this.error = __(
        'Questa opera è già stata aggiunta per il museo corrente e non può essere aggiunta nuovamente.',
      );
      await modalService.alert({
        title: __('Opera già presente'),
        message: __(
          'Questa opera è già stata aggiunta per il museo corrente e non può essere aggiunta nuovamente.',
        ),
        variant: 'info',
        confirmLabel: __('OK'),
      });
      return;
    }

    this.error = '';
    this.wikidataId = selectedWikidataId;

    // Precompila prima dal payload di ricerca
    this.applyWikidataData(e.detail as Record<string, unknown>);

    // Poi arricchisce con i dati completi dell'entità da Wikidata
    try {
      const entity = await wikidataService.getEntity(selectedWikidataId);
      if (entity) {
        this.applyWikidataData(entity as unknown as Record<string, unknown>);
      }
    } catch (error) {
      console.error('Error fetching Wikidata entity details:', error);
    }
  }

  private handleAuthorSelect(e: CustomEvent) {
    this.authorWikidataId = e.detail.id;
    this.author = e.detail.label;
    this.clearPendingWikidataField('authorWikidataId');
    this.clearPendingWikidataField('author');
  }

  private handleMovementSelect(e: CustomEvent) {
    this.movementWikidataId = e.detail.id;
    this.movement = e.detail.label;
    this.clearPendingWikidataField('movementWikidataId');
    this.clearPendingWikidataField('movement');
  }

  // ─── Validazione e invio ─────────────────────────────────
  private getDimensionsDisplayText(): string {
    const parts: string[] = [];
    if (this.dimensionHeight) parts.push(`${this.dimensionHeight}`);
    if (this.dimensionWidth) parts.push(`${this.dimensionWidth}`);
    if (this.dimensionDepth) parts.push(`${this.dimensionDepth}`);
    if (parts.length === 0) return '';
    return `${parts.join(' × ')} ${this.dimensionUnit}`;
  }

  private validateForm(): string | null {
    if (!this.wikidataId.trim()) {
      return __("L'ID Wikidata è obbligatorio (cerca l'opera su Wikidata)");
    }
    if (!this.artworkTitle.trim()) {
      return __('Il titolo è obbligatorio');
    }
    if (!this.museumId) {
      return __('Seleziona un museo attivo');
    }
    if (!this.image.trim()) {
      return __("L'immagine è obbligatoria");
    }
    // Richiesta solo se il museo ha già delle sale configurate: un museo che non
    // le usa ancora non deve bloccarsi nel creare opere.
    if (this.availableRooms.length > 0 && !this.roomId) {
      return __('Seleziona la sala in cui si trova questa opera');
    }
    return null;
  }

  private async handleSubmit(e: Event) {
    e.preventDefault();

    const validationError = this.validateForm();
    if (validationError) {
      this.error = validationError;
      return;
    }

    this.loading = true;
    this.error = '';
    this.success = '';

    try {
      const dimensions =
        this.dimensionHeight || this.dimensionWidth || this.dimensionDepth
          ? {
              height: this.dimensionHeight,
              width: this.dimensionWidth,
              depth: this.dimensionDepth,
              unit: this.dimensionUnit,
              displayText: this.getDimensionsDisplayText(),
            }
          : undefined;

      const artworkData: CreateArtworkData = {
        wikidataId: this.wikidataId.trim(),
        museumId: this.museumId,
        title: this.artworkTitle.trim(),
        description: this.description.trim() || undefined,
        author: this.author.trim() || undefined,
        authorWikidataId: this.authorWikidataId.trim() || undefined,
        year: this.year.trim() || undefined,
        artworkType: this.artworkType,
        movement: this.movement.trim() || undefined,
        movementWikidataId: this.movementWikidataId.trim() || undefined,
        dimensions,
        materials: this.materials.length > 0 ? this.materials : undefined,
        image: this.image.trim(),
        roomId: this.roomId || undefined,
        room: this.room.trim() || undefined,
        floor: this.floor.trim() || undefined,
      };

      if (this.artworkId) {
        await artworkService.updateArtwork(this.artworkId, artworkData as UpdateArtworkData);
        this.success = __('Opera aggiornata con successo!');
      } else {
        await artworkService.createArtwork(artworkData);
        this.success = __('Opera creata con successo!');
      }

      this.pendingWikidataFields = [];

      this.dispatchEvent(
        new CustomEvent('artwork-created', {
          bubbles: true,
          composed: true,
        }),
      );

      if (!this.artworkId) {
        setTimeout(() => {
          this.resetForm();
        }, 2000);
      }
    } catch (err) {
      console.error('Error saving artwork:', err);
      this.error =
        err instanceof Error ? err.message : __("Errore durante il salvataggio dell'opera");
    } finally {
      this.loading = false;
    }
  }

  // ─── Helper stato form ──────────────────────────────────
  private resetForm() {
    this.wikidataId = '';
    this.artworkTitle = '';
    this.description = '';
    this.museumId = '';
    this.author = '';
    this.authorWikidataId = '';
    this.year = '';
    this.artworkType = ArtworkType.Painting;
    this.movement = '';
    this.movementWikidataId = '';
    this.technique = '';
    this.materials = [];
    this.dimensionHeight = undefined;
    this.dimensionWidth = undefined;
    this.dimensionDepth = undefined;
    this.dimensionUnit = 'cm';
    this.image = '';
    this.roomId = '';
    this.room = '';
    this.floor = '';
    this.pendingWikidataFields = [];
    this.success = '';
    this.error = '';
  }

  private handleCancel() {
    this.dispatchEvent(
      new CustomEvent('cancel', {
        bubbles: true,
        composed: true,
      }),
    );
  }

  // ─── Helper di render ──────────────────────────────────────
  private renderFormSection(
    title: string,
    icon: string,
    iconClass: string,
    renderContent: () => unknown,
  ) {
    return html`
      <section>
        <h3
          class="text-lg font-semibold text-surface-900 dark:text-white mb-4 flex items-center gap-2"
        >
          <ui-icon name=${icon} size="sm" class=${iconClass}></ui-icon>
          ${title}
        </h3>

        <ui-card>${renderContent()}</ui-card>
      </section>
    `;
  }

  // ─── Render principale ────────────────────────────────────────
  render() {
    if (this.loadingArtwork) {
      return html`<ui-loading size="lg" .text=${__('Caricamento opera...')}></ui-loading>`;
    }

    const museumOptions = this.museums.map((m) => ({
      value: m.wikidataId,
      label: m.name,
    }));

    return html`
      <form @submit=${this.handleSubmit} class="space-y-8">
        <!-- Messaggi di successo/errore -->
        ${!this.museumId
          ? html`<ui-museum-required-notice
              subject="opere"
              @select-museum=${this.emitSelectMuseum}
            ></ui-museum-required-notice>`
          : nothing}
        ${this.success
          ? html`<ui-alert variant="success" .message=${this.success}></ui-alert>`
          : nothing}
        ${this.error
          ? html`<ui-alert variant="danger" .message=${this.error}></ui-alert>`
          : nothing}

        <!-- Section: Wikidata Reference -->
        ${this.renderFormSection(
          __('Riferimento Wikidata'),
          'link',
          'text-blue-500',
          () => html`
            <div class="space-y-4">
              ${this.artworkId
                ? html`
                    <p class="text-sm text-surface-500 dark:text-surface-400">
                      ${__(
                        "Il riferimento Wikidata non è modificabile dopo la creazione dell'opera.",
                      )}
                    </p>
                  `
                : html`
                    <p class="text-sm text-surface-500 dark:text-surface-400">
                      ${__(
                        "Cerca l'opera su Wikidata per compilare automaticamente i campi. L'ID Wikidata è obbligatorio per evitare duplicati.",
                      )}
                    </p>
                    <wikidata-autocomplete
                      .label=${__('Cerca Opera su Wikidata')}
                      .placeholder=${__('Es: Gioconda, David di Michelangelo...')}
                      searchType="artwork"
                      .value=${this.wikidataId}
                      .selectedId=${this.wikidataId}
                      @wikidata-select=${this.handleWikidataSelect}
                    ></wikidata-autocomplete>
                  `}
              ${this.wikidataId
                ? html`
                    <div
                      class="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg"
                    >
                      <span
                        class="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300"
                      >
                        ${this.wikidataId}
                      </span>
                      <a
                        href="https://www.wikidata.org/wiki/${this.wikidataId}"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        Vedi su Wikidata →
                      </a>
                    </div>
                  `
                : nothing}
            </div>
          `,
        )}

        <!-- Section: Basic Info -->
        ${this.renderFormSection(
          __('Informazioni Base'),
          'image',
          'text-brand-500',
          () => html`
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
              ${this.renderFieldWithBanner(
                'artworkTitle',
                html`
                  <ui-input
                    .label=${__('Titolo *')}
                    .placeholder=${__("Titolo dell'opera")}
                    .value=${this.artworkTitle}
                    @input-change=${(e: CustomEvent) => {
                      this.artworkTitle = e.detail.value;
                      this.clearPendingWikidataField('artworkTitle');
                    }}
                    required
                  ></ui-input>
                `,
                'lg:col-span-2',
              )}
              ${this.renderFieldWithBanner(
                'description',
                html`
                  <ui-textarea
                    .label=${__('Descrizione')}
                    .placeholder=${__("Descrizione dell'opera...")}
                    .value=${this.description}
                    @input-change=${(e: CustomEvent) => {
                      this.description = e.detail.value;
                      this.clearPendingWikidataField('description');
                    }}
                    rows="3"
                  ></ui-textarea>
                `,
                'lg:col-span-2',
              )}

              <ui-select
                .label=${__('Museo *')}
                .value=${this.museumId}
                .options=${museumOptions}
                .placeholder=${__('Seleziona il museo')}
                ?disabled=${true}
                required
              ></ui-select>

              <ui-select
                .label=${__('Tipo Opera *')}
                .value=${this.artworkType}
                .options=${this.artworkTypeOptions}
                @select-change=${(e: CustomEvent) => (this.artworkType = e.detail.value)}
              ></ui-select>
            </div>
          `,
        )}

        <!-- Section: Authorship -->
        ${this.renderFormSection(
          __('Autore'),
          'user',
          'text-amber-500',
          () => html`
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <wikidata-autocomplete
                .label=${__('Cerca Autore su Wikidata')}
                .placeholder=${__('Es: Leonardo da Vinci, Caravaggio...')}
                searchType="author"
                .value=${this.authorWikidataId}
                .selectedId=${this.authorWikidataId}
                @wikidata-select=${this.handleAuthorSelect}
              ></wikidata-autocomplete>

              ${this.authorWikidataId
                ? html`
                    <div class="lg:col-span-2 flex items-center gap-2 -mt-2">
                      <span
                        class="px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                      >
                        ${this.authorWikidataId}
                      </span>
                      <a
                        href="https://www.wikidata.org/wiki/${this.authorWikidataId}"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-xs text-amber-700 dark:text-amber-300 hover:underline"
                      >
                        Vedi autore su Wikidata →
                      </a>
                    </div>
                  `
                : nothing}
              ${this.renderFieldWithBanner(
                'author',
                html`
                  <ui-input
                    .label=${__('Nome Autore')}
                    .placeholder=${__("Nome dell'artista")}
                    .value=${this.author}
                    @input-change=${(e: CustomEvent) => {
                      this.author = e.detail.value;
                      this.clearPendingWikidataField('author');
                    }}
                  ></ui-input>
                `,
              )}
              ${this.renderFieldWithBanner(
                'year',
                html`
                  <ui-input
                    .label=${__('Anno / Periodo')}
                    .placeholder=${__('Es: 1605, 1598-1601, XVI secolo')}
                    .value=${this.year}
                    @input-change=${(e: CustomEvent) => {
                      this.year = e.detail.value;
                      this.clearPendingWikidataField('year');
                    }}
                  ></ui-input>
                `,
              )}
            </div>
          `,
        )}

        <!-- Section: Classification -->
        ${this.renderFormSection(
          __('Classificazione'),
          'tag',
          'text-purple-500',
          () => html`
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <wikidata-autocomplete
                .label=${__('Movimento Artistico')}
                .placeholder=${__('Es: Rinascimento, Barocco...')}
                searchType="movement"
                .value=${this.movementWikidataId}
                .selectedId=${this.movementWikidataId}
                @wikidata-select=${this.handleMovementSelect}
              ></wikidata-autocomplete>

              ${this.movementWikidataId
                ? html`
                    <div class="lg:col-span-2 flex items-center gap-2 -mt-2">
                      <span
                        class="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300"
                      >
                        ${this.movementWikidataId}
                      </span>
                      <a
                        href="https://www.wikidata.org/wiki/${this.movementWikidataId}"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-xs text-purple-700 dark:text-purple-300 hover:underline"
                      >
                        Vedi movimento su Wikidata →
                      </a>
                    </div>
                  `
                : nothing}
              ${this.renderFieldWithBanner(
                'movement',
                html`
                  <ui-input
                    .label=${__('Nome Movimento')}
                    .placeholder=${__('Nome del movimento')}
                    .value=${this.movement}
                    @input-change=${(e: CustomEvent) => {
                      this.movement = e.detail.value;
                      this.clearPendingWikidataField('movement');
                    }}
                  ></ui-input>
                `,
              )}
              ${this.renderFieldWithBanner(
                'technique',
                html`
                  <ui-input
                    .label=${__('Tecnica')}
                    .placeholder=${__('Es: Olio su tela, Affresco...')}
                    .value=${this.technique}
                    @input-change=${(e: CustomEvent) => {
                      this.technique = e.detail.value;
                      this.clearPendingWikidataField('technique');
                    }}
                  ></ui-input>
                `,
              )}

              <!-- Materials -->
              <div class="lg:col-span-2">
                ${this.renderFieldWithBanner(
                  'materials',
                  html`
                    <ui-tag-input
                      .label=${__('Materiali')}
                      .placeholder=${__('Es: Marmo di Carrara')}
                      .tags=${this.materials}
                      .lowercase=${false}
                      .emptyText=${__('Nessun materiale aggiunto')}
                      @tags-change=${(e: CustomEvent<{ tags: string[] }>) => {
                        this.materials = e.detail.tags;
                        this.clearPendingWikidataField('materials');
                      }}
                    ></ui-tag-input>
                  `,
                )}
              </div>
            </div>
          `,
        )}

        <!-- Section: Dimensions -->
        ${this.renderFormSection(
          __('Dimensioni'),
          'chart',
          'text-teal-500',
          () => html`
            <div class="grid grid-cols-2 lg:grid-cols-5 gap-4">
              ${this.renderFieldWithBanner(
                'dimensionHeight',
                html`
                  <ui-input
                    type="number"
                    .label=${__('Altezza')}
                    .placeholder=${__('0')}
                    .value=${String(this.dimensionHeight || '')}
                    @input-change=${(e: CustomEvent) => {
                      this.dimensionHeight = parseFloat(e.detail.value) || undefined;
                      this.clearPendingWikidataField('dimensionHeight');
                    }}
                  ></ui-input>
                `,
              )}
              ${this.renderFieldWithBanner(
                'dimensionWidth',
                html`
                  <ui-input
                    type="number"
                    .label=${__('Larghezza')}
                    placeholder="0"
                    .value=${String(this.dimensionWidth || '')}
                    @input-change=${(e: CustomEvent) => {
                      this.dimensionWidth = parseFloat(e.detail.value) || undefined;
                      this.clearPendingWikidataField('dimensionWidth');
                    }}
                  ></ui-input>
                `,
              )}
              ${this.renderFieldWithBanner(
                'dimensionDepth',
                html`
                  <ui-input
                    type="number"
                    .label=${__('Profondità')}
                    placeholder="0"
                    .value=${String(this.dimensionDepth || '')}
                    @input-change=${(e: CustomEvent) => {
                      this.dimensionDepth = parseFloat(e.detail.value) || undefined;
                      this.clearPendingWikidataField('dimensionDepth');
                    }}
                  ></ui-input>
                `,
              )}
              ${this.renderFieldWithBanner(
                'dimensionUnit',
                html`
                  <ui-select
                    .label=${__('Unità')}
                    .value=${this.dimensionUnit}
                    .options=${this.dimensionUnitOptions}
                    @select-change=${(e: CustomEvent) => {
                      this.dimensionUnit = e.detail.value;
                      this.clearPendingWikidataField('dimensionUnit');
                    }}
                  ></ui-select>
                `,
              )}

              <div class="flex items-end">
                ${this.getDimensionsDisplayText()
                  ? html`
                      <p class="text-sm text-surface-500 dark:text-surface-400 pb-3">
                        ${this.getDimensionsDisplayText()}
                      </p>
                    `
                  : nothing}
              </div>
            </div>
          `,
        )}

        <!-- Section: Location -->
        ${this.renderFormSection(
          'Posizione nel Museo',
          'location',
          'text-emerald-500',
          () => html`
            ${this.availableRooms.length > 0
              ? html`
                  <div class="mb-6">
                    <ui-select
                      .label=${`${__('Sala')} *`}
                      .help=${__(
                        'Oltre a organizzare le opere, questa assegnazione è ciò che "Crea marker opere" (in Gestione Mappe) usa per generare automaticamente il marker sulla piantina, se la sala ha un contorno disegnato.',
                      )}
                      .placeholder=${__('Seleziona la sala')}
                      .value=${this.roomId}
                      .options=${this.availableRooms.map((r) => ({
                        value: r.id,
                        label: r.subtitle ? `${r.title} — ${r.subtitle}` : r.title,
                      }))}
                      @select-change=${(e: CustomEvent) => (this.roomId = e.detail.value)}
                    ></ui-select>
                  </div>
                `
              : html`
                  <ui-alert
                    variant="info"
                    class="mb-6"
                    .message=${__(
                      'Questo museo non ha ancora sale configurate: creale da "Modifica Museo" per poter assegnare le opere.',
                    )}
                  ></ui-alert>
                `}

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
              ${this.renderFieldWithBanner(
                'room',
                html`
                  <ui-input
                    .label=${__('Nota sala (facoltativa)')}
                    .placeholder=${__('Es: Sala VIII, Pinacoteca - Sala XIV')}
                    .value=${this.room}
                    @input-change=${(e: CustomEvent) => {
                      this.room = e.detail.value;
                      this.clearPendingWikidataField('room');
                    }}
                  ></ui-input>
                `,
              )}
              ${this.renderFieldWithBanner(
                'floor',
                html`
                  <ui-input
                    .label=${__('Piano')}
                    .help=${__(
                      "Testo libero, solo descrittivo — non è collegato al piano vero e proprio della piantina (quello dipende dalla Sala scelta sopra e da dove il curatore l'ha posizionata in Gestione Mappe).",
                    )}
                    .placeholder=${__('Es: Piano Terra, Primo Piano')}
                    .value=${this.floor}
                    @input-change=${(e: CustomEvent) => {
                      this.floor = e.detail.value;
                      this.clearPendingWikidataField('floor');
                    }}
                  ></ui-input>
                `,
              )}
            </div>
          `,
        )}

        <!-- Section: Image -->
        ${this.renderFormSection('Immagine *', 'image', 'text-pink-500', () =>
          this.renderFieldWithBanner(
            'image',
            html`
              <image-editor
                .label=${__("Immagine dell'opera")}
                category="artworks"
                .value=${this.image}
                maxWidth=${1200}
                maxHeight=${1200}
                .maxOutputSizeMb=${0.5}
                defaultFormat="webp"
                @image-saved=${(e: CustomEvent) => {
                  this.image = e.detail.path || '';
                  this.clearPendingWikidataField('image');
                }}
              ></image-editor>
            `,
          ),
        )}

        <!-- Actions -->
        <div
          class="flex items-center justify-end gap-4 pt-6 border-t border-surface-200 dark:border-surface-700"
        >
          <ui-button
            variant="ghost"
            .label=${__('Annulla')}
            @click=${this.handleCancel}
          ></ui-button>
          <ui-button
            type="submit"
            variant="primary"
            .label=${this.artworkId ? __('Aggiorna Opera') : __('Crea Opera')}
            icon=${this.artworkId ? 'check' : 'plus'}
            ?loading=${this.loading}
          ></ui-button>
        </div>
      </form>
    `;
  }
}
