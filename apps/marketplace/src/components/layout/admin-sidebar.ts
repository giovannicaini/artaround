import { LitElement, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { ContextualRole, ResourceType, UserRole, type User } from '@artaround/shared';
import { preferencesService } from '../../services/preferences.service';
import '../ui/ui-icon';
import '../ui/ui-avatar';
import '../ui/ui-icon-button';
import '../ui/ui-brand-mark';

interface MenuItem {
  id: string;
  label: string;
  icon: string;
  badge?: string;
  roles?: UserRole[]; // If set, only these roles can see this item
}

@customElement('admin-sidebar')
export class AdminSidebar extends LitElement {
  @property({ type: String }) currentRoute = 'dashboard';
  @property({ type: Boolean }) collapsed = false;
  @property({ type: Object }) user: User | null = null;
  @state() private mobileOpen = false;
  @state() private selectedMuseum: { _id: string; name: string } | null = null;

  // ─── Lifecycle ───────────────────────────────────────────
  createRenderRoot() {
    return this;
  }

  private dashboardItem: MenuItem = { id: 'dashboard', label: 'Dashboard', icon: 'home' };

  private configureMuseumMenuItems: MenuItem[] = [
    { id: 'museum-edit', label: 'Modifica Museo', icon: 'edit' },
    { id: 'artworks', label: 'Gestione Opere', icon: 'image' },
    {
      id: 'navigator-customizations',
      label: 'Configurazioni Navigator',
      icon: 'cog',
    },
  ];

  private adminMenuItems: MenuItem[] = [
    {
      id: 'museums-management',
      label: 'Gestione Musei',
      icon: 'cog',
      roles: ['admin' as UserRole],
    },
    {
      id: 'navigator-default-config',
      label: 'Configurazione default app navigator',
      icon: 'cog',
      roles: ['admin' as UserRole],
    },
    { id: 'users', label: 'Utenti', icon: 'users', roles: ['admin' as UserRole] },
    {
      id: 'analytics',
      label: 'Analytics',
      icon: 'chart',
      roles: ['admin' as UserRole, 'curator' as UserRole],
    },
  ];

  private bottomItems: MenuItem[] = [{ id: 'settings', label: 'Impostazioni', icon: 'cog' }];

  connectedCallback() {
    super.connectedCallback();
    this.selectedMuseum = preferencesService.getSelectedMuseum();
    window.addEventListener('museum-changed', this.handleMuseumChanged as EventListener);
  }

  disconnectedCallback() {
    window.removeEventListener('museum-changed', this.handleMuseumChanged as EventListener);
    super.disconnectedCallback();
  }

  // ─── Actions & Computed ──────────────────────────────────
  private handleMuseumChanged = (event: CustomEvent) => {
    this.selectedMuseum = event.detail || null;
  };

  private handleNavigate(route: string) {
    this.dispatchEvent(
      new CustomEvent('navigate', {
        detail: { route },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private get canConfigureSelectedMuseum(): boolean {
    if (!this.user || !this.selectedMuseum) {
      return false;
    }

    if (this.user.role === UserRole.ADMIN) {
      return true;
    }

    return (
      this.user.roleAssignments?.some(
        (assignment) =>
          assignment.resourceType === ResourceType.MUSEUM &&
          assignment.resourceId === this.selectedMuseum?._id &&
          assignment.role === ContextualRole.MANAGER,
      ) ?? false
    );
  }

  // ─── Render Helpers ──────────────────────────────────────
  private renderMenuItem(item: MenuItem, collapsed = this.collapsed) {
    const isActive = this.currentRoute === item.id;
    const baseClasses =
      'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150';
    const activeClasses = isActive
      ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300'
      : 'text-surface-600 hover:bg-surface-100 hover:text-surface-900 dark:text-surface-400 dark:hover:bg-surface-800 dark:hover:text-white';

    return html`
      <button
        @click=${() => this.handleNavigate(item.id)}
        class="${baseClasses} ${activeClasses} ${collapsed ? 'justify-center' : 'w-full'}"
        aria-current=${isActive ? 'page' : 'false'}
        title=${collapsed ? item.label : ''}
      >
        <ui-icon
          name="${item.icon}"
          size="sm"
          class="${isActive ? 'text-brand-600 dark:text-brand-400' : ''}"
        ></ui-icon>
        ${!collapsed
          ? html`
              <span class="flex-1 text-left">${item.label}</span>
              ${item.badge
                ? html`
                    <span
                      class="px-2 py-0.5 text-2xs font-semibold rounded-full bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300"
                    >
                      ${item.badge}
                    </span>
                  `
                : nothing}
            `
          : nothing}
      </button>
    `;
  }

  private renderMenuSection(
    label: string,
    items: MenuItem[],
    sublabel?: string,
    collapsed = this.collapsed,
  ) {
    const userRole = this.user?.role;
    const visibleItems = items.filter((item) => {
      if (!item.roles) return true;
      if (!userRole) return false;
      return item.roles.includes(userRole);
    });

    if (visibleItems.length === 0) return null;

    return html`
      <div class="space-y-1">
        ${!collapsed
          ? html`
              <p
                class="px-3 pt-3 pb-1 text-xs font-semibold uppercase tracking-wider text-surface-400"
              >
                ${label}
                ${sublabel ? html`<br /><span class="text-[0.6rem]">${sublabel}</span>` : nothing}
              </p>
            `
          : nothing}
        ${visibleItems.map((item) => this.renderMenuItem(item, collapsed))}
      </div>
    `;
  }

  private renderMainNavigation(collapsed = this.collapsed) {
    const showConfigureMuseumArea = this.canConfigureSelectedMuseum;

    return html`
      ${!collapsed && this.selectedMuseum
        ? html`
            <div
              class="px-3 py-2 rounded-lg bg-surface-100 dark:bg-surface-800 text-xs text-surface-600 dark:text-surface-300"
            >
              Museo attivo: <span class="font-semibold">${this.selectedMuseum.name}</span>
            </div>
          `
        : nothing}
      ${this.renderMenuItem(this.dashboardItem, collapsed)}
      ${showConfigureMuseumArea
        ? this.renderMenuSection(
            'Area Curatore',
            this.configureMuseumMenuItems,
            this.selectedMuseum?.name || '',
            collapsed,
          )
        : nothing}
      ${this.renderMenuSection('Area Admin', this.adminMenuItems, undefined, collapsed)}
    `;
  }

  // ─── Render Entry ────────────────────────────────────────
  render() {
    const sidebarWidth = this.collapsed ? 'w-16' : 'w-64';
    return html`
      <!-- Desktop Sidebar -->
      <aside
        class="hidden lg:flex lg:flex-col ${sidebarWidth} fixed inset-y-0 left-0 z-30 bg-white dark:bg-surface-900 border-r border-surface-200 dark:border-surface-800 transition-all duration-300"
      >
        <!-- Logo -->
        <div
          class="flex items-center ${this.collapsed
            ? 'justify-center'
            : 'gap-3 px-4'} h-16 border-b border-surface-200 dark:border-surface-800"
        >
          <ui-brand-mark .showText=${!this.collapsed}></ui-brand-mark>
        </div>

        <!-- Navigation -->
        <nav class="flex-1 px-3 py-4 space-y-3 overflow-y-auto">
          ${this.renderMainNavigation(this.collapsed)}
        </nav>

        <!-- Bottom Section -->
        <div class="px-3 py-4 border-t border-surface-200 dark:border-surface-800 space-y-1">
          ${this.bottomItems.map((item) => this.renderMenuItem(item, this.collapsed))}

          <button
            @click=${() => this.handleNavigate('logout')}
            class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium w-full text-danger-600 hover:bg-danger-50 dark:text-danger-400 dark:hover:bg-danger-900/20 transition-colors ${this
              .collapsed
              ? 'justify-center'
              : ''}"
          >
            <ui-icon name="logout" size="sm"></ui-icon>
            ${!this.collapsed ? html`<span>Esci</span>` : nothing}
          </button>
        </div>
      </aside>

      <!-- Mobile Overlay -->
      ${this.mobileOpen
        ? html`
            <div
              class="lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm animate-fade-in"
              @click=${() => (this.mobileOpen = false)}
            ></div>
          `
        : nothing}

      <!-- Mobile Sidebar -->
      <aside
        class="${this.mobileOpen
          ? 'translate-x-0'
          : '-translate-x-full'} lg:hidden fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-surface-900 border-r border-surface-200 dark:border-surface-800 transition-transform duration-300"
      >
        <div
          class="flex items-center justify-between px-4 h-16 border-b border-surface-200 dark:border-surface-800"
        >
          <div class="flex items-center gap-3">
            <ui-brand-mark></ui-brand-mark>
          </div>
          <ui-icon-button
            icon="close"
            title="Chiudi menu"
            @click=${() => (this.mobileOpen = false)}
          ></ui-icon-button>
        </div>
        <nav class="flex-1 px-3 py-4 space-y-3">${this.renderMainNavigation(false)}</nav>
      </aside>
    `;
  }

  // ─── Public API ──────────────────────────────────────────
  public toggleMobile() {
    this.mobileOpen = !this.mobileOpen;
  }
}
