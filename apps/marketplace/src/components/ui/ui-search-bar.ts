/*
 * File: /src/components/ui/ui-search-bar.ts                                             *
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
import './ui-input';
import './ui-button';

/**
 * Barra di ricerca testuale con icona e pulsante di reset.
 */
@customElement('ui-search-bar')
export class UiSearchBar extends LitElement {
  @property({ type: String }) value = '';
  @property({ type: String }) placeholder = 'Cerca...';
  @property({ type: Boolean }) showButton = true;
  @property({ type: Boolean }) debounce = false;
  @property({ type: Number }) debounceMs = 300;

  @state() private internalValue = '';
  private debounceTimeout: ReturnType<typeof setTimeout> | null = null;

  // ─── Ciclo di vita ───────────────────────────────────────────
  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.style.display = 'block';
    this.internalValue = this.value;
  }

  updated(changedProps: Map<string, unknown>) {
    if (changedProps.has('value') && this.value !== this.internalValue) {
      this.internalValue = this.value;
    }
  }

  // ─── Azioni ──────────────────────────────────────────────
  private handleInput(e: CustomEvent) {
    this.internalValue = e.detail.value;

    this.dispatchEvent(
      new CustomEvent('input-change', {
        detail: { value: this.internalValue },
        bubbles: true,
        composed: true,
      }),
    );

    if (this.debounce) {
      if (this.debounceTimeout) clearTimeout(this.debounceTimeout);
      this.debounceTimeout = setTimeout(() => {
        this.emitSearch();
      }, this.debounceMs);
    }
  }

  private handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      if (this.debounceTimeout) clearTimeout(this.debounceTimeout);
      this.emitSearch();
    }
  }

  private handleButtonClick() {
    if (this.debounceTimeout) clearTimeout(this.debounceTimeout);
    this.emitSearch();
  }

  private emitSearch() {
    this.dispatchEvent(
      new CustomEvent('search', {
        detail: { value: this.internalValue },
        bubbles: true,
        composed: true,
      }),
    );
  }

  // ─── Render ──────────────────────────────────────────────
  render() {
    return html`
      <div class="flex gap-2">
        <ui-input
          type="search"
          placeholder=${this.placeholder}
          .value=${this.internalValue}
          @input-change=${this.handleInput}
          @keydown=${this.handleKeydown}
        ></ui-input>
        ${this.showButton
          ? html`
              <ui-button
                variant="secondary"
                icon="search"
                @click=${this.handleButtonClick}
              ></ui-button>
            `
          : nothing}
      </div>
    `;
  }
}
