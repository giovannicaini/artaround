import { LitElement, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import './ui-icon';
import './ui-card';

@customElement('ui-panel-section')
export class UiPanelSection extends LitElement {
  @property({ type: String }) title = '';
  @property({ type: String }) icon = '';
  @property({ type: String }) description = '';
  @property({ attribute: false }) renderContent: (() => unknown) | null = null;

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
      <section>
        <h3
          class="text-lg font-semibold text-surface-900 dark:text-white mb-4 flex items-center gap-2"
        >
          ${this.icon
            ? html`<ui-icon name=${this.icon} size="sm" class="text-brand-500"></ui-icon>`
            : nothing}
          ${this.title}
        </h3>
        <ui-card>
          ${this.description
            ? html`<p class="text-sm text-surface-500 mb-4">${this.description}</p>`
            : nothing}
          ${this.renderContent ? this.renderContent() : nothing}
        </ui-card>
      </section>
    `;
  }
}
