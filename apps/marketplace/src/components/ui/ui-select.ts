import { LitElement, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import './ui-icon';
import { __ } from '../../services/i18n.service';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

@customElement('ui-select')
export class UiSelect extends LitElement {
  @property({ type: String }) label = '';
  @property({ type: String }) value = '';
  @property({ type: String }) placeholder = '';
  @property({ type: String }) error = '';
  @property({ type: String }) hint = '';
  @property({ type: Boolean }) required = false;
  @property({ type: Boolean }) disabled = false;
  @property({ type: Boolean }) clearable = false;
  @property({ type: Boolean }) emojiFont = false;
  @property({ type: Array }) options: SelectOption[] = [];

  // ─── Lifecycle ───────────────────────────────────────────
  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.style.display = 'block';
  }

  // ─── Actions ──────────────────────────────────────────────
  private handleChange(e: Event) {
    const target = e.target as HTMLSelectElement;
    this.value = target.value;
    this.dispatchEvent(
      new CustomEvent('select-change', {
        detail: { value: this.value },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private clearValue(e: Event) {
    e.preventDefault();
    e.stopPropagation();
    if (this.disabled || this.required) return;

    this.value = '';
    this.dispatchEvent(
      new CustomEvent('select-change', {
        detail: { value: this.value },
        bubbles: true,
        composed: true,
      }),
    );
  }

  // ─── Render ──────────────────────────────────────────────
  render() {
    const resolvedPlaceholder = this.placeholder || __('Seleziona...');

    const selectClasses = `
      block w-full px-3 py-2.5 text-sm rounded-lg border transition-colors duration-150
      bg-white dark:bg-surface-900
      text-surface-900 dark:text-white
      focus:outline-none focus:ring-2 focus:ring-offset-0
      disabled:bg-surface-50 disabled:text-surface-500 disabled:cursor-not-allowed
      dark:disabled:bg-surface-800
      appearance-none cursor-pointer
      ${
        this.error
          ? 'border-danger-500 focus:border-danger-500 focus:ring-danger-500/20'
          : 'border-surface-300 dark:border-surface-600 focus:border-brand-500 focus:ring-brand-500/20'
      }
    `;

    return html`
      <div class="space-y-1.5">
        ${this.label
          ? html`
              <label class="block text-sm font-medium text-surface-700 dark:text-surface-300">
                ${this.label}
                ${this.required ? html`<span class="text-danger-500 ml-0.5">*</span>` : nothing}
              </label>
            `
          : nothing}

        <div class="relative">
          <select
            class="${selectClasses}"
            .value="${this.value}"
            ?required="${this.required}"
            ?disabled="${this.disabled}"
            style=${this.emojiFont
              ? 'font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, Noto Color Emoji, Apple Color Emoji, Segoe UI Emoji, sans-serif;'
              : ''}
            aria-invalid="${this.error ? 'true' : 'false'}"
            @change="${this.handleChange}"
          >
            ${this.placeholder
              ? html`
                  <option value="" ?disabled=${this.required} ?selected=${!this.value}>
                    ${resolvedPlaceholder}
                  </option>
                `
              : nothing}
            ${this.options.map(
              (opt) => html`
                <option
                  value="${opt.value}"
                  ?disabled=${opt.disabled}
                  ?selected=${this.value === opt.value}
                >
                  ${opt.label}
                </option>
              `,
            )}
          </select>

          ${this.clearable && this.value && !this.disabled && !this.required
            ? html`
                <button
                  type="button"
                  class="absolute inset-y-0 right-8 my-auto h-5 w-5 rounded-full flex items-center justify-center text-surface-400 hover:text-surface-700 dark:hover:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
                  @mousedown=${(e: Event) => e.preventDefault()}
                  @click=${this.clearValue}
                  aria-label=${__('Azzera selezione')}
                  title=${__('Azzera')}
                >
                  <ui-icon name="x" size="xs"></ui-icon>
                </button>
              `
            : nothing}

          <!-- Dropdown arrow -->
          <div class="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
            <ui-icon name="chevron-down" size="xs" class="text-surface-400"></ui-icon>
          </div>
        </div>

        ${this.hint && !this.error
          ? html` <p class="text-xs text-surface-500 dark:text-surface-400">${this.hint}</p> `
          : nothing}
        ${this.error
          ? html`
              <p
                class="text-xs text-danger-600 dark:text-danger-400 flex items-center gap-1"
                role="alert"
              >
                <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fill-rule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                    clip-rule="evenodd"
                  />
                </svg>
                ${this.error}
              </p>
            `
          : nothing}
      </div>
    `;
  }
}
