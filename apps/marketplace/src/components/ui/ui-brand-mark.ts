import { LitElement, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('ui-brand-mark')
export class UiBrandMark extends LitElement {
  @property({ type: String }) text = 'ArtAround';
  @property({ type: Boolean }) showText = true;
  @property({ type: String }) containerClass = 'inline-flex items-center gap-3';
  @property({ type: String }) textClass = 'font-semibold text-surface-900 dark:text-white';
  @property({ type: String }) iconSizeClass = 'w-8 h-8';

  createRenderRoot() {
    return this;
  }

  render() {
    return html`
      <div class=${this.containerClass}>
        <div class="${this.iconSizeClass} rounded-lg bg-brand-600 flex items-center justify-center">
          <span class="text-white font-bold text-sm">A</span>
        </div>
        ${this.showText ? html`<span class=${this.textClass}>${this.text}</span>` : nothing}
      </div>
    `;
  }
}
