import { LitElement, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { museumService } from '../../services/museum.service';
import { artworkService } from '../../services/artwork.service';
import { modalService } from '../../services/modal.service';
import type { Museum, MuseumFloor, MapMarker, Artwork } from '@artaround/shared';
import './svg-map-editor';
import './floor-manager';
import './marker-editor';
import '../ui/ui-button';
import '../ui/ui-card';
import '../ui/ui-image-placeholder';
import { __ } from '../../services/i18n.service';

/**
 * Museum Map Page
 *
 * Full page for managing museum floor maps, markers, and artwork positions
 */
@customElement('museum-map-page')
export class MuseumMapPage extends LitElement {
  // ─── Lifecycle ───────────────────────────────────────────
  createRenderRoot() {
    return this;
  }

  @property({ type: String })
  museumId: string = '';

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

  async connectedCallback() {
    super.connectedCallback();
    await this.loadData();
  }

  // ─── Data Loading ────────────────────────────────────────
  private async loadData() {
    if (!this.museumId) {
      this.error = __('ID museo non specificato');
      this.loading = false;
      return;
    }

    try {
      this.loading = true;
      this.error = null;

      // Load museum details and floors
      const [museum, floors, artworksResponse] = await Promise.all([
        museumService.getMuseum(this.museumId),
        museumService.getFloors(this.museumId),
        artworkService.getArtworksByMuseum(this.museumId),
      ]);

      this.museum = museum;
      this.floors = floors || [];
      this.artworks = artworksResponse || [];

      // Select first floor by default
      if (this.floors.length > 0 && !this.selectedFloorId) {
        this.selectedFloorId = this.floors[0].id;
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

  // ─── Render Entry ────────────────────────────────────────
  render() {
    if (this.loading) {
      return html`
        <div class="min-h-screen bg-surface-950 flex items-center justify-center">
          <div class="text-center">
            <div class="animate-spin text-4xl mb-4">🔄</div>
            <p class="text-surface-400">${__('Caricamento...')}</p>
          </div>
        </div>
      `;
    }

    if (this.error) {
      return html`
        <div class="min-h-screen bg-surface-950 flex items-center justify-center">
          <div class="text-center">
            <div class="text-4xl mb-4">❌</div>
            <p class="text-red-400">${this.error}</p>
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
      <div class="min-h-screen bg-surface-950 ${this.isFullscreen ? 'fixed inset-0 z-50' : ''}">
        <!-- Header -->
        <div
          class="flex items-center justify-between p-4 bg-surface-900 border-b border-surface-800"
        >
          <div class="flex items-center gap-4">
            <ui-button
              variant="secondary"
              .label=${`← ${__('Indietro')}`}
              @click=${this.goBack}
            ></ui-button>
            <div>
              <h1 class="text-xl font-semibold text-white m-0">🗺️ ${__('Gestione Mappe')}</h1>
              <p class="text-sm text-surface-400 m-0">${this.museum?.name || __('Museo')}</p>
            </div>
          </div>

          <div class="flex items-center gap-3">
            ${this.hasChanges
              ? html`
                  <span class="text-yellow-400 text-sm">● ${__('Modifiche non salvate')}</span>
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

        <!-- Main Content -->
        <div
          class="grid grid-cols-1 lg:grid-cols-12 gap-4 p-4"
          style="min-height: calc(100vh - 80px);"
        >
          <!-- Left Panel: Floors & Artworks -->
          <div class="lg:col-span-3 xl:col-span-2 space-y-4 overflow-y-auto order-2 lg:order-1">
            <floor-manager
              .floors=${this.floors}
              .selectedFloorId=${this.selectedFloorId}
              @floor-select=${this.handleFloorSelect}
              @floor-add=${this.handleFloorAdd}
              @floor-update=${this.handleFloorUpdate}
              @floor-delete=${this.handleFloorDelete}
            ></floor-manager>

            <!-- Artworks List -->
            <div class="bg-surface-800 rounded-lg overflow-hidden border border-surface-700">
              <div class="p-4 bg-surface-700 border-b border-surface-600">
                <h3 class="text-white font-medium text-base m-0">
                  🖼️ ${__('Opere')} (${this.artworks.length})
                </h3>
              </div>
              <div class="max-h-64 overflow-y-auto">
                ${this.artworks.length > 0
                  ? this.artworks.map((artwork) => this.renderArtworkItem(artwork))
                  : html`
                      <div class="p-4 text-center text-surface-400">
                        <p class="m-0">${__('Nessuna opera nel museo')}</p>
                      </div>
                    `}
              </div>
            </div>
          </div>

          <!-- Center: Map Editor -->
          <div class="lg:col-span-5 xl:col-span-7 order-1 lg:order-2">
            <svg-map-editor
              .floors=${this.floors}
              .selectedFloorId=${this.selectedFloorId}
              .selectedMarkerId=${this.selectedMarker?.id || null}
              .artworks=${this.artworks}
              editMode
              @floor-select=${(e: CustomEvent) => (this.selectedFloorId = e.detail.floorId)}
              @map-click=${this.handleMapClick}
              @marker-select=${this.handleMarkerSelect}
              @marker-drag=${this.handleMarkerDrag}
            ></svg-map-editor>
          </div>

          <!-- Right Panel: Marker Editor -->
          <div class="lg:col-span-4 xl:col-span-3 overflow-y-auto order-3">
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

  // ─── Render Helpers ──────────────────────────────────────
  private renderArtworkItem(artwork: Artwork) {
    const hasPosition = this.floors.some((f) =>
      f.markers?.some((m) => m.artworkId === artwork.wikidataId),
    );

    return html`
      <div
        class="flex items-center gap-3 p-3 border-b border-surface-600 hover:bg-surface-700 transition-colors"
      >
        <div class="w-10 h-10 rounded bg-surface-600 overflow-hidden flex-shrink-0 relative">
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
          <div class="text-white text-sm font-medium truncate">${artwork.title}</div>
          <div class="text-surface-400 text-xs">${artwork.author || __('Artista sconosciuto')}</div>
        </div>
        <div class="flex-shrink-0">
          ${hasPosition
            ? html`<span class="text-green-400 text-xs">📍</span>`
            : html`<span class="text-surface-500 text-xs">—</span>`}
        </div>
      </div>
    `;
  }

  // ─── Actions (Floors / Markers / Save) ──────────────────
  private async goBack() {
    if (this.hasChanges) {
      const confirmed = await modalService.confirm({
        title: __('Modifiche non salvate'),
        message: __('Hai modifiche non salvate. Sei sicuro di voler uscire?'),
        confirmLabel: __('Esci'),
        cancelLabel: __('Rimani'),
        variant: 'danger',
      });
      if (!confirmed) {
        return;
      }
    }

    this.dispatchEvent(
      new CustomEvent('navigate-back', {
        bubbles: true,
        composed: true,
      }),
    );
  }

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
        // Nota: NON resettare hasChanges qui. Il piano è già stato salvato,
        // ma potrebbero esserci marker trascinati/modificati su altri piani
        // ancora in attesa di "Salva Tutto": azzerare il flag li farebbe
        // perdere silenziosamente (bottone disabilitato, nessun salvataggio).
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
      // Aggiorna solo i campi del piano modificati nel form (nome/livello/svg/dimensioni):
      // floorData.markers/connections sono uno snapshot preso all'apertura del form e
      // potrebbero essere superati se nel frattempo si sono trascinati dei marker sullo
      // stesso piano. Manteniamo i marker/connections correnti dallo stato locale.
      this.floors = this.floors.map((f) =>
        f.id === floorData.id
          ? { ...floorData, markers: f.markers, connections: f.connections }
          : f,
      );
      // Nota: NON resettare hasChanges qui, per lo stesso motivo di handleFloorAdd
      // (marker non ancora salvati su altri piani non vanno persi).
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

      // Update local state
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

    // Update local state immediately for smooth drag
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

    // Update local state
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

      // Update local state
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

  private async saveAll() {
    if (!this.hasChanges) return;

    try {
      this.saving = true;

      // Save all floors with their markers
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
