import { LitElement, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import './ui-icon';

@customElement('ui-badge')
export class UiBadge extends LitElement {
  @property({ type: String }) variant:
    | 'default'
    | 'primary'
    | 'secondary'
    | 'success'
    | 'warning'
    | 'danger'
    | 'outline' = 'default';
  @property({ type: String }) size: 'sm' | 'md' = 'md';
  @property({ type: Boolean }) dot = false;
  @property({ type: String }) icon = '';
  @property({ type: String }) label = '';

  // ─── Ciclo di vita ───────────────────────────────────────────
  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.style.display = 'inline-flex';

    if (!this.label && this.textContent?.trim()) {
      this.label = this.textContent.trim();
      this.textContent = '';
    }
  }

  // ─── Helper ──────────────────────────────────────────────
  private get variantClasses() {
    const variants: Record<string, string> = {
      default: 'bg-surface-100 text-surface-700 dark:bg-surface-800 dark:text-surface-300',
      primary: 'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300',
      secondary: 'bg-surface-100 text-surface-600 dark:bg-surface-800 dark:text-surface-400',
      success: 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-300',
      warning: 'bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-300',
      danger: 'bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-300',
      outline:
        'bg-transparent border border-surface-300 text-surface-600 dark:border-surface-600 dark:text-surface-400',
    };
    return variants[this.variant];
  }

  private get sizeClasses() {
    const sizes: Record<string, string> = {
      sm: 'px-2 py-0.5 text-xs',
      md: 'px-2.5 py-1 text-xs',
    };
    return sizes[this.size];
  }

  private get dotClasses() {
    const dots: Record<string, string> = {
      default: 'bg-surface-500',
      primary: 'bg-brand-500',
      secondary: 'bg-surface-400',
      success: 'bg-success-500',
      warning: 'bg-warning-500',
      danger: 'bg-danger-500',
      outline: 'bg-surface-400',
    };
    return dots[this.variant];
  }

  // ─── Render ──────────────────────────────────────────────
  render() {
    const classes = `inline-flex items-center gap-1.5 font-medium rounded-full whitespace-nowrap ${this.variantClasses} ${this.sizeClasses}`;

    return html`
      <span class="${classes}">
        ${this.dot
          ? html`<span class="w-1.5 h-1.5 rounded-full ${this.dotClasses}"></span>`
          : nothing}
        ${this.icon ? html`<ui-icon name="${this.icon}" size="xs"></ui-icon>` : nothing}
        <span class="leading-none whitespace-nowrap">${this.label}</span>
      </span>
    `;
  }
}
