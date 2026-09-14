import { LitElement, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import './ui-info-tip';

/**
 * Titolo di sezione con descrizione e tooltip di aiuto opzionali.
 */
@customElement('ui-section-header')
export class UiSectionHeader extends LitElement {
  @property({ type: String }) title = '';
  @property({ type: String }) description = '';
  @property({ type: String }) help = '';

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
      <div>
        <h2
          class="flex items-center gap-1.5 flex-wrap text-base font-semibold text-surface-900 dark:text-white"
        >
          ${this.title}
          ${this.help
            ? html`<ui-info-tip variant="inline" text=${this.help}></ui-info-tip>`
            : nothing}
        </h2>
        ${this.description
          ? html`
              <p class="text-sm text-surface-500 dark:text-surface-400">${this.description}</p>
            `
          : nothing}
      </div>
    `;
  }
}
