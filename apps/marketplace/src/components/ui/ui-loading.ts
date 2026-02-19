import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';

/**
 * UI Loading State
 *
 * A consistent loading spinner with optional text.
 *
 * @example
 * ```html
 * <ui-loading text="Caricamento contenuti..."></ui-loading>
 * <ui-loading size="sm"></ui-loading>
 * ```
 */
@customElement('ui-loading')
export class UiLoading extends LitElement {
  @property({ type: String }) text = '';
  @property({ type: String }) size: 'sm' | 'md' | 'lg' = 'md';

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.style.display = 'block';
  }

  render() {
    const sizeClasses = {
      sm: 'w-5 h-5 border',
      md: 'w-8 h-8 border-2',
      lg: 'w-12 h-12 border-3',
    };

    const spinnerClass = sizeClasses[this.size];

    return html`
      <div class="flex items-center justify-center py-12">
        <div class="text-center">
          <div
            class="${spinnerClass} border-brand-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"
          ></div>
          ${this.text
            ? html`<p class="text-sm text-surface-500 dark:text-surface-400">${this.text}</p>`
            : ''}
        </div>
      </div>
    `;
  }
}
