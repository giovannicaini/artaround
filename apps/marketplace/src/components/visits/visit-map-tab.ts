/*
 * File: /src/components/visits/visit-map-tab.ts                                         *
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
import type { Artwork, MuseumFloor } from '@artaround/shared';
import { __ } from '../../services/i18n.service';
import { renderInlineEmptyState } from '../../utils/inline-empty-state';
import '../ui/ui-loading';
import '../ui/ui-alert';
import '../ui/ui-select';
import '../ui/ui-button';
import '../museums/svg-map-editor';

export type RoutePoint = { x: number; y: number; floorId: string; order: number };

/**
 * Tab "Mappa" del visit-editor: costruzione del percorso sulla piantina del museo.
 */
@customElement('visit-map-tab')
export class VisitMapTab extends LitElement {
  @property({ type: Boolean }) loadingFloors = false;
  @property({ type: Array }) floors: MuseumFloor[] = [];
  @property({ type: Array }) artworks: Artwork[] = [];
  @property({ type: String }) floorId = '';
  @property({ type: Array }) routePoints: RoutePoint[] = [];
  @property({ type: Number }) stepsCount = 0;

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.style.display = 'block';
  }

  render() {
    if (this.loadingFloors) {
      return html`<ui-loading .text=${__('Caricamento piantina...')}></ui-loading>`;
    }

    if (this.floors.length === 0) {
      return renderInlineEmptyState({
        icon: 'location',
        text: __('Nessuna piantina disponibile per questo museo'),
      });
    }

    const floorId = this.floorId || this.floors[0].id;
    const floorPoints = this.routePoints.filter((p) => p.floorId === floorId);

    return html`
      <div class="space-y-4">
        <ui-alert
          variant="info"
          .message=${__(
            "Costruisci il percorso direttamente sulla mappa: clicca un'opera per aggiungerla come prossima tappa, clicca un punto vuoto per inserire una svolta. Per cambiare piano, clicca le scale o l'ascensore per agganciarci il percorso, poi seleziona l'altro piano dal menu qui sotto e clicca le scale/ascensore corrispondente per continuare da lì. Le tappe vengono numerate nell'ordine dei click; puoi riordinarle o rimuoverle anche dalla tab Percorso.",
          )}
        ></ui-alert>

        <div class="flex items-end justify-between gap-3 flex-wrap">
          ${this.floors.length > 1
            ? html`
                <ui-select
                  .label=${__('Piano')}
                  .value=${floorId}
                  .options=${this.floors.map((f) => ({ value: f.id, label: f.name }))}
                  @select-change=${(e: CustomEvent) =>
                    this.dispatchEvent(
                      new CustomEvent('floor-change', {
                        detail: { floorId: e.detail.value },
                        bubbles: true,
                        composed: true,
                      }),
                    )}
                ></ui-select>
              `
            : html`<div></div>`}

          <ui-button
            type="button"
            variant="secondary"
            size="sm"
            icon="arrow-left"
            .label=${__('Annulla ultima tappa')}
            ?disabled=${this.stepsCount === 0}
            @click=${() =>
              this.dispatchEvent(
                new CustomEvent('undo-last-step', { bubbles: true, composed: true }),
              )}
          ></ui-button>
        </div>

        <svg-map-editor
          .floors=${this.floors}
          .selectedFloorId=${floorId}
          .artworks=${this.artworks}
          .routeStops=${floorPoints}
          .editMode=${false}
          routeBuildMode
        ></svg-map-editor>
        <!-- route-point-add/route-marker-add arrivano già a visit-editor (che li
             ascolta su <visit-map-tab>) per bubbling naturale: nessuno di questi
             componenti usa lo shadow DOM. Ridispatcharli qui li faceva arrivare
             due volte, aggiungendo ogni tappa due volte. -->

        ${this.routePoints.length < 2
          ? html`
              <ui-alert
                variant="warning"
                .message=${__(
                  'Aggiungi almeno due tappe posizionate sulla mappa (opere o svolte) per vedere il percorso disegnato.',
                )}
              ></ui-alert>
            `
          : nothing}
      </div>
    `;
  }
}
