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
  type UpdateItemData,
  type AppLanguage,
  isSupportedAppLanguage,
} from '@artaround/shared';
import { itemService } from '../../services/item.service';
import { museumService } from '../../services/museum.service';
import { translationService } from '../../services/translation.service';
import { __ } from '../../services/i18n.service';
import { MuseumAwareMixin, AppBaseElement } from '../../base';
import './wikidata-autocomplete';
import '../ui/image-editor';
import '../ui/ui-input';
import '../ui/ui-select';
import '../ui/ui-language-select';
import '../ui/ui-button';
import '../ui/ui-textarea';
import '../ui/ui-alert';
import '../ui/ui-badge';
import '../ui/ui-panel-section';
import '../ui/ui-tag-input';
import '../ui/ui-museum-required-notice';
import '../ui/ui-loading';

@customElement('item-creator')
export class ItemCreator extends MuseumAwareMixin(AppBaseElement) {
  @property({ type: String }) itemId = ''; // For edit mode

  @state() private loading = false;
  @state() private loadingItem = false;
  @state() private translating = false;
  @state() private error = '';
  @state() private success = '';
  @state() private activeLanguages: AppLanguage[] = ['it'];

  @state() private referenceType: ItemReferenceType = ItemReferenceType.ARTWORK;
  @state() private referenceId = '';
  @state() private referenceTitle = '';

  @state() private itemTitle = '';
  @state() private text = '';
  @state() private sourceLanguage: AppLanguage = 'it';
  @state() private translatedTitles: Partial<Record<AppLanguage, string>> = {};
  @state() private translatedTexts: Partial<Record<AppLanguage, string>> = {};
  @state() private translationModeByLang: Partial<Record<AppLanguage, 'ai' | 'manual'>> = {};
  @state() private isSpeaking = false;

  @state() private duration: ContentDuration = ContentDuration.MEDIUM;
  @state() private languageLevel: LanguageLevel = LanguageLevel.MEDIUM;

  @state() private license: LicenseType = LicenseType.CC_BY;
  @state() private price = 0;
  @state() private tags: string[] = [];
  @state() private image = '';

  private get referenceTypeOptions() {
    return ITEM_REFERENCE_TYPE_OPTIONS_IT.map((option) => ({
      ...option,
      label: __(option.label),
    }));
  }

  private get durationOptions() {
    return CONTENT_DURATION_OPTIONS_IT.map((option) => ({
      ...option,
      label: __(option.label),
    }));
  }

  private get languageLevelOptions() {
    return LANGUAGE_LEVEL_OPTIONS_IT.map((option) => ({
      ...option,
      label: __(option.label),
    }));
  }

