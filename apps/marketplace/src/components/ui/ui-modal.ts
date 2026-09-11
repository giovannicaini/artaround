import { LitElement, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import './ui-button';
import './ui-icon';
import { __ } from '../../services/i18n.service';

@customElement('ui-modal')
export class UiModal extends LitElement {
  @property({ type: Boolean }) open = false;
  @property({ type: String }) title = '';
  @property({ type: String }) message = '';
  @property({ type: String }) variant: 'default' | 'danger' | 'success' | 'info' = 'default';
  // Nome attributo esplicito: il default di Lit per una proprietà camelCase
  // è tutto minuscolo senza trattino (es. "confirmlabel"), ma modalService.ts
  // scrive gli attributi in kebab-case ("confirm-label") — senza specificarlo
  // qui il binding non avviene mai e il modale mostra sempre l'etichetta di
  // default, qualunque valore passi il chiamante.
  @property({ type: String, attribute: 'confirm-label' }) confirmLabel = '';
  @property({ type: String, attribute: 'cancel-label' }) cancelLabel = '';
  @property({ type: Boolean }) loading = false;
  @property({ type: Boolean, attribute: 'hide-cancel' }) hideCancel = false;

  // ─── Ciclo di vita ───────────────────────────────────────────
  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.style.display = 'block';
    document.addEventListener('keydown', this.handleKeydown.bind(this));
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('keydown', this.handleKeydown.bind(this));
  }

  // ─── Azioni ──────────────────────────────────────────────
  private handleConfirm() {
    this.dispatchEvent(
      new CustomEvent('confirm', {
        bubbles: true,
        composed: true,
      }),
    );
  }

  private handleCancel() {
    this.dispatchEvent(
      new CustomEvent('cancel', {
        bubbles: true,
        composed: true,
      }),
    );
  }

  private handleBackdropClick(e: Event) {
    if (e.target === e.currentTarget) {
      this.handleCancel();
    }
  }

  private handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      this.handleCancel();
    }
  }

  // ─── Render ──────────────────────────────────────────────
  render() {
    if (!this.open) return null;
    const resolvedConfirmLabel = this.confirmLabel || __('Conferma');
    const resolvedCancelLabel = this.cancelLabel || __('Annulla');

    const iconMap = {
      danger: 'warning',
      success: 'check-circle',
      info: 'info',
      default: 'info',
    };
    const colorMap = {
      danger: 'text-danger-500',
      success: 'text-success-500',
      info: 'text-brand-500',
      default: 'text-brand-500',
    };
    const bgMap = {
      danger: 'bg-danger-100 dark:bg-danger-900/30',
      success: 'bg-success-100 dark:bg-success-900/30',
      info: 'bg-brand-100 dark:bg-brand-900/30',
      default: 'bg-brand-100 dark:bg-brand-900/30',
    };
    const iconName = iconMap[this.variant];
    const iconColor = colorMap[this.variant];
    const iconBg = bgMap[this.variant];

    return html`
      <div
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn"
        @click=${this.handleBackdropClick}
      >
        <div
          class="bg-white dark:bg-surface-900 rounded-xl shadow-2xl w-full max-w-md transform transition-all animate-scaleIn"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
        >
          <!-- Header -->
          <div class="flex items-start gap-4 p-6 pb-0">
            <div
              class="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${iconBg}"
            >
              <ui-icon name="${iconName}" size="sm" class="${iconColor}"></ui-icon>
            </div>
            <div class="flex-1">
              <h3 id="modal-title" class="text-lg font-semibold text-surface-900 dark:text-white">
                ${this.title}
              </h3>
              <div class="mt-2 text-sm text-surface-600 dark:text-surface-400">${this.message}</div>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex items-center justify-end gap-3 p-6 pt-6">
            ${!this.hideCancel
              ? html`
                  <ui-button
                    variant="secondary"
                    .label=${resolvedCancelLabel}
                    ?disabled=${this.loading}
                    @click=${this.handleCancel}
                  ></ui-button>
                `
              : nothing}
            <ui-button
              variant="${this.variant === 'danger' ? 'danger' : 'primary'}"
              .label=${resolvedConfirmLabel}
              ?loading=${this.loading}
              @click=${this.handleConfirm}
            ></ui-button>
          </div>
        </div>
      </div>

      <style>
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.15s ease-out;
        }
        .animate-scaleIn {
          animation: scaleIn 0.15s ease-out;
        }
      </style>
    `;
  }
}
