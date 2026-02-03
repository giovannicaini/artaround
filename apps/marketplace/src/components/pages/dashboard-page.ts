import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { User } from '@artaround/shared';
import '../ui/ui-card';
import '../ui/ui-badge';
import '../ui/ui-button';
import '../ui/ui-icon';
import '../ui/ui-avatar';

@customElement('dashboard-page')
export class DashboardPage extends LitElement {
  @property({ type: Object }) user: User | null = null;

  createRenderRoot() {
    return this;
  }

  private stats = [
    { label: 'Opere Totali', value: '1,284', change: '+12%', positive: true, icon: 'image' },
    { label: 'Utenti Attivi', value: '842', change: '+8%', positive: true, icon: 'users' },
    { label: 'Visualizzazioni', value: '24.5K', change: '+23%', positive: true, icon: 'chart' },
    { label: 'Nuovi oggi', value: '38', change: '-5%', positive: false, icon: 'plus' },
  ];

  private recentArtworks = [
    {
      id: '1',
      title: 'Tramonto sul mare',
      artist: 'Mario Rossi',
      status: 'approved',
      date: '2 ore fa',
    },
    {
      id: '2',
      title: 'Ritratto moderno',
      artist: 'Laura Bianchi',
      status: 'pending',
      date: '4 ore fa',
    },
    {
      id: '3',
      title: 'Paesaggio urbano',
      artist: 'Giovanni Verdi',
      status: 'approved',
      date: '1 giorno fa',
    },
    {
      id: '4',
      title: 'Natura morta',
      artist: 'Anna Neri',
      status: 'rejected',
      date: '1 giorno fa',
    },
    {
      id: '5',
      title: 'Composizione astratta',
      artist: 'Paolo Gialli',
      status: 'pending',
      date: '2 giorni fa',
    },
  ];

  private recentUsers = [
    { name: 'Marco Rossi', email: 'marco@example.com', role: 'Artista', joined: '2 ore fa' },
    { name: 'Sofia Bianchi', email: 'sofia@example.com', role: 'Visitatore', joined: '5 ore fa' },
    { name: 'Luca Verdi', email: 'luca@example.com', role: 'Artista', joined: '1 giorno fa' },
  ];

  private renderStatCard(stat: (typeof this.stats)[0]) {
    return html`
      <ui-card padding="md">
        <div class="flex items-start justify-between">
          <div>
            <p class="text-sm font-medium text-surface-500 dark:text-surface-400">${stat.label}</p>
            <p class="text-2xl font-semibold text-surface-900 dark:text-white mt-1">
              ${stat.value}
            </p>
          </div>
          <div class="p-2 rounded-lg bg-brand-50 dark:bg-brand-900/30">
            <ui-icon
              name="${stat.icon}"
              size="sm"
              class="text-brand-600 dark:text-brand-400"
            ></ui-icon>
          </div>
        </div>
        <div class="flex items-center gap-1 mt-3">
          <span
            class="text-sm font-medium ${stat.positive
              ? 'text-success-600 dark:text-success-400'
              : 'text-danger-600 dark:text-danger-400'}"
          >
            ${stat.change}
          </span>
          <span class="text-xs text-surface-500">vs mese scorso</span>
        </div>
      </ui-card>
    `;
  }

  private getStatusBadge(status: string) {
    const variants: Record<string, { variant: string; label: string }> = {
      approved: { variant: 'success', label: 'Approvato' },
      pending: { variant: 'warning', label: 'In attesa' },
      rejected: { variant: 'danger', label: 'Rifiutato' },
    };
    const config = variants[status] || variants.pending;
    return html`<ui-badge
      variant="${config.variant}"
      size="sm"
      dot
      label="${config.label}"
    ></ui-badge>`;
  }

