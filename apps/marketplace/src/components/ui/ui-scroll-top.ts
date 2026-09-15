/*
 * File: /src/components/ui/ui-scroll-top.ts                                             *
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
import { customElement, state } from 'lit/decorators.js';
import './ui-icon';
import { __ } from '../../services/i18n.service';

/**
 * Bottone flottante per tornare in cima alla pagina.
 */
@customElement('ui-scroll-top')
export class UiScrollTop extends LitElement {
  @state() private visible = false;

  private scrollThreshold = 300;

  // ─── Ciclo di vita ───────────────────────────────────────────
  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener('scroll', this.handleScroll);
    this.handleScroll();
  }

  disconnectedCallback() {
    window.removeEventListener('scroll', this.handleScroll);
    super.disconnectedCallback();
  }

  // ─── Azioni ──────────────────────────────────────────────
  private handleScroll = () => {
    this.visible = window.scrollY > this.scrollThreshold;
  };

  private scrollToTop() {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }

  // ─── Render ──────────────────────────────────────────────
  render() {
    if (!this.visible) return nothing;

    return html`
      <button
        @click=${this.scrollToTop}
        class="fixed bottom-6 right-6 z-50 flex items-center justify-center w-12 h-12 bg-brand-600 hover:bg-brand-700 text-white rounded-full shadow-lg transition-all duration-300 hover:scale-110 focus-glow"
        .title=${__('Torna su')}
        aria-label=${__("Torna all'inizio della pagina")}
      >
        <ui-icon name="chevron-up" size="md"></ui-icon>
      </button>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ui-scroll-top': UiScrollTop;
  }
}
