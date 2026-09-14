import { LitElement, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import './ui-icon';
import './ui-card';
import './ui-info-tip';

/**
 * Sezione di form con titolo, icona e contenuto dentro una card.
 */
@customElement('ui-panel-section')
export class UiPanelSection extends LitElement {
  @property({ type: String }) title = '';
  @property({ type: String }) icon = '';
  @property({ type: String }) iconColor = 'text-brand-500';
  @property({ type: String }) cardPadding: 'none' | 'sm' | 'md' | 'lg' = 'md';
  @property({ type: String }) description = '';
  @property({ type: String }) help = '';
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
          class="text-lg font-semibold text-surface-900 dark:text-white mb-4 flex items-center gap-2 flex-wrap"
        >
          ${this.icon
            ? html`<ui-icon name=${this.icon} size="sm" class=${this.iconColor}></ui-icon>`
            : nothing}
          ${this.title}
          ${this.help
            ? html`<ui-info-tip variant="inline" text=${this.help}></ui-info-tip>`
            : nothing}
        </h3>
        <ui-card padding=${this.cardPadding}>
          ${this.description
            ? html`<p class="text-sm text-surface-500 mb-4">${this.description}</p>`
            : nothing}
          ${this.renderContent ? this.renderContent() : nothing}
        </ui-card>
      </section>
    `;
  }
}
