import { LitElement, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { MarkerType, type MapMarker, type Item } from '@artaround/shared';
import { modalService } from '../../services/modal.service';
import '../ui/ui-button';
import '../ui/ui-input';
import '../ui/ui-select';

/**
 * Marker Editor Component
 *
 * Panel for adding/editing map markers (POI)
 */
@customElement('marker-editor')
export class MarkerEditor extends LitElement {
  createRenderRoot() {
    return this;
  }

  @property({ type: Object })
  selectedMarker: MapMarker | null = null;

  @property({ type: Array })
  markers: MapMarker[] = [];

  @property({ type: Array })
  artworks: Item[] = [];

  @property({ type: String })
  currentFloorId: string = '';

  @property({ type: Object })
  clickPosition: { x: number; y: number } | null = null;

  @state()
  private activeTab: 'add' | 'list' = 'add';

  @state()
  private selectedType: MarkerType = MarkerType.ARTWORK;

  @state()
  private markerLabel = '';

  @state()
  private markerDescription = '';

  @state()
  private selectedArtworkId = '';

  // Marker type icons and labels
  private markerTypes = [
    { type: MarkerType.ARTWORK, icon: '🖼️', label: 'Opera' },
    { type: MarkerType.SCULPTURE, icon: '🗿', label: 'Scultura' },
    { type: MarkerType.PAINTING, icon: '🎨', label: 'Dipinto' },
    { type: MarkerType.ENTRANCE, icon: '🚪', label: 'Ingresso' },
    { type: MarkerType.EXIT, icon: '🚶', label: 'Uscita' },
    { type: MarkerType.EMERGENCY_EXIT, icon: '🚨', label: 'Uscita Emergenza' },
    { type: MarkerType.INFO_POINT, icon: 'ℹ️', label: 'Info Point' },
    { type: MarkerType.ELEVATOR, icon: '🛗', label: 'Ascensore' },
    { type: MarkerType.STAIRS, icon: '🪜', label: 'Scale' },
    { type: MarkerType.ESCALATOR, icon: '📶', label: 'Scale Mobili' },
    { type: MarkerType.RAMP, icon: '♿', label: 'Rampa' },
    { type: MarkerType.TOILETTE, icon: '🚻', label: 'Bagni' },
    { type: MarkerType.ACCESSIBLE_TOILETTE, icon: '♿🚻', label: 'Bagni Accessibili' },
    { type: MarkerType.BAR, icon: '☕', label: 'Bar' },
    { type: MarkerType.RESTAURANT, icon: '🍽️', label: 'Ristorante' },
    { type: MarkerType.SHOP, icon: '🛒', label: 'Negozio' },
    { type: MarkerType.CLOAKROOM, icon: '🧥', label: 'Guardaroba' },
    { type: MarkerType.LOCKER, icon: '🔐', label: 'Armadietti' },
    { type: MarkerType.ROOM, icon: '🚪', label: 'Sala' },
    { type: MarkerType.GALLERY, icon: '🏛️', label: 'Galleria' },
    { type: MarkerType.BENCH, icon: '🪑', label: 'Panchina' },
    { type: MarkerType.AUDIO_GUIDE, icon: '🎧', label: 'Audioguida' },
    { type: MarkerType.WIFI, icon: '📶', label: 'WiFi' },
  ];

  updated(changedProperties: Map<string, unknown>) {
    // When a marker is selected, switch to the list tab
    if (changedProperties.has('selectedMarker') && this.selectedMarker) {
      this.activeTab = 'list';
    }
  }

  render() {
    return html`
      <div class="bg-surface-800 rounded-lg overflow-hidden border border-surface-700">
        <!-- Header -->
        <div
          class="flex justify-between items-center p-4 bg-surface-700 border-b border-surface-600"
        >
          <h3 class="text-white font-medium text-base m-0">📍 Marker / POI</h3>
        </div>

        <!-- Tabs -->
        <div class="flex border-b border-surface-600">
          <button
            class="flex-1 py-3 px-4 text-sm font-medium transition-colors ${this.activeTab === 'add'
              ? 'text-brand-400 border-b-2 border-brand-400 bg-surface-700'
              : 'text-surface-400 hover:text-white hover:bg-surface-700'}"
            @click=${() => (this.activeTab = 'add')}
          >
            ➕ Aggiungi
          </button>
          <button
            class="flex-1 py-3 px-4 text-sm font-medium transition-colors ${this.activeTab ===
            'list'
              ? 'text-brand-400 border-b-2 border-brand-400 bg-surface-700'
              : 'text-surface-400 hover:text-white hover:bg-surface-700'}"
            @click=${() => (this.activeTab = 'list')}
          >
            📋 Lista (${this.markers.length})
          </button>
        </div>

        <!-- Content -->
        <div class="p-4">
          ${this.activeTab === 'add' ? this.renderAddForm() : this.renderList()}
        </div>
      </div>
    `;
  }

  private renderAddForm() {
    const isArtworkType = [MarkerType.ARTWORK, MarkerType.SCULPTURE, MarkerType.PAINTING].includes(
      this.selectedType,
    );

    return html`
      <!-- Click Position Info -->
      ${this.clickPosition
        ? html`
            <div class="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
              <div class="text-green-400 text-sm font-medium mb-1">📍 Posizione selezionata</div>
              <div class="text-surface-300 text-xs">
                X: ${Math.round(this.clickPosition.x)} • Y: ${Math.round(this.clickPosition.y)}
              </div>
            </div>
          `
        : html`
            <div class="mb-4 p-3 bg-surface-700 border border-surface-600 rounded-lg">
              <div class="text-surface-400 text-sm">
                👆 Clicca sulla mappa per selezionare una posizione
              </div>
            </div>
          `}

      <!-- Marker Type Grid -->
      <div class="mb-4">
        <label class="block text-sm font-medium text-surface-300 mb-2">Tipo Marker</label>
        <div class="grid grid-cols-4 gap-2">
          ${this.markerTypes.map(
            ({ type, icon, label }) => html`
              <button
                class="p-2 rounded-lg text-center transition-all ${this.selectedType === type
                  ? 'bg-brand-500 text-white'
                  : 'bg-surface-700 text-surface-300 hover:bg-surface-600'}"
                @click=${() => (this.selectedType = type)}
                title=${label}
              >
                <div class="text-xl">${icon}</div>
                <div class="text-xs mt-1 truncate">${label}</div>
              </button>
            `,
          )}
        </div>
      </div>

      <!-- Artwork Selector (if artwork type) -->
      ${isArtworkType
        ? html`
            <div class="mb-4">
              <label class="block text-sm font-medium text-surface-300 mb-2">Opera collegata</label>
              <select
                class="w-full px-3 py-2 bg-surface-700 border border-surface-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                @change=${(e: Event) => {
                  const select = e.target as HTMLSelectElement;
                  this.selectedArtworkId = select.value;
                  const artwork = this.artworks.find((a) => a._id === select.value);
                  if (artwork) {
                    this.markerLabel = artwork.title;
                  }
                }}
              >
                <option value="">-- Seleziona opera --</option>
                ${this.artworks.map(
                  (artwork) => html`
                    <option
                      value=${artwork._id}
                      ?selected=${this.selectedArtworkId === artwork._id}
                    >
                      ${artwork.title}
                    </option>
                  `,
                )}
              </select>
            </div>
          `
        : ''}

      <!-- Label -->
      <div class="mb-4">
        <ui-input
          label="Etichetta"
          placeholder="Nome del punto"
          .value=${this.markerLabel}
          @input-change=${(e: CustomEvent) => (this.markerLabel = e.detail.value)}
        ></ui-input>
      </div>

      <!-- Description -->
      <div class="mb-4">
        <label class="block text-sm font-medium text-surface-300 mb-2"
          >Descrizione (opzionale)</label
        >
        <textarea
          class="w-full px-3 py-2 bg-surface-700 border border-surface-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
          rows="2"
          placeholder="Descrizione aggiuntiva..."
          .value=${this.markerDescription}
          @input=${(e: Event) => (this.markerDescription = (e.target as HTMLTextAreaElement).value)}
        ></textarea>
      </div>

      <!-- Add Button -->
      <ui-button
        variant="primary"
        label="➕ Aggiungi Marker"
        block
        ?disabled=${!this.clickPosition || !this.markerLabel}
        @click=${this.addMarker}
      ></ui-button>
    `;
  }

  private renderList() {
    if (this.markers.length === 0) {
      return html`
        <div class="text-center py-8 text-surface-400">
          <div class="text-4xl mb-2">📍</div>
          <p class="m-0">Nessun marker su questo piano</p>
        </div>
      `;
    }

    // Get selected marker's artwork for focal point editor
    const selectedArtwork = this.selectedMarker?.itemId
      ? this.artworks.find((a) => a._id === this.selectedMarker?.itemId)
      : null;

    return html`
      <div class="space-y-2 max-h-64 overflow-y-auto mb-4 p-1">
        ${this.markers.map((marker) => this.renderMarkerItem(marker))}
      </div>

      <!-- Edit Form (when marker is selected) -->
      ${this.selectedMarker ? this.renderEditForm() : ''}

      <!-- Focal Point Editor (when artwork marker is selected) -->
      ${selectedArtwork?.image ? this.renderFocalPointEditor(selectedArtwork) : ''}
    `;
  }

  private renderEditForm() {
    if (!this.selectedMarker) return '';

    const isArtworkType = [MarkerType.ARTWORK, MarkerType.SCULPTURE, MarkerType.PAINTING].includes(
      this.selectedMarker.type,
    );

    return html`
      <div class="p-3 bg-surface-700 rounded-lg border border-brand-500/50 mb-4">
        <div class="text-brand-400 text-sm font-medium mb-3">✏️ Modifica Marker</div>

        <!-- Marker Type Grid -->
        <div class="mb-3">
          <label class="block text-xs font-medium text-surface-300 mb-2">Tipo</label>
          <div class="grid grid-cols-4 gap-1">
            ${this.markerTypes.map(
              ({ type, icon, label }) => html`
                <button
                  class="p-1.5 rounded text-center transition-all ${this.selectedMarker?.type ===
                  type
                    ? 'bg-brand-500 text-white'
                    : 'bg-surface-600 text-surface-300 hover:bg-surface-500'}"
                  @click=${() => this.updateMarkerType(type)}
                  title=${label}
                >
                  <div class="text-lg">${icon}</div>
                </button>
              `,
            )}
          </div>
        </div>

        <!-- Artwork Selector (if artwork type) -->
        ${isArtworkType
          ? html`
              <div class="mb-3">
                <label class="block text-xs font-medium text-surface-300 mb-1"
                  >Opera collegata</label
                >
                <select
                  class="w-full px-2 py-1.5 bg-surface-600 border border-surface-500 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  .value=${this.selectedMarker.itemId || ''}
                  @change=${(e: Event) =>
                    this.updateMarkerArtwork((e.target as HTMLSelectElement).value)}
                >
                  <option value="">-- Nessuna opera --</option>
                  ${this.artworks.map(
                    (artwork) => html`
                      <option
                        value=${artwork._id}
                        ?selected=${this.selectedMarker?.itemId === artwork._id}
                      >
                        ${artwork.title}
                      </option>
                    `,
                  )}
                </select>
              </div>
            `
          : ''}

        <!-- Label -->
        <div class="mb-3">
          <label class="block text-xs font-medium text-surface-300 mb-1">Etichetta</label>
          <input
            type="text"
            class="w-full px-2 py-1.5 bg-surface-600 border border-surface-500 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            .value=${this.selectedMarker.label || ''}
            @input=${(e: Event) => this.updateMarkerLabel((e.target as HTMLInputElement).value)}
            placeholder="Nome del punto"
          />
        </div>

        <!-- Description -->
        <div class="mb-3">
          <label class="block text-xs font-medium text-surface-300 mb-1">Descrizione</label>
          <textarea
            class="w-full px-2 py-1.5 bg-surface-600 border border-surface-500 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
            rows="2"
            .value=${this.selectedMarker.description || ''}
            @input=${(e: Event) =>
              this.updateMarkerDescription((e.target as HTMLTextAreaElement).value)}
            placeholder="Descrizione aggiuntiva..."
          ></textarea>
        </div>

        <!-- Position info -->
        <div class="text-xs text-surface-400 mb-3">
          📍 X: ${Math.round(this.selectedMarker.x)} • Y: ${Math.round(this.selectedMarker.y)}
        </div>

        <!-- Deselect button -->
        <button
          class="w-full px-3 py-1.5 bg-surface-600 hover:bg-surface-500 text-surface-300 text-sm rounded transition-colors"
          @click=${this.deselectMarker}
        >
          ✓ Chiudi modifica
        </button>
      </div>
    `;
  }

  private updateMarkerType(type: MarkerType) {
    if (!this.selectedMarker) return;
    this.dispatchEvent(
      new CustomEvent('marker-update', {
        detail: { ...this.selectedMarker, type },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private updateMarkerArtwork(itemId: string) {
    if (!this.selectedMarker) return;
    const artwork = this.artworks.find((a) => a._id === itemId);
    this.dispatchEvent(
      new CustomEvent('marker-update', {
        detail: {
          ...this.selectedMarker,
          itemId: itemId || undefined,
          label: artwork?.title || this.selectedMarker.label,
        },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private updateMarkerLabel(label: string) {
    if (!this.selectedMarker) return;
    this.dispatchEvent(
      new CustomEvent('marker-update', {
        detail: { ...this.selectedMarker, label },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private updateMarkerDescription(description: string) {
    if (!this.selectedMarker) return;
    this.dispatchEvent(
      new CustomEvent('marker-update', {
        detail: { ...this.selectedMarker, description: description || undefined },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private deselectMarker() {
    this.dispatchEvent(
      new CustomEvent('marker-select', {
        detail: null,
        bubbles: true,
        composed: true,
      }),
    );
  }

  private renderFocalPointEditor(artwork: Item) {
    const focalX = (this.selectedMarker as any)?.focalPoint?.x ?? 50;
    const focalY = (this.selectedMarker as any)?.focalPoint?.y ?? 50;
    const focalZoom = (this.selectedMarker as any)?.focalZoom ?? 1;

    // Calculate image transform: we move the image so that the focal point is at center
    // offsetX/Y: how much to shift the image (negative = image moves left/up)
    const offsetX = (50 - focalX) * focalZoom;
    const offsetY = (50 - focalY) * focalZoom;

    return html`
      <div class="mt-4 p-3 bg-surface-700 rounded-lg border border-surface-600">
        <div class="text-surface-300 text-sm font-medium mb-2">🎯 Ritaglio Immagine</div>
        <p class="text-surface-400 text-xs mb-3">
          Trascina l'immagine per spostarla • Scroll per zoom
        </p>

        <!-- Fixed circle with movable/zoomable image inside -->
        <div
          class="relative w-full aspect-square rounded-full overflow-hidden border-4 border-brand-400 shadow-xl cursor-move select-none bg-surface-900"
          @mousedown=${this.handleImageDragStart}
          @touchstart=${this.handleImageTouchStart}
          @wheel=${this.handleImageWheel}
        >
          <img
            src="${artwork.image}"
            alt="${artwork.title || ''}"
            class="absolute w-full h-full object-cover pointer-events-none"
            style="transform: scale(${focalZoom}) translate(${offsetX / focalZoom}%, ${offsetY /
            focalZoom}%);"
          />
          <!-- Center crosshair (fixed) -->
          <div class="absolute inset-0 pointer-events-none">
            <div class="absolute left-1/2 top-0 bottom-0 w-px bg-white/30 -translate-x-1/2"></div>
            <div class="absolute top-1/2 left-0 right-0 h-px bg-white/30 -translate-y-1/2"></div>
            <div
              class="absolute left-1/2 top-1/2 w-3 h-3 border-2 border-white rounded-full -translate-x-1/2 -translate-y-1/2"
            ></div>
          </div>
        </div>

        <!-- Preview: uses exact same transform -->
        <div class="mt-3 flex items-center gap-3">
          <div class="text-surface-400 text-xs">Anteprima:</div>
          <div
            class="w-8 h-8 rounded-full overflow-hidden border-2 border-white/80 shadow-lg flex-shrink-0 bg-surface-900"
          >
            <img
              src="${artwork.image}"
              alt=""
              class="w-full h-full object-cover"
              style="transform: scale(${focalZoom}) translate(${offsetX / focalZoom}%, ${offsetY /
              focalZoom}%);"
            />
          </div>
          <div
            class="w-12 h-12 rounded-full overflow-hidden border-2 border-brand-400 shadow-lg flex-shrink-0 bg-surface-900"
          >
            <img
              src="${artwork.image}"
              alt=""
              class="w-full h-full object-cover"
              style="transform: scale(${focalZoom}) translate(${offsetX / focalZoom}%, ${offsetY /
              focalZoom}%);"
            />
          </div>
        </div>

        <!-- Info and reset -->
        <div class="flex justify-between items-center mt-3">
          <div class="text-xs text-surface-400">Zoom: ${focalZoom.toFixed(1)}x</div>
          <button
            class="px-2 py-1 bg-surface-600 hover:bg-surface-500 text-surface-300 text-xs rounded transition-colors"
            @click=${this.resetFocalPoint}
          >
            🔄 Reset
          </button>
        </div>
      </div>
    `;
  }

  private handleImageDragStart(e: MouseEvent) {
    if (!this.selectedMarker) return;
    e.preventDefault();

    const container = e.currentTarget as HTMLElement;
    const rect = container.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const startFocalX = (this.selectedMarker as any).focalPoint?.x ?? 50;
    const startFocalY = (this.selectedMarker as any).focalPoint?.y ?? 50;
    const zoom = (this.selectedMarker as any).focalZoom ?? 1;
    // Calculate limits based on zoom
    // When zoom = 1, image fits exactly, so focal must be 50 (no movement)
    // When zoom = 2, image is 2x larger, so focal can be 25-75
    // Formula: min = 50/zoom, max = 100 - 50/zoom
    const minFocal = 50 / zoom;
    const maxFocal = 100 - 50 / zoom;

    const onMove = (moveEvent: MouseEvent) => {
      // Calculate how much the mouse moved as percentage of container
      const dx = ((moveEvent.clientX - startX) / rect.width) * 100;
      const dy = ((moveEvent.clientY - startY) / rect.height) * 100;

      // Moving image right = focal point moves left (inverse)
      // Divide by zoom because larger zoom = smaller movements have bigger effect
      const newFocalX = Math.max(minFocal, Math.min(maxFocal, startFocalX - dx / zoom));
      const newFocalY = Math.max(minFocal, Math.min(maxFocal, startFocalY - dy / zoom));

      this.dispatchEvent(
        new CustomEvent('marker-update', {
          detail: {
            ...this.selectedMarker,
            focalPoint: { x: newFocalX, y: newFocalY },
          },
          bubbles: true,
          composed: true,
        }),
      );
    };

    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  private handleImageTouchStart(e: TouchEvent) {
    if (!this.selectedMarker) return;
    e.preventDefault();

    const container = e.currentTarget as HTMLElement;
    const rect = container.getBoundingClientRect();
    const touch = e.touches[0];
    const startX = touch.clientX;
    const startY = touch.clientY;
    const startFocalX = (this.selectedMarker as any).focalPoint?.x ?? 50;
    const startFocalY = (this.selectedMarker as any).focalPoint?.y ?? 50;
    const zoom = (this.selectedMarker as any).focalZoom ?? 1;

    // Same limits for touch
    const minFocal = 50 / zoom;
    const maxFocal = 100 - 50 / zoom;

    const onMove = (moveEvent: TouchEvent) => {
      const t = moveEvent.touches[0];
      const dx = ((t.clientX - startX) / rect.width) * 100;
      const dy = ((t.clientY - startY) / rect.height) * 100;

      const newFocalX = Math.max(minFocal, Math.min(maxFocal, startFocalX - dx / zoom));
      const newFocalY = Math.max(minFocal, Math.min(maxFocal, startFocalY - dy / zoom));

      this.dispatchEvent(
        new CustomEvent('marker-update', {
          detail: {
            ...this.selectedMarker,
            focalPoint: { x: newFocalX, y: newFocalY },
          },
          bubbles: true,
          composed: true,
        }),
      );
    };

    const onEnd = () => {
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
    };

    document.addEventListener('touchmove', onMove);
    document.addEventListener('touchend', onEnd);
  }

  private handleImageWheel(e: WheelEvent) {
    if (!this.selectedMarker) return;
    e.preventDefault();

    const currentZoom = (this.selectedMarker as any).focalZoom ?? 1;
    const currentFocalX = (this.selectedMarker as any).focalPoint?.x ?? 50;
    const currentFocalY = (this.selectedMarker as any).focalPoint?.y ?? 50;

    const delta = e.deltaY > 0 ? -0.2 : 0.2;
    const newZoom = Math.max(1, Math.min(10, currentZoom + delta));

    // Recalculate limits for new zoom and clamp focal point
    const minFocal = 50 / newZoom;
    const maxFocal = 100 - 50 / newZoom;
    const newFocalX = Math.max(minFocal, Math.min(maxFocal, currentFocalX));
    const newFocalY = Math.max(minFocal, Math.min(maxFocal, currentFocalY));

    this.dispatchEvent(
      new CustomEvent('marker-update', {
        detail: {
          ...this.selectedMarker,
          focalZoom: Math.round(newZoom * 10) / 10,
          focalPoint: { x: newFocalX, y: newFocalY },
        },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private handleZoomChange(e: Event) {
    if (!this.selectedMarker) return;

    const zoom = parseFloat((e.target as HTMLInputElement).value);

    this.dispatchEvent(
      new CustomEvent('marker-update', {
        detail: {
          ...this.selectedMarker,
          focalZoom: zoom,
        },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private resetFocalPoint() {
    if (!this.selectedMarker) return;

    this.dispatchEvent(
      new CustomEvent('marker-update', {
        detail: {
          ...this.selectedMarker,
          focalPoint: { x: 50, y: 50 },
          focalZoom: 1,
        },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private renderMarkerItem(marker: MapMarker) {
    const typeInfo = this.markerTypes.find((t) => t.type === marker.type);
    const artwork = marker.itemId ? this.artworks.find((a) => a._id === marker.itemId) : null;

    return html`
      <div
        class="flex items-center gap-3 p-3 bg-surface-700 rounded-lg hover:bg-surface-600 transition-colors cursor-pointer ${this
          .selectedMarker?.id === marker.id
          ? 'ring-2 ring-brand-500'
          : ''}"
        @click=${() => this.selectMarker(marker)}
      >
        <div class="text-2xl">${typeInfo?.icon || '📍'}</div>
        <div class="flex-1 min-w-0">
          <div class="text-white text-sm font-medium truncate">
            ${marker.label || typeInfo?.label || 'Marker'}
          </div>
          <div class="text-surface-400 text-xs">
            ${artwork
              ? `🖼️ ${artwork.title}`
              : `X: ${Math.round(marker.x)} Y: ${Math.round(marker.y)}`}
          </div>
        </div>
        <button
          class="p-1.5 rounded hover:bg-red-600 text-surface-400 hover:text-white transition-colors"
          @click=${(e: Event) => this.deleteMarker(e, marker)}
          title="Elimina"
        >
          🗑️
        </button>
      </div>
    `;
  }

  private addMarker() {
    if (!this.clickPosition || !this.markerLabel) return;

    const marker: MapMarker = {
      id: `marker-${Date.now()}`,
      floorId: this.currentFloorId,
      x: this.clickPosition.x,
      y: this.clickPosition.y,
      type: this.selectedType,
      label: this.markerLabel,
      description: this.markerDescription || undefined,
      itemId: this.selectedArtworkId || undefined,
      isVisible: true,
    };

    this.dispatchEvent(
      new CustomEvent('marker-add', {
        detail: marker,
        bubbles: true,
        composed: true,
      }),
    );

    // Reset form
    this.markerLabel = '';
    this.markerDescription = '';
    this.selectedArtworkId = '';
  }

  private selectMarker(marker: MapMarker) {
    this.dispatchEvent(
      new CustomEvent('marker-select', {
        detail: marker,
        bubbles: true,
        composed: true,
      }),
    );
  }

  private async deleteMarker(e: Event, marker: MapMarker) {
    e.stopPropagation();

    const confirmed = await modalService.confirm({
      title: 'Elimina marker',
      message: `Eliminare il marker "${marker.label}"?`,
      confirmLabel: 'Elimina',
      variant: 'danger',
    });

    if (confirmed) {
      this.dispatchEvent(
        new CustomEvent('marker-delete', {
          detail: marker,
          bubbles: true,
          composed: true,
        }),
      );
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'marker-editor': MarkerEditor;
  }
}
