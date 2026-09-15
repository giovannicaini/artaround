/*
 * File: /src/components/museums/museum-map-page.ts                                      *
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
import { customElement, property, state } from 'lit/decorators.js';
import { HistorySyncMixin } from '../../base';
import { museumService } from '../../services/museum.service';
import { artworkService } from '../../services/artwork.service';
import { modalService } from '../../services/modal.service';
import { randomPointInPolygon } from '../../utils/polygon-utils';
import {
  MarkerType,
  ArtworkType,
  type Museum,
  type MuseumFloor,
  type MapMarker,
  type MuseumRoom,
  type MapPoint,
  type Artwork,
} from '@artaround/shared';
import './svg-map-editor';
import './floor-manager';
import './marker-editor';
import './room-outline-editor';
import '../ui/ui-button';
import '../ui/ui-card';
import '../ui/ui-image-placeholder';
import '../ui/ui-icon';
import '../ui/ui-info-tip';
import { __ } from '../../services/i18n.service';

/**
 * Pagina Piantina Museo: piani, sale e marker in un unico editor.
 */
@customElement('museum-map-page')
export class MuseumMapPage extends HistorySyncMixin(LitElement) {
  // ─── Ciclo di vita ───────────────────────────────────────────
  createRenderRoot() {
    return this;
  }

  @property({ type: String })
  museumId: string = '';

  // Piano/marker da cui aprire
  @property({ type: String })
  openingFloorId: string = '';

  @property({ type: String })
  openingMarkerId: string = '';

  @state()
  private museum: Museum | null = null;

  @state()
  private floors: MuseumFloor[] = [];

  @state()
  private artworks: Artwork[] = [];

  @state()
  private selectedFloorId: string | null = null;

  @state()
  private selectedMarker: MapMarker | null = null;

  @state()
  private clickPosition: { x: number; y: number } | null = null;

  @state()
  private loading = true;

  @state()
  private saving = false;

  @state()
  private error: string | null = null;

  @state()
  private hasChanges = false;

  @state()
  private isFullscreen = false;

  // Larghezza delle colonne laterali su desktop, trascinabile e ricordata per il prossimo giro.
  @state()
  private leftColWidth = 280;

  @state()
  private rightColWidth = 360;

  private resizingCol: 'left' | 'right' | null = null;
  private resizeStartX = 0;
  private resizeStartWidth = 0;
  private static readonly MIN_COL_WIDTH = 220;
  private static readonly MAX_COL_WIDTH = 560;
  private static readonly COL_WIDTH_STORAGE_KEY = 'museumMapColumnWidths';

  // Sale (gestione parallela ai marker)
  @state()
  private rooms: MuseumRoom[] = [];

  @state()
  private roomDrawMode = false;

  @state()
  private roomDrawPoints: MapPoint[] = [];

  @state()
  private drawingRoomId: string | null = null;

  @state()
  private generatingMarkersRoomId: string | null = null;

  @state()
  private artworksListCollapsed = true;

  // Per ogni sala, quante opere assegnate lì (Artwork.roomId) non hanno
  // ancora un marker su nessun piano — usato dal pulsante "Crea marker opere".
  private get pendingMarkerCountsByRoom(): Record<string, number> {
    const markedWikidataIds = new Set(
      this.floors.flatMap((f) => (f.markers || []).map((m) => m.artworkId).filter(Boolean)),
    );
    const counts: Record<string, number> = {};
    for (const artwork of this.artworks) {
      if (!artwork.roomId || markedWikidataIds.has(artwork.wikidataId)) continue;
      counts[artwork.roomId] = (counts[artwork.roomId] || 0) + 1;
    }
    return counts;
  }

  private hasEmittedStateOnce = false;

  async connectedCallback() {
    super.connectedCallback();
    this.loadColumnWidths();
    await this.loadData();
  }

  disconnectedCallback() {
    window.removeEventListener('pointermove', this.handleColumnResizeMove);
    window.removeEventListener('pointerup', this.handleColumnResizeEnd);
    super.disconnectedCallback();
  }

  private loadColumnWidths() {
    try {
      const stored = localStorage.getItem(MuseumMapPage.COL_WIDTH_STORAGE_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored);
      if (typeof parsed.left === 'number') this.leftColWidth = parsed.left;
      if (typeof parsed.right === 'number') this.rightColWidth = parsed.right;
    } catch {
      // localStorage non disponibile o valore corrotto: restano le larghezze di default
    }
  }

