import { LitElement, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import './ui-card';
import './ui-image-placeholder';

@customElement('ui-media-card')
export class UiMediaCard extends LitElement {
  @property({ type: String }) imageSrc = '';
  @property({ type: String }) imageSrcset = '';
  @property({ type: String }) imageSizes = '';
  @property({ type: String }) imageAlt = '';
  @property({ type: String }) aspectClass = 'aspect-video';
  @property({ type: String }) placeholderType:
    | 'artwork'
    | 'museum'
    | 'content'
    | 'user'
    | 'default' = 'default';
  @property({ type: String }) placeholderSize: 'xs' | 'sm' | 'md' | 'lg' | 'full' = 'md';
  @property({ type: String }) bodyClass = 'p-4';
  @property({ type: Boolean }) hover = true;
  @property({ attribute: false }) renderTopLeft: (() => unknown) | null = null;
  @property({ attribute: false }) renderTopRight: (() => unknown) | null = null;
  @property({ attribute: false }) renderContent: (() => unknown) | null = null;

  @state() private imageFailed = false;

  // ─── Ciclo di vita ───────────────────────────────────────────
  createRenderRoot() {
    return this;
  }

  protected updated(changedProps: Map<string, unknown>) {
    if (changedProps.has('imageSrc') && changedProps.get('imageSrc') !== this.imageSrc) {
      this.imageFailed = false;
    }
  }

  // ─── Azioni ──────────────────────────────────────────────
  private handleImageError() {
    this.imageFailed = true;
  }

  // ─── Render ──────────────────────────────────────────────
  render() {
    const showImage = Boolean(this.imageSrc) && !this.imageFailed;

    return html`
      <ui-card padding="none" ?hover=${this.hover}>
        <div
          class="${this
            .aspectClass} bg-surface-100 dark:bg-surface-800 relative overflow-hidden rounded-t-xl"
        >
          ${showImage
            ? html`
                <img
                  src=${this.imageSrc}
                  srcset=${this.imageSrcset || nothing}
                  sizes=${this.imageSizes || nothing}
                  alt=${this.imageAlt}
                  loading="lazy"
                  decoding="async"
                  fetchpriority="low"
                  class="w-full h-full object-cover"
                  @error=${this.handleImageError}
                />
              `
            : nothing}
          ${showImage
            ? html`
                <ui-image-placeholder
                  type=${this.placeholderType}
                  size=${this.placeholderSize}
                  hidden
                  class="absolute inset-0"
                ></ui-image-placeholder>
              `
            : html`
                <ui-image-placeholder
                  type=${this.placeholderType}
                  size=${this.placeholderSize}
                ></ui-image-placeholder>
              `}
          ${this.renderTopLeft
            ? html`<div class="absolute top-3 left-3">${this.renderTopLeft()}</div>`
            : nothing}
          ${this.renderTopRight
            ? html`<div class="absolute top-3 right-3">${this.renderTopRight()}</div>`
            : nothing}
        </div>

        <div class=${this.bodyClass}>${this.renderContent ? this.renderContent() : nothing}</div>
      </ui-card>
    `;
  }
}
