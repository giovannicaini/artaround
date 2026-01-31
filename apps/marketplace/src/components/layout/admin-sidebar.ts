import { LitElement, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../ui/ui-icon';
import '../ui/ui-avatar';

interface MenuItem {
  id: string;
  label: string;
  icon: string;
  badge?: string;
}

@customElement('admin-sidebar')
export class AdminSidebar extends LitElement {
  @property({ type: String }) currentRoute = 'dashboard';
  @property({ type: Boolean }) collapsed = false;
  @state() private mobileOpen = false;

  createRenderRoot() { return this; }

  private menuItems: MenuItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: 'home' },
    { id: 'museums', label: 'Musei', icon: 'location' },
    { id: 'artworks', label: 'Opere', icon: 'image' },
    { id: 'visits', label: 'Visite', icon: 'document' },
    { id: 'users', label: 'Utenti', icon: 'users' },
    { id: 'analytics', label: 'Analytics', icon: 'chart' },
  ];

  private bottomItems: MenuItem[] = [
    { id: 'settings', label: 'Impostazioni', icon: 'cog' },
  ];

  private handleNavigate(route: string) {
    this.dispatchEvent(new CustomEvent('navigate', { 
      detail: { route },
      bubbles: true,
      composed: true 
    }));
  }

  private renderMenuItem(item: MenuItem) {
    const isActive = this.currentRoute === item.id;
    const baseClasses = 'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150';
    const activeClasses = isActive
      ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300'
      : 'text-surface-600 hover:bg-surface-100 hover:text-surface-900 dark:text-surface-400 dark:hover:bg-surface-800 dark:hover:text-white';

    return html`
      <button
        @click=${() => this.handleNavigate(item.id)}
        class="${baseClasses} ${activeClasses} ${this.collapsed ? 'justify-center' : 'w-full'}"
        aria-current=${isActive ? 'page' : 'false'}
        title=${this.collapsed ? item.label : ''}
      >
        <ui-icon name="${item.icon}" size="sm" class="${isActive ? 'text-brand-600 dark:text-brand-400' : ''}"></ui-icon>
        ${!this.collapsed ? html`
          <span class="flex-1 text-left">${item.label}</span>
          ${item.badge ? html`
            <span class="px-2 py-0.5 text-2xs font-semibold rounded-full bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300">
              ${item.badge}
            </span>
          ` : ''}
        ` : ''}
      </button>
    `;
  }

  render() {
    const sidebarWidth = this.collapsed ? 'w-16' : 'w-64';
    
    return html`
      <!-- Desktop Sidebar -->
      <aside class="hidden lg:flex lg:flex-col ${sidebarWidth} fixed inset-y-0 left-0 z-30 bg-white dark:bg-surface-900 border-r border-surface-200 dark:border-surface-800 transition-all duration-300">
        <!-- Logo -->
        <div class="flex items-center ${this.collapsed ? 'justify-center' : 'gap-3 px-4'} h-16 border-b border-surface-200 dark:border-surface-800">
          <div class="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
            <span class="text-white font-bold text-sm">A</span>
          </div>
          ${!this.collapsed ? html`
            <span class="font-semibold text-surface-900 dark:text-white">ArtAround</span>
          ` : ''}
        </div>

        <!-- Navigation -->
        <nav class="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          ${this.menuItems.map(item => this.renderMenuItem(item))}
        </nav>

        <!-- Bottom Section -->
        <div class="px-3 py-4 border-t border-surface-200 dark:border-surface-800 space-y-1">
          ${this.bottomItems.map(item => this.renderMenuItem(item))}
          
          <button
            @click=${() => this.handleNavigate('logout')}
            class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium w-full text-danger-600 hover:bg-danger-50 dark:text-danger-400 dark:hover:bg-danger-900/20 transition-colors ${this.collapsed ? 'justify-center' : ''}"
          >
            <ui-icon name="logout" size="sm"></ui-icon>
            ${!this.collapsed ? html`<span>Esci</span>` : ''}
          </button>
        </div>
      </aside>

      <!-- Mobile Overlay -->
      ${this.mobileOpen ? html`
        <div 
          class="lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm animate-fade-in"
          @click=${() => this.mobileOpen = false}
        ></div>
      ` : ''}

      <!-- Mobile Sidebar -->
      <aside class="${this.mobileOpen ? 'translate-x-0' : '-translate-x-full'} lg:hidden fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-surface-900 border-r border-surface-200 dark:border-surface-800 transition-transform duration-300">
        <div class="flex items-center justify-between px-4 h-16 border-b border-surface-200 dark:border-surface-800">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
              <span class="text-white font-bold text-sm">A</span>
            </div>
            <span class="font-semibold text-surface-900 dark:text-white">ArtAround</span>
          </div>
          <button @click=${() => this.mobileOpen = false} class="p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800">
            <ui-icon name="close" size="sm" class="text-surface-500"></ui-icon>
          </button>
        </div>
        <nav class="flex-1 px-3 py-4 space-y-1">
          ${this.menuItems.map(item => this.renderMenuItem(item))}
        </nav>
      </aside>
    `;
  }

  public toggleMobile() {
    this.mobileOpen = !this.mobileOpen;
  }
}
