import { LitElement, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import './ui-info-tip';

/**
 * Checkbox con etichetta e testo di aiuto opzionale.
 */
@customElement('ui-checkbox')
export class UiCheckbox extends LitElement {
  @property({ type: String }) label = '';
  @property({ type: String }) help = '';
  @property({ type: String }) hint = '';
  @property({ type: Boolean }) checked = false;
  @property({ type: Boolean }) disabled = false;

  // ─── Ciclo di vita ───────────────────────────────────────────
  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.style.display = 'block';
  }

  // ─── Azioni ──────────────────────────────────────────────
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
          class="mt-1 w-4 h-4 rounded border-surface-300 dark:border-surface-600 text-brand-600 focus-glow disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <div class="flex-1">
          ${this.label
            ? html`
                <span
                  class="inline-flex items-center gap-1.5 text-sm text-surface-700 dark:text-surface-300 group-hover:text-surface-900 dark:group-hover:text-white transition-colors"
                >
                  ${this.label}
                  ${this.help ? html`<ui-info-tip text=${this.help}></ui-info-tip>` : nothing}
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
