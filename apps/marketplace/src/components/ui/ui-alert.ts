import { LitElement, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import './ui-icon';
import './ui-button';

export type AlertVariant = 'success' | 'danger' | 'warning' | 'info';

/**
 * UI Alert
 *
 * A consistent alert/notification box with icon.
 *
 * @example
 * ```html
 * <ui-alert variant="danger" message="Si è verificato un errore"></ui-alert>
 * <ui-alert variant="success" message="Operazione completata!"></ui-alert>
 * <ui-alert variant="info" title="Nota" message="Informazione importante"></ui-alert>
 * ```
 */
@customElement('ui-alert')
export class UiAlert extends LitElement {
  @property({ type: String }) variant: AlertVariant = 'info';
  @property({ type: String }) title = '';
  @property({ type: String }) message = '';
  @property({ type: Boolean }) dismissible = false;
  @property({ type: Boolean }) showRetry = false;

  @state() private visible = true;

  // ─── Lifecycle ───────────────────────────────────────────
  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.style.display = 'block';
  }

  // ─── Actions ──────────────────────────────────────────────
  private get variantConfig() {
    const configs = {
      success: {
        icon: 'check',
        bg: 'bg-success-50 dark:bg-success-900/20',
        border: 'border-success-200 dark:border-success-800',
        iconColor: 'text-success-600 dark:text-success-400',
        titleColor: 'text-success-800 dark:text-success-300',
        textColor: 'text-success-700 dark:text-success-300',
      },
      danger: {
        icon: 'warning',
        bg: 'bg-danger-50 dark:bg-danger-900/20',
        border: 'border-danger-200 dark:border-danger-800',
        iconColor: 'text-danger-600 dark:text-danger-400',
        titleColor: 'text-danger-800 dark:text-danger-300',
        textColor: 'text-danger-700 dark:text-danger-300',
      },
      warning: {
        icon: 'warning',
        bg: 'bg-warning-50 dark:bg-warning-900/20',
        border: 'border-warning-200 dark:border-warning-800',
        iconColor: 'text-warning-600 dark:text-warning-400',
        titleColor: 'text-warning-800 dark:text-warning-300',
        textColor: 'text-warning-700 dark:text-warning-300',
      },
      info: {
        icon: 'info',
        bg: 'bg-brand-50 dark:bg-brand-900/20',
        border: 'border-brand-200 dark:border-brand-800',
        iconColor: 'text-brand-600 dark:text-brand-400',
        titleColor: 'text-brand-800 dark:text-brand-300',
        textColor: 'text-brand-700 dark:text-brand-300',
      },
    };
    return configs[this.variant];
  }

  private handleDismiss() {
    this.visible = false;
    this.dispatchEvent(new CustomEvent('dismiss', { bubbles: true, composed: true }));
  }

  private handleRetry() {
    this.dispatchEvent(new CustomEvent('retry', { bubbles: true, composed: true }));
  }

  // ─── Render ──────────────────────────────────────────────
  render() {
    if (!this.visible || !this.message) return nothing;

    const config = this.variantConfig;

    return html`
      <div
        class="p-4 rounded-lg ${config.bg} border ${config.border} flex items-start gap-3"
        role="alert"
      >
        <ui-icon
          name="${config.icon}"
          size="sm"
          class="${config.iconColor} flex-shrink-0 mt-0.5"
        ></ui-icon>
        <div class="flex-1 min-w-0">
          ${this.title
            ? html` <h4 class="text-sm font-semibold ${config.titleColor} mb-1">${this.title}</h4> `
            : nothing}
          <p class="text-sm ${config.textColor}">${this.message}</p>
          ${this.showRetry
            ? html`
                <button
                  type="button"
                  class="mt-2 text-sm font-medium ${config.iconColor} hover:underline"
                  @click=${this.handleRetry}
                >
                  Riprova
                </button>
              `
            : nothing}
        </div>
        ${this.dismissible
          ? html`
              <button
                type="button"
                class="flex-shrink-0 p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors ${config.iconColor}"
                @click=${this.handleDismiss}
                aria-label="Chiudi"
              >
                <ui-icon name="x" size="sm"></ui-icon>
              </button>
            `
          : nothing}
      </div>
    `;
  }
}
