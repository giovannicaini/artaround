import { LitElement, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import './ui-icon';

export interface TabItem {
  id: string;
  label: string;
  icon?: string;
  badge?: string | number;
}

/**
 * UI Tabs
 *
 * A consistent tabbed navigation component.
 *
 * @fires tab-change - Emits the selected tab id
 *
 * @example
 * ```html
 * <ui-tabs
 *   .tabs=${[
 *     { id: 'info', label: 'Informazioni', icon: 'document' },
 *     { id: 'steps', label: 'Percorso', icon: 'list', badge: 5 }
 *   ]}
 *   .activeTab=${'info'}
 *   @tab-change=${(e) => this.activeTab = e.detail.id}
 * ></ui-tabs>
 * ```
 */
@customElement('ui-tabs')
export class UiTabs extends LitElement {
  @property({ type: Array }) tabs: TabItem[] = [];
  @property({ type: String }) activeTab = '';
  @property({ type: String }) variant: 'underline' | 'pills' = 'underline';

  // ─── Ciclo di vita ───────────────────────────────────────────
  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.style.display = 'block';
    // Come per ui-filter-tabs: senza min-width:0 questo elemento non si
    // restringe mai sotto la larghezza naturale del suo contenuto, quindi
    // con abbastanza tab (es. le 5 dell'editor visite) la riga usciva dalla
    // pagina invece di diventare scorribile su schermi stretti.
    this.style.minWidth = '0';
  }

  // ─── Azioni ──────────────────────────────────────────────
  private handleTabClick(tabId: string) {
    if (tabId === this.activeTab) return;
    this.dispatchEvent(
      new CustomEvent('tab-change', {
        detail: { id: tabId },
        bubbles: true,
        composed: true,
      }),
    );
  }

  // ─── Render ──────────────────────────────────────────────
  render() {
    if (this.variant === 'pills') {
      return this.renderPills();
    }
    return this.renderUnderline();
  }

  // ─── Helper di render ──────────────────────────────────────
  private renderUnderline() {
    return html`
      <div class="border-b border-surface-200 dark:border-surface-700 overflow-x-auto">
        <nav class="flex gap-4" role="tablist">
          ${this.tabs.map((tab) => {
            const isActive = this.activeTab === tab.id;
            return html`
              <button
                type="button"
                role="tab"
                aria-selected="${isActive}"
                @click=${() => this.handleTabClick(tab.id)}
                class="flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors flex-shrink-0 whitespace-nowrap ${isActive
                  ? 'border-brand-600 text-brand-600 dark:text-brand-400'
                  : 'border-transparent text-surface-500 hover:text-surface-700 dark:hover:text-surface-300'}"
              >
                ${tab.icon ? html`<ui-icon name="${tab.icon}" size="sm"></ui-icon>` : nothing}
                ${tab.label}
                ${tab.badge !== undefined
                  ? html`
                      <span
                        class="ml-1 px-1.5 py-0.5 text-xs rounded-full ${isActive
                          ? 'bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300'
                          : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400'}"
                      >
                        ${tab.badge}
                      </span>
                    `
                  : nothing}
              </button>
            `;
          })}
        </nav>
      </div>
    `;
  }

  private renderPills() {
    return html`
      <div class="overflow-x-auto">
        <div
          class="inline-flex gap-1 p-1 bg-surface-100 dark:bg-surface-800 rounded-lg"
          role="tablist"
        >
          ${this.tabs.map((tab) => {
            const isActive = this.activeTab === tab.id;
            return html`
              <button
                type="button"
                role="tab"
                aria-selected="${isActive}"
                @click=${() => this.handleTabClick(tab.id)}
                class="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors flex-shrink-0 whitespace-nowrap ${isActive
                  ? 'bg-white dark:bg-surface-700 text-surface-900 dark:text-white shadow-sm'
                  : 'text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-white'}"
              >
                ${tab.icon ? html`<ui-icon name="${tab.icon}" size="sm"></ui-icon>` : nothing}
                ${tab.label}
                ${tab.badge !== undefined
                  ? html`
                      <span
                        class="px-1.5 py-0.5 text-xs rounded-full ${isActive
                          ? 'bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300'
                          : 'bg-surface-200 dark:bg-surface-700 text-surface-600 dark:text-surface-400'}"
                      >
                        ${tab.badge}
                      </span>
                    `
                  : nothing}
              </button>
            `;
          })}
        </div>
      </div>
    `;
  }
}
