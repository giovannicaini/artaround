import { LitElement, html, nothing } from 'lit';
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
  // Riquadro opzionale a fianco (es. utenti di test in login-page): se assente
  // il layout resta a singola colonna centrata, invariato per register-page.
  @property({ attribute: false }) renderSidePanel: (() => unknown) | null = null;

  createRenderRoot() {
    return this;
  }

  render() {
    return html`
      <div
        class="min-h-screen grid lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-8 bg-surface-50 dark:bg-surface-950 p-4"
      >
        <div class="absolute inset-0 overflow-hidden pointer-events-none">
          <div
            class="absolute -top-40 -right-40 w-80 h-80 bg-brand-500/10 rounded-full blur-3xl"
          ></div>
          <div
            class="absolute -bottom-40 -left-40 w-80 h-80 bg-brand-500/10 rounded-full blur-3xl"
          ></div>
        </div>

        <!-- Colonna vuota a sinistra: bilancia il pannello laterale a destra
             così il form di login resta sempre visivamente al centro pagina. -->
        <div class="hidden lg:block"></div>

        <div class="relative w-full max-w-md mx-auto animate-slide-up">
          <div class="text-center mb-8">
            <div class="inline-flex items-center gap-2.5 mb-4">
              <ui-brand-mark iconSizeClass="w-12 h-12" .showText=${false}></ui-brand-mark>
              <span class="text-2xl font-bold whitespace-nowrap">
                <span class="gradient-aurora-text">ArtAround</span>
                <span class="text-surface-900 dark:text-white">Marketplace</span>
              </span>
            </div>
            ${this.subtitle
              ? html`<p class="text-sm text-surface-500 dark:text-surface-400 mt-1">
                  ${this.subtitle}
                </p>`
              : nothing}
          </div>

          <ui-card padding="lg">${this.renderContent ? this.renderContent() : ''}</ui-card>

          <p class="text-center text-xs text-surface-400 mt-6">
            © 2026 ArtAround. Tutti i diritti riservati.
          </p>
        </div>

        ${this.renderSidePanel
          ? html`<div
              class="hidden lg:block relative w-full max-w-[15rem] justify-self-start animate-slide-up"
            >
              ${this.renderSidePanel()}
            </div>`
          : html`<div class="hidden lg:block"></div>`}
      </div>
    `;
  }
}
