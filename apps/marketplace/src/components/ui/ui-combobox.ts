import { LitElement, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import './ui-icon';
import { __ } from '../../services/i18n.service';

export interface ComboboxOption {
  value: string;
  label: string;
}

@customElement('ui-combobox')
export class UiCombobox extends LitElement {
  @property({ type: String }) label = '';
  @property({ type: String }) value = '';
  @property({ type: String }) placeholder = '';
  @property({ type: String }) hint = '';
  @property({ type: String }) error = '';
  @property({ type: Boolean }) disabled = false;
  @property({ type: Boolean }) loading = false;
  @property({ type: Array }) options: ComboboxOption[] = [];

  @state() private search = '';
  @state() private open = false;
  @state() private focusedIndex = -1;

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.style.display = 'block';
    this._onOutsideClick = this._onOutsideClick.bind(this);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('click', this._onOutsideClick);
  }

  private _onOutsideClick(e: MouseEvent) {
    if (!this.contains(e.target as Node)) {
      this.closeDropdown();
    }
  }

  private get selectedLabel(): string {
    return this.options.find((o) => o.value === this.value)?.label ?? '';
  }

  private get filtered(): ComboboxOption[] {
    const q = this.search.toLowerCase();
    if (!q) return this.options;
    return this.options.filter((o) => o.label.toLowerCase().includes(q));
  }

  private openDropdown() {
    if (this.disabled) return;
    this.open = true;
    this.search = '';
    this.focusedIndex = -1;
    document.addEventListener('click', this._onOutsideClick);
  }

  private closeDropdown() {
    this.open = false;
    this.search = '';
    document.removeEventListener('click', this._onOutsideClick);
  }

  private select(option: ComboboxOption) {
    this.value = option.value;
    this.dispatchEvent(
      new CustomEvent('combobox-change', {
        detail: { value: option.value, label: option.label },
        bubbles: true,
        composed: true,
      }),
    );
    this.closeDropdown();
  }

  private clear(e: Event) {
    e.stopPropagation();
    this.value = '';
    this.dispatchEvent(
      new CustomEvent('combobox-change', {
        detail: { value: '', label: '' },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private handleKeydown(e: KeyboardEvent) {
    const items = this.filtered;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.focusedIndex = Math.min(this.focusedIndex + 1, items.length - 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.focusedIndex = Math.max(this.focusedIndex - 1, 0);
    } else if (e.key === 'Enter' && this.focusedIndex >= 0) {
      e.preventDefault();
      this.select(items[this.focusedIndex]);
    } else if (e.key === 'Escape') {
      this.closeDropdown();
    }
  }

  render() {
    const items = this.filtered;
    const resolvedPlaceholder = this.placeholder || __('Cerca o seleziona...');
    const inputClasses = `
      w-full px-3 py-2.5 text-sm rounded-lg border transition-colors duration-150
      bg-white dark:bg-surface-900
      text-surface-900 dark:text-white
      focus:outline-none focus:ring-2 focus:ring-offset-0
      disabled:bg-surface-50 disabled:text-surface-500 disabled:cursor-not-allowed
      dark:disabled:bg-surface-800
      ${
        this.error
          ? 'border-danger-500 focus:border-danger-500 focus:ring-danger-500/20'
          : 'border-surface-300 dark:border-surface-600 focus:border-brand-500 focus:ring-brand-500/20'
      }
    `;

    return html`
      <div class="space-y-1.5 relative">
        ${this.label
          ? html`<label class="block text-sm font-medium text-surface-700 dark:text-surface-300">
              ${this.label}
            </label>`
          : nothing}

        <!-- Trigger / search input -->
        <div class="relative">
          ${this.open
            ? html`
                <input
                  type="text"
                  class="${inputClasses} pr-8"
                  placeholder=${__('Cerca...')}
                  .value=${this.search}
                  @input=${(e: InputEvent) => {
                    this.search = (e.target as HTMLInputElement).value;
                    this.focusedIndex = -1;
                  }}
                  @keydown=${this.handleKeydown}
                  autofocus
                />
              `
            : html`
                <button
                  type="button"
                  class="${inputClasses} flex items-center justify-between w-full text-left ${this
                    .disabled
                    ? 'cursor-not-allowed opacity-60'
                    : 'cursor-pointer'}"
                  @click=${this.openDropdown}
                  ?disabled=${this.disabled}
                >
                  <span class="${this.value ? '' : 'text-surface-400 dark:text-surface-500'}">
                    ${this.value ? this.selectedLabel : resolvedPlaceholder}
                  </span>
                </button>
              `}

          <!-- Clear / chevron -->
          <div class="absolute inset-y-0 right-2 flex items-center gap-1 pointer-events-none">
            ${this.value && !this.open
              ? html`
                  <button
                    type="button"
                    class="pointer-events-auto text-surface-400 hover:text-surface-600 dark:hover:text-surface-300"
                    @click=${this.clear}
                    .title=${__('Rimuovi selezione')}
                  >
                    <ui-icon name="x" size="xs"></ui-icon>
                  </button>
                `
              : html`<ui-icon
                  name="${this.open ? 'chevron-up' : 'chevron-down'}"
                  size="xs"
                  class="text-surface-400"
                ></ui-icon>`}
          </div>
        </div>

        <!-- Dropdown -->
        ${this.open
          ? html`
              <div
                class="absolute z-50 w-full mt-1 bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg shadow-lg overflow-hidden"
              >
                ${this.loading
                  ? html`<p
                      class="px-3 py-4 text-sm text-surface-400 text-center flex items-center justify-center gap-2"
                    >
                      <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
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
                      ${__('Caricamento...')}
                    </p>`
                  : items.length === 0
                    ? html`<p class="px-3 py-4 text-sm text-surface-400 text-center">
                        ${__('Nessun risultato')}
                      </p>`
                    : html`
                        <ul
                          class="max-h-52 overflow-y-auto divide-y divide-surface-100 dark:divide-surface-800"
                        >
                          ${items.map(
                            (opt, i) => html`
                              <li
                                class="px-3 py-2.5 text-sm cursor-pointer transition-colors
                                  ${opt.value === this.value
                                  ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300 font-medium'
                                  : 'text-surface-900 dark:text-white'}
                                  ${i === this.focusedIndex
                                  ? 'bg-surface-100 dark:bg-surface-800'
                                  : 'hover:bg-surface-50 dark:hover:bg-surface-800/60'}"
                                @click=${() => this.select(opt)}
                              >
                                ${opt.label}
                              </li>
                            `,
                          )}
                        </ul>
                      `}
              </div>
            `
          : nothing}
        ${this.hint && !this.error
          ? html`<p class="text-xs text-surface-500">${this.hint}</p>`
          : nothing}
        ${this.error ? html`<p class="text-xs text-danger-600">${this.error}</p>` : nothing}
      </div>
    `;
  }
}
