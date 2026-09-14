import { LitElement, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { type AppLanguage, type GeneratedAudio, BCP47_BY_LANGUAGE } from '@artaround/shared';
import { itemService } from '../../services/item.service';
import { uploadService } from '../../services/upload.service';
import { __ } from '../../services/i18n.service';
import { renderFeedbackAlerts } from '../../utils/feedback-alerts';
import '../ui/ui-button';
import '../ui/ui-icon';
import '../ui/ui-alert';
import '../ui/ui-badge';

export interface AudioLanguageEntry {
  language: AppLanguage;
  label: string;
  text: string;
}

/**
 * Audio per lingua di un item già salvato: carica un file o genera con OpenAI.
 */
@customElement('item-audio-panel')
export class ItemAudioPanel extends LitElement {
  @property({ type: String }) itemId = '';
  @property({ type: Array }) entries: AudioLanguageEntry[] = [];
  @property({ type: Object }) audio: Partial<Record<AppLanguage, GeneratedAudio>> = {};

  @state() private error = '';
  @state() private generating = false;
  @state() private busyLanguage: AppLanguage | null = null;
  @state() private speakingLanguage: AppLanguage | null = null;

  createRenderRoot() {
    return this;
  }

  disconnectedCallback() {
    window.speechSynthesis?.cancel();
    super.disconnectedCallback();
  }

  private emitChanged() {
    this.dispatchEvent(
      new CustomEvent('audio-changed', {
        detail: { audio: this.audio },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private toggleBrowserSpeech(entry: AudioLanguageEntry) {
    if (!window.speechSynthesis) return;

    if (this.speakingLanguage === entry.language) {
      window.speechSynthesis.cancel();
      this.speakingLanguage = null;
      return;
    }

    const utterance = new SpeechSynthesisUtterance(entry.text);
    utterance.lang = BCP47_BY_LANGUAGE[entry.language];
    utterance.onend = () => (this.speakingLanguage = null);
    utterance.onerror = () => (this.speakingLanguage = null);

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    this.speakingLanguage = entry.language;
  }

  private playUploadedAudio(language: AppLanguage) {
    const generated = this.audio[language];
    if (!generated) return;
    const audioEl = new Audio(uploadService.getImageUrl(generated.url));
    void audioEl.play();
  }

  private async handleFileSelected(language: AppLanguage, e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    this.error = '';
    this.busyLanguage = language;
    try {
      const item = await itemService.uploadAudio(this.itemId, language, file);
      this.audio = item.audio || {};
      this.emitChanged();
    } catch (err) {
      this.error =
        err instanceof Error ? err.message : __("Errore durante il caricamento dell'audio");
    } finally {
      this.busyLanguage = null;
    }
  }

  private async handleDelete(language: AppLanguage) {
    this.error = '';
    this.busyLanguage = language;
    try {
      const item = await itemService.deleteAudio(this.itemId, language);
      this.audio = item.audio || {};
      this.emitChanged();
    } catch (err) {
      this.error =
        err instanceof Error ? err.message : __("Errore durante l'eliminazione dell'audio");
    } finally {
      this.busyLanguage = null;
    }
  }

  private async handleGenerateMissing() {
    this.error = '';
    this.generating = true;
    try {
      const item = await itemService.generateAudio(this.itemId);
      this.audio = item.audio || {};
      this.emitChanged();
    } catch (err) {
      this.error =
        err instanceof Error ? err.message : __("Errore durante la generazione dell'audio");
    } finally {
      this.generating = false;
    }
  }

  private renderRow(entry: AudioLanguageEntry) {
    const generated = this.audio[entry.language];
    const busy = this.busyLanguage === entry.language;
    const inputId = `item-audio-file-${entry.language}`;

    return html`
      <div
        class="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg bg-surface-50 dark:bg-surface-800"
      >
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-1.5">
            <p class="text-sm font-medium text-surface-800 dark:text-surface-100">${entry.label}</p>
            ${generated
              ? html`
                  <ui-badge
                    size="sm"
                    variant=${generated.source === 'manual' ? 'secondary' : 'info'}
                    .label=${generated.source === 'manual' ? __('Caricato') : __('AI')}
                  ></ui-badge>
                `
              : nothing}
          </div>
          <p class="text-xs text-surface-500 dark:text-surface-400">
            ${generated ? __('Audio disponibile') : __('Nessun audio: sintesi del browser')}
          </p>
        </div>
        <div class="flex items-center gap-2 flex-shrink-0">
          ${generated
            ? html`
                <ui-button
                  type="button"
                  size="sm"
                  variant="secondary"
                  icon="play"
                  .label=${__('Ascolta')}
                  @click=${() => this.playUploadedAudio(entry.language)}
                ></ui-button>
              `
            : html`
                <ui-button
                  type="button"
                  size="sm"
                  variant="secondary"
                  icon=${this.speakingLanguage === entry.language ? 'pause' : 'play'}
                  .label=${this.speakingLanguage === entry.language
                    ? __('Interrompi')
                    : __('Anteprima')}
                  ?disabled=${!entry.text.trim()}
                  @click=${() => this.toggleBrowserSpeech(entry)}
                ></ui-button>
              `}

          <label
            class="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-surface-300 dark:border-surface-600 cursor-pointer hover:bg-surface-100 dark:hover:bg-surface-700"
          >
            <ui-icon name="upload" size="xs"></ui-icon>
            ${generated ? __('Sostituisci') : __('Carica')}
            <input
              id=${inputId}
              type="file"
              accept="audio/*"
              class="hidden"
              ?disabled=${busy}
              @change=${(e: Event) => this.handleFileSelected(entry.language, e)}
            />
          </label>

          ${generated
            ? html`
                <ui-button
                  type="button"
                  size="sm"
                  variant="secondary"
                  icon="trash"
                  .loading=${busy}
                  @click=${() => this.handleDelete(entry.language)}
                ></ui-button>
              `
            : nothing}
        </div>
      </div>
    `;
  }

  render() {
    if (!this.itemId) {
      return html`
        <p class="text-sm text-surface-500 dark:text-surface-400">
          ${__("Salva il contenuto per poter caricare o generare l'audio.")}
        </p>
      `;
    }

    const missingCount = this.entries.filter((entry) => !this.audio[entry.language]).length;

    return html`
      <div class="space-y-3">
        ${renderFeedbackAlerts({ error: this.error })}

        <div class="flex items-center justify-between gap-3">
          <p class="text-xs text-surface-500 dark:text-surface-400">
            ${__(
              "Un audio caricato a mano non ha l'evidenziazione parola per parola nel Navigator; uno generato con OpenAI sì.",
            )}
          </p>
          <ui-button
            type="button"
            size="sm"
            variant="secondary"
            icon="sparkles"
            .label=${__('Genera audio mancante')}
            .loading=${this.generating}
            ?disabled=${missingCount === 0}
            @click=${() => this.handleGenerateMissing()}
          ></ui-button>
        </div>

        <div class="space-y-2">${this.entries.map((entry) => this.renderRow(entry))}</div>
      </div>
    `;
  }
}
