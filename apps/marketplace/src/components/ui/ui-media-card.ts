/*
 * File: /src/components/ui/ui-media-card.ts                                             *
 * Project: @artaround/marketplace                                                       *
 * Last Modified: 14/09/2026                                                             *
 * Author: Giovanni Caini (giovanni.caini@studio.unibo.it)                               *
 * -----                                                                                 *
 * MIT License                                                                           *
 *                                                                                       *
 * Copyright (c) 2026 Giovanni Caini                                                     *
 *                                                                                       *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of       *
 * this software and associated documentation files (the "Software"), to deal in         *
 * the Software without restriction, including without limitation the rights to          *
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies         *
 * of the Software, and to permit persons to whom the Software is furnished to do        *
 * so, subject to the following conditions:                                              *
 *                                                                                       *
 * The above copyright notice and this permission notice shall be included in all        *
 * copies or substantial portions of the Software.                                       *
 *                                                                                       *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR            *
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,              *
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE           *
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER                *
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,         *
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE         *
 * SOFTWARE.                                                                             *
 * ************************************************************************************* *
 */

import { LitElement, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import './ui-card';
import './ui-image-placeholder';

/**
 * Card con immagine in alto e contenuto sotto, base di ogni card entità.
 */
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
      <ui-card padding="none" ?hover=${this.hover} ?hoverGlow=${this.hover}>
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
