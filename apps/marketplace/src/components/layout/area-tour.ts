/*
 * File: /src/components/layout/area-tour.ts                                             *
 * Project: @artaround/marketplace                                                       *
 * Last Modified: 13/09/2026                                                             *
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
import type { User } from '@artaround/shared';
import { preferencesService, type TourId } from '../../services/preferences.service';
import { getTourSlides } from '../../utils/tour-content';
import '../ui/ui-tour';

/**
 * Ospita uno dei tour
 */
@customElement('area-tour')
export class AreaTour extends LitElement {
  @property({ type: String }) tourId: TourId | null = null;
  // Solo il tour di benvenuto lo usa per adattare la slide finale
  @property({ type: Object }) user: User | null = null;

  createRenderRoot() {
    return this;
  }

  private handleFinished() {
    if (this.tourId) {
      preferencesService.markTourSeen(this.tourId);
    }
    this.dispatchEvent(new CustomEvent('tour-finished', { bubbles: true, composed: true }));
  }

  render() {
    if (!this.tourId) return nothing;

    return html`
      <ui-tour
        .slides=${getTourSlides(this.tourId, this.user)}
        @tour-finished=${this.handleFinished}
      ></ui-tour>
    `;
  }
}
