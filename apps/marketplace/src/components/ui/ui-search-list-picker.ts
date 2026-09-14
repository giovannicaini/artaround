import { LitElement, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import './ui-info-tip';
import { __ } from '../../services/i18n.service';

export interface SearchListPickerOption {
  value: string;
  label: string;
}

/**
 * Selettore con ricerca per scegliere una o più entità da una lista.
 */
@customElement('ui-search-list-picker')
export class UiSearchListPicker extends LitElement {
  @property({ type: String }) label = '';
  @property({ type: String }) help = '';
  @property({ type: String }) value = '';
  @property({ type: String }) placeholder = '';
  @property({ type: Boolean }) loading = false;
  @property({ type: String }) loadingText = '';
  @property({ type: String }) emptyText = '';
  @property({ type: String }) noResultsText = '';
  @property({ type: Boolean }) showSelectedHint = true;
  @property({ type: Array }) options: SearchListPickerOption[] = [];

  @state() private query = '';

  // ─── Ciclo di vita ───────────────────────────────────────────
  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.style.display = 'block';
  }

  // ─── Azioni ──────────────────────────────────────────────
  private handleSelect(value: string) {
    this.value = value;
    this.dispatchEvent(
      new CustomEvent('value-change', {
        detail: { value },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private get filteredOptions(): SearchListPickerOption[] {
    const q = this.query.trim().toLowerCase();
    if (!q) return this.options;
    return this.options.filter((option) => option.label.toLowerCase().includes(q));
  }

  private get selectedLabel(): string {
    return this.options.find((option) => option.value === this.value)?.label ?? this.value;
  }

  // ─── Render ──────────────────────────────────────────────
  render() {
    const filtered = this.filteredOptions;
    const resolvedPlaceholder = this.placeholder || __('Cerca...');
    const resolvedLoadingText = this.loadingText || __('Caricamento...');
    const resolvedEmptyText = this.emptyText || __('Nessun elemento disponibile');
    const resolvedNoResultsText = this.noResultsText || __('Nessun risultato');

    return html`
      <div class="space-y-1.5">
        ${this.label
          ? html`<label
              class="flex items-center gap-1.5 text-sm font-medium text-surface-700 dark:text-surface-300"
            >
              ${this.label}
              ${this.help ? html`<ui-info-tip text=${this.help}></ui-info-tip>` : nothing}
            </label>`
          : nothing}
        ${this.loading
          ? html`<div
              class="flex items-center gap-2 px-3 py-2.5 text-sm text-surface-400 border border-surface-200 dark:border-surface-700 rounded-lg"
            >
              <svg class="w-4 h-4 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
                <circle
                  class="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  stroke-width="4"
                ></circle>
                <path
                  class="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                ></path>
              </svg>
              ${resolvedLoadingText}
            </div>`
          : html`
              <input
                type="text"
                .value=${this.query}
                placeholder=${resolvedPlaceholder}
                class="block w-full px-3 py-2 text-sm rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-900 text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                @input=${(e: InputEvent) => {
                  this.query = (e.target as HTMLInputElement).value;
                }}
              />

              <div
                class="mt-1 max-h-44 overflow-y-auto border border-surface-200 dark:border-surface-700 rounded-lg divide-y divide-surface-100 dark:divide-surface-800"
              >
                ${filtered.length === 0
                  ? html`<p class="px-3 py-3 text-sm text-surface-400 text-center">
                      ${this.options.length === 0 ? resolvedEmptyText : resolvedNoResultsText}
                    </p>`
                  : filtered.map(
                      (option) => html`
                        <div
                          class="px-3 py-2 text-sm cursor-pointer transition-colors ${option.value ===
                          this.value
                            ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300 font-medium'
                            : 'text-surface-900 dark:text-white hover:bg-surface-50 dark:hover:bg-surface-800/60'}"
                          @click=${() => this.handleSelect(option.value)}
                        >
                          ${option.label}
                        </div>
                      `,
                    )}
              </div>

              ${this.showSelectedHint && this.value
                ? html`<p class="text-xs text-brand-600 dark:text-brand-400 mt-1">
                    ✓ ${this.selectedLabel}
                  </p>`
                : nothing}
            `}
      </div>
    `;
  }
}
