import { LitElement, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import {
  VisitStepType,
  getVisitStepTypeLabel,
  type Artwork,
  type Item,
  type MuseumFloor,
  type VisitStep,
} from '@artaround/shared';
import { __ } from '../../services/i18n.service';
import { renderInlineEmptyState } from '../../utils/inline-empty-state';
import { getReferenceTypeLabel } from '../../utils/enum-labels';
import type { MarkerOption } from './visit-step-editor';
import './visit-step-editor';
import '../ui/ui-button';
import '../ui/ui-info-tip';
import '../ui/ui-icon';
import '../ui/ui-icon-button';
import '../ui/ui-badge';
import '../ui/ui-image-placeholder';

type WaypointMarkerLookup = (mapMarkerId?: string) => { floorId: string; label: string } | null;

/**
 * Tab "Percorso" del visit-editor: aggiunta e riordino (drag&drop) delle tappe.
 */
@customElement('visit-steps-tab')
export class VisitStepsTab extends LitElement {
  @property({ type: String }) museumId = '';
  @property({ type: Array }) artworks: Artwork[] = [];
  @property({ type: Boolean }) loadingArtworks = false;
  @property({ type: Array }) floors: MuseumFloor[] = [];
  @property({ type: Boolean }) loadingFloors = false;
  @property({ type: Array }) steps: VisitStep[] = [];
  @property({ type: Number }) editingStepIndex: number | null = null;
  @property({ type: Number }) draggingIndex: number | null = null;
  @property({ type: Number }) dragOverIndex: number | null = null;
  @property({ type: Array }) availableItems: Item[] = [];
  @property({ type: String }) waypointFloorId = '';
  @property({ type: Array }) markerOptions: MarkerOption[] = [];
  @property({ type: Array }) waypointOptions: MarkerOption[] = [];
  @property({ type: Object }) findWaypointMarker: WaypointMarkerLookup = () => null;

  createRenderRoot() {
    return this;
  }

  private emit(name: string, detail?: Record<string, unknown>) {
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
  }

  render() {
    return html`
      <div class="space-y-8">
        <div class="flex flex-wrap gap-2">
          <ui-button
            type="button"
            variant="secondary"
            size="sm"
            icon="image"
            .label=${__('Aggiungi Opera')}
            @click=${() => this.emit('add-step', { type: VisitStepType.ARTWORK })}
            ?disabled=${!this.museumId || this.artworks.length === 0}
          ></ui-button>
          <span class="inline-flex items-center gap-1">
            <ui-button
              type="button"
              variant="secondary"
              size="sm"
              icon="tag"
              .label=${__('Approfondimento')}
              .title=${__(
                'Contenuto su un autore, un movimento, un periodo o il museo stesso — non legato a una singola opera.',
              )}
              @click=${() => this.emit('add-step', { type: VisitStepType.CONTENT })}
            ></ui-button>
            <ui-info-tip
              text=${__(
                'Contenuto su un autore, un movimento, un periodo o il museo stesso — non legato a una singola opera.',
              )}
            ></ui-info-tip>
          </span>
          <ui-button
            type="button"
            variant="secondary"
            size="sm"
            icon="info"
            .label=${__('Info logistica')}
            @click=${() => this.emit('add-step', { type: VisitStepType.LOGISTIC })}
          ></ui-button>
          <ui-button
            type="button"
            variant="secondary"
            size="sm"
            icon="arrow-right"
            .label=${__('Indicazioni')}
            @click=${() => this.emit('add-step', { type: VisitStepType.NAVIGATION })}
          ></ui-button>
          <span class="inline-flex items-center gap-1">
            <ui-button
              type="button"
              variant="secondary"
              size="sm"
              icon="location"
              .label=${__('Svolta percorso')}
              .title=${__(
                'Punto muto per far piegare la linea del percorso sulla mappa (es. una porta su un corridoio): nessun audio, non è una tappa.',
              )}
              @click=${() => this.emit('add-step', { type: VisitStepType.WAYPOINT })}
              ?disabled=${this.loadingFloors || this.floors.length === 0}
            ></ui-button>
            <ui-info-tip
              text=${__(
                'Punto muto per far piegare la linea del percorso sulla mappa (es. una porta su un corridoio): nessun audio, non è una tappa.',
              )}
            ></ui-info-tip>
          </span>
        </div>

        ${this.renderStepsContent()}
      </div>
    `;
  }

  private renderStepsContent() {
    if (!this.museumId) {
      return renderInlineEmptyState({
        icon: 'location',
        text: __('Seleziona prima un museo nella tab Informazioni'),
      });
    }

    if (this.steps.length === 0) {
      return renderInlineEmptyState({
        icon: 'list',
        text: __('Aggiungi il primo passaggio del percorso'),
      });
    }

    return html`
      <div class="space-y-3">
        ${repeat(
          this.steps,
          (step) => step.id,
          (step, index) => this.renderStepCard(step, index),
        )}
      </div>
    `;
  }

  private renderStepCard(step: VisitStep, index: number) {
    const isEditing = this.editingStepIndex === index;
    const isDragging = this.draggingIndex === index;
    const isDragOver = this.dragOverIndex === index;
    const stepTypeLabel = getVisitStepTypeLabel(step.type);

    return html`
      <div
        class="step-card p-5 rounded-xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 shadow-soft transition-all duration-200
          ${isEditing ? 'ring-2 ring-brand-500' : ''}
          ${isDragging ? 'opacity-50 scale-95' : ''}
          ${isDragOver ? 'ring-2 ring-brand-400 ring-dashed' : ''}"
        draggable=${isEditing ? 'false' : 'true'}
        @dragstart=${(e: DragEvent) => {
          if (this.editingStepIndex !== null) {
            e.preventDefault();
            return;
          }
          if (e.dataTransfer) {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', index.toString());
          }
          this.emit('drag-start', { index });
        }}
        @dragend=${() => this.emit('drag-end')}
        @dragover=${(e: DragEvent) => {
          e.preventDefault();
          if (e.dataTransfer) {
            e.dataTransfer.dropEffect = 'move';
          }
          this.emit('drag-over', { index });
        }}
        @dragleave=${() => this.emit('drag-leave')}
        @drop=${(e: DragEvent) => {
          e.preventDefault();
          this.emit('drop-step', { index });
        }}
      >
        <div class="flex items-start gap-4">
          <div class="flex flex-col items-center gap-1">
            <ui-icon-button
              icon="chevron-up"
              size="xs"
              .title=${__('Sposta su')}
              @click=${(e: Event) => {
                e.preventDefault();
                e.stopPropagation();
                this.emit('move-step-up', { index });
              }}
              .disabled=${index === 0}
            ></ui-icon-button>
            <div
              class="cursor-grab active:cursor-grabbing p-1 rounded hover:bg-surface-100 dark:hover:bg-surface-800 ${isEditing
                ? 'opacity-30 cursor-not-allowed'
                : ''}"
              .title=${__('Trascina per riordinare')}
            >
              <span
                class="w-8 h-8 flex items-center justify-center rounded-full bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 font-semibold text-sm"
              >
                ${index + 1}
              </span>
            </div>
            <ui-icon-button
              icon="chevron-down"
              size="xs"
              .title=${__('Sposta giù')}
              @click=${(e: Event) => {
                e.preventDefault();
                e.stopPropagation();
                this.emit('move-step-down', { index });
              }}
              .disabled=${index === this.steps.length - 1}
            ></ui-icon-button>
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-2">
              <ui-badge variant="outline" .label=${stepTypeLabel}></ui-badge>
              ${step.isOptional
                ? html`<ui-badge variant="secondary" .label=${__('Opzionale')}></ui-badge>`
                : nothing}
            </div>

            ${isEditing ? this.renderStepEditor(step, index) : this.renderStepPreview(step)}
          </div>
          <div class="flex items-center gap-1">
            ${isEditing
              ? html`
                  <ui-icon-button
                    icon="check"
                    variant="brand"
                    .title=${__('Chiudi')}
                    @click=${() => this.emit('close-editing-step')}
                  ></ui-icon-button>
                  <ui-icon-button
                    icon="trash"
                    variant="danger"
                    .title=${__('Rimuovi')}
                    @click=${() => this.emit('remove-step', { index })}
                  ></ui-icon-button>
                `
              : html`
                  <ui-icon-button
                    icon="edit"
                    .title=${__('Modifica')}
                    @click=${() => this.emit('start-editing-step', { index })}
                  ></ui-icon-button>
                  <ui-icon-button
                    icon="trash"
                    variant="danger"
                    .title=${__('Rimuovi')}
                    @click=${() => this.emit('remove-step', { index })}
                  ></ui-icon-button>
                `}
          </div>
        </div>
      </div>
    `;
  }

  private renderStepPreview(step: VisitStep) {
    switch (step.type) {
      case VisitStepType.ARTWORK: {
        const artwork = this.artworks.find((a) => a.wikidataId === step.artworkId);
        return html`
          <div class="flex items-center gap-3">
            <div
              class="relative w-12 h-12 bg-surface-100 dark:bg-surface-800 rounded overflow-hidden flex-shrink-0"
            >
              ${artwork?.image
                ? html`
                    <img
                      src="${artwork.image}"
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
                      size="sm"
                      hidden
                      class="absolute inset-0"
                    ></ui-image-placeholder>
                  `
                : html`<ui-image-placeholder type="artwork" size="sm"></ui-image-placeholder>`}
            </div>
            <div>
              <p class="font-medium text-surface-900 dark:text-white">
                ${artwork?.title || __("Seleziona un'opera")}
              </p>
              ${artwork?.author
                ? html`<p class="text-sm text-surface-500">${artwork.author}</p>`
                : nothing}
            </div>
          </div>
        `;
      }
      case VisitStepType.LOGISTIC:
        return html`
          <div>
            <p class="font-medium text-surface-900 dark:text-white">
              ${step.logisticTitle || __('Info logistica')}
            </p>
            ${step.logisticText
              ? html`<p class="text-sm text-surface-500 line-clamp-2">${step.logisticText}</p>`
              : nothing}
            ${this.renderMapAssociationBadge(step)}
          </div>
        `;
      case VisitStepType.NAVIGATION:
        return html`
          <div>
            <p class="font-medium text-surface-900 dark:text-white">
              ${step.fromRoom && step.toRoom
                ? `${__('Da')} ${step.fromRoom} ${__('a')} ${step.toRoom}`
                : __('Indicazioni di navigazione')}
            </p>
            ${step.navigationText
              ? html`<p class="text-sm text-surface-500 line-clamp-2">${step.navigationText}</p>`
              : nothing}
            ${step.navigationVisual === 'map'
              ? html`<p class="text-xs text-brand-600 dark:text-brand-400 mt-1">
                  🗺️ ${__("Mostra la mappa integrata invece di un'immagine")}
                </p>`
              : nothing}
            ${this.renderMapAssociationBadge(step)}
          </div>
        `;
      case VisitStepType.WAYPOINT: {
        const waypoint = this.findWaypointMarker(step.mapMarkerId);
        const floorName = waypoint
          ? this.floors.find((f) => f.id === waypoint.floorId)?.name || waypoint.floorId
          : null;
        return html`
          <div>
            <p class="font-medium text-surface-900 dark:text-white">
              ${waypoint ? waypoint.label : __('Seleziona un waypoint sulla mappa')}
            </p>
            ${floorName ? html`<p class="text-sm text-surface-500">${floorName}</p>` : nothing}
          </div>
        `;
      }
      case VisitStepType.CONTENT: {
        const count = step.itemIds?.length || 0;
        return html`
          <div>
            <p class="font-medium text-surface-900 dark:text-white">
              ${step.contentReferenceType
                ? getReferenceTypeLabel(step.contentReferenceType)
                : __('Seleziona un tipo di approfondimento')}
            </p>
            ${count > 0
              ? html`<p class="text-sm text-surface-500">
                  ${count} ${count === 1 ? __('contenuto') : __('contenuti')}
                </p>`
              : nothing}
          </div>
        `;
      }
    }
  }

  // Riga "📍 associato a: X" nell'anteprima, solo se scelto un punto sulla mappa.
  private renderMapAssociationBadge(step: VisitStep) {
    if (!step.mapMarkerId) return nothing;
    const marker = this.findWaypointMarker(step.mapMarkerId);
    return html`<p class="text-xs text-surface-400 mt-1">
      📍 ${__('Associato a')}: ${marker?.label || __('punto sulla mappa')}
    </p>`;
  }

  private renderStepEditor(step: VisitStep, index: number) {
    return html`
      <visit-step-editor
        .step=${step}
        .index=${index}
        .availableItems=${this.availableItems}
        .artworks=${this.artworks}
        .loadingArtworks=${this.loadingArtworks}
        .loadingFloors=${this.loadingFloors}
        .markerOptions=${this.markerOptions}
        .waypointFloorOptions=${this.floors.map((f) => ({ value: f.id, label: f.name }))}
        .waypointOptions=${this.waypointOptions}
        .waypointFloorId=${this.waypointFloorId}
        @step-update=${(e: CustomEvent) => {
          e.stopPropagation();
          this.emit('step-update', { index, updates: e.detail.updates });
        }}
        @load-artwork-items=${(e: CustomEvent) => {
          e.stopPropagation();
          this.emit('load-artwork-items', { artworkId: e.detail.artworkId });
        }}
        @load-reference-items=${(e: CustomEvent) => {
          e.stopPropagation();
          this.emit('load-reference-items', { referenceType: e.detail.referenceType });
        }}
        @waypoint-floor-change=${(e: CustomEvent) => {
          e.stopPropagation();
          this.emit('waypoint-floor-change', { index, floorId: e.detail.floorId });
        }}
      ></visit-step-editor>
    `;
  }
}
