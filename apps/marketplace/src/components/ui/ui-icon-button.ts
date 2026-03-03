import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import './ui-icon';

/**
 * UI Icon Button
 *
 * A small button containing only an icon, used for actions in cards/tables.
 *
 * @fires click - Standard click event
 *
 * @example
 * ```html
 * <ui-icon-button
 *   icon="edit"
 *   title="Edit"
 *   @click=${this.handleEdit}
 * ></ui-icon-button>
 *
 * <ui-icon-button
 *   icon="trash"
 *   variant="danger"
 *   title="Delete"
 *   @click=${this.handleDelete}
 * ></ui-icon-button>
 * ```
 */
@customElement('ui-icon-button')
export class UiIconButton extends LitElement {
  @property({ type: String }) icon = '';
  @property({ type: String }) title = '';
  @property({ type: String }) variant: 'default' | 'danger' | 'success' | 'brand' = 'default';
  @property({ type: String }) size: 'xs' | 'sm' | 'md' = 'sm';
  @property({ type: Boolean }) disabled = false;

  // ─── Lifecycle ───────────────────────────────────────────
  createRenderRoot() {
    return this;
  }

  // ─── Helpers ──────────────────────────────────────────────
  private getVariantClasses(): string {
    const variants = {
      default:
        'text-surface-400 hover:text-surface-600 dark:hover:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800',
      danger:
        'text-surface-400 hover:text-danger-600 dark:hover:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-900/20',
      success:
        'text-surface-400 hover:text-success-600 dark:hover:text-success-400 hover:bg-success-50 dark:hover:bg-success-900/20',
      brand:
        'text-surface-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20',
    };
    return variants[this.variant];
  }

  private getSizeClasses(): string {
    const sizes = {
      xs: 'p-1',
      sm: 'p-2',
      md: 'p-2.5',
    };
    return sizes[this.size];
  }

  private getIconSize(): string {
    const iconSizes = {
      xs: 'xs',
      sm: 'xs',
      md: 'sm',
    };
    return iconSizes[this.size] as 'xs' | 'sm' | 'md';
  }

  // ─── Render ──────────────────────────────────────────────
  render() {
    return html`
      <button
        type="button"
        title=${this.title}
        ?disabled=${this.disabled}
        class="${this.getSizeClasses()} ${this.getVariantClasses()} rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <ui-icon name=${this.icon} size=${this.getIconSize()}></ui-icon>
      </button>
    `;
  }
}
