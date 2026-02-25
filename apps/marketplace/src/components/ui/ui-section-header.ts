import { LitElement, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('ui-section-header')
export class UiSectionHeader extends LitElement {
  @property({ type: String }) title = '';
  @property({ type: String }) description = '';

  // ─── Lifecycle ───────────────────────────────────────────
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
        <h2 class="text-base font-semibold text-surface-900 dark:text-white">${this.title}</h2>
        ${this.description
          ? html`
              <p class="text-sm text-surface-500 dark:text-surface-400">${this.description}</p>
            `
          : nothing}
      </div>
    `;
  }
}
