import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import './ui-card';
import './ui-icon';

@customElement('ui-stat-card')
export class UiStatCard extends LitElement {
  @property({ type: String }) label = '';
  @property({ type: Number }) value = 0;
  @property({ type: String }) icon = 'chart';

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
      <ui-card padding="md">
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="text-sm font-medium text-surface-500 dark:text-surface-400">${this.label}</p>
            <p class="text-2xl font-semibold text-surface-900 dark:text-white mt-1">
              ${this.value}
            </p>
          </div>
          <div class="p-2 rounded-lg bg-brand-50 dark:bg-brand-900/30">
            <ui-icon
              name=${this.icon}
              size="sm"
              class="text-brand-600 dark:text-brand-400"
            ></ui-icon>
          </div>
        </div>
      </ui-card>
    `;
  }
}
