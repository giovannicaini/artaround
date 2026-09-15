/*
 * File: /src/components/visits/visit-step-editor.ts                                     *
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
import {
  VisitStepType,
  ItemReferenceType,
  type Artwork,
  type Item,
  type VisitStep,
} from '@artaround/shared';
import { __ } from '../../services/i18n.service';
import { getReferenceTypeOptions } from '../../utils/enum-labels';
import '../ui/ui-input';
import '../ui/ui-select';
import '../ui/ui-button';
import '../ui/ui-textarea';
import '../ui/ui-checkbox';
import '../ui/ui-filter-tabs';
import '../ui/image-editor';

export type MarkerOption = { value: string; label: string };

// Tipi di riferimento per una tappa CONTENT — non ARTWORK, che ha la sua tappa dedicata.
function getContentStepReferenceTypeOptions() {
  return getReferenceTypeOptions().filter((option) => option.value !== ItemReferenceType.ARTWORK);
}

/**
 * Editor della tappa in modifica nello step-builder di una visita, dispatcher per tipo.
 */
@customElement('visit-step-editor')
export class VisitStepEditor extends LitElement {
  @property({ type: Object }) step!: VisitStep;
  @property({ type: Number }) index = 0;
  @property({ type: Array }) availableItems: Item[] = [];
  @property({ type: Array }) artworks: Artwork[] = [];
  @property({ type: Boolean }) loadingArtworks = false;
  @property({ type: Boolean }) loadingFloors = false;
  @property({ type: Array }) markerOptions: MarkerOption[] = [];
  @property({ type: Array }) waypointFloorOptions: MarkerOption[] = [];
  @property({ type: Array }) waypointOptions: MarkerOption[] = [];
  @property({ type: String }) waypointFloorId = '';

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.style.display = 'block';
  }

  private updateStep(updates: Partial<VisitStep>) {
    this.dispatchEvent(
      new CustomEvent('step-update', { detail: { updates }, bubbles: true, composed: true }),
    );
  }

  private loadArtworkItems(artworkId: string) {
    this.dispatchEvent(
      new CustomEvent('load-artwork-items', {
        detail: { artworkId },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private loadReferenceItems(referenceType: ItemReferenceType) {
    this.dispatchEvent(
      new CustomEvent('load-reference-items', {
        detail: { referenceType },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private changeWaypointFloor(floorId: string) {
    this.dispatchEvent(
      new CustomEvent('waypoint-floor-change', {
        detail: { floorId },
        bubbles: true,
        composed: true,
      }),
    );
  }

  render() {
    switch (this.step.type) {
      case VisitStepType.ARTWORK:
        return this.renderArtworkStepEditor();
      case VisitStepType.LOGISTIC:
        return this.renderLogisticStepEditor();
      case VisitStepType.NAVIGATION:
        return this.renderNavigationStepEditor();
      case VisitStepType.WAYPOINT:
        return this.renderWaypointStepEditor();
      case VisitStepType.CONTENT:
        return this.renderContentStepEditor();
    }
  }

  private renderContentStepEditor() {
    const step = this.step;
    return html`
      <div class="space-y-4 mt-3 pt-3 border-t border-surface-200 dark:border-surface-700">
        <ui-select
          .label=${__('Tipo di approfondimento')}
          .help=${__(
            'Determina quali Contenuti sono selezionabili qui sotto: solo quelli creati con lo stesso tipo di riferimento (Opera, Autore, Movimento, Periodo o Museo).',
          )}
          .value=${step.contentReferenceType || ''}
          .options=${getContentStepReferenceTypeOptions()}
          placeholder=${__('Seleziona un tipo')}
          @select-change=${async (e: CustomEvent) => {
            const contentReferenceType = e.detail.value as ItemReferenceType;
            // Cambiare tipo invalida la selezione precedente: gli item di un
            // tipo diverso non hanno senso per questa tappa.
            this.updateStep({ contentReferenceType, itemIds: [] });
            if (contentReferenceType) {
              this.loadReferenceItems(contentReferenceType);
            }
          }}
        ></ui-select>

        ${step.contentReferenceType ? this.renderItemChecklist() : nothing}

        <ui-input
          type="number"
          .label=${__('Durata stimata (secondi)')}
          .placeholder=${__('Es. 180')}
          .value=${String(step.estimatedDuration || '')}
          @input=${(e: InputEvent) =>
            this.updateStep({
              estimatedDuration: parseInt((e.target as HTMLInputElement).value) || undefined,
            })}
        ></ui-input>

        <ui-checkbox
          .label=${__('Passaggio opzionale')}
          .checked=${step.isOptional}
          @checkbox-change=${(e: CustomEvent) => this.updateStep({ isOptional: e.detail.checked })}
        ></ui-checkbox>
      </div>
    `;
  }

  private renderArtworkStepEditor() {
    const step = this.step;
    return html`
      <div class="space-y-4 mt-3 pt-3 border-t border-surface-200 dark:border-surface-700">
        <ui-select
          .label=${__('Opera')}
          .value=${step.artworkId || ''}
          .options=${this.artworks.map((a) => ({
            value: a.wikidataId,
            label: `${a.title} - ${a.author || __('Autore sconosciuto')}`,
          }))}
          placeholder=${this.loadingArtworks ? __('Caricamento...') : __("Seleziona un'opera")}
          ?disabled=${this.loadingArtworks}
          @select-change=${(e: CustomEvent) => {
            const artworkId = e.detail.value;
            this.updateStep({ artworkId });
            if (artworkId) {
              this.loadArtworkItems(artworkId);
            }
          }}
        ></ui-select>

        ${step.artworkId ? this.renderItemChecklist() : nothing}

        <ui-input
          type="number"
          .label=${__('Durata stimata (secondi)')}
          .placeholder=${__('Es. 180')}
          .value=${String(step.estimatedDuration || '')}
          @input=${(e: InputEvent) =>
            this.updateStep({
              estimatedDuration: parseInt((e.target as HTMLInputElement).value) || undefined,
            })}
        ></ui-input>

        <ui-checkbox
          .label=${__('Passaggio opzionale')}
          .checked=${step.isOptional}
          @checkbox-change=${(e: CustomEvent) => this.updateStep({ isOptional: e.detail.checked })}
        ></ui-checkbox>
      </div>
    `;
  }

  // Checklist contenuti condivisa tra tappe ARTWORK e CONTENT: entrambe scelgono da this.availableItems.
  private renderItemChecklist() {
    const step = this.step;
    if (this.availableItems.length === 0) return nothing;
    return html`
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <label class="block text-sm font-medium text-surface-700 dark:text-surface-300">
            ${__('Contenuti disponibili')}
          </label>
          <div class="flex gap-2">
            <ui-button
              type="button"
              variant="secondary"
              size="xs"
              .label=${__('Seleziona tutti')}
              @click=${() => {
                const allIds = this.availableItems.map((item) => item._id);
                this.updateStep({ itemIds: allIds });
              }}
            ></ui-button>
            <span class="text-surface-300">|</span>
            <ui-button
              type="button"
              variant="secondary"
              size="xs"
              .label=${__('Deseleziona tutti')}
              @click=${() => this.updateStep({ itemIds: [] })}
            ></ui-button>
          </div>
        </div>
        <div class="space-y-2">
          ${this.availableItems.map(
            (item) => html`
              <label
                class="flex items-center gap-2 p-2 rounded border border-surface-200 dark:border-surface-700 cursor-pointer hover:bg-surface-50 dark:hover:bg-surface-800"
              >
                <ui-checkbox
                  .checked=${step.itemIds?.includes(item._id)}
                  @checkbox-change=${(e: CustomEvent) => {
                    const checked = e.detail.checked;
                    const currentIds = step.itemIds || [];
                    const newIds = checked
                      ? [...currentIds, item._id]
                      : currentIds.filter((id) => id !== item._id);
                    this.updateStep({ itemIds: newIds });
                  }}
                ></ui-checkbox>
                <span class="flex-1 text-sm">
                  ${item.title}
                  <span class="text-surface-500">
                    - ${item.duration},
                    ${item.languageLevel}${item.authorName
                      ? html` · ${__('di')} ${item.authorName}`
                      : nothing}</span
                  >
                </span>
              </label>
            `,
          )}
        </div>
      </div>
    `;
  }

  // Associazione facoltativa a un punto della mappa, condivisa da LOGISTIC e NAVIGATION.
  private renderMapMarkerPicker() {
    const options = this.markerOptions;
    return html`
      <ui-select
        .label=${__('Punto sulla mappa (opzionale)')}
        .value=${this.step.mapMarkerId || ''}
        .options=${options}
        clearable
        placeholder=${this.loadingFloors
          ? __('Caricamento piani...')
          : options.length === 0
            ? __('Nessun marker sulla piantina di questo museo')
            : __('Nessuno')}
        ?disabled=${this.loadingFloors || options.length === 0}
        @select-change=${(e: CustomEvent) =>
          this.updateStep({ mapMarkerId: e.detail.value || undefined })}
      ></ui-select>
    `;
  }

  private renderLogisticStepEditor() {
    const step = this.step;
    return html`
      <div class="space-y-4 mt-3 pt-3 border-t border-surface-200 dark:border-surface-700">
        <ui-input
          .label=${__('Titolo')}
          .placeholder=${__('Es. Informazioni utili')}
          .value=${step.logisticTitle || ''}
          @input=${(e: InputEvent) =>
            this.updateStep({ logisticTitle: (e.target as HTMLInputElement).value })}
        ></ui-input>

        <ui-textarea
          .label=${__('Testo')}
          .placeholder=${__('Descrivi le informazioni logistiche...')}
          .value=${step.logisticText || ''}
          @input=${(e: InputEvent) =>
            this.updateStep({ logisticText: (e.target as HTMLTextAreaElement).value })}
          rows="3"
        ></ui-textarea>

        <ui-select
          .label=${__('Icona')}
          .value=${step.logisticIcon || 'info'}
          .options=${getLogisticIconOptions()}
          @select-change=${(e: CustomEvent) => this.updateStep({ logisticIcon: e.detail.value })}
        ></ui-select>

        ${this.renderMapMarkerPicker()}

        <ui-checkbox
          .label=${__('Passaggio opzionale')}
          .checked=${step.isOptional}
          @checkbox-change=${(e: CustomEvent) => this.updateStep({ isOptional: e.detail.checked })}
        ></ui-checkbox>
      </div>
    `;
  }

  private renderNavigationStepEditor() {
    const step = this.step;
    const visual = step.navigationVisual || 'image';
    return html`
      <div class="space-y-4 mt-3 pt-3 border-t border-surface-200 dark:border-surface-700">
        <div class="grid grid-cols-2 gap-4">
          <ui-input
            .label=${__('Da (sala/area)')}
            .placeholder=${__('Es. Sala 1')}
            .value=${step.fromRoom || ''}
            @input=${(e: InputEvent) =>
              this.updateStep({ fromRoom: (e.target as HTMLInputElement).value })}
          ></ui-input>

          <ui-input
            .label=${__('A (sala/area)')}
            .placeholder=${__('Es. Sala 3')}
            .value=${step.toRoom || ''}
            @input=${(e: InputEvent) =>
              this.updateStep({ toRoom: (e.target as HTMLInputElement).value })}
          ></ui-input>
        </div>

        <ui-textarea
          .label=${__('Indicazioni')}
          .placeholder=${__('Es. Prosegui dritto, alla fine del corridoio gira a sinistra...')}
          .value=${step.navigationText || ''}
          @input=${(e: InputEvent) =>
            this.updateStep({ navigationText: (e.target as HTMLTextAreaElement).value })}
          rows="3"
        ></ui-textarea>

        ${this.renderMapMarkerPicker()}

        <div>
          <p class="text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
            ${__('Immagine della tappa')}
          </p>
          <ui-filter-tabs
            .tabs=${[
              { value: 'image', label: __('Immagine') },
              { value: 'map', label: __('Mappa integrata') },
            ]}
            .value=${visual}
            @filter-change=${(e: CustomEvent) => {
              const nextVisual = e.detail.value as 'image' | 'map';
              // Le due modalità sono alternative: passando a "Mappa" l'immagine caricata perde senso.
              this.updateStep({
                navigationVisual: nextVisual,
                navigationImage: nextVisual === 'map' ? undefined : step.navigationImage,
              });
            }}
          ></ui-filter-tabs>
        </div>

        ${visual === 'image'
          ? html`
              <image-editor
                .label=${__('Immagine del percorso')}
                category="visits"
                .value=${step.navigationImage || ''}
                maxWidth=${1600}
                maxHeight=${1200}
                .maxOutputSizeMb=${1}
                defaultFormat="webp"
                @image-saved=${(e: CustomEvent) =>
                  this.updateStep({ navigationImage: e.detail.path || '' })}
              ></image-editor>
            `
          : html`
              <p class="text-sm text-surface-500 dark:text-surface-400">
                ${step.mapMarkerId
                  ? __(
                      "A questa tappa il Navigator mostrerà la mappa del museo centrata sul punto scelto sopra, invece di un'immagine.",
                    )
                  : __(
                      "A questa tappa il Navigator mostrerà la mappa del museo invece di un'immagine. Scegli anche un punto qui sopra per centrarla su un posto preciso.",
                    )}
              </p>
            `}

        <ui-checkbox
          .label=${__('Passaggio opzionale')}
          .checked=${step.isOptional}
          @checkbox-change=${(e: CustomEvent) => this.updateStep({ isOptional: e.detail.checked })}
        ></ui-checkbox>
      </div>
    `;
  }

  private renderWaypointStepEditor() {
    const step = this.step;
    return html`
      <div class="space-y-4 mt-3 pt-3 border-t border-surface-200 dark:border-surface-700">
        <p class="text-sm text-surface-500 dark:text-surface-400">
          ${__(
            'Punto muto, senza audio: serve solo a far piegare la linea del percorso sulla mappa (es. una porta su un corridoio) invece di tagliare dritto attraverso un muro.',
          )}
        </p>

        ${this.waypointFloorOptions.length > 1
          ? html`
              <ui-select
                .label=${__('Piano')}
                .value=${this.waypointFloorId}
                .options=${this.waypointFloorOptions}
                @select-change=${(e: CustomEvent) => this.changeWaypointFloor(e.detail.value)}
              ></ui-select>
            `
          : nothing}

        <ui-select
          .label=${__('Waypoint')}
          .value=${step.mapMarkerId || ''}
          .options=${this.waypointOptions}
          placeholder=${this.loadingFloors
            ? __('Caricamento piani...')
            : this.waypointOptions.length === 0
              ? __('Nessun waypoint su questo piano: creane uno da Piantina e mappa')
              : __('Seleziona un waypoint')}
          ?disabled=${this.loadingFloors || this.waypointOptions.length === 0}
          @select-change=${(e: CustomEvent) => this.updateStep({ mapMarkerId: e.detail.value })}
        ></ui-select>
      </div>
    `;
  }
}

function getLogisticIconOptions() {
  return [
    { value: 'ticket', label: `🎫 ${__('Biglietteria')}` },
    { value: 'info', label: `ℹ️ ${__('Informazioni')}` },
    { value: 'clock', label: `⏰ ${__('Orari')}` },
    { value: 'accessibility', label: `♿ ${__('Accessibilità')}` },
    { value: 'food', label: `🍽️ ${__('Ristoro')}` },
    { value: 'shop', label: `🛍️ ${__('Shop')}` },
    { value: 'toilet', label: `🚻 ${__('Servizi')}` },
    { value: 'wifi', label: `📶 ${__('WiFi')}` },
  ];
}
