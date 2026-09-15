/*
 * File: /src/base/museum-aware.mixin.ts                                                 *
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

import { state } from 'lit/decorators.js';
import { preferencesService } from '../services/preferences.service';
import type { LitElement } from 'lit';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Constructor<T = LitElement> = new (...args: any[]) => T;

export interface MuseumAwareInterface {
  selectedMuseumId: string | null;
  onMuseumChanged(): void;
  emitSelectMuseum(): void;
}

/**
 * Mixin per il museo attivo selezionato..
 */
export function MuseumAwareMixin<T extends Constructor<LitElement>>(
  superClass: T,
): Constructor<MuseumAwareInterface> & T {
  class MuseumAwareClass extends superClass {
    @state() selectedMuseumId: string | null = null;

    private _museumChangeHandler = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      this.selectedMuseumId = detail?._id || null;
      this.onMuseumChanged();
    };

    connectedCallback() {
      super.connectedCallback();
      this.selectedMuseumId = preferencesService.getSelectedMuseumId();
      window.addEventListener('museum-changed', this._museumChangeHandler);
    }

    disconnectedCallback() {
      window.removeEventListener('museum-changed', this._museumChangeHandler);
      super.disconnectedCallback();
    }

    // Sovrascrivi questo metodo per reagire ai cambi di museo.
    onMuseumChanged(): void {
      // Da sovrascrivere nella sottoclasse
    }

    // Emette l'evento per aprire il selettore museo.
    emitSelectMuseum(): void {
      this.dispatchEvent(
        new CustomEvent('select-museum', {
          bubbles: true,
          composed: true,
        }),
      );
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return MuseumAwareClass as any;
}
