/*
 * File: /src/components/museums/floor-manager.ts                                        *
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
import type { MuseumFloor } from '@artaround/shared';
import { modalService } from '../../services/modal.service';
import '../ui/ui-button';
import '../ui/ui-input';
import '../ui/ui-icon-button';
import '../ui/ui-info-tip';
import { __ } from '../../services/i18n.service';

/**
 * Lista dei piani del museo: aggiunta, modifica e upload della piantina SVG.
 */
@customElement('floor-manager')
export class FloorManager extends LitElement {
  // ─── Ciclo di vita ───────────────────────────────────────────
  createRenderRoot() {
    return this;
  }

  @property({ type: Array })
  floors: MuseumFloor[] = [];

  @property({ type: String })
  selectedFloorId: string | null = null;

  @property({ type: Boolean })
  loading = false;

  @state()
  private showAddForm = false;

  @state()
  private collapsed = true;

  @state()
  private editingFloor: MuseumFloor | null = null;

  @state()
  private newFloor = {
    id: '',
    name: '',
    level: 0,
    svgContent: '',
    dimensions: { width: 800, height: 600 },
  };

  // ─── Render principale ────────────────────────────────────────
  render() {
    const showContent = this.showAddForm || !this.collapsed;

    return html`
      <div
        class="bg-white dark:bg-surface-800 rounded-lg overflow-hidden border border-surface-200 dark:border-surface-700"
      >
        <div
          class="flex justify-between items-start p-4 bg-surface-50 dark:bg-surface-700 border-b border-surface-200 dark:border-surface-600"
        >
          <h3
            class="flex items-center gap-1.5 flex-wrap text-surface-900 dark:text-white font-medium text-base m-0"
          >
            📐 ${__('Piani del Museo')}
            <ui-info-tip
              variant="inline"
              text=${__(
                'Il "Livello" (es. -1, 0, 1) è un valore semantico per l\'ordinamento tra piani, non l\'ordine in questa lista. "Collegamenti" è un conteggio di sola lettura (scale/ascensori tra piani) — non gestibile da qui.',
              )}
            ></ui-info-tip>
          </h3>
          <div class="flex items-center gap-1">
            <ui-icon-button
              icon=${this.showAddForm ? 'x' : 'plus'}
              size="sm"
              variant="brand"
              .title=${this.showAddForm ? __('Annulla') : __('Aggiungi Piano')}
              @click=${() => (this.showAddForm = !this.showAddForm)}
            ></ui-icon-button>
            <ui-icon-button
              icon=${this.collapsed ? 'chevron-down' : 'chevron-up'}
              size="sm"
              .title=${this.collapsed ? __('Espandi') : __('Comprimi')}
              @click=${() => (this.collapsed = !this.collapsed)}
            ></ui-icon-button>
          </div>
        </div>

        ${showContent
          ? html`
              ${this.showAddForm ? this.renderAddForm() : nothing}
              <div class="max-h-[32rem] overflow-y-auto">
                ${this.floors.length > 0
                  ? this.floors.map((floor) => this.renderFloorItem(floor))
                  : this.renderEmptyState()}
              </div>
            `
          : nothing}
      </div>
    `;
  }

  // ─── Helper di render ──────────────────────────────────────
  private renderFloorItem(floor: MuseumFloor) {
    const markerCount = floor.markers?.length || 0;
    const connectionCount = floor.connections?.length || 0;
    const isActive = this.selectedFloorId === floor.id;

    return html`
      <div
        class="flex items-center gap-3 p-3 border-b border-surface-100 dark:border-surface-600 cursor-pointer transition-colors hover:bg-surface-50 dark:hover:bg-surface-700 ${isActive
          ? 'bg-brand-50 dark:bg-surface-600 border-l-4 border-l-brand-500'
          : ''}"
        @click=${() => this.selectFloor(floor)}
      >
        <div
          class="w-10 h-10 flex items-center justify-center bg-surface-100 dark:bg-surface-600 rounded-lg text-surface-900 dark:text-white font-bold text-sm"
        >
          ${floor.level}
        </div>
        <div class="flex-1 min-w-0">
          <div class="text-surface-900 dark:text-white font-medium truncate">${floor.name}</div>
          <div class="text-surface-500 dark:text-surface-400 text-xs">
            ${floor.dimensions.width}×${floor.dimensions.height}px • ${markerCount} ${__('marker')}
            • ${connectionCount} ${__('collegamenti')}
          </div>
        </div>
        <div class="flex gap-1">
          <button
            class="p-1.5 rounded hover:bg-surface-200 dark:hover:bg-surface-500 text-surface-500 dark:text-surface-400 hover:text-surface-900 dark:hover:text-white transition-colors"
            @click=${(e: Event) => this.editFloor(e, floor)}
            .title=${__('Modifica')}
          >
            ✏️
          </button>
          <button
            class="p-1.5 rounded hover:bg-danger-600 text-surface-500 dark:text-surface-400 hover:text-white transition-colors"
            @click=${(e: Event) => this.deleteFloor(e, floor)}
            .title=${__('Elimina')}
          >
            🗑️
          </button>
        </div>
      </div>
    `;
  }