  // ─── Colonne ridimensionabili (desktop) ─────────────────────
  private startColumnResize(side: 'left' | 'right', e: PointerEvent) {
    this.resizingCol = side;
    this.resizeStartX = e.clientX;
    this.resizeStartWidth = side === 'left' ? this.leftColWidth : this.rightColWidth;
    window.addEventListener('pointermove', this.handleColumnResizeMove);
    window.addEventListener('pointerup', this.handleColumnResizeEnd);
    e.preventDefault();
  }

  private handleColumnResizeMove = (e: PointerEvent) => {
    if (!this.resizingCol) return;
    const delta = e.clientX - this.resizeStartX;
    const rawWidth =
      this.resizingCol === 'left' ? this.resizeStartWidth + delta : this.resizeStartWidth - delta;
    const width = Math.min(
      MuseumMapPage.MAX_COL_WIDTH,
      Math.max(MuseumMapPage.MIN_COL_WIDTH, rawWidth),
    );
    if (this.resizingCol === 'left') this.leftColWidth = width;
    else this.rightColWidth = width;
  };

  private handleColumnResizeEnd = () => {
    if (!this.resizingCol) return;
    this.resizingCol = null;
    window.removeEventListener('pointermove', this.handleColumnResizeMove);
    window.removeEventListener('pointerup', this.handleColumnResizeEnd);
    try {
      localStorage.setItem(
        MuseumMapPage.COL_WIDTH_STORAGE_KEY,
        JSON.stringify({ left: this.leftColWidth, right: this.rightColWidth }),
      );
    } catch {
      // localStorage non disponibile: la larghezza scelta vale solo per questa sessione
    }
  };

  updated(changedProps: Map<string, unknown>) {
    if (
      changedProps.has('openingFloorId') &&
      this.openingFloorId &&
      this.openingFloorId !== this.selectedFloorId
    ) {
      const floor = this.floors.find((f) => f.id === this.openingFloorId);
      if (floor) this.selectedFloorId = floor.id;
    }
    if (changedProps.has('openingMarkerId')) {
      const floor = this.floors.find((f) => f.id === (this.selectedFloorId || this.openingFloorId));
      this.selectedMarker = this.openingMarkerId
        ? floor?.markers?.find((m) => m.id === this.openingMarkerId) || null
        : null;
    }

    // selectedFloorId ancora null: primissimo giro di updated(), niente da riportare nell'URL.
    if (
      (changedProps.has('selectedFloorId') || changedProps.has('selectedMarker')) &&
      this.selectedFloorId
    ) {
      const replace = !this.hasEmittedStateOnce;
      this.hasEmittedStateOnce = true;
      this.emitStateChange(replace);
    }
  }

  // Stato granulare (piano + marker selezionati) verso app-root, per la history — stesso schema di artworks-page.ts.
  private emitStateChange(replace = false): void {
    this.emitPageStateChange({
      floorId: this.selectedFloorId || '',
      markerId: this.selectedMarker?.id || '',
      replace,
    });
  }

  // ─── Caricamento dati ────────────────────────────────────────
  private async loadData() {
    if (!this.museumId) {
      this.error = __('ID museo non specificato');
      this.loading = false;
      return;
    }

    try {
      this.loading = true;
      this.error = null;

      // Carica dettagli museo, piani e sale
      const [museum, floors, artworksResponse, rooms] = await Promise.all([
        museumService.getMuseum(this.museumId),
        museumService.getFloors(this.museumId),
        artworkService.getArtworksByMuseum(this.museumId),
        museumService.getRooms(this.museumId),
      ]);

      this.museum = museum;
      this.floors = floors || [];
      this.artworks = artworksResponse || [];
      this.rooms = rooms || [];

      // Seleziona il piano indicato da fuori (deep-link/history), altrimenti il primo di default.
      if (this.floors.length > 0 && !this.selectedFloorId) {
        const opening =
          this.openingFloorId && this.floors.find((f) => f.id === this.openingFloorId);
        this.selectedFloorId = opening ? opening.id : this.floors[0].id;
      }
      if (this.openingMarkerId && !this.selectedMarker) {
        const floor = this.floors.find((f) => f.id === this.selectedFloorId);
        this.selectedMarker = floor?.markers?.find((m) => m.id === this.openingMarkerId) || null;
      }
    } catch (err) {
      console.error('Error loading museum data:', err);
      this.error = __('Errore nel caricamento dei dati del museo');
    } finally {
      this.loading = false;
    }
  }

