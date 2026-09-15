/*
 * File: /src/components/ui/ui-page-header.ts                                            *
 * Project: @artaround/marketplace                                                       *
 * Last Modified: 12/09/2026                                                             *
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
import './ui-button';
import './ui-info-tip';

/**
 * Intestazione di pagina con titolo, descrizione e bottone indietro opzionali.
 */
@customElement('ui-page-header')
export class UiPageHeader extends LitElement {
  @property({ type: String }) title = '';
  @property({ type: String }) description = '';
  @property({ type: String }) help = '';
  @property({ type: Number }) count: number | undefined = undefined;
  @property({ type: String }) countLabel = '';
  @property({ type: Boolean }) showBack = false;

  @state() private actionsContent: Element[] = [];
  private actionsInitialized = false;

  // ─── Ciclo di vita ───────────────────────────────────────────
  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.style.display = 'block';
    // Ritarda la cattura per assicurarsi che i figli siano pronti
    requestAnimationFrame(() => {
      if (!this.actionsInitialized) {
        this.captureSlotContent();
        this.actionsInitialized = true;
      }
    });
  }

  // ─── Azioni ──────────────────────────────────────────────
  private captureSlotContent() {
    // Cattura i figli con attributo slot="actions" - tiene gli elementi originali (non cloni!)
    const actionsSlotted = Array.from(this.querySelectorAll('[slot="actions"]')) as Element[];
    this.actionsContent = actionsSlotted.map((el) => {
      el.removeAttribute('slot');
      return el; // Ritorna l'elemento originale, non un clone
    });
  }

  private handleBack() {
    this.dispatchEvent(
      new CustomEvent('back', {
        bubbles: true,
        composed: true,
      }),
    );
  }

  protected updated() {
    // Sposta le azioni nel contenitore (non clona - preserva gli event listener)
    const actionsContainer = this.querySelector('.page-header-actions');
    if (actionsContainer && this.actionsContent.length > 0) {
      // Sposta solo se non è già lì
      this.actionsContent.forEach((node) => {
        if (node.parentElement !== actionsContainer) {
          actionsContainer.appendChild(node);
        }
      });
    }
  }

  // ─── Render ──────────────────────────────────────────────
  render() {
    const countText =
      this.count !== undefined ? `${this.count} ${this.countLabel}` : this.countLabel;
    const showDescription = this.description || countText;

    return html`
      <div class="flex flex-col sm:flex-row gap-4 sm:items-start sm:justify-between mb-6">
        <div class="flex items-start gap-4">
          ${this.showBack
            ? html`
                <button
                  type="button"
                  class="p-2 text-surface-500 hover:text-surface-700 dark:text-surface-400 dark:hover:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-lg transition-colors"
                  @click=${this.handleBack}
                >
                  <ui-icon name="arrow-left" size="sm"></ui-icon>
                </button>
              `
            : nothing}
          <div>
            <h1
              class="flex items-center gap-2 flex-wrap text-2xl font-bold text-surface-900 dark:text-white"
            >
              ${this.title}
              ${this.help
                ? html`<ui-info-tip variant="inline" text=${this.help}></ui-info-tip>`
                : nothing}
            </h1>
            ${showDescription
              ? html`
                  <p class="text-sm text-surface-500 dark:text-surface-400 mt-1">
                    ${countText}${this.description && countText ? ' • ' : ''}${this.description}
                  </p>
                `
              : nothing}
          </div>
        </div>

        <div class="page-header-actions flex items-center gap-3"></div>
      </div>
    `;
  }
}