  private renderAddForm() {
    const isEditing = this.editingFloor !== null;

    return html`
      <div
        class="p-4 bg-surface-50 dark:bg-surface-700 border-b border-surface-200 dark:border-surface-600"
      >
        <div class="grid grid-cols-3 gap-3 mb-3">
          <ui-input
            .label=${__('ID Piano')}
            .help=${__(
              'Identificatore tecnico interno (usato nei link e nei dati salvati) — non è mai mostrato ai visitatori, che vedono solo il campo "Nome" qui a fianco. Non modificabile dopo la creazione.',
            )}
            .placeholder=${__('piano-terra')}
            .value=${this.newFloor.id}
            ?disabled=${isEditing}
            @input-change=${(e: CustomEvent) => (this.newFloor.id = e.detail.value)}
          ></ui-input>
          <ui-input
            .label=${__('Nome')}
            .placeholder=${__('Piano Terra')}
            .value=${this.newFloor.name}
            @input-change=${(e: CustomEvent) => (this.newFloor.name = e.detail.value)}
          ></ui-input>
          <ui-input
            .label=${__('Livello')}
            .help=${__(
              'Valore numerico per ordinare i piani in senso logico (es. -1 seminterrato, 0 piano terra, 1 primo piano) — non è la posizione in questa lista.',
            )}
            type="number"
            .placeholder=${__('0')}
            .value=${String(this.newFloor.level)}
            @input-change=${(e: CustomEvent) =>
              (this.newFloor.level = parseInt(e.detail.value) || 0)}
          ></ui-input>
        </div>
        <div
          class="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all mb-3 ${this
            .newFloor.svgContent
            ? 'border-success-500 bg-success-500/10'
            : 'border-surface-300 dark:border-surface-500 hover:border-brand-500 hover:bg-brand-500/10'}"
          @click=${() => this.triggerFileUpload()}
          @dragover=${(e: DragEvent) => e.preventDefault()}
          @drop=${this.handleFileDrop}
        >
          <input
            type="file"
            accept=".svg,image/svg+xml"
            class="hidden"
            @change=${this.handleFileSelect}
          />
          <div class="text-3xl mb-2">${this.newFloor.svgContent ? '✅' : '📄'}</div>
          <div class="text-surface-500 dark:text-surface-400 text-sm">
            ${this.newFloor.svgContent
              ? __('File SVG caricato - Clicca per cambiare')
              : __('Trascina qui un file SVG o clicca per selezionare')}
          </div>
        </div>
        ${this.newFloor.svgContent
          ? html`
              <div
                class="max-h-36 overflow-hidden rounded bg-surface-100 dark:bg-surface-900 mb-3 p-2 flex justify-center"
              >
                <div class="svg-preview-container" .innerHTML=${this.newFloor.svgContent}></div>
              </div>
            `
          : nothing}
        <div class="grid grid-cols-2 gap-3 mb-3">
          <ui-input
            .label=${__('Larghezza')}
            type="number"
            .value=${String(this.newFloor.dimensions.width)}
            @input-change=${(e: CustomEvent) =>
              (this.newFloor.dimensions.width = parseInt(e.detail.value) || 800)}
          ></ui-input>
          <ui-input
            .label=${__('Altezza')}
            type="number"
            .value=${String(this.newFloor.dimensions.height)}
            @input-change=${(e: CustomEvent) =>
              (this.newFloor.dimensions.height = parseInt(e.detail.value) || 600)}
          ></ui-input>
        </div>
        <div class="flex gap-2 justify-end">
          <ui-button
            variant="secondary"
            .label=${__('Annulla')}
            @click=${this.cancelForm}
          ></ui-button>
          <ui-button
            variant="primary"
            .label=${isEditing ? __('Salva Modifiche') : __('Aggiungi Piano')}
            ?disabled=${!this.isFormValid()}
            ?loading=${this.loading}
            @click=${this.submitForm}
          ></ui-button>
        </div>
      </div>
    `;
  }

