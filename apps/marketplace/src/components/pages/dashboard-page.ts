import { LitElement, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { UserRole, type User, type Museum, type Artwork, type Visit } from '@artaround/shared';
import { preferencesService } from '../../services/preferences.service';
import { artworkService } from '../../services/artwork.service';
import { visitService } from '../../services/visit.service';
import { userService } from '../../services/user.service';
import '../museums/museum-selector';
import '../ui/ui-card';
import '../ui/ui-badge';
import '../ui/ui-button';
import '../ui/ui-icon';
import '../ui/ui-page-header';
import '../ui/ui-alert';
import '../ui/ui-loading';
import '../ui/ui-stat-card';
import '../ui/ui-list-row';

@customElement('dashboard-page')
export class DashboardPage extends LitElement {
  @property({ type: Object }) user: User | null = null;
  @state() private selectedMuseum: Museum | null = null;
  @state() private showMuseumSelector = false;
  @state() private loading = false;
  @state() private loadError = '';
  @state() private totalArtworks = 0;
  @state() private totalVisits = 0;
  @state() private totalPublishedVisits = 0;
  @state() private totalActiveUsers = 0;
  @state() private recentArtworks: Artwork[] = [];
  @state() private recentVisits: Visit[] = [];

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.selectedMuseum = preferencesService.getSelectedMuseum() as Museum | null;
    window.addEventListener('museum-changed', this.handleMuseumChanged as EventListener);
    this.loadDashboardData();
  }

  disconnectedCallback() {
    window.removeEventListener('museum-changed', this.handleMuseumChanged as EventListener);
    super.disconnectedCallback();
  }

  private handleMuseumChanged = (event: CustomEvent) => {
    this.selectedMuseum = event.detail || null;
    this.showMuseumSelector = false;
    this.loadDashboardData();
  };

  private handleMuseumSelected(e: CustomEvent) {
    this.selectedMuseum = e.detail;
  }

  private confirmMuseumSelection() {
    if (this.selectedMuseum) {
      preferencesService.setSelectedMuseum({
        _id: this.selectedMuseum._id,
        wikidataId: this.selectedMuseum.wikidataId,
        name: this.selectedMuseum.name,
      });
    }
  }

  private clearMuseumSelection() {
    preferencesService.clearSelectedMuseum();
  }

  private async loadDashboardData() {
    this.loading = true;
    this.loadError = '';

    this.totalArtworks = 0;
    this.totalVisits = 0;
    this.totalPublishedVisits = 0;
    this.recentArtworks = [];
    this.recentVisits = [];

    try {
      const museumId = this.selectedMuseum?.wikidataId || this.selectedMuseum?._id;

      if (museumId) {
        const [artworksResponse, visitsResponse, publishedVisitsResponse] = await Promise.all([
          artworkService.getArtworks({ museumId, page: 1, limit: 100 }),
          visitService.getVisits({ museumId, page: 1, limit: 100 }),
          visitService.getVisits({ museumId, isPublished: true, page: 1, limit: 1 }),
        ]);

        this.totalArtworks = artworksResponse.pagination.total;
        this.totalVisits = visitsResponse.pagination.total;
        this.totalPublishedVisits = publishedVisitsResponse.pagination.total;
        this.recentArtworks = [...artworksResponse.artworks]
          .sort(
            (a, b) =>
              new Date(String(b.createdAt || 0)).getTime() -
              new Date(String(a.createdAt || 0)).getTime(),
          )
          .slice(0, 5);
        this.recentVisits = [...visitsResponse.visits]
          .sort(
            (a, b) =>
              new Date(String(b.createdAt || 0)).getTime() -
              new Date(String(a.createdAt || 0)).getTime(),
          )
          .slice(0, 5);
      }

      if (this.user?.role === UserRole.ADMIN) {
        const users = await userService.getUsers({ page: 1, limit: 1, isActive: true });
        this.totalActiveUsers = users.pagination.total;
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      this.loadError = 'Errore nel caricamento dei dati reali della dashboard';
    } finally {
      this.loading = false;
    }
  }

  private formatDate(value?: string | Date): string {
    if (!value) return '-';
    try {
      return new Date(value).toLocaleDateString('it-IT');
    } catch {
      return '-';
    }
  }

  private renderStatCard(label: string, value: number, icon: string) {
    return html`<ui-stat-card .label=${label} .value=${value} .icon=${icon}></ui-stat-card>`;
  }

  private goToRoute(route: string) {
    this.dispatchEvent(
      new CustomEvent('navigate', {
        detail: { route },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private handleRecentArtworkClick(artwork: Artwork) {
    this.dispatchEvent(
      new CustomEvent('open-artwork-detail', {
        detail: { artworkId: artwork._id || artwork.wikidataId },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private handleRecentVisitClick() {
    this.goToRoute('visits');
  }

  private getVisitStatusBadge(visit: Visit) {
    return visit.isPublished
      ? html`<ui-badge variant="success" size="sm" label="Pubblicata"></ui-badge>`
      : html`<ui-badge variant="warning" size="sm" label="Bozza"></ui-badge>`;
  }

  render() {
    return html`
      <div class="space-y-6 animate-fade-in">
        <ui-page-header
          .title=${'Buongiorno, ' + (this.user?.username?.split(' ')[0] || 'Admin')}
          description="Panoramica operativa del marketplace"
        >
        </ui-page-header>

        ${this.loadError
          ? html`<ui-alert
              variant="error"
              message=${this.loadError}
              dismissible
              @dismiss=${() => (this.loadError = '')}
            ></ui-alert>`
          : nothing}

        <ui-card padding="md">
          <div class="flex flex-col gap-4">
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="text-sm font-medium text-surface-700 dark:text-surface-300">
                  Museo attivo
                </p>
                <p class="text-lg font-semibold text-surface-900 dark:text-white">
                  ${this.selectedMuseum?.name || 'Nessun museo selezionato'}
                </p>
                ${this.selectedMuseum
                  ? html`
                      <p class="text-xs text-surface-500 mt-1">ID: ${this.selectedMuseum._id}</p>
                    `
                  : ''}
              </div>
              <div class="flex items-center gap-2">
                ${this.selectedMuseum
                  ? html`
                      <ui-button
                        variant="secondary"
                        size="sm"
                        label="Deseleziona"
                        @click=${this.clearMuseumSelection}
                      ></ui-button>
                    `
                  : ''}
                <ui-button
                  variant="secondary"
                  size="sm"
                  label=${this.showMuseumSelector ? 'Chiudi' : 'Cambia'}
                  @click=${() => (this.showMuseumSelector = !this.showMuseumSelector)}
                ></ui-button>
              </div>
            </div>

            ${this.showMuseumSelector
              ? html`
                  <div class="space-y-3">
                    <museum-selector
                      @museum-selected=${this.handleMuseumSelected}
                    ></museum-selector>
                    <div class="flex justify-end">
                      <ui-button
                        variant="primary"
                        size="sm"
                        label="Conferma museo"
                        @click=${this.confirmMuseumSelection}
                      ></ui-button>
                    </div>
                  </div>
                `
              : ''}
          </div>
        </ui-card>

        ${this.loading
          ? html`<ui-loading></ui-loading>`
          : html`
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                ${this.renderStatCard('Opere nel museo', this.totalArtworks, 'image')}
                ${this.renderStatCard('Visite nel museo', this.totalVisits, 'document')}
                ${this.renderStatCard('Visite pubblicate', this.totalPublishedVisits, 'check')}
                ${this.user?.role === UserRole.ADMIN
                  ? this.renderStatCard('Utenti attivi', this.totalActiveUsers, 'users')
                  : this.renderStatCard('Museo selezionato', this.selectedMuseum ? 1 : 0, 'folder')}
              </div>

              <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ui-card padding="none">
                  <div
                    class="px-5 py-4 border-b border-surface-200 dark:border-surface-800 flex items-center justify-between"
                  >
                    <h3 class="font-semibold text-surface-900 dark:text-white">
                      Ultime opere create
                    </h3>
                    <ui-button
                      variant="ghost"
                      size="xs"
                      label="Apri opere"
                      @click=${() => this.goToRoute('artworks')}
                    ></ui-button>
                  </div>
                  <div class="divide-y divide-surface-200 dark:divide-surface-800">
                    ${this.recentArtworks.length === 0
                      ? html`<p class="px-5 py-4 text-sm text-surface-500">
                          Nessuna opera disponibile
                        </p>`
                      : this.recentArtworks.map(
                          (artwork) => html`
                            <ui-list-row
                              .title=${artwork.title || artwork.wikidataId}
                              .subtitle=${`${artwork.author || 'Autore non specificato'} • ${this.formatDate(artwork.updatedAt || artwork.createdAt)}`}
                              .renderTrailing=${() =>
                                html`<ui-badge
                                  variant="secondary"
                                  size="sm"
                                  .label=${artwork.artworkType}
                                ></ui-badge>`}
                              @click=${() => this.handleRecentArtworkClick(artwork)}
                            ></ui-list-row>
                          `,
                        )}
                  </div>
                </ui-card>

                <ui-card padding="none">
                  <div
                    class="px-5 py-4 border-b border-surface-200 dark:border-surface-800 flex items-center justify-between"
                  >
                    <h3 class="font-semibold text-surface-900 dark:text-white">Ultime visite</h3>
                    <ui-button
                      variant="ghost"
                      size="xs"
                      label="Apri visite"
                      @click=${() => this.goToRoute('visits')}
                    ></ui-button>
                  </div>
                  <div class="divide-y divide-surface-200 dark:divide-surface-800">
                    ${this.recentVisits.length === 0
                      ? html`<p class="px-5 py-4 text-sm text-surface-500">
                          Nessuna visita disponibile
                        </p>`
                      : this.recentVisits.map(
                          (visit) => html`
                            <ui-list-row
                              .title=${visit.title || visit._id}
                              .subtitle=${`${visit.steps?.length || 0} step • ${this.formatDate(visit.updatedAt || visit.createdAt)}`}
                              .renderTrailing=${() => html`${this.getVisitStatusBadge(visit)}`}
                              @click=${this.handleRecentVisitClick}
                            ></ui-list-row>
                          `,
                        )}
                  </div>
                </ui-card>
              </div>
            `}
        ${!this.selectedMuseum
          ? html`<ui-alert
              variant="info"
              title="Nessun museo attivo"
              message="Per lavorare su opere e configurazioni devi prima selezionare un museo."
            ></ui-alert>`
          : nothing}
      </div>
    `;
  }
}