  get currentFloor(): MuseumFloor | null {
    return this.floors.find((f) => f.id === this.selectedFloorId) || null;
  }

  get currentMarkers(): MapMarker[] {
    return this.currentFloor?.markers || [];
  }

  // ─── Render principale ────────────────────────────────────────
  render() {
    if (this.loading) {
      return html`
        <div
          class="min-h-screen bg-surface-50 dark:bg-surface-950 flex items-center justify-center"
        >
          <div class="text-center">
            <div class="animate-spin text-4xl mb-4">🔄</div>
            <p class="text-surface-500 dark:text-surface-400">${__('Caricamento...')}</p>
          </div>
        </div>
      `;
    }

    if (this.error) {
      return html`
        <div
          class="min-h-screen bg-surface-50 dark:bg-surface-950 flex items-center justify-center"
        >
          <div class="text-center">
            <div class="text-4xl mb-4">❌</div>
            <p class="text-danger-600 dark:text-danger-400">${this.error}</p>
            <ui-button
              variant="primary"
              .label=${__('Riprova')}
              class="mt-4"
              @click=${this.loadData}
            ></ui-button>
          </div>
        </div>
      `;
    }

    return html`
      <div
        class="min-h-screen bg-surface-50 dark:bg-surface-950 ${this.isFullscreen
          ? 'fixed inset-0 z-50 overflow-y-auto'
          : ''}"
      >
        <div
          class="flex flex-wrap items-start justify-between gap-3 p-4 bg-white dark:bg-surface-900 border-b border-surface-200 dark:border-surface-800"
        >
          <div class="flex items-start gap-4">
            <div>
              <h1
                class="flex items-center gap-1.5 flex-wrap text-xl font-semibold text-surface-900 dark:text-white m-0"
              >
                🗺️ ${__('Gestione Mappe')}
                <ui-info-tip
                  variant="inline"
                  text=${__(
                    'Piani, sale e marker sono tre cose distinte: i piani (a sinistra) sono le piantine caricate; le sale si creano in "Modifica Museo" e qui si contornano sulla piantina; i marker (a destra) sono i singoli punti — opere o servizi. "Salva Tutto" salva solo i marker: piani e sale si salvano già da soli quando li aggiungi o modifichi.',
                  )}
                ></ui-info-tip>
              </h1>
              <p class="text-sm text-surface-500 dark:text-surface-400 m-0">
                ${this.museum?.name || __('Museo')}
              </p>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-3">
            ${this.hasChanges
              ? html`
                  <span class="text-warning-600 dark:text-warning-400 text-sm"
                    >● ${__('Modifiche non salvate')}</span
                  >
                `
              : nothing}
            <ui-button
              variant="secondary"
              .label=${this.isFullscreen ? `⬜ ${__('Riduci')}` : `⛶ ${__('Schermo intero')}`}
              @click=${() => (this.isFullscreen = !this.isFullscreen)}
            ></ui-button>
            <ui-button
              variant="primary"
              .label=${`💾 ${__('Salva Tutto')}`}
              ?loading=${this.saving}
              ?disabled=${!this.hasChanges}
              @click=${this.saveAll}
            ></ui-button>
          </div>
        </div>
        <div
          class="grid grid-cols-1 museum-map-columns gap-4 p-4"
          style="min-height: calc(100vh - 80px); --map-left-w: ${this
            .leftColWidth}px; --map-right-w: ${this.rightColWidth}px;"
        >
          <div class="space-y-4 overflow-y-auto order-2 lg:order-1">
            <floor-manager
              class="block"
              .floors=${this.floors}
              .selectedFloorId=${this.selectedFloorId}
              @floor-select=${this.handleFloorSelect}
              @floor-add=${this.handleFloorAdd}
              @floor-update=${this.handleFloorUpdate}
              @floor-delete=${this.handleFloorDelete}
            ></floor-manager>

            <room-outline-editor
              class="block"
              .rooms=${this.rooms}
              .currentFloorId=${this.selectedFloorId || ''}
              .drawMode=${this.roomDrawMode}
              .drawingRoomId=${this.drawingRoomId}
              .pointCount=${this.roomDrawPoints.length}
              .pendingCounts=${this.pendingMarkerCountsByRoom}
              .generatingMarkersRoomId=${this.generatingMarkersRoomId}
              @room-outline-start=${this.handleRoomOutlineStart}
              @room-outline-undo-point=${this.handleRoomOutlineUndoPoint}
              @room-outline-finish=${this.handleRoomOutlineFinish}
              @room-outline-cancel=${this.handleRoomOutlineCancel}
              @room-outline-remove=${this.handleRoomOutlineRemove}
              @room-generate-markers=${this.handleGenerateRoomMarkers}
            ></room-outline-editor>
            <div
              class="bg-white dark:bg-surface-800 rounded-lg overflow-hidden border border-surface-200 dark:border-surface-700"
            >
              <button
                type="button"
                class="w-full flex justify-between items-center p-4 hover:bg-surface-50 dark:hover:bg-surface-700 transition-colors ${this
                  .artworksListCollapsed
                  ? ''
                  : 'border-b border-surface-200 dark:border-surface-600'}"
                @click=${() => (this.artworksListCollapsed = !this.artworksListCollapsed)}
              >
                <h3 class="text-surface-900 dark:text-white font-medium text-base m-0">
                  🖼️ ${__('Opere')} (${this.artworks.length})
                </h3>
                <ui-icon
                  name=${this.artworksListCollapsed ? 'chevron-down' : 'chevron-up'}
                  size="sm"
                  class="text-surface-400"
                ></ui-icon>
              </button>
              ${this.artworksListCollapsed
                ? nothing
                : html`
                    <div class="max-h-[32rem] overflow-y-auto">
                      ${this.artworks.length > 0
                        ? this.artworks.map((artwork) => this.renderArtworkItem(artwork))
                        : html`
                            <div class="p-4 text-center text-surface-500 dark:text-surface-400">
                              <p class="m-0">${__('Nessuna opera nel museo')}</p>
                            </div>
                          `}
                    </div>
                  `}
            </div>
          </div>
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label=${__('Ridimensiona colonna sinistra')}
            class="hidden lg:block lg:order-2 w-1.5 shrink-0 cursor-col-resize rounded-full bg-surface-200 dark:bg-surface-700 hover:bg-brand-400 dark:hover:bg-brand-500 transition-colors"
            @pointerdown=${(e: PointerEvent) => this.startColumnResize('left', e)}
          ></div>
          <div class="order-1 lg:order-3 min-w-0">
            <svg-map-editor
              .floors=${this.floors}
              .selectedFloorId=${this.selectedFloorId}
              .selectedMarkerId=${this.selectedMarker?.id || null}
              .artworks=${this.artworks}
              .rooms=${this.rooms}
              .selectedRoomId=${this.drawingRoomId}
              .roomDrawMode=${this.roomDrawMode}
              .roomDrawPoints=${this.roomDrawPoints}
              editMode
              @floor-select=${(e: CustomEvent) => (this.selectedFloorId = e.detail.floorId)}
              @map-click=${this.handleMapClick}
              @marker-select=${this.handleMarkerSelect}
              @marker-drag=${this.handleMarkerDrag}
              @room-point-add=${this.handleRoomPointAdd}
            ></svg-map-editor>
          </div>
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label=${__('Ridimensiona colonna destra')}
            class="hidden lg:block lg:order-4 w-1.5 shrink-0 cursor-col-resize rounded-full bg-surface-200 dark:bg-surface-700 hover:bg-brand-400 dark:hover:bg-brand-500 transition-colors"
            @pointerdown=${(e: PointerEvent) => this.startColumnResize('right', e)}
          ></div>
          <div class="overflow-y-auto order-3 lg:order-5">
            <marker-editor
              .markers=${this.currentMarkers}
              .artworks=${this.artworks}
              .currentFloorId=${this.selectedFloorId || ''}
              .clickPosition=${this.clickPosition}
              .selectedMarker=${this.selectedMarker}
              @marker-add=${this.handleMarkerAdd}
              @marker-select=${this.handleMarkerSelect}
              @marker-delete=${this.handleMarkerDelete}
              @marker-update=${this.handleMarkerUpdate}
            ></marker-editor>
          </div>
        </div>
      </div>
    `;
  }

