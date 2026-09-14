import { LitElement, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import './ui-icon';

/**
 * Stato vuoto a piena pagina con icona, titolo/descrizione e azione opzionale.
 */
@customElement('ui-empty')
export class UiEmpty extends LitElement {
  @property({ type: String }) icon = 'folder';
  @property({ type: String }) title = '';
  @property({ type: String }) description = '';

  @state() private actionContent: Element[] = [];
  private actionInitialized = false;

  // ─── Ciclo di vita ───────────────────────────────────────────
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

  // ─── Helper ──────────────────────────────────────────────
  private captureSlotContent() {
    const actionSlotted = Array.from(this.querySelectorAll('[slot="action"]')) as Element[];
    this.actionContent = actionSlotted.map((el) => {
      el.removeAttribute('slot');
      return el; // Tiene l'elemento originale, non un clone - preserva gli event listener
    });
  }

  protected updated() {
    const actionContainer = this.querySelector('.empty-action-container');
    if (actionContainer && this.actionContent.length > 0) {
      // Sposta gli elementi (non clona) per preservare gli event listener
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
