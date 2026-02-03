import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('ui-textarea')
export class UiTextarea extends LitElement {
  @property({ type: String }) label = '';
  @property({ type: String }) placeholder = '';
  @property({ type: String }) value = '';
  @property({ type: String }) error = '';
  @property({ type: String }) hint = '';
  @property({ type: Number }) rows = 4;
  @property({ type: Number }) maxLength = 0;
  @property({ type: Boolean }) required = false;
  @property({ type: Boolean }) disabled = false;
  @property({ type: Boolean }) showCount = false;

  createRenderRoot() {
    return this;
  }

  private handleInput(e: Event) {
    const target = e.target as HTMLTextAreaElement;
    this.value = target.value;
    this.dispatchEvent(
      new CustomEvent('textarea-change', {
        detail: { value: this.value },
        bubbles: true,
        composed: true,
      }),
    );
  }

  render() {
    const textareaClasses = `
      block w-full px-3 py-2.5 text-sm rounded-lg border transition-colors duration-150
      bg-white dark:bg-surface-900
      text-surface-900 dark:text-white
      placeholder:text-surface-400 dark:placeholder:text-surface-500
      focus:outline-none focus:ring-2 focus:ring-offset-0
      disabled:bg-surface-50 disabled:text-surface-500 disabled:cursor-not-allowed
      dark:disabled:bg-surface-800
      resize-none
      ${
        this.error
          ? 'border-danger-500 focus:border-danger-500 focus:ring-danger-500/20'
          : 'border-surface-300 dark:border-surface-600 focus:border-brand-500 focus:ring-brand-500/20'
      }
    `;

    const charCount = this.value.length;
    const isOverLimit = this.maxLength > 0 && charCount > this.maxLength;

    return html`
      <div class="space-y-1.5">
        ${this.label
          ? html`
              <label class="block text-sm font-medium text-surface-700 dark:text-surface-300">
                ${this.label}
                ${this.required ? html`<span class="text-danger-500 ml-0.5">*</span>` : ''}
              </label>
            `
          : ''}

        <textarea
          class="${textareaClasses}"
          rows="${this.rows}"
          placeholder="${this.placeholder}"
          .value="${this.value}"
          ?required="${this.required}"
          ?disabled="${this.disabled}"
          maxlength="${this.maxLength > 0 ? this.maxLength : ''}"
          aria-invalid="${this.error ? 'true' : 'false'}"
          @input="${this.handleInput}"
        ></textarea>

        <div class="flex items-center justify-between">
          <div>
            ${this.hint && !this.error
              ? html` <p class="text-xs text-surface-500 dark:text-surface-400">${this.hint}</p> `
              : ''}
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
              : ''}
          </div>

          ${this.showCount || this.maxLength > 0
            ? html`
                <p class="text-xs ${isOverLimit ? 'text-danger-500' : 'text-surface-400'}">
                  ${charCount}${this.maxLength > 0 ? `/${this.maxLength}` : ''}
                </p>
              `
            : ''}
        </div>
      </div>
    `;
  }
}
