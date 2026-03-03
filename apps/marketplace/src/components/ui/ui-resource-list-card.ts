import { LitElement, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import './ui-card';
import './ui-badge';
import { __ } from '../../services/i18n.service';

@customElement('ui-resource-list-card')
export class UiResourceListCard extends LitElement {
  @property({ type: String }) title = '';
  @property({ type: String }) emptyText = '';
  @property({ type: Number }) count = 0;
  @property({ type: String }) badgeVariant: 'secondary' | 'success' | 'warning' | 'danger' =
    'secondary';
  @property({ attribute: false }) renderItems: (() => unknown) | null = null;
  @property({ attribute: false }) renderActions: (() => unknown) | null = null;

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
    const resolvedEmptyText = this.emptyText || __('Nessun elemento');

    return html`
      <ui-card padding="none">
        <div
          class="px-5 py-4 border-b border-surface-200 dark:border-surface-800 flex items-center justify-between gap-3"
        >
          <h3 class="font-semibold text-surface-900 dark:text-white">${this.title}</h3>
          <div class="flex items-center gap-2">
            ${this.renderActions ? this.renderActions() : nothing}
            <ui-badge
              .variant=${this.badgeVariant}
              size="sm"
              .label=${String(this.count)}
            ></ui-badge>
          </div>
        </div>

        <div class="divide-y divide-surface-200 dark:divide-surface-800">
          ${this.count === 0
            ? html`<p class="px-5 py-4 text-sm text-surface-500">${resolvedEmptyText}</p>`
            : this.renderItems
              ? this.renderItems()
              : nothing}
        </div>
      </ui-card>
    `;
  }
}