  // ─── Helper di render ──────────────────────────────────────
  private renderArtworkItem(artwork: Artwork) {
    const hasPosition = this.floors.some((f) =>
      f.markers?.some((m) => m.artworkId === artwork.wikidataId),
    );

    return html`
      <div
        class="flex items-center gap-3 p-3 border-b border-surface-100 dark:border-surface-600 hover:bg-surface-50 dark:hover:bg-surface-700 transition-colors"
      >
        <div
          class="w-10 h-10 rounded bg-surface-100 dark:bg-surface-600 overflow-hidden flex-shrink-0 relative"
        >
          ${artwork.image
            ? html`
                <img
                  src=${artwork.image}
                  alt=""
                  class="w-full h-full object-cover"
                  @error=${(e: Event) => {
                    const img = e.target as HTMLImageElement;
                    img.style.display = 'none';
                    img.parentElement
                      ?.querySelector('ui-image-placeholder')
                      ?.removeAttribute('hidden');
                  }}
                />
                <ui-image-placeholder
                  type="artwork"
                  size="xs"
                  hidden
                  class="absolute inset-0"
                ></ui-image-placeholder>
              `
            : html`<ui-image-placeholder type="artwork" size="xs"></ui-image-placeholder>`}
        </div>
        <div class="flex-1 min-w-0">
          <div class="text-surface-900 dark:text-white text-sm font-medium truncate">
            ${artwork.title}
          </div>
          <div class="text-surface-500 dark:text-surface-400 text-xs">
            ${artwork.author || __('Artista sconosciuto')}
          </div>
        </div>
        <div class="flex-shrink-0">
          ${hasPosition
            ? html`<span class="text-success-600 dark:text-success-400 text-xs">📍</span>`
            : html`<span class="text-surface-400 dark:text-surface-500 text-xs">—</span>`}
        </div>
      </div>
    `;
  }

