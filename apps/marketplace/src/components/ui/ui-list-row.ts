import { LitElement, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';

/**
 * Riga di lista con icona/avatar, titolo/sottotitolo e azioni a destra.
 */
@customElement('ui-list-row')
export class UiListRow extends LitElement {
  @property({ type: String }) title = '';
  @property({ type: String }) subtitle = '';
  @property({ type: Boolean }) disabled = false;
  @property({ attribute: false }) renderTrailing: (() => unknown) | null = null;

  // ─── Ciclo di vita ───────────────────────────────────────────
  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.style.display = 'block';
  }

  // ─── Render ──────────────────────────────────────────────
  render() {
    return html`
      <button
        type="button"
        class="w-full px-5 py-4 flex items-center justify-between gap-3 text-left transition-colors hover:bg-surface-50 dark:hover:bg-surface-800/50 disabled:opacity-60 disabled:pointer-events-none"
        ?disabled=${this.disabled}
      >
        <div class="min-w-0 flex-1">
          <p class="text-sm font-medium text-surface-900 dark:text-white truncate">${this.title}</p>
          ${this.subtitle
            ? html`<p class="text-xs text-surface-500 truncate mt-0.5">${this.subtitle}</p>`
            : nothing}
        </div>
        <div class="flex items-center gap-2">
          ${this.renderTrailing ? this.renderTrailing() : nothing}
        </div>
      </button>
    `;
  }
}
