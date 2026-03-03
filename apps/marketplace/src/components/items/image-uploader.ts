import { LitElement, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../ui/ui-icon';
import '../ui/ui-button';
import '../ui/ui-image-placeholder';
import { __ } from '../../services/i18n.service';

@customElement('image-uploader')
export class ImageUploader extends LitElement {
  @property({ type: String }) label = '';
  @property({ type: String }) hint = '';
  @property({ type: String }) value = '';
  @property({ type: String }) error = '';
  @property({ type: Boolean }) required = false;

  @state() private dragOver = false;
  @state() private uploading = false;

  // ─── Lifecycle ───────────────────────────────────────────
  createRenderRoot() {
    return this;
  }

  // ─── Actions (Drag & Upload) ─────────────────────────────
  private handleDragOver(e: DragEvent) {
    e.preventDefault();
    this.dragOver = true;
  }

  private handleDragLeave(e: DragEvent) {
    e.preventDefault();
    this.dragOver = false;
  }

  private handleDrop(e: DragEvent) {
    e.preventDefault();
    this.dragOver = false;

    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      this.processFile(files[0]);
    }
  }

  private handleFileSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.processFile(input.files[0]);
    }
  }

  private async processFile(file: File) {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      this.error = __("Il file deve essere un'immagine");
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      this.error = __("L'immagine non può superare i 5MB");
      return;
    }

    this.uploading = true;
    this.error = '';

    try {
      const base64 = await this.fileToBase64(file);
      this.value = base64;

      this.dispatchEvent(
        new CustomEvent('image-change', {
          detail: { value: base64, file },
          bubbles: true,
          composed: true,
        }),
      );
    } catch (e) {
      console.error('Error processing image:', e);
      this.error = __("Errore durante l'elaborazione dell'immagine");
    } finally {
      this.uploading = false;
    }
  }

  // ─── File Helpers ────────────────────────────────────────
  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  private removeImage() {
    this.value = '';
    this.dispatchEvent(
      new CustomEvent('image-change', {
        detail: { value: '' },
        bubbles: true,
        composed: true,
      }),
    );
  }

  // ─── Render Entry ────────────────────────────────────────
  render() {
    const resolvedLabel = this.label || __('Immagine');
    const resolvedHint = this.hint || __('PNG, JPG fino a 5MB');

    return html`
      <div class="space-y-1.5">
        <label class="block text-sm font-medium text-surface-700 dark:text-surface-300">
          ${resolvedLabel}
          ${this.required ? html`<span class="text-danger-500 ml-0.5">*</span>` : nothing}
        </label>

        ${this.value
          ? html`
              <!-- Image Preview -->
              <div
                class="relative rounded-lg overflow-hidden border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800"
              >
                <img
                  src="${this.value}"
                  alt=${__('Anteprima')}
                  class="w-full h-48 object-contain"
                  @error=${(e: Event) => {
                    const img = e.target as HTMLImageElement;
                    img.style.display = 'none';
                    img.parentElement
                      ?.querySelector('ui-image-placeholder')
                      ?.removeAttribute('hidden');
                  }}
                />
                <ui-image-placeholder
                  type="default"
                  size="lg"
                  hidden
                  class="w-full h-48"
                ></ui-image-placeholder>
                <div class="absolute top-2 right-2 flex gap-2">
                  <button
                    type="button"
                    class="p-1.5 bg-white dark:bg-surface-800 rounded-lg shadow-md hover:bg-surface-50 dark:hover:bg-surface-700 transition-colors"
                    @click=${this.removeImage}
                  >
                    <ui-icon name="trash" size="xs" class="text-danger-500"></ui-icon>
                  </button>
                </div>
              </div>
            `
          : html`
              <!-- Upload Zone -->
              <div
                class="relative border-2 border-dashed rounded-lg p-6 transition-colors cursor-pointer
              ${this.dragOver
                  ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20'
                  : 'border-surface-300 dark:border-surface-600 hover:border-surface-400 dark:hover:border-surface-500'}
              ${this.error ? 'border-danger-500' : ''}
            "
                @dragover=${this.handleDragOver}
                @dragleave=${this.handleDragLeave}
                @drop=${this.handleDrop}
                @click=${() => (this.shadowRoot || this).querySelector('input')?.click()}
              >
                <input
                  type="file"
                  accept="image/*"
                  class="sr-only"
                  @change=${this.handleFileSelect}
                />

                <div class="text-center">
                  ${this.uploading
                    ? html`
                        <svg
                          class="animate-spin h-10 w-10 text-brand-500 mx-auto mb-3"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            class="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            stroke-width="4"
                          ></circle>
                          <path
                            class="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                          ></path>
                        </svg>
                        <p class="text-sm text-surface-600 dark:text-surface-400">
                          ${__('Elaborazione in corso...')}
                        </p>
                      `
                    : html`
                        <ui-icon
                          name="upload"
                          size="lg"
                          class="text-surface-400 dark:text-surface-500 mx-auto mb-3"
                        ></ui-icon>
                        <p class="text-sm text-surface-600 dark:text-surface-400 mb-1">
                          <span class="text-brand-600 dark:text-brand-400 font-medium"
                            >${__('Clicca per caricare')}</span
                          >
                          ${__('o trascina qui')}
                        </p>
                        <p class="text-xs text-surface-500 dark:text-surface-500">
                          ${resolvedHint}
                        </p>
                      `}
                </div>
              </div>
            `}
        ${this.error
          ? html`
              <p
                class="text-xs text-danger-600 dark:text-danger-400 flex items-center gap-1"
                role="alert"
              >
                <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fill-rule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                    clip-rule="evenodd"
                  />
                </svg>
                ${this.error}
              </p>
            `
          : nothing}
      </div>
    `;
  }
}