  // ─── Azioni (piani / marker / salvataggio) ──────────────────
  private handleFloorSelect(e: CustomEvent) {
    const floor = e.detail as MuseumFloor;
    this.selectedFloorId = floor.id;
    this.selectedMarker = null;
    this.clickPosition = null;
  }

  private async handleFloorAdd(e: CustomEvent) {
    const floorData = e.detail as MuseumFloor;

    try {
      const result = await museumService.addFloor(this.museumId, floorData);
      if (result.data) {
        this.floors = [...this.floors, result.data];
        this.selectedFloorId = result.data.id;
        // Non resettare hasChanges: potrebbero esserci marker non ancora salvati su altri piani.
      } else {
        await modalService.error(result.error || __("Errore durante l'aggiunta del piano"));
      }
    } catch (err) {
      console.error('Error adding floor:', err);
      await modalService.error(__("Errore di connessione durante l'aggiunta del piano"));
    }
  }

  private async handleFloorUpdate(e: CustomEvent) {
    const floorData = e.detail as MuseumFloor;

    try {
      await museumService.updateFloor(this.museumId, floorData.id, floorData);
      // Aggiorna solo i campi del form
      this.floors = this.floors.map((f) =>
        f.id === floorData.id
          ? { ...floorData, markers: f.markers, connections: f.connections }
          : f,
      );
    } catch (err) {
      console.error('Error updating floor:', err);
      await modalService.error(__("Errore durante l'aggiornamento del piano"));
    }
  }

  private async handleFloorDelete(e: CustomEvent) {
    const floor = e.detail as MuseumFloor;

    try {
      await museumService.deleteFloor(this.museumId, floor.id);
      this.floors = this.floors.filter((f) => f.id !== floor.id);

      if (this.selectedFloorId === floor.id) {
        this.selectedFloorId = this.floors[0]?.id || null;
      }
    } catch (err) {
      console.error('Error deleting floor:', err);
      await modalService.error(__("Errore durante l'eliminazione del piano"));
    }
  }

  private handleMapClick(e: CustomEvent) {
    const { x, y } = e.detail;
    this.clickPosition = { x, y };
    this.selectedMarker = null;
  }

  private handleMarkerSelect(e: CustomEvent) {
    this.selectedMarker = e.detail as MapMarker;
    this.clickPosition = null;
  }

