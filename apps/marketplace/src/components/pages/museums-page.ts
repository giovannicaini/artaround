import { LitElement, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { Museum } from '@artaround/shared';
import '../museums/museum-selector';
import '../ui/ui-button';

@customElement('museums-page')
export class MuseumsPage extends LitElement {
  @state() private selectedMuseum: Museum | null = null;

  createRenderRoot() {
    return this;
  }

  private handleMuseumSelected(e: CustomEvent) {
    this.selectedMuseum = e.detail;
  }

  private handleConfirm() {
    if (this.selectedMuseum) {
      this.dispatchEvent(
        new CustomEvent('museum-confirmed', {
          detail: this.selectedMuseum,
          bubbles: true,
          composed: true,
        }),
      );
    }
  }

  private openMapEditor() {
    if (this.selectedMuseum) {
      this.dispatchEvent(
        new CustomEvent('open-map-editor', {
          detail: { museumId: this.selectedMuseum._id },
          bubbles: true,
          composed: true,
        }),
      );
    }
  }

  render() {
    return html`
      <div class="space-y-6 animate-fade-in">
        <!-- Header -->
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 class="text-2xl font-semibold text-surface-900 dark:text-white">Seleziona Museo</h2>
            <p class="text-sm text-surface-500 dark:text-surface-400 mt-1">
              Scegli il museo su cui vuoi lavorare
            </p>
          </div>
          ${this.selectedMuseum
            ? html`
                <ui-button
                  variant="primary"
                  size="md"
                  label="Conferma: ${this.selectedMuseum.name}"
                  icon="check"
                  @click=${this.handleConfirm}
                ></ui-button>
              `
            : ''}
        </div>

        <!-- Selected Museum Banner -->
        ${this.selectedMuseum
          ? html`
              <div
                class="p-4 rounded-lg bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800"
              >
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-lg bg-brand-600 flex items-center justify-center">
                      <ui-icon name="check" size="sm" class="text-white"></ui-icon>
                    </div>
                    <div>
                      <p class="font-medium text-brand-900 dark:text-brand-100">
                        Museo selezionato: ${this.selectedMuseum.name}
                      </p>
                      <p class="text-sm text-brand-700 dark:text-brand-300">
                        ${this.selectedMuseum.location?.city || ''},
                        ${this.selectedMuseum.location?.country || ''}
                      </p>
                    </div>
                  </div>
                  <div class="flex gap-2">
                    <ui-button
                      variant="secondary"
                      size="sm"
                      label="🗺️ Gestisci Mappe"
                      @click=${this.openMapEditor}
                    ></ui-button>
                    <ui-button
                      variant="primary"
                      size="sm"
                      icon="check"
                      @click=${this.handleConfirm}
                    ></ui-button>
                  </div>
                </div>
              </div>
            `
          : ''}

        <!-- Museum Grid -->
        <museum-selector @museum-selected=${this.handleMuseumSelected}></museum-selector>
      </div>
    `;
  }
}
