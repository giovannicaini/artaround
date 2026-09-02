import { LitElement, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('ui-color-input')
export class UiColorInput extends LitElement {
  @property({ type: String }) value = '#000000';
  @property({ type: String }) label = '';
  @property({ type: Boolean }) disabled = false;

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.style.display = 'block';
  }

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

  render() {
    return html`
      <div class="space-y-1.5">
        ${this.label
          ? html`
              <label class="block text-sm font-medium text-surface-700 dark:text-surface-300">
                ${this.label}
              </label>
            `
          : nothing}
        <input
          type="color"
          class="h-10 w-14 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-900 p-1 cursor-pointer"
          .value=${this.value}
          ?disabled=${this.disabled}
          @input=${this.handleInput}
        />
      </div>
    `;
  }
}
