import { LitElement, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { LicenseType, type ItemContent } from '@artaround/shared';
import { itemService, type CreateItemData } from '../../services/item.service';
import { preferencesService } from '../../services/preferences.service';
import './wikidata-autocomplete';
import './image-uploader';
import './content-matrix-editor';
import '../ui/ui-input';
import '../ui/ui-select';
import '../ui/ui-button';
import '../ui/ui-icon';
import '../ui/ui-card';

@customElement('item-creator')
export class ItemCreator extends LitElement {
  @property({ type: String }) itemId = ''; // For edit mode
  
  @state() private loading = false;
  @state() private error = '';
  @state() private success = '';
  
  // Form data
  @state() private objectId = '';
  @state() private itemTitle = '';
  @state() private image = '';
  @state() private contents: ItemContent[] = [];
  
  // Metadata
  @state() private author = '';
  @state() private artStyle = '';
  @state() private epoch = '';
  @state() private license: LicenseType = LicenseType.CC_BY;
  @state() private price = 0;
  @state() private isFree = true;
  @state() private tags: string[] = [];
  @state() private tagInput = '';

  private licenseOptions = [
    { value: LicenseType.CC0, label: 'CC0 - Pubblico Dominio' },
    { value: LicenseType.CC_BY, label: 'CC BY - Attribuzione' },
    { value: LicenseType.CC_BY_SA, label: 'CC BY-SA - Attribuzione Condividi' },
    { value: LicenseType.CC_BY_NC, label: 'CC BY-NC - Non Commerciale' },
    { value: LicenseType.PROPRIETARY, label: 'Proprietaria' },
  ];

  createRenderRoot() { return this; }

  private handleWikidataSelect(e: CustomEvent) {
    this.objectId = e.detail.id;
    if (!this.itemTitle) {
      this.itemTitle = e.detail.label;
    }
  }

  private handleContentsChange(e: CustomEvent) {
    this.contents = e.detail.contents;
  }

  private handleImageChange(e: CustomEvent) {
    this.image = e.detail.value;
  }

  private handleAddTag() {
    const tag = this.tagInput.trim().toLowerCase();
    if (tag && !this.tags.includes(tag)) {
      this.tags = [...this.tags, tag];
      this.tagInput = '';
    }
  }

  private handleRemoveTag(tag: string) {
    this.tags = this.tags.filter(t => t !== tag);
  }

  private handleTagKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      this.handleAddTag();
    }
  }

  private handlePriceChange(e: CustomEvent) {
    this.price = parseFloat(e.detail.value) || 0;
    this.isFree = this.price === 0;
  }

  private validateForm(): string | null {
    if (!this.objectId) {
      return 'Seleziona un\'opera da Wikidata';
    }
    if (!this.itemTitle.trim()) {
      return 'Il titolo è obbligatorio';
    }
    if (this.contents.length === 0) {
      return 'Aggiungi almeno un contenuto';
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
      const museumId = preferencesService.getSelectedMuseumId();
      if (!museumId) {
        throw new Error('Nessun museo selezionato');
      }

      const itemData: CreateItemData = {
        museumId,
        objectId: this.objectId,
        title: this.itemTitle.trim(),
        contents: this.contents,
        metadata: {
          author: this.author.trim() || undefined,
          style: this.artStyle.trim() || undefined,
          epoch: this.epoch.trim() || undefined,
          license: this.license,
          price: this.price,
          isFree: this.isFree,
          tags: this.tags.length > 0 ? this.tags : undefined,
        },
        image: this.image || undefined,
      };

      await itemService.createItem(itemData);
      
      this.success = 'Opera creata con successo!';
      
      // Dispatch success event
      this.dispatchEvent(new CustomEvent('item-created', {
        bubbles: true,
        composed: true
      }));

      // Reset form after short delay
      setTimeout(() => {
        this.resetForm();
      }, 2000);

    } catch (err: any) {
      console.error('Error creating item:', err);
      this.error = err.message || 'Errore durante la creazione dell\'opera';
    } finally {
      this.loading = false;
    }
  }

  private resetForm() {
    this.objectId = '';
    this.itemTitle = '';
    this.image = '';
    this.contents = [];
    this.author = '';
    this.artStyle = '';
    this.epoch = '';
    this.license = LicenseType.CC_BY;
    this.price = 0;
    this.isFree = true;
    this.tags = [];
    this.tagInput = '';
    this.success = '';
    this.error = '';
  }

  private handleCancel() {
    this.dispatchEvent(new CustomEvent('cancel', {
      bubbles: true,
      composed: true
    }));
  }

  render() {
    return html`
      <form @submit=${this.handleSubmit} class="space-y-8">
        <!-- Success/Error Messages -->
        ${this.success ? html`
          <div class="p-4 rounded-lg bg-success-50 dark:bg-success-900/20 border border-success-200 dark:border-success-800 flex items-center gap-3">
            <ui-icon name="check" size="sm" class="text-success-600 dark:text-success-400"></ui-icon>
            <p class="text-sm text-success-800 dark:text-success-300">${this.success}</p>
          </div>
        ` : ''}
        
        ${this.error ? html`
          <div class="p-4 rounded-lg bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 flex items-center gap-3">
            <ui-icon name="warning" size="sm" class="text-danger-600 dark:text-danger-400"></ui-icon>
            <p class="text-sm text-danger-800 dark:text-danger-300">${this.error}</p>
          </div>
        ` : ''}

        <!-- Section: Identificazione Opera -->
        <section>
          <h3 class="text-lg font-semibold text-surface-900 dark:text-white mb-4 flex items-center gap-2">
            <ui-icon name="link" size="sm" class="text-brand-500"></ui-icon>
            Identificazione Opera
          </h3>
          
          <ui-card>
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div class="lg:col-span-2">
                <wikidata-autocomplete
                  label="Cerca opera su Wikidata"
                  placeholder="Es: Gioconda, David di Michelangelo..."
                  .selectedId=${this.objectId}
                  required
                  @wikidata-select=${this.handleWikidataSelect}
                ></wikidata-autocomplete>
              </div>
              
              <ui-input
                label="Titolo"
                placeholder="Titolo dell'opera"
                .value=${this.itemTitle}
                required
                @input-change=${(e: CustomEvent) => this.itemTitle = e.detail.value}
              ></ui-input>
              
              <ui-input
                label="Autore/Artista"
                placeholder="Nome dell'artista"
                .value=${this.author}
                @input-change=${(e: CustomEvent) => this.author = e.detail.value}
              ></ui-input>
              
              <ui-input
                label="Stile/Corrente"
                placeholder="Es: Rinascimento, Impressionismo..."
                .value=${this.artStyle}
                @input-change=${(e: CustomEvent) => this.artStyle = e.detail.value}
              ></ui-input>
              
              <ui-input
                label="Epoca"
                placeholder="Es: XVI secolo, 1500-1600..."
                .value=${this.epoch}
                @input-change=${(e: CustomEvent) => this.epoch = e.detail.value}
              ></ui-input>
            </div>
          </ui-card>
        </section>

        <!-- Section: Immagine -->
        <section>
          <h3 class="text-lg font-semibold text-surface-900 dark:text-white mb-4 flex items-center gap-2">
            <ui-icon name="image" size="sm" class="text-brand-500"></ui-icon>
            Immagine di Riferimento
          </h3>
          
          <ui-card>
            <image-uploader
              label="Immagine dell'opera"
              hint="Usata per il riconoscimento. PNG, JPG fino a 5MB"
              .value=${this.image}
              @image-change=${this.handleImageChange}
            ></image-uploader>
          </ui-card>
        </section>

        <!-- Section: Contenuti -->
        <section>
          <h3 class="text-lg font-semibold text-surface-900 dark:text-white mb-4 flex items-center gap-2">
            <ui-icon name="document" size="sm" class="text-brand-500"></ui-icon>
            Contenuti Descrittivi
          </h3>
          
          <ui-card>
            <content-matrix-editor
              .contents=${this.contents}
              @contents-change=${this.handleContentsChange}
            ></content-matrix-editor>
            
            <div class="mt-4 p-3 rounded-lg bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700">
              <div class="flex items-start gap-2">
                <ui-icon name="info" size="xs" class="text-brand-500 mt-0.5"></ui-icon>
                <p class="text-xs text-surface-600 dark:text-surface-400">
                  Clicca su una cella per aggiungere il contenuto. Ogni cella rappresenta una combinazione unica di durata (quanto tempo ha l'utente) e livello di competenza (bambino, adulto, esperto).
                </p>
              </div>
            </div>
          </ui-card>
        </section>

        <!-- Section: Licenza e Prezzo -->
        <section>
          <h3 class="text-lg font-semibold text-surface-900 dark:text-white mb-4 flex items-center gap-2">
            <ui-icon name="currency" size="sm" class="text-brand-500"></ui-icon>
            Licenza e Prezzo
          </h3>
          
          <ui-card>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <ui-select
                label="Tipo di Licenza"
                .value=${this.license}
                .options=${this.licenseOptions}
                required
                @select-change=${(e: CustomEvent) => this.license = e.detail.value as LicenseType}
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
          </ui-card>
        </section>

        <!-- Section: Tags -->
        <section>
          <h3 class="text-lg font-semibold text-surface-900 dark:text-white mb-4 flex items-center gap-2">
            <ui-icon name="tag" size="sm" class="text-brand-500"></ui-icon>
            Tag
          </h3>
          
          <ui-card>
            <div class="space-y-3">
              <div class="flex gap-2">
                <div class="flex-1">
                  <ui-input
                    placeholder="Aggiungi un tag..."
                    .value=${this.tagInput}
                    @input-change=${(e: CustomEvent) => this.tagInput = e.detail.value}
                    @keydown=${this.handleTagKeydown}
                  ></ui-input>
                </div>
                <ui-button
                  type="button"
                  variant="secondary"
                  icon="plus"
                  label="Aggiungi"
                  @click=${this.handleAddTag}
                ></ui-button>
              </div>
              
              ${this.tags.length > 0 ? html`
                <div class="flex flex-wrap gap-2">
                  ${this.tags.map(tag => html`
                    <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm bg-surface-100 dark:bg-surface-800 text-surface-700 dark:text-surface-300">
                      ${tag}
                      <button
                        type="button"
                        class="p-0.5 hover:bg-surface-200 dark:hover:bg-surface-700 rounded-full transition-colors"
                        @click=${() => this.handleRemoveTag(tag)}
                      >
                        <ui-icon name="x" size="xs"></ui-icon>
                      </button>
                    </span>
                  `)}
                </div>
              ` : html`
                <p class="text-sm text-surface-500 dark:text-surface-400">
                  Nessun tag aggiunto
                </p>
              `}
            </div>
          </ui-card>
        </section>

        <!-- Actions -->
        <div class="flex items-center justify-end gap-3 pt-6 border-t border-surface-200 dark:border-surface-700">
          <ui-button
            type="button"
            variant="secondary"
            label="Annulla"
            @click=${this.handleCancel}
          ></ui-button>
          <ui-button
            type="submit"
            variant="primary"
            label="Crea Opera"
            icon="save"
            .loading=${this.loading}
          ></ui-button>
        </div>
      </form>
    `;
  }
}