  private async handleMarkerAdd(e: CustomEvent) {
    const marker = e.detail as MapMarker;

    if (!this.selectedFloorId) return;

    try {
      await museumService.addMarker(this.museumId, this.selectedFloorId, marker);

      // Aggiorna lo stato locale
      this.floors = this.floors.map((f) => {
        if (f.id === this.selectedFloorId) {
          return {
            ...f,
            markers: [...(f.markers || []), marker],
          };
        }
        return f;
      });

      this.clickPosition = null;
    } catch (err) {
      console.error('Error adding marker:', err);
      await modalService.error(__("Errore durante l'aggiunta del marker"));
    }
  }

  private handleMarkerDrag(e: CustomEvent) {
    const { markerId, x, y } = e.detail;

    // Aggiorna subito lo stato locale per un drag fluido
    this.floors = this.floors.map((f) => {
      if (f.id === this.selectedFloorId) {
        return {
          ...f,
          markers: f.markers?.map((m) => (m.id === markerId ? { ...m, x, y } : m)),
        };
      }
      return f;
    });

    this.hasChanges = true;
  }

  private handleMarkerUpdate(e: CustomEvent) {
    const updatedMarker = e.detail as MapMarker;

    // Aggiorna lo stato locale
    this.floors = this.floors.map((f) => {
      if (f.id === this.selectedFloorId) {
        return {
          ...f,
          markers: f.markers?.map((m) => (m.id === updatedMarker.id ? updatedMarker : m)),
        };
      }
      return f;
    });

    // Update selected marker
    this.selectedMarker = updatedMarker;
    this.hasChanges = true;
  }

  private async handleMarkerDelete(e: CustomEvent) {
    const marker = e.detail as MapMarker;

    if (!this.selectedFloorId) return;

    try {
      await museumService.deleteMarker(this.museumId, this.selectedFloorId, marker.id);

      // Aggiorna lo stato locale
      this.floors = this.floors.map((f) => {
        if (f.id === this.selectedFloorId) {
          return {
            ...f,
            markers: f.markers?.filter((m) => m.id !== marker.id),
          };
        }
        return f;
      });

      if (this.selectedMarker?.id === marker.id) {
        this.selectedMarker = null;
      }
    } catch (err) {
      console.error('Error deleting marker:', err);
      await modalService.error(__("Errore durante l'eliminazione del marker"));
    }
  }

  // ─── Azioni (sale / contorno) ───────────────────────────
  private readonly CLOSE_POLYGON_THRESHOLD_PX = 12;

  private handleRoomOutlineStart(e: CustomEvent) {
    const room = e.detail as MuseumRoom;
    this.roomDrawMode = true;
    this.drawingRoomId = room.id;
    // sostituisce l'eventuale contorno precedente, mai lo modifica.
    this.roomDrawPoints = [];
    this.selectedMarker = null;
    this.clickPosition = null;
  }

  private handleRoomPointAdd(e: CustomEvent) {
    const { x, y } = e.detail;
    const first = this.roomDrawPoints[0];

    if (first && this.roomDrawPoints.length >= 3) {
      const distance = Math.hypot(x - first.x, y - first.y);
      if (distance <= this.CLOSE_POLYGON_THRESHOLD_PX) {
        this.handleRoomOutlineFinish();
        return;
      }
    }

    this.roomDrawPoints = [...this.roomDrawPoints, { x, y }];
  }

  private handleRoomOutlineUndoPoint() {
    this.roomDrawPoints = this.roomDrawPoints.slice(0, -1);
  }

  private handleRoomOutlineCancel() {
    this.roomDrawMode = false;
    this.drawingRoomId = null;
    this.roomDrawPoints = [];
  }

  private async handleRoomOutlineFinish() {
    if (!this.drawingRoomId || !this.selectedFloorId || this.roomDrawPoints.length < 3) return;

    // Punto di partenza = punto di arrivo: chiudiamo esplicitamente il poligono.
    const first = this.roomDrawPoints[0];
    const closedPolygon = [...this.roomDrawPoints, { x: first.x, y: first.y }];

    try {
      const result = await museumService.outlineRoom(
        this.museumId,
        this.drawingRoomId,
        this.selectedFloorId,
        closedPolygon,
      );
      if (result.data) {
        this.rooms = this.rooms.map((r) => (r.id === result.data!.id ? result.data! : r));
      } else {
        await modalService.error(result.error || __('Errore durante il salvataggio del contorno'));
      }
    } catch (err) {
      console.error('Error saving room outline:', err);
      await modalService.error(__('Errore di connessione durante il salvataggio del contorno'));
    } finally {
      this.roomDrawMode = false;
      this.drawingRoomId = null;
      this.roomDrawPoints = [];
    }
  }

