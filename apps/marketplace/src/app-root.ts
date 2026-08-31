import { LitElement, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { authService } from './services/auth.service';
import { preferencesService } from './services/preferences.service';
import { historyService, type HistoryState } from './services/history.service';
import { __ } from './services/i18n.service';
import { ContextualRole, ResourceType, UserRole, type User } from '@artaround/shared';

// Import components sempre necessari nella shell iniziale (login, layout)
import './components/auth/login-page';
import './components/layout/admin-sidebar';
import './components/layout/admin-header';
import './components/ui/ui-scroll-top';

// Le pagine vere e proprie vengono caricate on-demand (vedi PAGE_LOADERS più sotto):
// evita di mettere ~700KB di componenti nel bundle iniziale quando l'utente ne visita
// solo uno o due per sessione. Stesso pattern già usato per Leaflet in
// museums-management-page.ts (import() dinamico -> chunk separato).
const PAGE_LOADERS: Record<string, () => Promise<unknown>> = {
  dashboard: () => import('./components/pages/dashboard-page'),
  museums: () => import('./components/pages/museums-page'),
  'museums-management': () => import('./components/museums/museums-management-page'),
  'museum-edit': () => import('./components/museums/museums-management-page'),
  'navigator-customizations': () => import('./components/museums/museums-management-page'),
  'navigator-default-config': () => import('./components/navigator/navigator-default-config-page'),
  'museum-maps': () => import('./components/museums/museum-map-page'),
  artworks: () => import('./components/pages/artworks-page'),
  'author-area': () => import('./components/pages/author-area-page'),
  marketplace: () => import('./components/pages/marketplace-page'),
  purchases: () => import('./components/pages/purchases-page'),
  contents: () => import('./components/pages/contents-page'),
  visits: () => import('./components/visits/visits-page'),
  users: () => import('./components/pages/users-page'),
  settings: () => import('./components/pages/settings-page'),
};

@customElement('app-root')
export class AppRoot extends LitElement {
  // ─── Lifecycle ───────────────────────────────────────────
  createRenderRoot() {
    return this;
  }

  @state()
  private currentUser: User | null = null;

  @state()
  private currentRoute = 'dashboard';

  @state()
  private routeParams: Record<string, string> = {};

  // ─── Lifecycle ───────────────────────────────────────────
  @state()
  private pageTitle = 'Dashboard';

  @state()
  private sidebarCollapsed = false;

  @state()
  private loading = true;

  // Flag per evitare cicli durante la navigazione dalla history
  private isNavigatingFromHistory = false;

  // Tracking dei moduli-pagina caricati on-demand (vedi PAGE_LOADERS)
  private loadedPageModules = new Set<string>();
  private pendingPageModules = new Set<string>();

  connectedCallback() {
    super.connectedCallback();
    this.checkAuth();
    this.restoreHistoryState();
    window.addEventListener('museum-changed', this.handleMuseumChanged as EventListener);
    window.addEventListener('ui-language-changed', this.handleLanguageChanged as EventListener);
  }

  disconnectedCallback() {
    window.removeEventListener('museum-changed', this.handleMuseumChanged as EventListener);
    window.removeEventListener('ui-language-changed', this.handleLanguageChanged as EventListener);
    super.disconnectedCallback();
  }

  private handleLanguageChanged = (_event: CustomEvent) => {
    this.pageTitle = this.getRouteTitle(this.currentRoute);
  };

  private getRouteTitle(route: string): string {
    const labelByRoute: Record<string, string> = {
      dashboard: 'Dashboard',
      museums: 'Seleziona Museo',
      'museums-management': 'Gestione Musei',
      'museum-maps': 'Gestione Mappe',
      'museum-edit': 'Modifica Museo',
      artworks: 'Gestione Opere',
      'navigator-customizations': 'Configurazioni Navigator',
      'navigator-default-config': 'Configurazione default app navigator',
      'author-area': 'Area Autore',
      marketplace: 'Marketplace',
      purchases: 'Acquisti',
      contents: 'Contenuti',
      visits: 'Visite',
      users: 'Gestione Utenti',
      categories: 'Categorie',
      tags: 'Tag',
      settings: 'Impostazioni',
    };

    const label = labelByRoute[route] || 'Homepage';
    return __(label);
  }

  // ─── Auth & Navigation ───────────────────────────────────
  async checkAuth() {
    // Check if there's a token first - avoid unnecessary API calls
    const token = localStorage.getItem('authToken');
    if (!token) {
      this.loading = false;
      return;
    }

    try {
      this.currentUser = await authService.getCurrentUser();
    } catch (e) {
      console.error('Auth check failed:', e);
    } finally {
      this.loading = false;
    }
  }

  handleLogin(e: CustomEvent) {
    this.currentUser = e.detail;
  }

  handleLogout() {
    authService.logout();
    this.currentUser = null;
  }

  handleNavigate(e: CustomEvent) {
    const route = e.detail.route;

    if (route === 'logout') {
      this.handleLogout();
      return;
    }

    if (
      route === 'author-area' &&
      (!this.currentUser ||
        (this.currentUser.role !== UserRole.AUTHOR && this.currentUser.role !== UserRole.ADMIN))
    ) {
      this.currentRoute = 'dashboard';
      this.pageTitle = this.getRouteTitle('dashboard');
      this.pushToHistory('dashboard', {}, this.getRouteTitle('dashboard'));
      return;
    }

    if (this.requiresSelectedMuseum(route) && !this.hasSelectedMuseum()) {
      this.redirectToMuseumsSelection();
      return;
    }

    if (this.requiresMuseumConfigAccess(route) && !this.canAccessMuseumConfigArea()) {
      this.currentRoute = 'dashboard';
      this.pageTitle = this.getRouteTitle('dashboard');
      this.pushToHistory('dashboard', {}, this.getRouteTitle('dashboard'));
      return;
    }

    if (route === 'navigator-default-config' && this.currentUser?.role !== UserRole.ADMIN) {
      this.currentRoute = 'dashboard';
      this.pageTitle = this.getRouteTitle('dashboard');
      this.pushToHistory('dashboard', {}, this.getRouteTitle('dashboard'));
      return;
    }

    this.currentRoute = route;

    // Scroll to top on navigation
    window.scrollTo(0, 0);

    this.pageTitle = this.getRouteTitle(route);

    // Push to history (only if not navigating from history)
    if (!this.isNavigatingFromHistory) {
      this.pushToHistory(route, this.routeParams, this.pageTitle);
    }
  }

  // ─── Route Renderers ─────────────────────────────────────
  /**
   * Assicura che il componente della pagina richiesta sia caricato prima di renderizzarla.
   * Ritorna true se già disponibile (nessuna pagina da caricare, o già caricata),
   * false se il caricamento è in corso: in quel caso renderPage() mostra uno spinner
   * e si aggiorna da sola (requestUpdate) appena il chunk arriva.
   */
  private ensurePageLoaded(route: string): boolean {
    const loader = PAGE_LOADERS[route];
    if (!loader || this.loadedPageModules.has(route)) {
      return true;
    }

    if (!this.pendingPageModules.has(route)) {
      this.pendingPageModules.add(route);
      loader()
        .then(() => {
          this.loadedPageModules.add(route);
        })
        .catch((error) => {
          console.error(`Errore nel caricamento della pagina "${route}":`, error);
        })
        .finally(() => {
          this.pendingPageModules.delete(route);
          this.requestUpdate();
        });
    }

    return false;
  }

  private renderPageLoading() {
    return html`
      <div class="flex items-center justify-center min-h-[300px]">
        <div
          class="w-8 h-8 rounded-full border-2 border-brand-500 border-t-transparent animate-spin"
        ></div>
      </div>
    `;
  }

  renderPage() {
    if (!this.ensurePageLoaded(this.currentRoute)) {
      return this.renderPageLoading();
    }

    switch (this.currentRoute) {
      case 'dashboard':
        return html`<dashboard-page .user=${this.currentUser}></dashboard-page>`;
      case 'museums':
        return html`<museums-page
          .user=${this.currentUser}
          @museum-confirmed=${this.handleMuseumConfirmed}
          @open-map-editor=${this.handleOpenMapEditor}
        ></museums-page>`;
      case 'museums-management':
        return html`<museums-management-page
          .currentUser=${this.currentUser}
        ></museums-management-page>`;
      case 'museum-edit': {
        const selectedMuseum = preferencesService.getSelectedMuseum();
        return html`<museums-management-page
          .currentUser=${this.currentUser}
          .selectedMuseumId=${selectedMuseum?._id || ''}
          configMode="museum"
        ></museums-management-page>`;
      }
      case 'navigator-customizations': {
        const selectedMuseum = preferencesService.getSelectedMuseum();
        return html`<museums-management-page
          .currentUser=${this.currentUser}
          .selectedMuseumId=${selectedMuseum?._id || ''}
          configMode="navigator"
        ></museums-management-page>`;
      }
      case 'navigator-default-config':
        return html`<navigator-default-config-page></navigator-default-config-page>`;
      case 'museum-maps':
        return html`<museum-map-page
          .museumId=${this.routeParams.museumId || ''}
        ></museum-map-page>`;
      case 'artworks':
        return html`<artworks-page
          .user=${this.currentUser}
          .openingArtworkId=${this.routeParams.artworkId || ''}
          .openingViewMode=${this.routeParams.viewMode || 'list'}
          @page-state-changed=${this.handlePageStateChanged}
        ></artworks-page>`;
      case 'author-area':
        return html`<author-area-page .user=${this.currentUser}></author-area-page>`;
      case 'marketplace':
        return html`<marketplace-page .user=${this.currentUser}></marketplace-page>`;
      case 'purchases':
        return html`<purchases-page .user=${this.currentUser}></purchases-page>`;
      case 'contents':
        return html`<contents-page .user=${this.currentUser}></contents-page>`;
      case 'visits':
        return html`<visits-page .user=${this.currentUser}></visits-page>`;
      case 'users':
        return html`<users-page .currentUser=${this.currentUser}></users-page>`;
      case 'settings':
        return html`<settings-page .user=${this.currentUser}></settings-page>`;
      default:
        return html`
          <div class="flex items-center justify-center min-h-[400px]">
            <div class="text-center">
              <div
                class="w-16 h-16 mx-auto mb-4 rounded-full bg-surface-100 dark:bg-surface-800 flex items-center justify-center"
              >
                <svg
                  class="w-8 h-8 text-surface-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="1.5"
                    d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                  />
                </svg>
              </div>
              <h3 class="text-lg font-semibold text-surface-900 dark:text-white mb-1">
                ${this.pageTitle}
              </h3>
              <p class="text-sm text-surface-500 dark:text-surface-400">
                ${__('Questa sezione è in fase di sviluppo')}
              </p>
            </div>
          </div>
        `;
    }
  }

  // ─── Render Entry ────────────────────────────────────────
  render() {
    // Show loading spinner while checking auth
    if (this.loading) {
      return html`
        <div
          class="min-h-screen flex items-center justify-center bg-surface-50 dark:bg-surface-950"
        >
          <div class="text-center">
            <div
              class="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-brand-600 mb-4 animate-pulse"
            >
              <span class="text-white font-bold text-xl">A</span>
            </div>
            <p class="text-sm text-surface-500 dark:text-surface-400">${__('Caricamento...')}</p>
          </div>
        </div>
      `;
    }

    if (!this.currentUser) {
      return html` <login-page @login-success=${this.handleLogin}></login-page> `;
    }

    const marginClass = this.sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64';

    return html`
      <div class="min-h-screen bg-surface-50 dark:bg-surface-950">
        <admin-sidebar
          .currentRoute=${this.currentRoute}
          .user=${this.currentUser}
          ?collapsed=${this.sidebarCollapsed}
          @navigate=${this.handleNavigate}
        ></admin-sidebar>

        <admin-header
          .title=${this.pageTitle}
          .user=${this.currentUser}
          ?sidebarCollapsed=${this.sidebarCollapsed}
          @menu-toggle=${this.handleMenuToggle}
          @sidebar-toggle=${this.handleSidebarToggle}
          @select-museum=${this.handleSelectMuseum}
          @history-back=${this.handleHistoryBack}
          @history-forward=${this.handleHistoryForward}
          @logout=${this.handleLogout}
        ></admin-header>

        <main class="${marginClass} pt-16 min-h-screen transition-all duration-300">
          <div
            class="p-4 lg:p-6"
            @select-museum=${this.handleSelectMuseum}
            @open-artwork-detail=${this.handleOpenArtworkDetail}
            @page-state-changed=${this.handlePageStateChanged}
            @user-updated=${this.handleUserUpdated}
          >
            ${this.renderPage()}
          </div>
        </main>

        <ui-scroll-top></ui-scroll-top>
      </div>
    `;
  }

  // ─── UI Actions & Events ─────────────────────────────────
  private handleSidebarToggle() {
    this.sidebarCollapsed = !this.sidebarCollapsed;
  }

  private handleMenuToggle() {
    const sidebar = this.querySelector('admin-sidebar') as HTMLElement & { toggleMobile(): void };
    if (sidebar) {
      sidebar.toggleMobile();
    }
  }

  private handleUserUpdated(e: CustomEvent<User>) {
    this.currentUser = e.detail;
  }

  private handleMuseumConfirmed(e: CustomEvent) {
    preferencesService.setSelectedMuseum(e.detail);
    this.currentRoute = 'artworks';
    this.pageTitle = this.getRouteTitle('artworks');
    this.pushToHistory('artworks', {}, this.getRouteTitle('artworks'));
  }

  private handleSelectMuseum() {
    this.currentRoute = 'museums';
    this.pageTitle = this.getRouteTitle('museums');
    this.pushToHistory('museums', {}, this.getRouteTitle('museums'));
  }

  private handleMuseumChanged = (event: CustomEvent) => {
    if (!event.detail) {
      this.currentRoute = 'dashboard';
      this.pageTitle = this.getRouteTitle('dashboard');
      this.routeParams = {};
      this.pushToHistory('dashboard', {}, this.getRouteTitle('dashboard'));
      return;
    }

    if (this.requiresMuseumConfigAccess(this.currentRoute) && !this.canAccessMuseumConfigArea()) {
      this.currentRoute = 'dashboard';
      this.pageTitle = this.getRouteTitle('dashboard');
      this.pushToHistory('dashboard', {}, this.getRouteTitle('dashboard'));
    }
  };

  private handleOpenMapEditor(e: CustomEvent) {
    this.routeParams = { museumId: e.detail.museumId };
    this.currentRoute = 'museum-maps';
    this.pageTitle = this.getRouteTitle('museum-maps');
    this.pushToHistory(
      'museum-maps',
      { museumId: e.detail.museumId },
      this.getRouteTitle('museum-maps'),
    );
  }

  private handleOpenArtworkDetail(e: CustomEvent) {
    const artworkId = e.detail?.artworkId;
    if (!artworkId) return;

    this.routeParams = { ...this.routeParams, artworkId: String(artworkId) };
    this.currentRoute = 'artworks';
    this.pageTitle = this.getRouteTitle('artworks');
    this.pushToHistory(
      'artworks',
      { artworkId: String(artworkId) },
      this.getRouteTitle('artworks'),
    );
  }

  /**
   * Handles state changes from child pages (e.g., viewMode changes in artworks-page)
   * Updates the history with the new state
   */
  private handlePageStateChanged(e: CustomEvent) {
    // Don't update history when navigating from history
    if (this.isNavigatingFromHistory) return;

    const { viewMode, artworkId } = e.detail;

    // Build params based on the page state
    const params: Record<string, string> = { ...this.routeParams };

    if (viewMode) {
      params.viewMode = viewMode;
    }

    if (artworkId) {
      params.artworkId = artworkId;
    } else {
      // Clear artworkId if going back to list
      delete params.artworkId;
    }

    // Update routeParams to keep them in sync
    this.routeParams = params;

    // Push to history with the updated state
    this.pushToHistory(this.currentRoute, params, this.pageTitle);
  }

  // ─── Permissions ──────────────────────────────────────────
  private requiresMuseumConfigAccess(route: string): boolean {
    return route === 'museum-edit' || route === 'artworks' || route === 'navigator-customizations';
  }

  private requiresSelectedMuseum(route: string): boolean {
    return (
      route === 'author-area' ||
      route === 'marketplace' ||
      route === 'purchases' ||
      route === 'contents'
    );
  }

  private hasSelectedMuseum(): boolean {
    return Boolean(preferencesService.getSelectedMuseum()?._id);
  }

  private redirectToMuseumsSelection(): void {
    this.currentRoute = 'museums';
    this.pageTitle = this.getRouteTitle('museums');
    this.routeParams = {};
    this.pushToHistory('museums', {}, this.getRouteTitle('museums'));
  }

  private canAccessMuseumConfigArea(): boolean {
    const selectedMuseum = preferencesService.getSelectedMuseum();

    if (!this.currentUser || !selectedMuseum) {
      return false;
    }

    if (this.currentUser.role === UserRole.ADMIN) {
      return true;
    }

    return (
      this.currentUser.roleAssignments?.some(
        (assignment) =>
          assignment.resourceType === ResourceType.MUSEUM &&
          assignment.resourceId === selectedMuseum._id &&
          assignment.role === ContextualRole.MANAGER,
      ) ?? false
    );
  }

  // ─── History Management ──────────────────────────────────
  /**
   * Ripristina lo stato della navigazione dal localStorage all'avvio
   */
  private restoreHistoryState(): void {
    const savedState = historyService.getSavedState();
    if (savedState) {
      this.isNavigatingFromHistory = true;
      this.navigateToState(savedState);
      this.isNavigatingFromHistory = false;
    } else {
      // Prima visita: aggiungi dashboard alla history
      this.pushToHistory('dashboard', {}, this.getRouteTitle('dashboard'));
    }
  }

  /**
   * Naviga indietro nella history
   */
  private handleHistoryBack(): void {
    const state = historyService.back();
    if (state) {
      this.isNavigatingFromHistory = true;
      this.navigateToState(state);
      this.isNavigatingFromHistory = false;
    }
  }

  /**
   * Naviga avanti nella history
   */
  private handleHistoryForward(): void {
    const state = historyService.forward();
    if (state) {
      this.isNavigatingFromHistory = true;
      this.navigateToState(state);
      this.isNavigatingFromHistory = false;
    }
  }

  /**
   * Naviga verso uno stato specifico
   */
  private navigateToState(state: HistoryState): void {
    // Verifica i permessi prima di navigare
    if (this.requiresSelectedMuseum(state.route) && !this.hasSelectedMuseum()) {
      this.currentRoute = 'museums';
      this.pageTitle = this.getRouteTitle('museums');
      this.routeParams = {};
      return;
    }

    if (this.requiresMuseumConfigAccess(state.route) && !this.canAccessMuseumConfigArea()) {
      this.currentRoute = 'dashboard';
      this.pageTitle = this.getRouteTitle('dashboard');
      this.routeParams = {};
      return;
    }

    if (state.route === 'navigator-default-config' && this.currentUser?.role !== UserRole.ADMIN) {
      this.currentRoute = 'dashboard';
      this.pageTitle = this.getRouteTitle('dashboard');
      this.routeParams = {};
      return;
    }

    this.currentRoute = state.route;
    this.routeParams = { ...state.params };
    this.pageTitle = this.getRouteTitle(state.route);

    // Scroll to top on navigation
    window.scrollTo(0, 0);
  }

  /**
   * Aggiunge lo stato corrente alla history
   */
  private pushToHistory(route: string, params: Record<string, string>, title: string): void {
    historyService.push(route, params, title);
  }
}
