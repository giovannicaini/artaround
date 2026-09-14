import { html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import {
  LicenseType,
  ItemReferenceType,
  ContentDuration,
  LanguageLevel,
  type CreateItemData,
  type UpdateItemData,
  type AppLanguage,
  type GeneratedAudio,
  isSupportedAppLanguage,
  BCP47_BY_LANGUAGE,
} from '@artaround/shared';
import { itemService } from '../../services/item.service';
import { museumService } from '../../services/museum.service';
import { modalService } from '../../services/modal.service';
import { __ } from '../../services/i18n.service';
import { renderFeedbackAlerts } from '../../utils/feedback-alerts';
import { renderStackedTranslations } from '../../utils/translation-panel';
import { runBatchTranslation } from '../../utils/translation-batch';
import {
  getReferenceTypeOptions,
  getContentDurationOptions,
  getLanguageLevelOptions,
  getLicenseTypeOptions,
} from '../../utils/enum-labels';
import { MuseumAwareMixin, AppBaseElement } from '../../base';
import './wikidata-autocomplete';
import './item-audio-panel';
import '../ui/image-editor';
import '../ui/ui-input';
import '../ui/ui-select';
import '../ui/ui-language-select';
import '../ui/ui-button';
import '../ui/ui-form-actions';
import '../ui/ui-textarea';
import '../ui/ui-alert';
import '../ui/ui-badge';
import '../ui/ui-panel-section';
import '../ui/ui-tag-input';
import '../ui/ui-museum-required-notice';
import '../ui/ui-loading';

/**
 * Form di creazione/modifica di un contenuto (item) collegato a opera, autore, movimento o museo.
 */
@customElement('item-creator')
export class ItemCreator extends MuseumAwareMixin(AppBaseElement) {
  @property({ type: String }) itemId = ''; // For edit mode

  @state() private loading = false;
  @state() private loadingItem = false;
  @state() private translating = false;
  @state() private error = '';
  @state() private success = '';
  @state() private activeLanguages: AppLanguage[] = ['it'];

  // Reference selection
  @state() private referenceType: ItemReferenceType = ItemReferenceType.ARTWORK;
  @state() private referenceId = '';
  @state() private referenceTitle = '';

  // Content
  @state() private itemTitle = '';
  @state() private text = '';
  @state() private sourceLanguage: AppLanguage = 'it';
  @state() private translatedTitles: Partial<Record<AppLanguage, string>> = {};
  @state() private translatedTexts: Partial<Record<AppLanguage, string>> = {};
  @state() private translationModeByLang: Partial<Record<AppLanguage, 'ai' | 'manual'>> = {};
  @state() private isSpeaking = false;
  @state() private audio: Partial<Record<AppLanguage, GeneratedAudio>> = {};
  // Testo/titolo al caricamento — confrontati al salvataggio per capire se avvisare della perdita di traduzioni/audio.
  private originalTitle = '';
  private originalText = '';

  // Characteristics
  @state() private duration: ContentDuration = ContentDuration.MEDIUM;
  @state() private languageLevel: LanguageLevel = LanguageLevel.MEDIUM;

  // Metadata
  @state() private license: LicenseType = LicenseType.CC_BY;
  @state() private price = 0;
  @state() private tags: string[] = [];
  @state() private image = '';

  private get referenceTypeOptions() {
    return getReferenceTypeOptions();
  }

  private get durationOptions() {
    return getContentDurationOptions();
  }

  private get languageLevelOptions() {
    return getLanguageLevelOptions();
  }

  private get licenseOptions() {
    return getLicenseTypeOptions();
  }

  // ─── Ciclo di vita ───────────────────────────────────────────
  connectedCallback() {
    super.connectedCallback();
    window.addEventListener('ui-language-changed', this.handleLanguageChanged as EventListener);
    void this.loadMuseumLanguages();
    if (this.itemId) {
      void this.loadExistingItem();
    }
  }

  // In modalità modifica (itemId valorizzato) precarica il contenuto esistente.
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
      this.originalTitle = item.title;
      this.originalText = item.text;
      this.sourceLanguage = item.sourceLanguage;
      this.translatedTitles = item.translatedTitles || {};
      this.translatedTexts = item.translatedTexts || {};
      this.audio = item.audio || {};
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

  // ─── Helper lingua ────────────────────────────────────
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
    await runBatchTranslation({
      sourceLanguage: this.sourceLanguage,
      targetLanguages: this.getTargetLanguages(),
      validationErrorMessage: __('Compila titolo e testo nella lingua sorgente prima di tradurre'),
      getFields: (lang) => [
        {
          key: 'title',
          sourceValue: this.itemTitle,
          currentValue: this.translatedTitles[lang] || '',
        },
        { key: 'text', sourceValue: this.text, currentValue: this.translatedTexts[lang] || '' },
      ],
      onFieldTranslated: (lang, key, value) => {
        if (key === 'title') {
          this.translatedTitles = { ...this.translatedTitles, [lang]: value };
        } else {
          this.translatedTexts = { ...this.translatedTexts, [lang]: value };
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

  // ─── Azioni (aggiornamento campi) ─────────────────────────────
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

  // ─── Valori calcolati e validazione ───────────────────────────────
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

  // ─── Text-to-Speech Preview ──────────────────────────────
  // Anteprima con l'API Web Speech del browser: come suonerebbe il testo nel Navigator.
  private toggleSpeechPreview() {
    if (!window.speechSynthesis) return;

    if (this.isSpeaking) {
      window.speechSynthesis.cancel();
      this.isSpeaking = false;
      return;
    }

    if (!this.text.trim()) return;

    const utterance = new SpeechSynthesisUtterance(this.text);
    utterance.lang = BCP47_BY_LANGUAGE[this.sourceLanguage];
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
    // Per certi tipi di riferimento, richiede un ID Wikidata
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

  // ─── Flusso di invio ─────────────────────────────────────────
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

    const isEditMode = Boolean(this.itemId);
    const textChanged =
      isEditMode &&
      (this.itemTitle.trim() !== this.originalTitle || this.text.trim() !== this.originalText);

    if (textChanged) {
      const confirmed = await modalService.confirm({
        title: __('Testo modificato'),
        message: __(
          'Modificando titolo o testo, tutte le traduzioni e tutti gli audio (caricati o generati) di questo contenuto verranno eliminati, per evitare che restino disallineati dal nuovo testo. Vuoi continuare?',
        ),
        variant: 'danger',
        confirmLabel: __('Continua ed elimina'),
        cancelLabel: __('Annulla'),
      });
      if (!confirmed) return;

      this.translatedTitles = {};
      this.translatedTexts = {};
      this.translationModeByLang = {};
      this.audio = {};
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

      if (isEditMode) {
        await itemService.updateItem(this.itemId, itemData);
        this.originalTitle = this.itemTitle.trim();
        this.originalText = this.text.trim();
        this.success = __('Contenuto aggiornato con successo!');
      } else {
        await itemService.createItem(itemData as CreateItemData);
        this.success = __('Contenuto creato con successo!');
      }

      // Emette l'evento di successo
      this.dispatchEvent(
        new CustomEvent('item-created', {
          bubbles: true,
          composed: true,
        }),
      );

      // Reset form after short delay (solo in creazione: in modifica il form
      // sparisce comunque perché il chiamante torna alla lista sull'evento sopra)
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

  // ─── Helper stato form ──────────────────────────────────
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

  // Una riga per lingua con testo scritto: la sorgente sempre, le traduzioni solo se compilate.
  private getAudioEntries() {
    const entries = [
      {
        language: this.sourceLanguage,
        label: this.getLanguageLabel(this.sourceLanguage),
        text: this.text,
      },
    ];
    for (const lang of this.getTargetLanguages()) {
      const text = this.translatedTexts[lang];
      if (text?.trim()) {
        entries.push({ language: lang, label: this.getLanguageLabel(lang), text });
      }
    }
    return entries;
  }

  // ─── Render principale ────────────────────────────────────────
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
        ${!this.selectedMuseumId
          ? html`<ui-museum-required-notice
              subject="contenuti"
              @select-museum=${this.emitSelectMuseum}
            ></ui-museum-required-notice>`
          : nothing}
        ${renderFeedbackAlerts({ error: this.error, success: this.success })}

        <ui-panel-section
          .title=${__('Tipo di Contenuto')}
          icon="link"
          .help=${__(
            "A cosa si riferisce questo contenuto: un'opera specifica, un autore, un movimento artistico, un periodo storico o il museo in generale. Il tipo determina cosa cercare su Wikidata e da quali visite può essere richiamato.",
          )}
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
                      @wikidata-select=${(e: CustomEvent) => this.handleWikidataSelect(e)}
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
                    variant="secondary"
                    icon=${this.isSpeaking ? 'pause' : 'play'}
                    .label=${this.isSpeaking ? __('Interrompi') : __('Ascolta anteprima')}
                    ?disabled=${!this.text.trim()}
                    @click=${() => this.toggleSpeechPreview()}
                  ></ui-button>
                </div>
              </div>

              ${renderStackedTranslations({
                targetLanguages: this.getTargetLanguages(),
                getLanguageLabel: (lang) => this.getLanguageLabel(lang),
                getTranslationStatus: (lang) => this.getTranslationStatus(lang),
                translating: this.translating,
                onTranslateMissing: () => this.translateMissingLanguages(),
                getFields: (lang) => [
                  {
                    label: `${__('Titolo')} (${lang.toUpperCase()})`,
                    value: this.translatedTitles[lang] || '',
                    kind: 'input',
                    onUpdate: (value) => {
                      this.translatedTitles = { ...this.translatedTitles, [lang]: value };
                      this.markLanguageAsManual(lang);
                    },
                  },
                  {
                    label: `${__('Testo')} (${lang.toUpperCase()})`,
                    value: this.translatedTexts[lang] || '',
                    kind: 'textarea',
                    rows: 4,
                    onUpdate: (value) => {
                      this.translatedTexts = { ...this.translatedTexts, [lang]: value };
                      this.markLanguageAsManual(lang);
                    },
                  },
                ],
              })}
            </div>
          `}
        ></ui-panel-section>

        <ui-panel-section
          .title=${__('Audio')}
          icon="microphone"
          .help=${__(
            'Per ogni lingua con un testo scritto: carica un file audio o generalo con OpenAI. Finché manca, il Navigator legge il testo con la sintesi vocale del browser.',
          )}
          .renderContent=${() => html`
            <item-audio-panel
              .itemId=${this.itemId}
              .entries=${this.getAudioEntries()}
              .audio=${this.audio}
              @audio-changed=${(
                e: CustomEvent<{ audio: Partial<Record<AppLanguage, GeneratedAudio>> }>,
              ) => {
                this.audio = e.detail.audio;
              }}
            ></item-audio-panel>
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
          .help=${__(
            'Licenza Creative Commons del testo (CC0 = dominio pubblico, CC-BY = richiede attribuzione, NC = non commerciale, SA = condividi allo stesso modo, Proprietaria = tutti i diritti riservati). Il prezzo si applica solo se qualcuno acquista questo contenuto separatamente nel Marketplace, non se è già incluso in una visita.',
          )}
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
                @input-change=${(e: CustomEvent) => this.handlePriceChange(e)}
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
        <ui-form-actions
          .submitLabel=${this.itemId ? __('Salva modifiche') : __('Crea Contenuto')}
          .loading=${this.loading}
          @cancel=${this.handleCancel}
        ></ui-form-actions>
      </form>
    `;
  }
}
