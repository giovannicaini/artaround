import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';

export interface FilterTab {
  value: string;
  label: string;
}

@customElement('ui-filter-tabs')
export class UiFilterTabs extends LitElement {
  @property({ type: Array }) tabs: FilterTab[] = [];
  @property({ type: String }) value = '';
  @property({ type: String }) size: 'sm' | 'md' = 'md';

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.style.display = 'block';
    // dentro un flex container un block non si restringe sotto min-width:auto
    this.style.minWidth = '0';
  }

  private handleClick(tabValue: string) {
    if (tabValue === this.value) return;
    this.dispatchEvent(
      new CustomEvent('filter-change', {
        detail: { value: tabValue },
        bubbles: true,
        composed: true,
      }),
    );
  }

  render() {
    const sizeClasses = {
      sm: 'px-2 py-1 text-xs',
      md: 'px-3 py-2 text-sm',
    };
    const paddingClass = sizeClasses[this.size];

    // overflow-x-auto sul contenitore esterno, non sull'inline-flex, per scorrere con molte tab
    return html`
      <div class="overflow-x-auto">
        <div
          class="inline-flex rounded-lg overflow-hidden border border-surface-200 dark:border-surface-700"
        >
          ${this.tabs.map(
            (tab, index) => html`
              <button
                type="button"
                @click=${() => this.handleClick(tab.value)}
                class="${paddingClass} font-medium transition-colors flex-shrink-0 whitespace-nowrap ${index >
                0
                  ? 'border-l border-surface-200 dark:border-surface-700'
                  : ''} ${tab.value === this.value
                  ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300'
                  : 'bg-white dark:bg-surface-800 text-surface-600 hover:bg-surface-50 dark:text-surface-400 dark:hover:bg-surface-700'}"
              >
                ${tab.label}
              </button>
            `,
          )}
        </div>
      </div>
    `;
  }
}
