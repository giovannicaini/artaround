import { LitElement, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import './ui-card';
import './ui-icon-button';

@customElement('ui-list-controls')
export class UiListControls extends LitElement {
  @property({ type: String }) title = 'Opzioni elenco';
  @property({ type: String }) description = '';
  @property({ type: Boolean }) collapsed = true;
  @property({ attribute: false }) renderSummary: (() => unknown) | null = null;
  @property({ attribute: false }) renderContent: (() => unknown) | null = null;

  // ─── Ciclo di vita ───────────────────────────────────────────
  createRenderRoot() {
    return this;
  }

  // ─── Azioni ──────────────────────────────────────────────
  private toggle() {
    this.collapsed = !this.collapsed;
    this.dispatchEvent(
      new CustomEvent('collapsed-change', {
        detail: { collapsed: this.collapsed },
        bubbles: true,
        composed: true,
      }),
    );
  }

  // ─── Render ──────────────────────────────────────────────
  render() {
    return html`
      <ui-card padding="none">
        <div class="flex items-center justify-between gap-3 p-4">
          <div class="min-w-0">
            <h3 class="text-sm font-semibold text-surface-900 dark:text-white">${this.title}</h3>
            ${this.description
              ? html`
                  <p class="text-xs text-surface-500 dark:text-surface-400 mt-0.5">
                    ${this.description}
                  </p>
                `
              : nothing}
          </div>

          <div class="flex items-center gap-2">
            ${this.renderSummary ? this.renderSummary() : nothing}
            <ui-icon-button
              icon=${this.collapsed ? 'chevron-down' : 'chevron-up'}
              title=${this.collapsed ? 'Espandi controlli' : 'Comprimi controlli'}
              @click=${this.toggle}
            ></ui-icon-button>
          </div>
        </div>

        ${this.collapsed
          ? nothing
          : html`
              <div
                class="border-t border-surface-200 dark:border-surface-800 px-4 pb-4 pt-3 space-y-4"
              >
                ${this.renderContent ? this.renderContent() : nothing}
              </div>
            `}
      </ui-card>
    `;
  }
}
