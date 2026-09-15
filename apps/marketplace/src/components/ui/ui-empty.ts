/*
 * File: /src/components/ui/ui-empty.ts                                                  *
 * Project: @artaround/marketplace                                                       *
 * Last Modified: 02/09/2026                                                             *
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
import './ui-icon';

/**
 * Stato vuoto a piena pagina con icona, titolo/descrizione e azione opzionale.
 */
@customElement('ui-empty')
export class UiEmpty extends LitElement {
  @property({ type: String }) icon = 'folder';
  @property({ type: String }) title = '';
  @property({ type: String }) description = '';

  @state() private actionContent: Element[] = [];
  private actionInitialized = false;

  // ─── Ciclo di vita ───────────────────────────────────────────
  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    requestAnimationFrame(() => {
      if (!this.actionInitialized) {
        this.captureSlotContent();
        this.actionInitialized = true;
      }
    });
  }

  // ─── Helper ──────────────────────────────────────────────
  private captureSlotContent() {
    const actionSlotted = Array.from(this.querySelectorAll('[slot="action"]')) as Element[];
    this.actionContent = actionSlotted.map((el) => {
      el.removeAttribute('slot');
      return el; // Tiene l'elemento originale, non un clone - preserva gli event listener
    });
  }

  protected updated() {
    const actionContainer = this.querySelector('.empty-action-container');
    if (actionContainer && this.actionContent.length > 0) {
      // Sposta gli elementi (non clona) per preservare gli event listener
      this.actionContent.forEach((node) => {
        if (node.parentElement !== actionContainer) {
          actionContainer.appendChild(node);
        }
      });
    }
  }

  // ─── Render ──────────────────────────────────────────────
  render() {
    return html`
      <div class="text-center py-12">
        <div
          class="w-16 h-16 mx-auto mb-4 rounded-full bg-surface-100 dark:bg-surface-800 flex items-center justify-center"
        >
          <ui-icon name="${this.icon}" size="lg" class="text-surface-400"></ui-icon>
        </div>
        ${this.title
          ? html`
              <h3 class="text-lg font-semibold text-surface-900 dark:text-white mb-1">
                ${this.title}
              </h3>
            `
          : nothing}
        ${this.description
          ? html`
              <p class="text-sm text-surface-500 dark:text-surface-400 mb-4">${this.description}</p>
            `
          : nothing}
        <div class="empty-action-container"></div>
      </div>
    `;
  }
}
