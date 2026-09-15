/*
 * File: /src/components/ui/ui-brand-mark.ts                                             *
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
  @property({ type: String }) textClass = 'text-xl font-bold gradient-aurora-text';
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
            d="M10.5 9 L8.5 13 V23.5 Q8.5 25 10 25 H22 Q23.5 25 23.5 23.5 V13 L21.5 9 Z"
            fill="white"
          />
          <path
            d="M12.5 13a3.5 3.5 0 0 0 7 0"
            stroke="url(#${this.gradientId})"
            stroke-width="1.7"
            stroke-linecap="round"
            fill="none"
          />
        </svg>
        ${this.showText ? html`<span class=${this.textClass}>${this.text}</span>` : nothing}
      </div>
    `;
  }
}
