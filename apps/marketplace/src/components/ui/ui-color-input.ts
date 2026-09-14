import { LitElement, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import './ui-info-tip';
import './ui-input';

/**
 * Campo colore con swatch nativo e hex digitabile.
 */
@customElement('ui-color-input')
export class UiColorInput extends LitElement {
  @property({ type: String }) value = '#000000';
  @property({ type: String }) label = '';
  @property({ type: String }) help = '';
  @property({ type: Boolean }) disabled = false;
  // Affianca un campo testuale per l'hex, per chi vuole anche digitarlo
  // invece di scegliere solo dal color-picker nativo.
  @property({ type: Boolean }) hex = false;

  // ─── Ciclo di vita ───────────────────────────────────────────
  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.style.display = 'block';
  }

  // ─── Azioni ──────────────────────────────────────────────
  private handleInput(event: Event) {
    const target = event.target as HTMLInputElement;
    this.value = target.value;
    this.dispatchEvent(
      new CustomEvent('input-change', {
        detail: { value: this.value },
        bubbles: true,
        composed: true,
      }),
    );
  }

  // ─── Render ──────────────────────────────────────────────
  render() {
    return html`
      <div class="space-y-1.5">
        ${this.label
          ? html`
              <label
                class="flex items-center gap-1.5 text-sm font-medium text-surface-700 dark:text-surface-300"
              >
                ${this.label}
                ${this.help ? html`<ui-info-tip text=${this.help}></ui-info-tip>` : nothing}
              </label>
            `
          : nothing}
        <div class="flex items-center gap-2">
          <input
            type="color"
            class="h-10 w-14 flex-shrink-0 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-900 p-1 cursor-pointer"
            .value=${this.value}
            ?disabled=${this.disabled}
            @input=${this.handleInput}
          />
          ${this.hex
            ? html`
                <ui-input
                  class="flex-1"
                  .value=${this.value}
                  ?disabled=${this.disabled}
                  @input-change=${(e: CustomEvent<{ value: string }>) => {
                    this.value = e.detail.value;
                    this.dispatchEvent(
                      new CustomEvent('input-change', {
                        detail: { value: this.value },
                        bubbles: true,
                        composed: true,
                      }),
                    );
                  }}
                ></ui-input>
              `
            : nothing}
        </div>
      </div>
    `;
  }
}
