import { LitElement, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';

/**
 * UI Checkbox
 *
 * A consistent checkbox input with label.
 *
 * @fires checkbox-change - Emits the checked state
 *
 * @example
 * ```html
 * <ui-checkbox
 *   label="Accetto i termini"
 *   .checked=${this.accepted}
 *   @checkbox-change=${(e) => this.accepted = e.detail.checked}
 * ></ui-checkbox>
 * ```
 */
@customElement('ui-checkbox')
export class UiCheckbox extends LitElement {
  @property({ type: String }) label = '';
  @property({ type: String }) hint = '';
  @property({ type: Boolean }) checked = false;
  @property({ type: Boolean }) disabled = false;

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
    const target = e.target as HTMLInputElement;
    this.dispatchEvent(
      new CustomEvent('checkbox-change', {
        detail: { checked: target.checked },
        bubbles: true,
        composed: true,
      }),
    );
  }

  // ─── Render ──────────────────────────────────────────────
  render() {
    return html`
      <label class="flex items-start gap-3 cursor-pointer group">
        <input
          type="checkbox"
          .checked=${this.checked}
          ?disabled=${this.disabled}
          @change=${this.handleChange}
          class="mt-1 w-4 h-4 rounded border-surface-300 dark:border-surface-600 text-brand-600 focus:ring-brand-500 focus:ring-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <div class="flex-1">
          ${this.label
            ? html`
                <span
                  class="text-sm text-surface-700 dark:text-surface-300 group-hover:text-surface-900 dark:group-hover:text-white transition-colors"
                >
                  ${this.label}
                </span>
              `
            : nothing}
          ${this.hint
            ? html`
                <p class="text-xs text-surface-500 dark:text-surface-400 mt-0.5">${this.hint}</p>
              `
            : nothing}
        </div>
      </label>
    `;
  }
}
