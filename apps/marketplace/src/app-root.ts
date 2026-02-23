import { LitElement, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { authService } from './services/auth.service';
import { preferencesService } from './services/preferences.service';
import { historyService, type HistoryState } from './services/history.service';
import { ContextualRole, ResourceType, UserRole, type User } from '@artaround/shared';

// Import components
import './components/auth/login-page';
import './components/layout/admin-sidebar';
import './components/layout/admin-header';
import './components/pages/dashboard-page';
import './components/pages/museums-page';
import './components/pages/artworks-page';
import './components/pages/contents-page';
import './components/pages/users-page';
import './components/visits/visits-page';
import './components/museums/museum-map-page';
import './components/museums/museums-management-page';
import './components/navigator/navigator-default-config-page';
import './components/ui/ui-scroll-top';

@customElement('app-root')
export class AppRoot extends LitElement {
  createRenderRoot() {
    return this;
  }

  @state()
  private currentUser: User | null = null;

  @state()
  private currentRoute = 'dashboard';

  @state()
  private routeParams: Record<string, string> = {};

  @state()
  private pageTitle = 'Dashboard';

  @state()
  private sidebarCollapsed = false;

  @state()
  private loading = true;

  // Flag per evitare cicli durante la navigazione dalla history
  private isNavigatingFromHistory = false;

  connectedCallback() {
    super.connectedCallback();
    this.checkAuth();
    this.restoreHistoryState();
    window.addEventListener('museum-changed', this.handleMuseumChanged as EventListener);
  }

  disconnectedCallback() {
    window.removeEventListener('museum-changed', this.handleMuseumChanged as EventListener);
    super.disconnectedCallback();
  }

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

    if (this.requiresMuseumConfigAccess(route) && !this.canAccessMuseumConfigArea()) {
      this.currentRoute = 'dashboard';
      this.pageTitle = 'Dashboard';
      this.pushToHistory('dashboard', {}, 'Dashboard');
      return;
    }

    if (route === 'navigator-default-config' && this.currentUser?.role !== UserRole.ADMIN) {
      this.currentRoute = 'dashboard';
      this.pageTitle = 'Dashboard';
      this.pushToHistory('dashboard', {}, 'Dashboard');
      return;
    }

    this.currentRoute = route;

    // Scroll to top on navigation
    window.scrollTo(0, 0);

    // Update page title based on route
    const titles: Record<string, string> = {
      dashboard: 'Dashboard',
      museums: 'Musei',
      'museums-management': 'Gestione Musei',
      'museum-maps': 'Gestione Mappe',
      'museum-edit': 'Modifica Museo',
      artworks: 'Gestione Opere',
      'navigator-customizations': 'Configurazioni Navigator',
      'navigator-default-config': 'Configurazione default app navigator',
      contents: 'Contenuti',
      visits: 'Visite',
      users: 'Gestione Utenti',
      categories: 'Categorie',
      tags: 'Tag',
      analytics: 'Analytics',
      settings: 'Impostazioni',
    };
    this.pageTitle = titles[route] || 'Homepage';

    // Push to history (only if not navigating from history)
    if (!this.isNavigatingFromHistory) {
      this.pushToHistory(route, this.routeParams, this.pageTitle);
    }
  }

  renderPage() {
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
      case 'contents':
        return html`<contents-page .user=${this.currentUser}></contents-page>`;
      case 'visits':
        return html`<visits-page .user=${this.currentUser}></visits-page>`;
      case 'users':
        return html`<users-page .currentUser=${this.currentUser}></users-page>`;
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
                Questa sezione è in fase di sviluppo
              </p>
            </div>
          </div>
        `;
    }
  }

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
            <p class="text-sm text-surface-500 dark:text-surface-400">Caricamento...</p>
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
          >
            ${this.renderPage()}
          </div>
        </main>

        <ui-scroll-top></ui-scroll-top>
      </div>
    `;
  }

  private handleSidebarToggle() {
    this.sidebarCollapsed = !this.sidebarCollapsed;
  }

  private handleMenuToggle() {
    const sidebar = this.querySelector('admin-sidebar') as HTMLElement & { toggleMobile(): void };
    if (sidebar) {
      sidebar.toggleMobile();
    }
  }

  private handleMuseumConfirmed(e: CustomEvent) {
    preferencesService.setSelectedMuseum(e.detail);
    this.currentRoute = 'artworks';
    this.pageTitle = 'Gestione Opere';
    this.pushToHistory('artworks', {}, 'Gestione Opere');
  }

  private handleSelectMuseum() {
    this.currentRoute = 'museums';
    this.pageTitle = 'Seleziona Museo';
    this.pushToHistory('museums', {}, 'Seleziona Museo');
  }

  private handleMuseumChanged = (event: CustomEvent) => {
    if (!event.detail) {
      this.currentRoute = 'dashboard';
      this.pageTitle = 'Dashboard';
      this.routeParams = {};
      this.pushToHistory('dashboard', {}, 'Dashboard');
      return;
    }

    if (this.requiresMuseumConfigAccess(this.currentRoute) && !this.canAccessMuseumConfigArea()) {
      this.currentRoute = 'dashboard';
      this.pageTitle = 'Dashboard';
      this.pushToHistory('dashboard', {}, 'Dashboard');
    }
  };

  private handleOpenMapEditor(e: CustomEvent) {
    this.routeParams = { museumId: e.detail.museumId };
    this.currentRoute = 'museum-maps';
    this.pageTitle = 'Gestione Mappe';
    this.pushToHistory('museum-maps', { museumId: e.detail.museumId }, 'Gestione Mappe');
  }

  private handleOpenArtworkDetail(e: CustomEvent) {
    const artworkId = e.detail?.artworkId;
    if (!artworkId) return;

    this.routeParams = { ...this.routeParams, artworkId: String(artworkId) };
    this.currentRoute = 'artworks';
    this.pageTitle = 'Gestione Opere';
    this.pushToHistory('artworks', { artworkId: String(artworkId) }, 'Gestione Opere');
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

  private requiresMuseumConfigAccess(route: string): boolean {
    return route === 'museum-edit' || route === 'artworks' || route === 'navigator-customizations';
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
      this.pushToHistory('dashboard', {}, 'Dashboard');
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
    if (this.requiresMuseumConfigAccess(state.route) && !this.canAccessMuseumConfigArea()) {
      this.currentRoute = 'dashboard';
      this.pageTitle = 'Dashboard';
      this.routeParams = {};
      return;
    }

    if (state.route === 'navigator-default-config' && this.currentUser?.role !== UserRole.ADMIN) {
      this.currentRoute = 'dashboard';
      this.pageTitle = 'Dashboard';
      this.routeParams = {};
      return;
    }

    this.currentRoute = state.route;
    this.routeParams = { ...state.params };
    this.pageTitle = state.title;

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
