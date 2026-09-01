import { LitElement, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { MuseumRoom } from '@artaround/shared';
import '../ui/ui-button';
import '../ui/ui-badge';
import '../ui/ui-icon-button';
import { __ } from '../../services/i18n.service';

/**
 * Room Outline Editor
 *
 * Gestione del contorno (poligono) delle sale — parallela e distinta
 * dall'editor dei marker. Le sale si CREANO in "Modifica Museo" (solo nome);
 * qui si sceglie su quale piano si trovano e si disegna il loro contorno
 * cliccando i vertici sulla piantina, chiudendo la forma sul primo punto.
 */
@customElement('room-outline-editor')
export class RoomOutlineEditor extends LitElement {
  createRenderRoot() {
    return this;
  }

  @property({ type: Array })
  rooms: MuseumRoom[] = [];

  @property({ type: String })
  currentFloorId = '';

  @property({ type: Boolean })
  drawMode = false;

  @property({ type: String })
  drawingRoomId: string | null = null;

  @property({ type: Number })
  pointCount = 0;

  private get roomsForThisFloor(): MuseumRoom[] {
    return this.rooms.filter((room) => !room.floorId || room.floorId === this.currentFloorId);
  }

  private get roomsOnOtherFloors(): MuseumRoom[] {
    return this.rooms.filter((room) => room.floorId && room.floorId !== this.currentFloorId);
  }

  private startDrawing(room: MuseumRoom) {
    this.dispatchEvent(
      new CustomEvent('room-outline-start', {
        detail: room,
        bubbles: true,
        composed: true,
      }),
    );
  }

  private undoPoint() {
    this.dispatchEvent(
      new CustomEvent('room-outline-undo-point', { bubbles: true, composed: true }),
    );
  }

  private finishOutline() {
    this.dispatchEvent(new CustomEvent('room-outline-finish', { bubbles: true, composed: true }));
  }

  private cancelDrawing() {
    this.dispatchEvent(new CustomEvent('room-outline-cancel', { bubbles: true, composed: true }));
  }

  private removeOutline(room: MuseumRoom) {
    this.dispatchEvent(
      new CustomEvent('room-outline-remove', {
        detail: room,
        bubbles: true,
        composed: true,
      }),
    );
  }

  render() {
    return html`
      <div
        class="bg-surface-800 dark:bg-surface-800 rounded-lg overflow-hidden border border-surface-700"
      >
        <div
          class="flex justify-between items-center p-4 bg-surface-700 border-b border-surface-600"
        >
          <h3 class="text-white font-medium text-base m-0">📐 ${__('Sale')}</h3>
        </div>

        ${this.drawMode ? this.renderDrawingPanel() : this.renderRoomsList()}
      </div>
    `;
  }

  private renderDrawingPanel() {
    const room = this.rooms.find((r) => r.id === this.drawingRoomId);

    return html`
      <div class="p-4 space-y-3">
        <p class="text-sm text-surface-300">
          ${__('Contornando')}: <span class="font-semibold text-white">${room?.name}</span>
        </p>
        <p class="text-xs text-surface-400">
          ${__(
            'Clicca sulla piantina per aggiungere un vertice. Clicca di nuovo sul primo punto (bianco) per chiudere la sala.',
          )}
        </p>
        <p class="text-sm text-brand-400 font-medium">${this.pointCount} ${__('punti')}</p>
        <div class="flex flex-wrap gap-2">
          <ui-button
            variant="secondary"
            size="sm"
            .label=${__('Annulla ultimo punto')}
            ?disabled=${this.pointCount === 0}
            @click=${this.undoPoint}
          ></ui-button>
          <ui-button
            variant="primary"
            size="sm"
            .label=${__('Chiudi sala')}
            ?disabled=${this.pointCount < 3}
            @click=${this.finishOutline}
          ></ui-button>
          <ui-button
            variant="ghost"
            size="sm"
            .label=${__('Annulla disegno')}
            @click=${this.cancelDrawing}
          ></ui-button>
        </div>
      </div>
    `;
  }

  private renderRoomsList() {
    const rooms = this.roomsForThisFloor;
    const elsewhere = this.roomsOnOtherFloors;

    if (rooms.length === 0 && elsewhere.length === 0) {
      return html`
        <div class="p-10 text-center text-surface-400">
          <div class="text-5xl mb-3">🏛️</div>
          <p class="m-0">${__('Nessuna sala creata')}</p>
          <p class="text-xs mt-1 m-0">
            ${__('Crea le sale da "Modifica Museo", poi torna qui a contornarle')}
          </p>
        </div>
      `;
    }

    return html`
      <div class="max-h-96 overflow-y-auto">
        ${rooms.map((room) => this.renderRoomRow(room))}
        ${elsewhere.length > 0
          ? html`
              <div class="p-3 text-xs text-surface-500 border-t border-surface-700">
                ${__('Contornate su altri piani')}: ${elsewhere.map((r) => r.name).join(', ')}
              </div>
            `
          : nothing}
      </div>
    `;
  }

  private renderRoomRow(room: MuseumRoom) {
    const isOutlined = Boolean(room.polygon && room.polygon.length > 0);

    return html`
      <div
        class="flex items-center justify-between gap-2 p-3 border-b border-surface-600 last:border-0"
      >
        <div class="min-w-0">
          <p class="text-white text-sm font-medium truncate m-0">${room.name}</p>
          ${isOutlined
            ? html`<ui-badge variant="success" size="sm" .label=${__('Contornata')}></ui-badge>`
            : html`<ui-badge
                variant="secondary"
                size="sm"
                .label=${__('Da contornare')}
              ></ui-badge>`}
        </div>
        <div class="flex items-center gap-1 flex-shrink-0">
          <ui-button
            variant="secondary"
            size="xs"
            .label=${isOutlined ? __('Ridisegna') : __('Disegna contorno')}
            @click=${() => this.startDrawing(room)}
          ></ui-button>
          ${isOutlined
            ? html`
                <ui-icon-button
                  icon="trash"
                  size="sm"
                  variant="danger"
                  .title=${__('Rimuovi contorno')}
                  @click=${() => this.removeOutline(room)}
                ></ui-icon-button>
              `
            : nothing}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'room-outline-editor': RoomOutlineEditor;
  }
}
