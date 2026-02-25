import { html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import {
  CONTENT_DURATION_OPTIONS_IT,
  ITEM_REFERENCE_TYPE_OPTIONS_IT,
  LANGUAGE_LEVEL_OPTIONS_IT,
  LICENSE_TYPE_OPTIONS_IT,
  LicenseType,
  ItemReferenceType,
  ContentDuration,
  LanguageLevel,
  type CreateItemData,
} from '@artaround/shared';
import { itemService } from '../../services/item.service';
import { MuseumAwareMixin, AppBaseElement } from '../../base';
import './wikidata-autocomplete';
import './image-uploader';
import '../ui/ui-input';
import '../ui/ui-select';
import '../ui/ui-button';
import '../ui/ui-textarea';
import '../ui/ui-alert';
import '../ui/ui-panel-section';
import '../ui/ui-tag-input';
import '../ui/ui-museum-required-notice';

@customElement('item-creator')
export class ItemCreator extends MuseumAwareMixin(AppBaseElement) {
  @property({ type: String }) itemId = ''; // For edit mode

  @state() private loading = false;
  @state() private error = '';
  @state() private success = '';

  // Reference selection
  @state() private referenceType: ItemReferenceType = ItemReferenceType.ARTWORK;
  @state() private referenceId = '';
  @state() private referenceTitle = '';

  // Content
  @state() private itemTitle = '';
  @state() private text = '';

  // Characteristics
  @state() private duration: ContentDuration = ContentDuration.MEDIUM;
  @state() private languageLevel: LanguageLevel = LanguageLevel.MEDIUM;

  // Metadata
  @state() private license: LicenseType = LicenseType.CC_BY;
  @state() private price = 0;
  @state() private tags: string[] = [];
  @state() private image = '';

  private readonly referenceTypeOptions = ITEM_REFERENCE_TYPE_OPTIONS_IT;

  private readonly durationOptions = CONTENT_DURATION_OPTIONS_IT;

  private readonly languageLevelOptions = LANGUAGE_LEVEL_OPTIONS_IT;

  private readonly licenseOptions = LICENSE_TYPE_OPTIONS_IT;

  // ─── Actions (Field Updates) ─────────────────────────────
  private handleWikidataSelect(e: CustomEvent) {
    this.referenceId = e.detail.id;
    this.referenceTitle = e.detail.label;
    if (!this.itemTitle) {
      this.itemTitle = e.detail.label;
    }
    if (e.detail.imageUrl && !this.image) {
      this.image = e.detail.imageUrl;
    }
  }

  private handleImageChange(e: CustomEvent) {
    this.image = e.detail.value;
  }

  private handlePriceChange(e: CustomEvent) {
    this.price = parseFloat(e.detail.value) || 0;
  }

  // ─── Computed & Validation ───────────────────────────────
  private getWordCount(): number {
    return this.text.trim().split(/\s+/).filter(Boolean).length;
  }

  private getEstimatedReadTime(): string {
    const words = this.getWordCount();
    const seconds = Math.ceil((words / 150) * 60); // 150 words per minute
    if (seconds < 60) return `~${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return remainingSeconds > 0 ? `~${minutes}m ${remainingSeconds}s` : `~${minutes}m`;
  }

  private validateForm(): string | null {
    if (!this.selectedMuseumId) {
      return 'Seleziona un museo prima di creare il contenuto';
    }
    if (!this.itemTitle.trim()) {
      return 'Il titolo è obbligatorio';
    }
    if (!this.text.trim()) {
      return 'Il testo è obbligatorio';
    }
    // For certain reference types, require a Wikidata ID
    if (
      [
        ItemReferenceType.ARTWORK,
        ItemReferenceType.AUTHOR,
        ItemReferenceType.MOVEMENT,
        ItemReferenceType.MUSEUM,
      ].includes(this.referenceType) &&
      !this.referenceId
    ) {
      return 'Seleziona un riferimento da Wikidata';
    }
    return null;
  }

  // ─── Submit Flow ─────────────────────────────────────────
  private async handleSubmit(e: Event) {
    e.preventDefault();

    const validationError = this.validateForm();
    if (validationError) {
      this.error = validationError;
      return;
    }

    const museumId = this.selectedMuseumId;
    if (!museumId) {
      this.error = 'Seleziona un museo prima di creare il contenuto';
      return;
    }

    this.loading = true;
    this.error = '';
    this.success = '';

    try {
      const itemData: CreateItemData = {
        museumId,
        referenceType: this.referenceType,
        referenceId: this.referenceId || undefined,
        referenceTitle: this.referenceTitle || undefined,
        title: this.itemTitle.trim(),
        text: this.text.trim(),
        duration: this.duration,
        languageLevel: this.languageLevel,
        license: this.license,
        price: this.price,
        tags: this.tags.length > 0 ? this.tags : undefined,
        image: this.image || undefined,
      };

      await itemService.createItem(itemData);

      this.success = 'Contenuto creato con successo!';

      // Dispatch success event
      this.dispatchEvent(
        new CustomEvent('item-created', {
          bubbles: true,
          composed: true,
        }),
      );

      // Reset form after short delay
      setTimeout(() => {
        this.resetForm();
      }, 2000);
    } catch (err) {
      console.error('Error creating item:', err);
      this.error = err instanceof Error ? err.message : 'Errore durante la creazione del contenuto';
    } finally {
      this.loading = false;
    }
  }

  // ─── Form State Helpers ──────────────────────────────────
  private resetForm() {
    this.referenceType = ItemReferenceType.ARTWORK;
    this.referenceId = '';
    this.referenceTitle = '';
    this.itemTitle = '';
    this.text = '';
    this.duration = ContentDuration.MEDIUM;
    this.languageLevel = LanguageLevel.MEDIUM;
    this.license = LicenseType.CC_BY;
    this.price = 0;
    this.tags = [];
    this.image = '';
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

  private getPlaceholderForReferenceType(): string {
    switch (this.referenceType) {
      case ItemReferenceType.ARTWORK:
        return 'Es: Gioconda, David di Michelangelo...';
      case ItemReferenceType.AUTHOR:
        return 'Es: Leonardo da Vinci, Caravaggio...';
      case ItemReferenceType.MOVEMENT:
        return 'Es: Rinascimento, Barocco, Impressionismo...';
      case ItemReferenceType.MUSEUM:
        return 'Es: Galleria Borghese, Uffizi...';
      default:
        return 'Cerca su Wikidata...';
    }
  }

  // ─── Render Entry ────────────────────────────────────────
  render() {
    const needsWikidataRef = [
      ItemReferenceType.ARTWORK,
      ItemReferenceType.AUTHOR,
      ItemReferenceType.MOVEMENT,
      ItemReferenceType.MUSEUM,
    ].includes(this.referenceType);

    return html`
      <form @submit=${this.handleSubmit} class="space-y-8">
        <!-- Success/Error Messages -->
        ${!this.selectedMuseumId
          ? html`<ui-museum-required-notice
              subject="contenuti"
              @select-museum=${this.emitSelectMuseum}
            ></ui-museum-required-notice>`
          : nothing}
        ${this.success
          ? html`<ui-alert variant="success" .message=${this.success}></ui-alert>`
          : nothing}
        ${this.error
          ? html`<ui-alert variant="danger" .message=${this.error}></ui-alert>`
          : nothing}

        <ui-panel-section
          title="Tipo di Contenuto"
          icon="link"
          .renderContent=${() => html`
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ui-select
                label="Tipo di riferimento"
                .value=${this.referenceType}
                .options=${this.referenceTypeOptions}
                required
                @select-change=${(e: CustomEvent) =>
                  (this.referenceType = e.detail.value as ItemReferenceType)}
              ></ui-select>

              ${needsWikidataRef
                ? html`
                    <wikidata-autocomplete
                      label="Riferimento Wikidata"
                      placeholder=${this.getPlaceholderForReferenceType()}
                      .selectedId=${this.referenceId}
                      required
                      @wikidata-select=${this.handleWikidataSelect}
                    ></wikidata-autocomplete>
                  `
                : html`
                    <ui-input
                      label="Titolo riferimento (opzionale)"
                      placeholder="Es: Come raggiungere il museo"
                      .value=${this.referenceTitle}
                      @input-change=${(e: CustomEvent) => (this.referenceTitle = e.detail.value)}
                    ></ui-input>
                  `}
            </div>
          `}
        ></ui-panel-section>

        <ui-panel-section
          title="Caratteristiche del Contenuto"
          icon="settings"
          .renderContent=${() => html`
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <ui-select
                label="Durata"
                hint="Tempo di lettura/ascolto previsto"
                .value=${this.duration}
                .options=${this.durationOptions}
                required
                @select-change=${(e: CustomEvent) =>
                  (this.duration = e.detail.value as ContentDuration)}
              ></ui-select>

              <ui-select
                label="Livello linguistico"
                hint="Complessità del linguaggio"
                .value=${this.languageLevel}
                .options=${this.languageLevelOptions}
                required
                @select-change=${(e: CustomEvent) =>
                  (this.languageLevel = e.detail.value as LanguageLevel)}
              ></ui-select>
            </div>
          `}
        ></ui-panel-section>

        <ui-panel-section
          title="Contenuto"
          icon="document"
          .renderContent=${() => html`
            <div class="space-y-6">
              <ui-input
                label="Titolo"
                placeholder="Titolo del contenuto"
                .value=${this.itemTitle}
                required
                @input-change=${(e: CustomEvent) => (this.itemTitle = e.detail.value)}
              ></ui-input>

              <div>
                <label
                  class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2"
                >
                  Testo <span class="text-danger-500">*</span>
                </label>
                <textarea
                  class="w-full h-48 p-3 border rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-surface-800 dark:border-surface-600 dark:text-white"
                  placeholder="Scrivi il testo descrittivo..."
                  .value=${this.text}
                  @input=${(e: Event) => {
                    this.text = (e.target as HTMLTextAreaElement).value;
                  }}
                ></textarea>
                <div class="mt-2 flex justify-between text-xs text-surface-500">
                  <span>${this.getWordCount()} parole</span>
                  <span>Tempo stimato: ${this.getEstimatedReadTime()}</span>
                </div>
              </div>
            </div>
          `}
        ></ui-panel-section>

        <ui-panel-section
          title="Immagine (opzionale)"
          icon="image"
          .renderContent=${() => html`
            <image-uploader
              label="Immagine di copertina"
              hint="PNG, JPG fino a 5MB. Se non specificata, verrà usata quella del riferimento"
              .value=${this.image}
              @image-change=${this.handleImageChange}
            ></image-uploader>
          `}
        ></ui-panel-section>

        <ui-panel-section
          title="Licenza e Prezzo"
          icon="currency"
          .renderContent=${() => html`
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <ui-select
                label="Tipo di Licenza"
                .value=${this.license}
                .options=${this.licenseOptions}
                required
                @select-change=${(e: CustomEvent) => (this.license = e.detail.value as LicenseType)}
              ></ui-select>

              <ui-input
                type="number"
                label="Prezzo (€)"
                placeholder="0 per gratuito"
                .value=${String(this.price)}
                hint="Lascia 0 per contenuto gratuito"
                @input-change=${this.handlePriceChange}
              ></ui-input>
            </div>
          `}
        ></ui-panel-section>

        <ui-panel-section
          title="Tag"
          icon="tag"
          .renderContent=${() => html`
            <ui-tag-input
              placeholder="Aggiungi un tag..."
              .tags=${this.tags}
              emptyText="Nessun tag aggiunto"
              @tags-change=${(e: CustomEvent<{ tags: string[] }>) => {
                this.tags = e.detail.tags;
              }}
            ></ui-tag-input>
          `}
        ></ui-panel-section>

        <!-- Actions -->
        <div
          class="flex items-center justify-end gap-3 pt-6 border-t border-surface-200 dark:border-surface-700"
        >
          <ui-button
            type="button"
            variant="secondary"
            label="Annulla"
            @click=${this.handleCancel}
          ></ui-button>
          <ui-button
            type="submit"
            variant="primary"
            label="Crea Contenuto"
            icon="save"
            .loading=${this.loading}
          ></ui-button>
        </div>
      </form>
    `;
  }
}