  private async handleRoomOutlineRemove(e: CustomEvent) {
    const room = e.detail as MuseumRoom;

    const confirmed = await modalService.confirm({
      title: __('Rimuovi contorno'),
      message: `${__('Rimuovere il contorno di')} "${room.title}"? ${__('La sala resterà, senza forma sulla piantina.')}`,
      confirmLabel: __('Rimuovi'),
      variant: 'danger',
    });
    if (!confirmed) return;

    try {
      const ok = await museumService.removeRoomOutline(this.museumId, room.id);
      if (ok) {
        this.rooms = this.rooms.map((r) =>
          r.id === room.id ? { ...r, floorId: undefined, polygon: undefined } : r,
        );
      } else {
        await modalService.error(__('Errore durante la rimozione del contorno'));
      }
    } catch (err) {
      console.error('Error removing room outline:', err);
      await modalService.error(__('Errore di connessione durante la rimozione del contorno'));
    }
  }

  private markerTypeForArtwork(artwork: Artwork): MarkerType {
    switch (artwork.artworkType) {
      case ArtworkType.Sculpture:
        return MarkerType.SCULPTURE;
      case ArtworkType.Painting:
      case ArtworkType.Drawing:
      case ArtworkType.Print:
      case ArtworkType.Photograph:
        return MarkerType.PAINTING;
      default:
        return MarkerType.ARTWORK;
    }
  }

  // Genera i marker per tutte le opere sprovviste e permette quindi di creare sale
  private async handleGenerateRoomMarkers(e: CustomEvent) {
    const room = e.detail as MuseumRoom;
    if (!room.floorId || !room.polygon || room.polygon.length < 3) return;

    const floor = this.floors.find((f) => f.id === room.floorId);
    if (!floor) return;

    const markedWikidataIds = new Set(
      this.floors.flatMap((f) => (f.markers || []).map((m) => m.artworkId).filter(Boolean)),
    );
    const pendingArtworks = this.artworks.filter(
      (a) => a.roomId === room.id && a.wikidataId && !markedWikidataIds.has(a.wikidataId),
    );
    if (pendingArtworks.length === 0) return;

    this.generatingMarkersRoomId = room.id;
    try {
      // Distribuiti a caso dentro il contorno della sala, tenuti a distanza
      // minima l'uno dall'altro perché non finiscano sovrapposti.
      const placedPoints: MapPoint[] = [];
      const newMarkers: MapMarker[] = pendingArtworks.map((artwork) => {
        const point = randomPointInPolygon(room.polygon!, placedPoints);
        placedPoints.push(point);
        return {
          id: `marker-${artwork.wikidataId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          floorId: room.floorId!,
          x: point.x,
          y: point.y,
          type: this.markerTypeForArtwork(artwork),
          label: artwork.title,
          artworkId: artwork.wikidataId,
          isVisible: true,
        };
      });

      const allMarkers = [...(floor.markers || []), ...newMarkers];
      const saved = await museumService.updateMarkers(this.museumId, room.floorId, allMarkers);

      if (saved.length !== allMarkers.length) {
        await modalService.error(__('Errore durante la creazione dei marker'));
        return;
      }

      this.floors = this.floors.map((f) => (f.id === room.floorId ? { ...f, markers: saved } : f));

      await modalService.success(`${newMarkers.length} ${__('marker creati per')} "${room.title}"`);
    } catch (err) {
      console.error('Error generating room markers:', err);
      await modalService.error(__('Errore di connessione durante la creazione dei marker'));
    } finally {
      this.generatingMarkersRoomId = null;
    }
  }

  private async saveAll() {
    if (!this.hasChanges) return;

    try {
      this.saving = true;

      // Salva tutti i piani con i loro marker
      for (const floor of this.floors) {
        if (floor.markers && floor.markers.length > 0) {
          await museumService.updateMarkers(this.museumId, floor.id, floor.markers);
        }
      }

      this.hasChanges = false;
      await modalService.success(__('Modifiche salvate con successo!'));
    } catch (err) {
      console.error('Error saving:', err);
      await modalService.error(__('Errore durante il salvataggio'));
    } finally {
      this.saving = false;
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'museum-map-page': MuseumMapPage;
  }
}
