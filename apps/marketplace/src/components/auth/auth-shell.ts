import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import '../ui/ui-card';
import '../ui/ui-brand-mark';

/**
 * Cornice condivisa da login-page e register-page: sfondo, header, card e footer.
 */
@customElement('auth-shell')
export class AuthShell extends LitElement {
  @property({ type: String }) subtitle = '';
  @property({ attribute: false }) renderContent: (() => unknown) | null = null;

  createRenderRoot() {
    return this;
  }

  render() {
    return html`
      <div
        class="min-h-screen flex flex-col items-center justify-center bg-surface-50 dark:bg-surface-950 p-4"
      >
        <div class="absolute inset-0 overflow-hidden pointer-events-none">
          <div
            class="absolute -top-40 -right-40 w-80 h-80 bg-brand-500/10 rounded-full blur-3xl"
          ></div>
          <div
            class="absolute -bottom-40 -left-40 w-80 h-80 bg-brand-500/10 rounded-full blur-3xl"
          ></div>
        </div>

        <div class="relative w-full max-w-sm animate-slide-up">
          <div class="text-center mb-8">
            <div class="inline-flex mb-4">
              <ui-brand-mark
                iconSizeClass="w-12 h-12"
                text="ArtAround Admin"
                textClass="text-2xl font-semibold text-surface-900 dark:text-white"
              ></ui-brand-mark>
            </div>
            <p class="text-sm text-surface-500 dark:text-surface-400 mt-1">${this.subtitle}</p>
          </div>

          <ui-card padding="lg">${this.renderContent ? this.renderContent() : ''}</ui-card>

          <p class="text-center text-xs text-surface-400 mt-6">
            © 2026 ArtAround. Tutti i diritti riservati.
          </p>
        </div>
      </div>
    `;
  }
}