  private get licenseOptions() {
    return LICENSE_TYPE_OPTIONS_IT.map((option) => ({
      ...option,
      label: __(option.label),
    }));
  }

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener('ui-language-changed', this.handleLanguageChanged as EventListener);
    void this.loadMuseumLanguages();
    if (this.itemId) {
      void this.loadExistingItem();
    }
  }

  // in modifica precarica il contenuto esistente, altrimenti il form parte vuoto
  private async loadExistingItem(): Promise<void> {
    this.loadingItem = true;
    this.error = '';

    try {
      const item = await itemService.getItem(this.itemId);
      if (!item) {
        this.error = __('Contenuto non trovato');
        return;
      }

      this.referenceType = item.referenceType;
      this.referenceId = item.referenceId || '';
      this.referenceTitle = item.referenceTitle || '';
      this.itemTitle = item.title;
      this.text = item.text;
      this.sourceLanguage = item.sourceLanguage;
      this.translatedTitles = item.translatedTitles || {};
      this.translatedTexts = item.translatedTexts || {};
      this.translationModeByLang = Object.fromEntries(
        Object.keys(item.translatedTexts || {}).map((lang) => [lang, 'manual' as const]),
      );
      this.duration = item.duration;
      this.languageLevel = item.languageLevel;
      this.license = item.license;
      this.price = item.price ?? 0;
      this.tags = item.tags || [];
      this.image = item.image || '';
    } catch (err) {
      this.error =
        err instanceof Error ? err.message : __('Impossibile caricare il contenuto da modificare');
    } finally {
      this.loadingItem = false;
    }
  }

  disconnectedCallback() {
    window.removeEventListener('ui-language-changed', this.handleLanguageChanged as EventListener);
    window.speechSynthesis?.cancel();
    super.disconnectedCallback();
  }

  private handleLanguageChanged = (_event: CustomEvent<{ language: AppLanguage }>) => {
    this.requestUpdate();
  };

  onMuseumChanged(): void {
    void this.loadMuseumLanguages();
  }

  private async loadMuseumLanguages(): Promise<void> {
    const museumId = this.selectedMuseumId;
    if (!museumId) {
      this.activeLanguages = ['it'];
      return;
    }

    try {
      const museum = await museumService.getMuseum(museumId);
      const active = (museum?.activeLanguages || []).filter((lang): lang is AppLanguage =>
        isSupportedAppLanguage(lang),
      );
      const normalizedActive: AppLanguage[] =
        active.length > 0 ? active : (['it'] as AppLanguage[]);
      this.activeLanguages = normalizedActive;

      if (!normalizedActive.includes(this.sourceLanguage)) {
        this.sourceLanguage = normalizedActive[0] || 'it';
      }
    } catch {
      this.activeLanguages = ['it'];
    }
  }

  private getTargetLanguages(): AppLanguage[] {
    return this.activeLanguages.filter((lang) => lang !== this.sourceLanguage);
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

  private async translateMissingLanguages(): Promise<void> {
    if (!this.itemTitle.trim() || !this.text.trim()) {
      this.error = __('Compila titolo e testo nella lingua sorgente prima di tradurre');
      return;
    }

    this.translating = true;
    this.error = '';

    try {
      const targets = this.getTargetLanguages();
      const batchItems: Array<{ key: string; text: string; targetLang: AppLanguage }> = [];

      for (const lang of targets) {
        if (!this.translatedTitles[lang]?.trim()) {
          batchItems.push({ key: `${lang}:title`, text: this.itemTitle, targetLang: lang });
        }
        if (!this.translatedTexts[lang]?.trim()) {
          batchItems.push({ key: `${lang}:text`, text: this.text, targetLang: lang });
        }
      }

      if (batchItems.length === 0) {
        return;
      }

      const translations = await translationService.translateBatch(this.sourceLanguage, batchItems);

      for (const lang of targets) {
        let translatedByAI = false;
        const titleKey = `${lang}:title`;
        const textKey = `${lang}:text`;

        if (translations[titleKey]) {
          this.translatedTitles = {
            ...this.translatedTitles,
            [lang]: translations[titleKey],
          };
          translatedByAI = true;
        }

        if (translations[textKey]) {
          this.translatedTexts = {
            ...this.translatedTexts,
            [lang]: translations[textKey],
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
    } catch (err) {
      this.error = err instanceof Error ? err.message : __('Traduzione automatica non riuscita');
    } finally {
      this.translating = false;
    }
  }

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

  private handlePriceChange(e: CustomEvent) {
    this.price = parseFloat(e.detail.value) || 0;
  }

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

  // anteprima con la Web Speech API del browser, nessuna chiamata al server
  private toggleSpeechPreview() {
    if (!window.speechSynthesis) return;

    if (this.isSpeaking) {
      window.speechSynthesis.cancel();
      this.isSpeaking = false;
      return;
    }

    if (!this.text.trim()) return;

    const utterance = new SpeechSynthesisUtterance(this.text);
    utterance.lang = `${this.sourceLanguage}-${this.sourceLanguage.toUpperCase()}`;
    utterance.onend = () => {
      this.isSpeaking = false;
    };
    utterance.onerror = () => {
      this.isSpeaking = false;
    };

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    this.isSpeaking = true;
  }

  private validateForm(): string | null {
    if (!this.selectedMuseumId) {
      return __('Seleziona un museo prima di creare il contenuto');
    }
    if (!this.itemTitle.trim()) {
      return __('Il titolo è obbligatorio');
    }
    if (!this.text.trim()) {
      return __('Il testo è obbligatorio');
    }

    for (const lang of this.getTargetLanguages()) {
      if (!this.translatedTitles[lang]?.trim() || !this.translatedTexts[lang]?.trim()) {
        return `${__('Completa le traduzioni per la lingua')} ${lang.toUpperCase()}`;
      }
    }
    if (
      [
        ItemReferenceType.ARTWORK,
        ItemReferenceType.AUTHOR,
        ItemReferenceType.MOVEMENT,
        ItemReferenceType.MUSEUM,
      ].includes(this.referenceType) &&
      !this.referenceId
    ) {
      return __('Seleziona un riferimento da Wikidata');
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

    const museumId = this.selectedMuseumId;
    if (!museumId) {
      this.error = __('Seleziona un museo prima di creare il contenuto');
      return;
    }

    this.loading = true;
    this.error = '';
    this.success = '';

    try {
      const itemData: CreateItemData | UpdateItemData = {
        museumId,
        sourceLanguage: this.sourceLanguage,
        referenceType: this.referenceType,
        referenceId: this.referenceId || undefined,
        referenceTitle: this.referenceTitle || undefined,
        title: this.itemTitle.trim(),
        text: this.text.trim(),
        translatedTitles: this.translatedTitles,
        translatedTexts: this.translatedTexts,
        duration: this.duration,
        languageLevel: this.languageLevel,
        license: this.license,
        price: this.price,
        tags: this.tags.length > 0 ? this.tags : undefined,
        image: this.image || undefined,
      };

      const isEditMode = Boolean(this.itemId);

      if (isEditMode) {
        await itemService.updateItem(this.itemId, itemData);
        this.success = __('Contenuto aggiornato con successo!');
      } else {
        await itemService.createItem(itemData as CreateItemData);
        this.success = __('Contenuto creato con successo!');
      }

      this.dispatchEvent(
        new CustomEvent('item-created', {
          bubbles: true,
          composed: true,
        }),
      );

      // solo in creazione, in modifica il chiamante torna già alla lista
      if (!isEditMode) {
        setTimeout(() => {
          this.resetForm();
        }, 2000);
      }
    } catch (err) {
      console.error('Error saving item:', err);
      this.error =
        err instanceof Error ? err.message : __('Errore durante il salvataggio del contenuto');
    } finally {
      this.loading = false;
    }
  }

  private resetForm() {
    this.referenceType = ItemReferenceType.ARTWORK;
    this.referenceId = '';
    this.referenceTitle = '';
    this.itemTitle = '';
    this.text = '';
    this.sourceLanguage = this.activeLanguages[0] || 'it';
    this.translatedTitles = {};
    this.translatedTexts = {};
    this.translationModeByLang = {};
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
        return __('Es: Gioconda, David di Michelangelo...');
      case ItemReferenceType.AUTHOR:
        return __('Es: Leonardo da Vinci, Caravaggio...');
      case ItemReferenceType.MOVEMENT:
        return __('Es: Rinascimento, Barocco, Impressionismo...');
      case ItemReferenceType.MUSEUM:
        return __('Es: Galleria Borghese, Uffizi...');
      default:
        return __('Cerca su Wikidata...');
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

  render() {
    const needsWikidataRef = [
      ItemReferenceType.ARTWORK,
      ItemReferenceType.AUTHOR,
      ItemReferenceType.MOVEMENT,
      ItemReferenceType.MUSEUM,
    ].includes(this.referenceType);

    if (this.loadingItem) {
      return html`<ui-loading .text=${__('Caricamento contenuto...')}></ui-loading>`;
    }

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
          .title=${__('Tipo di Contenuto')}
          icon="link"
          .renderContent=${() => html`
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ui-select
                .label=${__('Tipo di riferimento')}
                .value=${this.referenceType}
                .options=${this.referenceTypeOptions}
                required
                @select-change=${(e: CustomEvent) =>
                  (this.referenceType = e.detail.value as ItemReferenceType)}
              ></ui-select>

              ${needsWikidataRef
                ? html`
                    <wikidata-autocomplete
                      .label=${__('Riferimento Wikidata')}
                      placeholder=${this.getPlaceholderForReferenceType()}
                      .selectedId=${this.referenceId}
                      required
                      @wikidata-select=${this.handleWikidataSelect}
                    ></wikidata-autocomplete>
                  `
                : html`
                    <ui-input
                      .label=${__('Titolo riferimento (opzionale)')}
                      .placeholder=${__('Es: Come raggiungere il museo')}
                      .value=${this.referenceTitle}
                      @input-change=${(e: CustomEvent) => (this.referenceTitle = e.detail.value)}
                    ></ui-input>
                  `}
            </div>
          `}
        ></ui-panel-section>

        <ui-panel-section
          .title=${__('Caratteristiche del Contenuto')}
          icon="settings"
          .renderContent=${() => html`
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <ui-select
                .label=${__('Durata')}
                .hint=${__('Tempo di lettura/ascolto previsto')}
                .value=${this.duration}
                .options=${this.durationOptions}
                required
                @select-change=${(e: CustomEvent) =>
                  (this.duration = e.detail.value as ContentDuration)}
              ></ui-select>

              <ui-select
                .label=${__('Livello linguistico')}
                .hint=${__('Complessità del linguaggio')}
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
          .title=${__('Contenuto')}
          icon="document"
          .renderContent=${() => html`
            <div class="space-y-6">
              <ui-language-select
                .label=${__('Lingua sorgente')}
                .value=${this.sourceLanguage}
                .languages=${this.activeLanguages}
                @select-change=${(e: CustomEvent) =>
                  (this.sourceLanguage = e.detail.value as AppLanguage)}
              ></ui-language-select>

              <ui-input
                .label=${__('Titolo')}
                .placeholder=${__('Titolo del contenuto')}
                .value=${this.itemTitle}
                required
                @input-change=${(e: CustomEvent) => (this.itemTitle = e.detail.value)}
              ></ui-input>

              <div>
                <label
                  class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2"
                >
                  ${__('Testo')} <span class="text-danger-500">*</span>
                </label>
                <textarea
                  class="w-full h-48 p-3 border rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-surface-800 dark:border-surface-600 dark:text-white"
                  placeholder=${__('Scrivi il testo descrittivo...')}
                  .value=${this.text}
                  @input=${(e: Event) => {
                    this.text = (e.target as HTMLTextAreaElement).value;
                  }}
                ></textarea>
                <div class="mt-2 flex items-center justify-between text-xs text-surface-500">
                  <span>${this.getWordCount()} ${__('parole')}</span>
                  <span>${__('Tempo stimato')}: ${this.getEstimatedReadTime()}</span>
                  <ui-button
                    size="sm"
                    variant="ghost"
                    icon=${this.isSpeaking ? 'pause' : 'play'}
                    .label=${this.isSpeaking ? __('Interrompi') : __('Ascolta anteprima')}
                    ?disabled=${!this.text.trim()}
                    @click=${this.toggleSpeechPreview}
                  ></ui-button>
                </div>
              </div>

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
                          .label=${__('Traduci mancanti con AI')}
                          icon="sparkles"
                          .loading=${this.translating}
                          @click=${() => this.translateMissingLanguages()}
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
                              .value=${this.translatedTitles[lang] || ''}
                              @input-change=${(e: CustomEvent) => {
                                this.translatedTitles = {
                                  ...this.translatedTitles,
                                  [lang]: e.detail.value,
                                };
                                this.markLanguageAsManual(lang);
                              }}
                              required
                            ></ui-input>
                            <ui-textarea
                              .label=${`${__('Testo')} (${lang.toUpperCase()})`}
                              .value=${this.translatedTexts[lang] || ''}
                              @input=${(e: InputEvent) => {
                                this.translatedTexts = {
                                  ...this.translatedTexts,
                                  [lang]: (e.target as HTMLTextAreaElement).value,
                                };
                                this.markLanguageAsManual(lang);
                              }}
                              rows="4"
                              required
                            ></ui-textarea>
                          </div>
                        `;
                      })}
                    </div>
                  `
                : nothing}
            </div>
          `}
        ></ui-panel-section>

        <ui-panel-section
          .title=${__('Immagine (opzionale)')}
          icon="image"
          .renderContent=${() => html`
            <p class="text-xs text-surface-500 dark:text-surface-400 mb-2">
              ${__('Se non specificata, verrà usata quella del riferimento')}
            </p>
            <image-editor
              .label=${__('Immagine di copertina')}
              category="items"
              .value=${this.image}
              maxWidth=${1200}
              maxHeight=${1200}
              .maxOutputSizeMb=${0.5}
              defaultFormat="webp"
              @image-saved=${(e: CustomEvent) => {
                this.image = e.detail.path || '';
              }}
            ></image-editor>
          `}
        ></ui-panel-section>

        <ui-panel-section
          .title=${__('Licenza e Prezzo')}
          icon="euro"
          .renderContent=${() => html`
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <ui-select
                .label=${__('Tipo di Licenza')}
                .value=${this.license}
                .options=${this.licenseOptions}
                required
                @select-change=${(e: CustomEvent) => (this.license = e.detail.value as LicenseType)}
              ></ui-select>

              <ui-input
                type="number"
                .label=${__('Prezzo (€)')}
                .placeholder=${__('0 per gratuito')}
                .value=${String(this.price)}
                .hint=${__('Lascia 0 per contenuto gratuito')}
                @input-change=${this.handlePriceChange}
              ></ui-input>
            </div>
          `}
        ></ui-panel-section>

        <ui-panel-section
          .title=${__('Tag')}
          icon="tag"
          .renderContent=${() => html`
            <ui-tag-input
              .placeholder=${__('Aggiungi un tag...')}
              .tags=${this.tags}
              .emptyText=${__('Nessun tag aggiunto')}
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
            .label=${__('Annulla')}
            @click=${this.handleCancel}
          ></ui-button>
          <ui-button
            type="submit"
            variant="primary"
            .label=${this.itemId ? __('Salva modifiche') : __('Crea Contenuto')}
            icon="save"
            .loading=${this.loading}
          ></ui-button>
        </div>
      </form>
    `;
  }
}
