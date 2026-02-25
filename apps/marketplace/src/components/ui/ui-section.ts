import { LitElement, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import './ui-icon';

/**
 * UI Section
 *
 * A form/page section with title and optional icon.
 * Used for grouping related content with a consistent header style.
 *
 * @example
 * ```html
 * <ui-section
 *   title="Informazioni base"
 *   icon="document"
 *   .renderContent=${() => html`<ui-card>...</ui-card>`}
 * ></ui-section>
 * ```
 */
@customElement('ui-section')
export class UiSection extends LitElement {
  @property({ type: String }) title = '';
  @property({ type: String }) icon = '';
  @property({ type: String }) description = '';
  @property({ attribute: false }) renderContent: (() => unknown) | null = null;

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
    const hasHeader = this.title || this.description;

    return html`
      <section class="space-y-3">
        ${hasHeader
          ? html`
              <header class="flex items-start gap-3">
                ${this.icon
                  ? html`
                      <div
                        class="p-2 rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400"
                      >
                        <ui-icon name=${this.icon} size="sm"></ui-icon>
                      </div>
                    `
                  : nothing}
                <div>
                  ${this.title
                    ? html`
                        <h3 class="text-base font-semibold text-surface-900 dark:text-white">
                          ${this.title}
                        </h3>
                      `
                    : nothing}
                  ${this.description
                    ? html`
                        <p class="text-sm text-surface-500 dark:text-surface-400 mt-0.5">
                          ${this.description}
                        </p>
                      `
                    : nothing}
                </div>
              </header>
            `
          : nothing}

        <div
          class="rounded-xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 p-5 shadow-soft"
        >
          ${this.renderContent ? this.renderContent() : nothing}
        </div>
      </section>
    `;
  }
}
