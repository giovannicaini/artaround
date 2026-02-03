import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('ui-badge')
export class UiBadge extends LitElement {
  @property({ type: String }) variant: 'default' | 'primary' | 'success' | 'warning' | 'danger' =
    'default';
  @property({ type: String }) size: 'sm' | 'md' = 'md';
  @property({ type: Boolean }) dot = false;
  @property({ type: String }) label = '';

  createRenderRoot() {
    return this;
  }

  private get variantClasses() {
    const variants: Record<string, string> = {
      default: 'bg-surface-100 text-surface-700 dark:bg-surface-800 dark:text-surface-300',
      primary: 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300',
      success: 'bg-success-50 text-success-700 dark:bg-success-900/30 dark:text-success-300',
      warning: 'bg-warning-50 text-warning-700 dark:bg-warning-900/30 dark:text-warning-300',
      danger: 'bg-danger-50 text-danger-700 dark:bg-danger-900/30 dark:text-danger-300',
    };
    return variants[this.variant];
  }

  private get sizeClasses() {
    const sizes: Record<string, string> = {
      sm: 'px-2 py-0.5 text-2xs',
      md: 'px-2.5 py-1 text-xs',
    };
    return sizes[this.size];
  }

  private get dotClasses() {
    const dots: Record<string, string> = {
      default: 'bg-surface-500',
      primary: 'bg-brand-500',
      success: 'bg-success-500',
      warning: 'bg-warning-500',
      danger: 'bg-danger-500',
    };
    return dots[this.variant];
  }

  render() {
    const classes = `inline-flex items-center gap-1.5 font-medium rounded-full ${this.variantClasses} ${this.sizeClasses}`;

    return html`
      <span class="${classes}">
        ${this.dot ? html`<span class="w-1.5 h-1.5 rounded-full ${this.dotClasses}"></span>` : ''}
        ${this.label}
      </span>
    `;
  }
}
