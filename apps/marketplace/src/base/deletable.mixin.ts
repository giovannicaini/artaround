/*
 * File: /src/base/deletable.mixin.ts                                                    *
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
import type { LitElement } from 'lit';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Constructor<T = LitElement> = new (...args: any[]) => T;

export interface DeletableInterface {
  deleteModalOpen: boolean;
  entityToDelete: unknown;
  deleting: boolean;
  openDeleteModal(entity: unknown): void;
  closeDeleteModal(): void;
}

/**
 * Stato e apertura/chiusura del modale di conferma eliminazione, comuni a ogni pagina
 */
export function DeletableMixin<TBase extends Constructor>(
  superClass: TBase,
): Constructor<DeletableInterface> & TBase {
  class DeletableClass extends superClass {
    @state() deleteModalOpen = false;
    @state() entityToDelete: unknown = null;
    @state() deleting = false;

    openDeleteModal(entity: unknown): void {
      this.entityToDelete = entity;
      this.deleteModalOpen = true;
    }

    closeDeleteModal(): void {
      this.deleteModalOpen = false;
      this.entityToDelete = null;
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return DeletableClass as any;
}
