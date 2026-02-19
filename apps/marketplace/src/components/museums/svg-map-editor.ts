import { LitElement, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import type { MuseumFloor, MapMarker, Artwork } from '@artaround/shared';
import '../ui/ui-image-placeholder';

export interface MarkerDragEvent {
  markerId: string;
  x: number;
  y: number;
}

export interface MapClickEvent {
  x: number;
  y: number;
}

/**
 * SVG Map Editor Component
 *
 * Allows viewing and editing museum floor maps with draggable markers
 */
@customElement('svg-map-editor')
export class SvgMapEditor extends LitElement {
  createRenderRoot() {
    return this;
  }

  @property({ type: Array })
  floors: MuseumFloor[] = [];

  @property({ type: String })
  selectedFloorId: string | null = null;

  @property({ type: Boolean })
  editMode = true;

  @property({ type: String })
  selectedMarkerId: string | null = null;

  @property({ type: Array })
  artworks: Artwork[] = [];

  @state()
  private zoom = 1;

  @state()
  private panX = 0;

  @state()
  private panY = 0;

  @state()
  private isDragging = false;

  @state()
  private dragStartX = 0;

  @state()
  private dragStartY = 0;

  // Marker type icons
  private markerIcons: Record<string, string> = {
    artwork: '🖼️',
    sculpture: '🗿',
    painting: '🎨',
    entrance: '🚪',
    exit: '🚶',
    emergency_exit: '🚨',
    info_point: 'ℹ️',
    elevator: '🛗',
    stairs: '🪜',
    escalator: '📶',
    ramp: '♿',
    toilette: '🚻',
    accessible_toilette: '♿',
    bar: '☕',
    restaurant: '🍽️',
    shop: '🛒',
    cloakroom: '🧥',
    locker: '🔐',
    room: '🚪',
    gallery: '🏛️',
    bench: '🪑',
    audio_guide: '🎧',
    wifi: '📶',
  };

  get currentFloor(): MuseumFloor | null {
    return this.floors.find((f) => f.id === this.selectedFloorId) || this.floors[0] || null;
  }

  render() {
    const floor = this.currentFloor;

    return html`
      <div class="bg-surface-900 rounded-lg overflow-hidden border border-surface-700">
        <!-- Toolbar -->
        <div
          class="flex items-center justify-between p-3 bg-surface-800 border-b border-surface-700"
        >
          <!-- Floor Tabs -->
          <div class="flex gap-1">
            ${this.floors.map(
              (f) => html`
                <button
                  class="px-3 py-1.5 rounded text-sm font-medium transition-colors ${this
                    .selectedFloorId === f.id ||
                  (!this.selectedFloorId && f === this.floors[0])
                    ? 'bg-brand-500 text-white'
                    : 'bg-surface-700 text-surface-300 hover:bg-surface-600'}"
                  @click=${() => this.selectFloor(f.id)}
                >
                  ${f.name}
                </button>
              `,
            )}
          </div>

          <!-- Zoom Controls -->
          <div class="flex items-center gap-2">
            <button
              class="w-8 h-8 flex items-center justify-center rounded bg-surface-700 text-white hover:bg-surface-600 transition-colors"
              @click=${() => this.setZoom(this.zoom - 0.25)}
              ?disabled=${this.zoom <= 0.25}
            >
              ➖
            </button>
            <span class="text-surface-300 text-sm w-16 text-center"
              >${Math.round(this.zoom * 100)}%</span
            >
            <button
              class="w-8 h-8 flex items-center justify-center rounded bg-surface-700 text-white hover:bg-surface-600 transition-colors"
              @click=${() => this.setZoom(this.zoom + 0.25)}
              ?disabled=${this.zoom >= 3}
            >
              ➕
            </button>
            <button
              class="w-8 h-8 flex items-center justify-center rounded bg-surface-700 text-white hover:bg-surface-600 transition-colors ml-2"
              @click=${this.resetView}
              title="Reset View"
            >
              🔄
            </button>
          </div>
        </div>

        <!-- Map Container -->
        <div
          class="relative overflow-hidden bg-surface-950 cursor-grab"
          style="height: 500px;"
          @mousedown=${this.handleMouseDown}
          @mousemove=${this.handleMouseMove}
          @mouseup=${this.handleMouseUp}
          @mouseleave=${this.handleMouseUp}
          @wheel=${this.handleWheel}
          @contextmenu=${(e: Event) => e.preventDefault()}
        >
          ${floor
            ? html`
                <div
                  class="absolute origin-top-left transition-transform duration-75"
                  style="transform: translate(${this.panX}px, ${this.panY}px) scale(${this.zoom});"
                >
                  <!-- SVG Map -->
                  <div class="map-svg-container" @click=${this.handleMapClick}>
                    ${unsafeHTML(floor.svgContent)}
                  </div>

                  <!-- Markers Overlay -->
                  <div class="absolute inset-0 pointer-events-none">
                    ${floor.markers?.map((marker) => this.renderMarker(marker))}
                  </div>
                </div>
              `
            : html`
                <div class="flex items-center justify-center h-full text-surface-400">
                  <div class="text-center">
                    <div class="text-5xl mb-3">🗺️</div>
                    <p>Nessuna mappa disponibile</p>
                    <p class="text-sm">Aggiungi un piano per iniziare</p>
                  </div>
                </div>
              `}
        </div>

        <!-- Status Bar -->
        <div
          class="flex items-center justify-between p-2 bg-surface-800 border-t border-surface-700 text-xs text-surface-400"
        >
          <div>
            ${floor
              ? `${floor.dimensions.width} × ${floor.dimensions.height}px • ${floor.markers?.length || 0} marker`
              : 'Nessun piano selezionato'}
          </div>
          <div>
            ${this.editMode
              ? '✏️ Click: aggiungi marker • Scroll: zoom • Tasto destro: sposta'
              : '👁️ Modalità Visualizzazione'}
          </div>
        </div>
      </div>
    `;
  }

  private renderMarker(marker: MapMarker) {
    const isSelected = this.selectedMarkerId === marker.id;

    // Find artwork image if this is an artwork marker
    const artwork = marker.artworkId
      ? this.artworks.find((a) => a.wikidataId === marker.artworkId)
      : null;
    const hasImage = artwork?.image;

    // Get focal point and zoom settings
    const focalX = marker.focalPoint?.x ?? 50;
    const focalY = marker.focalPoint?.y ?? 50;
    const focalZoom = marker.focalZoom ?? 1;

    // Calculate image transform (same formula as editor)
    const offsetX = (50 - focalX) * focalZoom;
    const offsetY = (50 - focalY) * focalZoom;

    const markerSize = isSelected ? 48 : 32;

    return html`
      <div
        class="absolute pointer-events-auto cursor-pointer transition-all duration-200 hover:scale-110 hover:z-50 ${isSelected
          ? 'scale-125 z-50'
          : 'z-10'}"
        style="left: ${marker.x}px; top: ${marker.y}px; transform: translate(-50%, -50%);"
        @click=${(e: Event) => this.handleMarkerClick(e, marker)}
        @mousedown=${(e: MouseEvent) => this.handleMarkerDragStart(e, marker)}
        title="${marker.label || artwork?.title || marker.type}"
      >
        <div class="relative">
          ${hasImage
            ? html`
                <!-- Artwork marker with image -->
                <div
                  class="rounded-full overflow-hidden border-2 shadow-lg transition-all duration-200 ${isSelected
                    ? 'border-brand-400 ring-2 ring-brand-400/50'
                    : 'border-white/80 hover:border-brand-300'}"
                  style="width: ${markerSize}px; height: ${markerSize}px;"
                >
                  <img
                    src="${artwork.image}"
                    alt="${artwork.title || ''}"
                    class="w-full h-full object-cover pointer-events-none"
                    style="transform: scale(${focalZoom}) translate(${offsetX /
                    focalZoom}%, ${offsetY / focalZoom}%);"
                    draggable="false"
                  />
                </div>
              `
            : html`
                <!-- POI marker with icon -->
                <div class="text-2xl filter drop-shadow-lg ${isSelected ? 'animate-pulse' : ''}">
                  ${this.markerIcons[marker.type] || '📍'}
                </div>
              `}

          <!-- Label: only visible when selected -->
          ${isSelected && (marker.label || artwork?.title)
            ? html`
                <div
                  class="absolute left-1/2 top-full -translate-x-1/2 mt-2 px-2 py-1 bg-surface-900/95 text-white text-xs rounded shadow-lg whitespace-nowrap max-w-32 truncate border border-surface-600"
                >
                  ${marker.label || artwork?.title}
                </div>
              `
            : ''}

          <!-- Selection ring for non-image markers -->
          ${isSelected && !hasImage
            ? html`
                <div
                  class="absolute inset-0 -m-2 border-2 border-brand-500 rounded-full animate-ping"
                ></div>
              `
            : ''}
        </div>
      </div>
    `;
  }

  private selectFloor(floorId: string) {
    this.dispatchEvent(
      new CustomEvent('floor-select', {
        detail: { floorId },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private setZoom(newZoom: number) {
    this.zoom = Math.max(0.25, Math.min(3, newZoom));
  }

  private resetView() {
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
  }

  private handleWheel(e: WheelEvent) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    this.setZoom(this.zoom + delta);
  }

  private handleMouseDown(e: MouseEvent) {
    // Pan with middle mouse button (1) or right click (2), or left click when holding space
    if (e.button === 1 || e.button === 2 || (!this.editMode && e.button === 0)) {
      e.preventDefault();
      this.isDragging = true;
      this.dragStartX = e.clientX - this.panX;
      this.dragStartY = e.clientY - this.panY;
    }
  }

  private handleMouseMove(e: MouseEvent) {
    if (this.isDragging) {
      this.panX = e.clientX - this.dragStartX;
      this.panY = e.clientY - this.dragStartY;
    }
  }

  private handleMouseUp() {
    this.isDragging = false;
  }

  private handleMapClick(e: MouseEvent) {
    if (!this.editMode) return;

    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();

    // Calculate position relative to the SVG, accounting for zoom
    const x = (e.clientX - rect.left) / this.zoom;
    const y = (e.clientY - rect.top) / this.zoom;

    this.dispatchEvent(
      new CustomEvent('map-click', {
        detail: { x, y },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private handleMarkerClick(e: Event, marker: MapMarker) {
    e.stopPropagation();

    this.dispatchEvent(
      new CustomEvent('marker-select', {
        detail: marker,
        bubbles: true,
        composed: true,
      }),
    );
  }

  private handleMarkerDragStart(e: MouseEvent, marker: MapMarker) {
    if (!this.editMode) return;
    e.stopPropagation();
    e.preventDefault();

    // Simple drag implementation
    const startX = e.clientX;
    const startY = e.clientY;
    const originalX = marker.x;
    const originalY = marker.y;

    const handleMove = (moveEvent: MouseEvent) => {
      const dx = (moveEvent.clientX - startX) / this.zoom;
      const dy = (moveEvent.clientY - startY) / this.zoom;

      this.dispatchEvent(
        new CustomEvent('marker-drag', {
          detail: {
            markerId: marker.id,
            x: originalX + dx,
            y: originalY + dy,
          },
          bubbles: true,
          composed: true,
        }),
      );
    };

    const handleUp = () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'svg-map-editor': SvgMapEditor;
  }
}
