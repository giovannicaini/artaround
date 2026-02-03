import { LitElement, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { museumService } from '../../services/museum.service';
import type { Museum } from '@artaround/shared';
import '../ui/ui-card';
import '../ui/ui-icon';

@customElement('museum-selector')
export class MuseumSelector extends LitElement {
  @state() private museums: Museum[] = [];
  @state() private loading = true;
  @state() private error = '';
  @state() private selectedMuseumId: string | null = null;

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.loadMuseums();
  }

  private async loadMuseums() {
    this.loading = true;
    this.error = '';

    try {
      this.museums = await museumService.getMuseums();
    } catch (e) {
      console.error('Error loading museums:', e);
      this.error = 'Impossibile caricare i musei';
    } finally {
      this.loading = false;
    }
  }

  private selectMuseum(museum: Museum) {
    this.selectedMuseumId = museum._id;
    this.dispatchEvent(
      new CustomEvent('museum-selected', {
        detail: museum,
        bubbles: true,
        composed: true,
      }),
    );
  }

  private renderMuseumCard(museum: Museum) {
    const isSelected = this.selectedMuseumId === museum._id;

    return html`
      <div
        class="group cursor-pointer transition-all duration-200 ${isSelected
          ? 'ring-2 ring-brand-500 ring-offset-2'
          : ''}"
        @click=${() => this.selectMuseum(museum)}
      >
        <ui-card padding="none" hover>
          <!-- Image or Placeholder -->
          <div
            class="aspect-video bg-surface-100 dark:bg-surface-800 relative overflow-hidden rounded-t-xl"
          >
            ${museum.images && museum.images.length > 0
              ? html`
                  <img
                    src="${museum.images[0]}"
                    alt="${museum.name}"
                    class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                `
              : html`
                  <div class="w-full h-full flex items-center justify-center">
                    <ui-icon
                      name="image"
                      size="lg"
                      class="text-surface-300 dark:text-surface-600"
                    ></ui-icon>
                  </div>
                `}
            ${isSelected
              ? html`
                  <div
                    class="absolute top-3 right-3 w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center"
                  >
                    <ui-icon name="check" size="sm" class="text-white"></ui-icon>
                  </div>
                `
              : ''}
          </div>

          <!-- Content -->
          <div class="p-4">
            <h3
              class="font-semibold text-surface-900 dark:text-white mb-1 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors"
            >
              ${museum.name}
            </h3>
            <p class="text-sm text-surface-500 dark:text-surface-400 line-clamp-2 mb-3">
              ${museum.description || 'Nessuna descrizione disponibile'}
            </p>

            <!-- Location -->
            <div class="flex items-center gap-2 text-xs text-surface-400">
              <ui-icon name="location" size="xs"></ui-icon>
              <span
                >${museum.location?.city || 'Città non specificata'},
                ${museum.location?.country || ''}</span
              >
            </div>
          </div>
        </ui-card>
      </div>
    `;
  }

  render() {
    if (this.loading) {
      return html`
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          ${[1, 2, 3].map(
            () => html`
              <div class="animate-pulse">
                <div class="aspect-video bg-surface-200 dark:bg-surface-800 rounded-t-xl"></div>
                <div
                  class="p-4 bg-white dark:bg-surface-900 rounded-b-xl border border-t-0 border-surface-200 dark:border-surface-800"
                >
                  <div class="h-5 bg-surface-200 dark:bg-surface-700 rounded w-3/4 mb-2"></div>
                  <div class="h-4 bg-surface-200 dark:bg-surface-700 rounded w-full mb-1"></div>
                  <div class="h-4 bg-surface-200 dark:bg-surface-700 rounded w-2/3"></div>
                </div>
              </div>
            `,
          )}
        </div>
      `;
    }

    if (this.error) {
      return html`
        <div class="text-center py-12">
          <ui-icon name="warning" size="lg" class="text-danger-500 mx-auto mb-4"></ui-icon>
          <h3 class="text-lg font-semibold text-surface-900 dark:text-white mb-2">Errore</h3>
          <p class="text-sm text-surface-500 dark:text-surface-400 mb-4">${this.error}</p>
          <button
            @click=${this.loadMuseums}
            class="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors"
          >
            Riprova
          </button>
        </div>
      `;
    }

    if (this.museums.length === 0) {
      return html`
        <div class="text-center py-12">
          <ui-icon
            name="folder"
            size="lg"
            class="text-surface-300 dark:text-surface-600 mx-auto mb-4"
          ></ui-icon>
          <h3 class="text-lg font-semibold text-surface-900 dark:text-white mb-2">Nessun museo</h3>
          <p class="text-sm text-surface-500 dark:text-surface-400">
            Non ci sono musei disponibili al momento.
          </p>
        </div>
      `;
    }

    return html`
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        ${this.museums.map((museum) => this.renderMuseumCard(museum))}
      </div>
    `;
  }
}
