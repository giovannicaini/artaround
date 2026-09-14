import { LitElement, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';

let instanceCounter = 0;

/**
 * Logo ArtAround (icona + testo), stesso gradiente del Navigator.
 */
@customElement('ui-brand-mark')
export class UiBrandMark extends LitElement {
  @property({ type: String }) text = 'ArtAround';
  @property({ type: Boolean }) showText = true;
  @property({ type: String }) containerClass = 'inline-flex items-center gap-3';
  @property({ type: String }) textClass = 'font-semibold text-surface-900 dark:text-white';
  @property({ type: String }) iconSizeClass = 'w-8 h-8';

  // Id univoco per il <linearGradient>: più istanze non possono condividere lo stesso id SVG.
  private readonly gradientId = `brand-mark-g-${instanceCounter++}`;

  // ─── Ciclo di vita ───────────────────────────────────────────
  createRenderRoot() {
    return this;
  }

  // ─── Render ──────────────────────────────────────────────
  render() {
    return html`
      <div class=${this.containerClass}>
        <svg
          class="${this.iconSizeClass} rounded-lg"
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id=${this.gradientId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#8b3ffc" />
              <stop offset="100%" stop-color="#f59e0b" />
            </linearGradient>
          </defs>
          <rect width="32" height="32" fill="url(#${this.gradientId})" />
          <path
            d="M11.5 13.5V11a4.5 4.5 0 0 1 9 0v2.5"
            stroke="white"
            stroke-width="2"
            stroke-linecap="round"
            fill="none"
          />
          <rect x="7.5" y="13.5" width="17" height="12.5" rx="2.5" fill="white" />
          <circle cx="16" cy="19.5" r="1.6" fill="url(#${this.gradientId})" />
        </svg>
        ${this.showText ? html`<span class=${this.textClass}>${this.text}</span>` : nothing}
      </div>
    `;
  }
}
