import { LitElement, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { museumService } from '../../services/museum.service';
import type { Museum } from '@artaround/shared';
import '../ui/ui-card';
import '../ui/ui-icon';
import '../ui/ui-image-placeholder';
import '../ui/ui-loading';
import '../ui/ui-alert';
import '../ui/ui-empty';

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
                    @error=${(e: Event) => {
                      const img = e.target as HTMLImageElement;
                      img.style.display = 'none';
                      img.parentElement
                        ?.querySelector('ui-image-placeholder')
                        ?.removeAttribute('hidden');
                    }}
                  />
                  <ui-image-placeholder
                    type="museum"
                    size="lg"
                    hidden
                    class="absolute inset-0"
                  ></ui-image-placeholder>
                `
              : html` <ui-image-placeholder type="museum" size="lg"></ui-image-placeholder> `}
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
      return html`<ui-loading size="lg" text="Caricamento musei..."></ui-loading>`;
    }

    if (this.error) {
      return html`
        <ui-alert
          variant="danger"
          title="Errore"
          .message=${this.error}
          showRetry
          @retry=${this.loadMuseums}
        ></ui-alert>
      `;
    }

    if (this.museums.length === 0) {
      return html`
        <ui-empty
          icon="folder"
          title="Nessun museo"
          description="Non ci sono musei disponibili al momento."
        ></ui-empty>
      `;
    }

    return html`
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        ${this.museums.map((museum) => this.renderMuseumCard(museum))}
      </div>
    `;
  }
}