  render() {
    return html`
      <div class="space-y-6 animate-fade-in">
        <!-- Welcome -->
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 class="text-2xl font-semibold text-surface-900 dark:text-white">
              Buongiorno, ${this.user?.username?.split(' ')[0] || 'Admin'}
            </h2>
            <p class="text-sm text-surface-500 dark:text-surface-400 mt-1">
              Ecco cosa sta succedendo oggi nella piattaforma.
            </p>
          </div>
          <ui-button variant="primary" size="md" label="Nuova Opera" icon="plus"></ui-button>
        </div>

        <!-- Stats Grid -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          ${this.stats.map((stat) => this.renderStatCard(stat))}
        </div>

        <!-- Main Content Grid -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <!-- Recent Artworks Table -->
          <div class="lg:col-span-2">
            <ui-card padding="none">
              <div
                class="px-5 py-4 border-b border-surface-200 dark:border-surface-800 flex items-center justify-between"
              >
                <h3 class="font-semibold text-surface-900 dark:text-white">Opere Recenti</h3>
                <ui-button variant="ghost" size="xs" label="Vedi tutte"></ui-button>
              </div>
              <div class="overflow-x-auto">
                <table class="w-full">
                  <thead>
                    <tr class="border-b border-surface-200 dark:border-surface-800">
                      <th
                        class="px-5 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider"
                      >
                        Opera
                      </th>
                      <th
                        class="px-5 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider hidden sm:table-cell"
                      >
                        Artista
                      </th>
                      <th
                        class="px-5 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider"
                      >
                        Stato
                      </th>
                      <th
                        class="px-5 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider hidden md:table-cell"
                      >
                        Data
                      </th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-surface-200 dark:divide-surface-800">
                    ${this.recentArtworks.map(
                      (artwork) => html`
                        <tr
                          class="hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors"
                        >
                          <td class="px-5 py-4">
                            <div class="flex items-center gap-3">
                              <div
                                class="w-10 h-10 rounded-lg bg-surface-100 dark:bg-surface-800 flex items-center justify-center flex-shrink-0"
                              >
                                <ui-icon name="image" size="sm" class="text-surface-400"></ui-icon>
                              </div>
                              <span
                                class="text-sm font-medium text-surface-900 dark:text-white truncate max-w-[150px]"
                              >
                                ${artwork.title}
                              </span>
                            </div>
                          </td>
                          <td class="px-5 py-4 hidden sm:table-cell">
                            <span class="text-sm text-surface-600 dark:text-surface-400"
                              >${artwork.artist}</span
                            >
                          </td>
                          <td class="px-5 py-4">${this.getStatusBadge(artwork.status)}</td>
                          <td class="px-5 py-4 hidden md:table-cell">
                            <span class="text-sm text-surface-500">${artwork.date}</span>
                          </td>
                        </tr>
                      `,
                    )}
                  </tbody>
                </table>
              </div>
            </ui-card>
          </div>

          <!-- Recent Users -->
          <div>
            <ui-card padding="none">
              <div
                class="px-5 py-4 border-b border-surface-200 dark:border-surface-800 flex items-center justify-between"
              >
                <h3 class="font-semibold text-surface-900 dark:text-white">Nuovi Utenti</h3>
                <ui-button variant="ghost" size="xs" label="Vedi tutti"></ui-button>
              </div>
              <div class="divide-y divide-surface-200 dark:divide-surface-800">
                ${this.recentUsers.map(
                  (user) => html`
                    <div class="px-5 py-4 flex items-center gap-3">
                      <ui-avatar
                        initials="${user.name
                          .split(' ')
                          .map((n) => n[0])
                          .join('')}"
                        size="md"
                      ></ui-avatar>
                      <div class="flex-1 min-w-0">
                        <p class="text-sm font-medium text-surface-900 dark:text-white truncate">
                          ${user.name}
                        </p>
                        <p class="text-xs text-surface-500 truncate">${user.email}</p>
                      </div>
                      <ui-badge variant="default" size="sm" label="${user.role}"></ui-badge>
                    </div>
                  `,
                )}
              </div>
            </ui-card>

            <!-- Quick Actions -->
            <ui-card padding="md" class="mt-4">
              <h3 class="font-semibold text-surface-900 dark:text-white mb-4">Azioni Rapide</h3>
              <div class="space-y-2">
                <ui-button
                  variant="secondary"
                  size="sm"
                  block
                  label="Gestisci Opere"
                  icon="image"
                ></ui-button>
                <ui-button
                  variant="secondary"
                  size="sm"
                  block
                  label="Gestisci Utenti"
                  icon="users"
                ></ui-button>
                <ui-button
                  variant="secondary"
                  size="sm"
                  block
                  label="Impostazioni"
                  icon="cog"
                ></ui-button>
              </div>
            </ui-card>
          </div>
        </div>

        <!-- Chart Placeholder -->
        <ui-card padding="md">
          <div class="flex items-center justify-between mb-4">
            <h3 class="font-semibold text-surface-900 dark:text-white">
              Andamento Visualizzazioni
            </h3>
            <div class="flex gap-2">
              <ui-button variant="ghost" size="xs" label="7 giorni"></ui-button>
              <ui-button variant="secondary" size="xs" label="30 giorni"></ui-button>
              <ui-button variant="ghost" size="xs" label="1 anno"></ui-button>
            </div>
          </div>
          <div
            class="h-64 flex items-center justify-center bg-surface-50 dark:bg-surface-800/50 rounded-lg border-2 border-dashed border-surface-200 dark:border-surface-700"
          >
            <div class="text-center">
              <ui-icon
                name="chart"
                size="lg"
                class="text-surface-300 dark:text-surface-600 mx-auto"
              ></ui-icon>
              <p class="text-sm text-surface-400 mt-2">Grafico visualizzazioni</p>
            </div>
          </div>
        </ui-card>
      </div>
    `;
  }
}
