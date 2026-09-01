import { LitElement, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import {
  MARKER_TYPE_EDITOR_OPTIONS_IT,
  MarkerType,
  type MapMarker,
  type Artwork,
} from '@artaround/shared';
import { modalService } from '../../services/modal.service';
import '../ui/ui-button';
import '../ui/ui-input';
import '../ui/ui-select';
import '../ui/ui-textarea';
import '../ui/ui-icon-button';
import '../ui/ui-image-placeholder';
import { __ } from '../../services/i18n.service';

/**
 * Marker Editor Component
 *
 * Panel for adding/editing map markers (POI)
 */
@customElement('marker-editor')
export class MarkerEditor extends LitElement {
  // ─── Lifecycle ───────────────────────────────────────────
  createRenderRoot() {
    return this;
  }

  @property({ type: Object })
  selectedMarker: MapMarker | null = null;

  @property({ type: Array })
  markers: MapMarker[] = [];

  @property({ type: Array })
  artworks: Artwork[] = [];

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

  private get markerTypes() {
    return MARKER_TYPE_EDITOR_OPTIONS_IT.map((option) => ({
      ...option,
      label: __(option.label),
    }));
  }

  updated(changedProperties: Map<string, unknown>) {
    // When a marker is selected, switch to the list tab
    if (changedProperties.has('selectedMarker') && this.selectedMarker) {
      this.activeTab = 'list';
    }
  }

  // ─── Render Entry ────────────────────────────────────────
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

  // ─── Render Helpers ──────────────────────────────────────
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
              <ui-select
                .label=${__('Opera collegata')}
                .value=${this.selectedArtworkId}
                .options=${this.artworks.map((artwork) => ({
                  value: artwork.wikidataId,
                  label: artwork.title,
                }))}
                .placeholder=${__('Seleziona opera')}
                @select-change=${(e: CustomEvent) => {
                  this.selectedArtworkId = e.detail.value;
                  // marker.artworkId deve essere il Wikidata ID (come in MapMarker),
                  // non l'_id di Mongo: prima veniva usato artwork._id, per cui i marker
                  // aggiunti da qui non si ricollegavano mai alla relativa opera
                  // (focal point editor, indicatore "opera posizionata", ecc.).
                  const artwork = this.artworks.find((a) => a.wikidataId === e.detail.value);
                  if (artwork) {
                    this.markerLabel = artwork.title;
                  }
                }}
              ></ui-select>
            </div>
          `
        : nothing}

      <!-- Label -->
      <div class="mb-4">
        <ui-input
          .label=${__('Etichetta')}
          .placeholder=${__('Nome del punto')}
          .value=${this.markerLabel}
          @input-change=${(e: CustomEvent) => (this.markerLabel = e.detail.value)}
        ></ui-input>
      </div>

      <!-- Description -->
      <div class="mb-4">
        <ui-textarea
          .label=${__('Descrizione (opzionale)')}
          .rows=${2}
          .placeholder=${__('Descrizione aggiuntiva...')}
          .value=${this.markerDescription}
          @textarea-change=${(e: CustomEvent) => (this.markerDescription = e.detail.value)}
        ></ui-textarea>
      </div>

      <!-- Add Button -->
      <ui-button
        variant="primary"
        .label=${`➕ ${__('Aggiungi Marker')}`}
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
          <p class="m-0">${__('Nessun marker su questo piano')}</p>
        </div>
      `;
    }

    // Get selected marker's artwork for focal point editor
    const selectedArtwork = this.selectedMarker?.artworkId
      ? this.artworks.find((a) => a.wikidataId === this.selectedMarker?.artworkId)
      : null;

    return html`
      <div class="space-y-2 max-h-64 overflow-y-auto mb-4 p-1">
        ${this.markers.map((marker) => this.renderMarkerItem(marker))}
      </div>

      <!-- Edit Form (when marker is selected) -->
      ${this.selectedMarker ? this.renderEditForm() : nothing}

      <!-- Focal Point Editor (when artwork marker is selected) -->
      ${selectedArtwork?.image ? this.renderFocalPointEditor(selectedArtwork) : nothing}
    `;
  }

  private renderEditForm() {
    if (!this.selectedMarker) return nothing;

    const isArtworkType = [MarkerType.ARTWORK, MarkerType.SCULPTURE, MarkerType.PAINTING].includes(
      this.selectedMarker.type,
    );

    return html`
      <div class="p-3 bg-surface-700 rounded-lg border border-brand-500/50 mb-4">
        <div class="text-brand-400 text-sm font-medium mb-3">✏️ ${__('Modifica Marker')}</div>

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
                <ui-select
                  .label=${__('Opera collegata')}
                  .value=${this.selectedMarker.artworkId || ''}
                  .options=${this.artworks.map((artwork) => ({
                    value: artwork.wikidataId,
                    label: artwork.title,
                  }))}
                  .placeholder=${__('Nessuna opera')}
                  @select-change=${(e: CustomEvent) => this.updateMarkerArtwork(e.detail.value)}
                ></ui-select>
              </div>
            `
          : nothing}

        <!-- Label -->
        <div class="mb-3">
          <ui-input
            .label=${__('Etichetta')}
            .placeholder=${__('Nome del punto')}
            .value=${this.selectedMarker.label || ''}
            @input-change=${(e: CustomEvent) => this.updateMarkerLabel(e.detail.value)}
          ></ui-input>
        </div>

        <!-- Description -->
        <div class="mb-3">
          <ui-textarea
            .label=${__('Descrizione')}
            .rows=${2}
            .placeholder=${__('Descrizione aggiuntiva...')}
            .value=${this.selectedMarker.description || ''}
            @textarea-change=${(e: CustomEvent) => this.updateMarkerDescription(e.detail.value)}
          ></ui-textarea>
        </div>

        <!-- Position info -->
        <div class="text-xs text-surface-400 mb-3">
          📍 X: ${Math.round(this.selectedMarker.x)} • Y: ${Math.round(this.selectedMarker.y)}
        </div>

        <!-- Deselect button -->
        <ui-button
          variant="secondary"
          size="sm"
          .label=${`✓ ${__('Chiudi modifica')}`}
          block
          @click=${this.deselectMarker}
        ></ui-button>
      </div>
    `;
  }

  // ─── Actions (Marker CRUD) ───────────────────────────────
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
    const artwork = this.artworks.find((a) => a.wikidataId === itemId || a._id === itemId);
    this.dispatchEvent(
      new CustomEvent('marker-update', {
        detail: {
          ...this.selectedMarker,
          artworkId: itemId || undefined,
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

  private renderFocalPointEditor(artwork: Artwork) {
    const focalX = this.selectedMarker?.focalPoint?.x ?? 50;
    const focalY = this.selectedMarker?.focalPoint?.y ?? 50;
    const focalZoom = this.selectedMarker?.focalZoom ?? 1;

    // Calculate image transform: we move the image so that the focal point is at center
    // offsetX/Y: how much to shift the image (negative = image moves left/up)
    const offsetX = (50 - focalX) * focalZoom;
    const offsetY = (50 - focalY) * focalZoom;

    return html`
      <div class="mt-4 p-3 bg-surface-700 rounded-lg border border-surface-600">
        <div class="text-surface-300 text-sm font-medium mb-2">🎯 ${__('Ritaglio Immagine')}</div>
        <p class="text-surface-400 text-xs mb-3">
          ${__("Trascina l'immagine per spostarla • Scroll per zoom")}
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
          <div class="text-surface-400 text-xs">${__('Anteprima')}:</div>
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
          <div class="text-xs text-surface-400">
            ${__('Ingrandimento')}: ${focalZoom.toFixed(1)}x
          </div>
          <ui-button
            variant="secondary"
            size="xs"
            .label=${__('🔄 Reset')}
            @click=${this.resetFocalPoint}
          ></ui-button>
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
    const startFocalX = this.selectedMarker.focalPoint?.x ?? 50;
    const startFocalY = this.selectedMarker.focalPoint?.y ?? 50;
    const zoom = this.selectedMarker.focalZoom ?? 1;
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
    const startFocalX = this.selectedMarker.focalPoint?.x ?? 50;
    const startFocalY = this.selectedMarker.focalPoint?.y ?? 50;
    const zoom = this.selectedMarker.focalZoom ?? 1;

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

    const currentZoom = this.selectedMarker.focalZoom ?? 1;
    const currentFocalX = this.selectedMarker.focalPoint?.x ?? 50;
    const currentFocalY = this.selectedMarker.focalPoint?.y ?? 50;

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
    const artwork = marker.artworkId
      ? this.artworks.find((a) => a.wikidataId === marker.artworkId)
      : null;

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
        <ui-icon-button
          icon="trash"
          variant="danger"
          .title=${__('Elimina')}
          @click=${(e: Event) => this.deleteMarker(e, marker)}
        ></ui-icon-button>
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
      artworkId: this.selectedArtworkId || undefined,
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
      title: __('Elimina marker'),
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
