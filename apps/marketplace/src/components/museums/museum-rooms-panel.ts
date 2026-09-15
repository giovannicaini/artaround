/*
 * File: /src/components/museums/museum-rooms-panel.ts                                   *
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
import type { MuseumRoom } from '@artaround/shared';
import { __ } from '../../services/i18n.service';
import '../ui/ui-panel-section';
import '../ui/ui-input';
import '../ui/ui-button';
import '../ui/ui-badge';
import '../ui/ui-icon-button';

/**
 * Sezione "Sale" dell'editor museo: crea/rinomina/elimina le sale a cui vanno assegnate le opere.
 */
@customElement('museum-rooms-panel')
export class MuseumRoomsPanel extends LitElement {
  @property({ type: Array }) rooms: MuseumRoom[] = [];
  @property({ type: String }) newRoomTitle = '';
  @property({ type: String }) newRoomSubtitle = '';
  @property({ type: Boolean }) savingRoom = false;
  @property({ type: String }) renamingRoomId: string | null = null;
  @property({ type: String }) renameRoomTitle = '';
  @property({ type: String }) renameRoomSubtitle = '';

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.style.display = 'block';
  }

  private emit(name: string, detail?: Record<string, unknown>) {
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
  }

  render() {
    return html`
      <ui-panel-section
        icon="grid"
        iconColor="text-indigo-500"
        cardPadding="lg"
        .title=${__('Sale')}
        .renderContent=${() => html`
          <div class="space-y-4">
            <p class="text-sm text-surface-500 dark:text-surface-400">
              ${__(
                'Crea qui le sale del museo: un titolo (es. "Sala I") e un sottotitolo facoltativo (es. "Sala del Gladiatore"). Il contorno sulla piantina si disegna dopo, in "Piantina e mappa". Ogni opera va assegnata a una di queste sale.',
              )}
            </p>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
              <ui-input
                .label=${__('Titolo sala')}
                .placeholder=${__('Es. Sala I')}
                .value=${this.newRoomTitle}
                @input-change=${(e: CustomEvent) =>
                  this.emit('new-room-title-change', { value: e.detail.value })}
                @keydown=${(e: KeyboardEvent) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    this.emit('add-room');
                  }
                }}
              ></ui-input>
              <ui-input
                .label=${__('Sottotitolo (facoltativo)')}
                .placeholder=${__('Es. Sala del Gladiatore')}
                .value=${this.newRoomSubtitle}
                @input-change=${(e: CustomEvent) =>
                  this.emit('new-room-subtitle-change', { value: e.detail.value })}
                @keydown=${(e: KeyboardEvent) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    this.emit('add-room');
                  }
                }}
              ></ui-input>
            </div>
            <div class="flex justify-end">
              <ui-button
                type="button"
                variant="primary"
                icon="plus"
                .label=${__('Aggiungi sala')}
                ?disabled=${!this.newRoomTitle.trim()}
                .loading=${this.savingRoom}
                @click=${() => this.emit('add-room')}
              ></ui-button>
            </div>

            ${this.rooms.length === 0
              ? html`
                  <p class="text-sm text-surface-400 dark:text-surface-500 italic">
                    ${__('Nessuna sala creata')}
                  </p>
                `
              : html`
                  <ul
                    class="max-h-[28rem] overflow-y-auto divide-y divide-surface-200 dark:divide-surface-700"
                  >
                    ${this.rooms.map(
                      (room) => html`
                        <li class="flex items-center justify-between gap-3 py-2.5">
                          ${this.renamingRoomId === room.id
                            ? html`
                                <div class="flex-1 grid grid-cols-2 gap-2 items-center">
                                  <ui-input
                                    .label=${__('Titolo')}
                                    .value=${this.renameRoomTitle}
                                    @input-change=${(e: CustomEvent) =>
                                      this.emit('rename-room-title-change', {
                                        value: e.detail.value,
                                      })}
                                  ></ui-input>
                                  <ui-input
                                    .label=${__('Sottotitolo')}
                                    .value=${this.renameRoomSubtitle}
                                    @input-change=${(e: CustomEvent) =>
                                      this.emit('rename-room-subtitle-change', {
                                        value: e.detail.value,
                                      })}
                                  ></ui-input>
                                </div>
                                <ui-icon-button
                                  icon="check"
                                  variant="brand"
                                  .title=${__('Salva')}
                                  .loading=${this.savingRoom}
                                  @click=${() => this.emit('rename-room', { roomId: room.id })}
                                ></ui-icon-button>
                                <ui-icon-button
                                  icon="x"
                                  .title=${__('Annulla')}
                                  @click=${() => this.emit('cancel-rename-room')}
                                ></ui-icon-button>
                              `
                            : html`
                                <div class="min-w-0">
                                  <div class="flex items-center gap-2">
                                    <span class="font-medium text-surface-900 dark:text-white"
                                      >${room.title}</span
                                    >
                                    ${room.polygon && room.polygon.length > 0
                                      ? html`<ui-badge
                                          variant="success"
                                          size="sm"
                                          .label=${__('Contornata')}
                                        ></ui-badge>`
                                      : html`<ui-badge
                                          variant="secondary"
                                          size="sm"
                                          .label=${__('Da contornare')}
                                        ></ui-badge>`}
                                  </div>
                                  ${room.subtitle
                                    ? html`<p
                                        class="text-sm text-surface-500 dark:text-surface-400 truncate m-0"
                                      >
                                        ${room.subtitle}
                                      </p>`
                                    : nothing}
                                </div>
                                <div class="flex items-center gap-1 flex-shrink-0">
                                  <ui-icon-button
                                    icon="edit"
                                    size="sm"
                                    .title=${__('Rinomina')}
                                    @click=${() => this.emit('start-rename-room', { room })}
                                  ></ui-icon-button>
                                  <ui-icon-button
                                    icon="trash"
                                    size="sm"
                                    variant="danger"
                                    .title=${__('Elimina')}
                                    @click=${() => this.emit('delete-room', { room })}
                                  ></ui-icon-button>
                                </div>
                              `}
                        </li>
                      `,
                    )}
                  </ul>
                `}
          </div>
        `}
      ></ui-panel-section>
    `;
  }
}
