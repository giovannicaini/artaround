import { LitElement, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import './ui-icon';
import { __ } from '../../services/i18n.service';

/**
 * UI Empty State
 *
 * A consistent empty state with icon, title, description, and optional action.
 *
 * @slot action - Slot for action button
 *
 * @example
 * ```html
 * <ui-empty
 *   icon="document"
 *   .title=${__('Nessun contenuto')}
 *   .description=${__('Non ci sono ancora contenuti')}
 * >
 *   <ui-button slot="action" variant="primary" icon="plus" .label=${__('Crea il primo')}></ui-button>
 * </ui-empty>
 * ```
 */
@customElement('ui-empty')
export class UiEmpty extends LitElement {
  @property({ type: String }) icon = 'folder';
  @property({ type: String }) title = '';
  @property({ type: String }) description = '';

  @state() private actionContent: Element[] = [];
  private actionInitialized = false;

  // ─── Lifecycle ───────────────────────────────────────────
  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    requestAnimationFrame(() => {
      if (!this.actionInitialized) {
        this.captureSlotContent();
        this.actionInitialized = true;
      }
    });
  }

  // ─── Helpers ──────────────────────────────────────────────
  private captureSlotContent() {
    const actionSlotted = Array.from(this.querySelectorAll('[slot="action"]')) as Element[];
    this.actionContent = actionSlotted.map((el) => {
      el.removeAttribute('slot');
      return el; // Keep original element, not clone - preserves event listeners
    });
  }

  protected updated() {
    const actionContainer = this.querySelector('.empty-action-container');
    if (actionContainer && this.actionContent.length > 0) {
      // Move elements (not clone) to preserve event listeners
      this.actionContent.forEach((node) => {
        if (node.parentElement !== actionContainer) {
          actionContainer.appendChild(node);
        }
      });
    }
  }

  // ─── Render ──────────────────────────────────────────────
  render() {
    return html`
      <div class="text-center py-12">
        <div
          class="w-16 h-16 mx-auto mb-4 rounded-full bg-surface-100 dark:bg-surface-800 flex items-center justify-center"
        >
          <ui-icon name="${this.icon}" size="lg" class="text-surface-400"></ui-icon>
        </div>
        ${this.title
          ? html`
              <h3 class="text-lg font-semibold text-surface-900 dark:text-white mb-1">
                ${this.title}
              </h3>
            `
          : nothing}
        ${this.description
          ? html`
              <p class="text-sm text-surface-500 dark:text-surface-400 mb-4">${this.description}</p>
            `
          : nothing}
        <div class="empty-action-container"></div>
      </div>
    `;
  }
}
