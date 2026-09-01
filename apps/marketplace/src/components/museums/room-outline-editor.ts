import { LitElement, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { MuseumRoom } from '@artaround/shared';
import '../ui/ui-badge';
import '../ui/ui-icon-button';
import '../ui/ui-icon';
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

  // Numero di opere di ciascuna sala che non hanno ancora un marker sulla
  // piantina (calcolato dal genitore, che ha sia le opere sia i marker).
  @property({ type: Object })
  pendingCounts: Record<string, number> = {};

  @property({ type: String })
  generatingMarkersRoomId: string | null = null;

  @state()
  private collapsed = true;

  private roomLabel(room: MuseumRoom): string {
    return room.subtitle ? `${room.title} — ${room.subtitle}` : room.title;
  }

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

  private generateMarkers(room: MuseumRoom) {
    this.dispatchEvent(
      new CustomEvent('room-generate-markers', {
        detail: room,
        bubbles: true,
        composed: true,
      }),
    );
  }

  render() {
    // In fase di disegno il pannello resta sempre aperto: non ha senso
    // poterlo nascondere mentre si sta contornando una sala.
    const showContent = this.drawMode || !this.collapsed;

    return html`
      <div
        class="bg-surface-800 dark:bg-surface-800 rounded-lg overflow-hidden border border-surface-700"
      >
        <button
          type="button"
          class="w-full flex justify-between items-center p-4 bg-surface-700 border-b border-surface-600 ${showContent
            ? ''
            : 'border-b-0'}"
          @click=${() => (this.collapsed = !this.collapsed)}
        >
          <h3 class="text-white font-medium text-base m-0">📐 ${__('Sale')}</h3>
          <ui-icon
            name=${this.collapsed ? 'chevron-down' : 'chevron-up'}
            size="sm"
            class="text-surface-400"
          ></ui-icon>
        </button>

        ${showContent
          ? this.drawMode
            ? this.renderDrawingPanel()
            : this.renderRoomsList()
          : nothing}
      </div>
    `;
  }

  private renderDrawingPanel() {
    const room = this.rooms.find((r) => r.id === this.drawingRoomId);

    return html`
      <div class="p-4 space-y-3">
        <p class="text-sm text-surface-300">
          ${__('Contornando')}:
          <span class="font-semibold text-white">${room ? this.roomLabel(room) : ''}</span>
        </p>
        <p class="text-xs text-surface-400">
          ${__(
            'Clicca sulla piantina per aggiungere un vertice. Clicca di nuovo sul primo punto (bianco) per chiudere la sala.',
          )}
        </p>
        <p class="text-xs text-surface-400">
          ${__('Tieni premuto Ctrl (o ⌘) per allineare il segmento in orizzontale o verticale.')}
        </p>
        <p class="text-sm text-brand-400 font-medium">${this.pointCount} ${__('punti')}</p>
        <div class="flex flex-wrap gap-1">
          <ui-icon-button
            icon="arrow-left"
            .title=${__('Annulla ultimo punto')}
            ?disabled=${this.pointCount === 0}
            @click=${this.undoPoint}
          ></ui-icon-button>
          <ui-icon-button
            icon="check"
            variant="brand"
            .title=${__('Chiudi sala')}
            ?disabled=${this.pointCount < 3}
            @click=${this.finishOutline}
          ></ui-icon-button>
          <ui-icon-button
            icon="x"
            variant="danger"
            .title=${__('Annulla disegno')}
            @click=${this.cancelDrawing}
          ></ui-icon-button>
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
      <div class="max-h-[32rem] overflow-y-auto">
        ${rooms.map((room) => this.renderRoomRow(room))}
        ${elsewhere.length > 0
          ? html`
              <div class="p-3 text-xs text-surface-500 border-t border-surface-700">
                ${__('Contornate su altri piani')}:
                ${elsewhere.map((r) => this.roomLabel(r)).join(', ')}
              </div>
            `
          : nothing}
      </div>
    `;
  }

  private renderRoomRow(room: MuseumRoom) {
    const isOutlined = Boolean(room.polygon && room.polygon.length > 0);
    const pending = this.pendingCounts[room.id] || 0;
    const isGenerating = this.generatingMarkersRoomId === room.id;

    return html`
      <div class="p-3 border-b border-surface-600 last:border-0 space-y-2">
        <div class="flex items-center justify-between gap-2">
          <div class="min-w-0">
            <p class="text-white text-sm font-medium truncate m-0">${room.title}</p>
            ${room.subtitle
              ? html`<p class="text-surface-400 text-xs truncate m-0">${room.subtitle}</p>`
              : nothing}
            ${isOutlined
              ? html`<ui-badge variant="success" size="sm" .label=${__('Contornata')}></ui-badge>`
              : html`<ui-badge
                  variant="secondary"
                  size="sm"
                  .label=${__('Da contornare')}
                ></ui-badge>`}
          </div>
          <div class="flex items-center gap-1 flex-shrink-0">
            <ui-icon-button
              icon="edit"
              size="sm"
              .title=${isOutlined ? __('Ridisegna') : __('Disegna contorno')}
              @click=${() => this.startDrawing(room)}
            ></ui-icon-button>
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

        ${isOutlined && pending > 0
          ? html`
              <div class="flex items-center gap-1.5">
                <ui-icon-button
                  icon="sparkles"
                  size="sm"
                  variant="brand"
                  .title=${`${__('Crea marker opere')} (${pending})`}
                  ?disabled=${isGenerating}
                  @click=${() => this.generateMarkers(room)}
                ></ui-icon-button>
                <ui-badge variant="secondary" size="sm" .label=${`${pending}`}></ui-badge>
              </div>
            `
          : nothing}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'room-outline-editor': RoomOutlineEditor;
  }
}
