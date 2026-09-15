/*
 * File: /src/components/ui/ui-view-toggle.ts                                            *
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

import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import './ui-button';
import { __ } from '../../services/i18n.service';

export type ViewLayout = 'grid' | 'table';

/**
 * Interruttore Griglia/Tabella per le liste che offrono entrambe le viste.
 */
@customElement('ui-view-toggle')
export class UiViewToggle extends LitElement {
  @property({ type: String }) value: ViewLayout = 'grid';

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.style.display = 'block';
  }

  private select(layout: ViewLayout) {
    this.dispatchEvent(
      new CustomEvent('layout-change', {
        detail: { value: layout },
        bubbles: true,
        composed: true,
      }),
    );
  }

  render() {
    return html`
      <p class="text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">
        ${__('Vista')}
      </p>
      <div class="flex items-center gap-2">
        <ui-button
          size="xs"
          .variant=${this.value === 'grid' ? 'primary' : 'secondary'}
          .label=${__('Griglia')}
          @click=${() => this.select('grid')}
        ></ui-button>
        <ui-button
          size="xs"
          .variant=${this.value === 'table' ? 'primary' : 'secondary'}
          .label=${__('Tabella')}
          @click=${() => this.select('table')}
        ></ui-button>
      </div>
    `;
  }
}
