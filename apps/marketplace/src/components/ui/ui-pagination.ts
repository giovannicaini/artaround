/*
 * File: /src/components/ui/ui-pagination.ts                                             *
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
import './ui-button';

/**
 * Controlli di paginazione con numeri di pagina ed ellissi.
 */
@customElement('ui-pagination')
export class UiPagination extends LitElement {
  @property({ type: Number }) page = 1;
  @property({ type: Number }) totalPages = 1;
  @property({ type: Number }) maxVisible = 5;

  // ─── Ciclo di vita ───────────────────────────────────────────
  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.style.display = 'block';
  }

  // ─── Helper ──────────────────────────────────────────────
  private handlePageChange(newPage: number) {
    if (newPage < 1 || newPage > this.totalPages || newPage === this.page) return;
    this.dispatchEvent(
      new CustomEvent('page-change', {
        detail: { page: newPage },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private getVisiblePages(): (number | 'ellipsis')[] {
    const pages: (number | 'ellipsis')[] = [];
    const half = Math.floor(this.maxVisible / 2);

    let start = Math.max(1, this.page - half);
    let end = Math.min(this.totalPages, start + this.maxVisible - 1);

    // Aggiusta l'inizio se siamo vicini alla fine
    if (end - start + 1 < this.maxVisible) {
      start = Math.max(1, end - this.maxVisible + 1);
    }

    // Aggiunge la prima pagina e i puntini se serve
    if (start > 1) {
      pages.push(1);
      if (start > 2) pages.push('ellipsis');
    }

    // Aggiunge le pagine visibili
    for (let i = start; i <= end; i++) {
      if (i !== 1 && i !== this.totalPages) {
        pages.push(i);
      } else if (start <= 1 && i === 1) {
        pages.push(i);
      } else if (end >= this.totalPages && i === this.totalPages) {
        pages.push(i);
      }
    }

    // Aggiunge l'ultima pagina e i puntini se serve
    if (end < this.totalPages) {
      if (end < this.totalPages - 1) pages.push('ellipsis');
      pages.push(this.totalPages);
    }

    return pages;
  }

  // ─── Render ──────────────────────────────────────────────
  render() {
    if (this.totalPages <= 1) return nothing;

    const visiblePages = this.getVisiblePages();

    return html`
      <div class="flex justify-center items-center gap-1 mt-6">
        <ui-button
          variant="secondary"
          icon="arrow-left"
          size="sm"
          ?disabled=${this.page === 1}
          @click=${() => this.handlePageChange(this.page - 1)}
        ></ui-button>

        ${visiblePages.map((p) =>
          p === 'ellipsis'
            ? html`<span class="px-2 text-surface-400">...</span>`
            : html`
                <ui-button
                  variant=${p === this.page ? 'primary' : 'secondary'}
                  size="sm"
                  label="${p}"
                  @click=${() => this.handlePageChange(p)}
                ></ui-button>
              `,
        )}

        <ui-button
          variant="secondary"
          icon="arrow-right"
          size="sm"
          ?disabled=${this.page === this.totalPages}
          @click=${() => this.handlePageChange(this.page + 1)}
        ></ui-button>
      </div>
    `;
  }
}