  private renderEmptyState() {
    return html`
      <div class="p-10 text-center text-surface-500 dark:text-surface-400">
        <div class="text-5xl mb-3">🏛️</div>
        <p class="m-0">${__('Nessun piano configurato')}</p>
        <p class="text-xs mt-1 m-0">${__('Aggiungi i piani del museo per iniziare')}</p>
      </div>
    `;
  }

  // ─── Azioni (upload / CRUD) ─────────────────────────────
  private triggerFileUpload() {
    const input = this.querySelector('input[type="file"]') as HTMLInputElement;
    input?.click();
  }

  private async handleFileSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      await this.processSvgFile(file);
    }
  }

  private async handleFileDrop(e: DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer?.files[0];
    if (file && file.type === 'image/svg+xml') {
      await this.processSvgFile(file);
    }
  }

  private async processSvgFile(file: File) {
    const text = await file.text();
    this.newFloor.svgContent = text;

    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'image/svg+xml');
    const svg = doc.querySelector('svg');

    if (svg) {
      const viewBox = svg.getAttribute('viewBox');
      if (viewBox) {
        const [, , w, h] = viewBox.split(' ').map(Number);
        if (w && h) {
          this.newFloor.dimensions = { width: w, height: h };
        }
      } else {
        const width = parseInt(svg.getAttribute('width') || '800');
        const height = parseInt(svg.getAttribute('height') || '600');
        this.newFloor.dimensions = { width, height };
      }
    }

    this.requestUpdate();
  }

  private selectFloor(floor: MuseumFloor) {
    this.dispatchEvent(
      new CustomEvent('floor-select', {
        detail: floor,
        bubbles: true,
        composed: true,
      }),
    );
  }

  private editFloor(e: Event, floor: MuseumFloor) {
    e.stopPropagation();
    this.editingFloor = floor;
    this.newFloor = {
      id: floor.id,
      name: floor.name,
      level: floor.level,
      svgContent: floor.svgContent,
      dimensions: { ...floor.dimensions },
    };
    this.showAddForm = true;
  }

  private async deleteFloor(e: Event, floor: MuseumFloor) {
    e.stopPropagation();

    const confirmed = await modalService.confirm({
      title: __('Elimina piano'),
      message: `Sei sicuro di voler eliminare "${floor.name}"?`,
      confirmLabel: 'Elimina',
      variant: 'danger',
    });

    if (confirmed) {
      this.dispatchEvent(
        new CustomEvent('floor-delete', {
          detail: floor,
          bubbles: true,
          composed: true,
        }),
      );
    }
  }

  private cancelForm() {
    this.showAddForm = false;
    this.editingFloor = null;
    this.resetForm();
  }

  private resetForm() {
    this.newFloor = {
      id: '',
      name: '',
      level: 0,
      svgContent: '',
      dimensions: { width: 800, height: 600 },
    };
  }

  private isFormValid(): boolean {
    return !!(
      this.newFloor.id &&
      this.newFloor.name &&
      this.newFloor.svgContent &&
      this.newFloor.dimensions.width > 0 &&
      this.newFloor.dimensions.height > 0
    );
  }

  private submitForm() {
    if (!this.isFormValid()) return;

    const eventName = this.editingFloor ? 'floor-update' : 'floor-add';
    const floorData: MuseumFloor = {
      ...this.newFloor,
      markers: this.editingFloor?.markers || [],
      connections: this.editingFloor?.connections || [],
    };

    this.dispatchEvent(
      new CustomEvent(eventName, {
        detail: floorData,
        bubbles: true,
        composed: true,
      }),
    );

    this.cancelForm();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'floor-manager': FloorManager;
  }
}
