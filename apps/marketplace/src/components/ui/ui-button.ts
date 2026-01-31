import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import './ui-icon';

@customElement('ui-button')
export class UiButton extends LitElement {
  @property({ type: String }) variant: 'primary' | 'secondary' | 'ghost' | 'danger' = 'primary';
  @property({ type: String }) size: 'xs' | 'sm' | 'md' | 'lg' = 'md';
  @property({ type: Boolean }) loading = false;
  @property({ type: Boolean }) disabled = false;
  @property({ type: Boolean }) block = false;
  @property({ type: String }) label = '';
  @property({ type: String }) icon = '';

  createRenderRoot() { return this; }

  private get baseClasses() {
    return 'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';
  }

  private get variantClasses() {
    const variants: Record<string, string> = {
      primary: 'bg-brand-600 text-white hover:bg-brand-700 focus:ring-brand-500 active:bg-brand-800',
      secondary: 'bg-white text-surface-700 border border-surface-300 hover:bg-surface-50 focus:ring-brand-500 dark:bg-surface-800 dark:text-surface-100 dark:border-surface-600 dark:hover:bg-surface-700',
      ghost: 'text-surface-600 hover:bg-surface-100 focus:ring-brand-500 dark:text-surface-300 dark:hover:bg-surface-800',
      danger: 'bg-danger-600 text-white hover:bg-danger-700 focus:ring-danger-500 active:bg-danger-800',
    };
    return variants[this.variant];
  }

  private get sizeClasses() {
    const sizes: Record<string, string> = {
      xs: 'px-2.5 py-1.5 text-xs',
      sm: 'px-3 py-2 text-sm',
      md: 'px-4 py-2.5 text-sm',
      lg: 'px-5 py-3 text-base',
    };
    return sizes[this.size];
  }

  render() {
    const classes = `${this.baseClasses} ${this.variantClasses} ${this.sizeClasses} ${this.block ? 'w-full' : ''}`;
    const iconSize = this.size === 'xs' || this.size === 'sm' ? 'xs' : 'sm';

    return html`
      <button
        class="${classes}"
        ?disabled=${this.disabled || this.loading}
        aria-busy=${this.loading}
      >
        ${this.loading ? html`
          <svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        ` : this.icon ? html`
          <ui-icon name="${this.icon}" size="${iconSize}"></ui-icon>
        ` : ''}
        ${this.label}
      </button>
    `;
  }
}
