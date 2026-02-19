import { LitElement, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { User } from '@artaround/shared';
import { preferencesService } from '../../services/preferences.service';
import '../ui/ui-icon';
import '../ui/ui-avatar';
import '../ui/ui-button';
import '../ui/ui-icon-button';
import '../ui/ui-search-bar';

@customElement('admin-header')
export class AdminHeader extends LitElement {
  @property({ type: String }) title = 'Dashboard';
  @property({ type: Object }) user: User | null = null;
  @property({ type: Boolean }) sidebarCollapsed = false;
  @state() private darkMode = false;
  @state() private userMenuOpen = false;
  @state() private selectedMuseum: { _id: string; name: string } | null = null;

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.darkMode = document.documentElement.classList.contains('dark');
    this.selectedMuseum = preferencesService.getSelectedMuseum();
    window.addEventListener('museum-changed', this.handleMuseumChanged as EventListener);

    // Close menu on outside click
    document.addEventListener('click', (e) => {
      if (this.userMenuOpen && !(e.target as Element).closest('.user-menu')) {
        this.userMenuOpen = false;
      }
    });
  }

  disconnectedCallback() {
    window.removeEventListener('museum-changed', this.handleMuseumChanged as EventListener);
    super.disconnectedCallback();
  }

  private handleMuseumChanged = (event: CustomEvent) => {
    this.selectedMuseum = event.detail || null;
  };

  private toggleDarkMode() {
    this.darkMode = !this.darkMode;
    document.documentElement.classList.toggle('dark');
    this.dispatchEvent(
      new CustomEvent('theme-change', {
        detail: { dark: this.darkMode },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private handleMenuToggle() {
    this.dispatchEvent(new CustomEvent('menu-toggle', { bubbles: true, composed: true }));
  }

  private handleSidebarToggle() {
    this.dispatchEvent(new CustomEvent('sidebar-toggle', { bubbles: true, composed: true }));
  }

  private handleSelectMuseum() {
    this.dispatchEvent(new CustomEvent('select-museum', { bubbles: true, composed: true }));
  }

  private handleClearMuseum() {
    preferencesService.clearSelectedMuseum();
  }

  render() {
    const marginLeft = this.sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64';

    return html`
      <header
        class="fixed top-0 right-0 left-0 ${marginLeft} z-20 h-16 bg-white dark:bg-surface-900 border-b border-surface-200 dark:border-surface-800 transition-all duration-300"
      >
        <div class="flex items-center justify-between h-full px-4 lg:px-6">
          <!-- Left Section -->
          <div class="flex items-center gap-4">
            <!-- Mobile Menu Button -->
            <ui-icon-button
              @click=${this.handleMenuToggle}
              class="lg:hidden"
              icon="menu"
              title="Toggle menu"
            ></ui-icon-button>

            <!-- Sidebar Collapse Button (Desktop) -->
            <ui-icon-button
              @click=${this.handleSidebarToggle}
              class="hidden lg:inline-flex"
              icon="menu"
              title="Toggle sidebar"
            ></ui-icon-button>

            <!-- Page Title -->
            <h1 class="text-lg font-semibold text-surface-900 dark:text-white">${this.title}</h1>
          </div>

          <!-- Right Section -->
          <div class="flex items-center gap-2">
            <div class="hidden lg:flex items-center gap-1">
              <ui-button
                variant="secondary"
                size="sm"
                icon="location"
                .label=${this.selectedMuseum?.name || 'Seleziona museo'}
                @click=${this.handleSelectMuseum}
              ></ui-button>
              ${this.selectedMuseum
                ? html`
                    <ui-icon-button
                      icon="x"
                      title="Deseleziona museo"
                      @click=${this.handleClearMuseum}
                    ></ui-icon-button>
                  `
                : ''}
            </div>

            <!-- Search (Desktop) -->
            <div class="hidden md:flex items-center gap-2 w-64">
              <ui-search-bar placeholder="Cerca..." .showButton=${false}></ui-search-bar>
              <kbd
                class="hidden lg:inline-flex items-center px-1.5 py-0.5 text-2xs font-mono text-surface-400 bg-surface-200 dark:bg-surface-700 rounded"
              >
                ⌘K
              </kbd>
            </div>

            <!-- Theme Toggle -->
            <ui-icon-button
              @click=${this.toggleDarkMode}
              icon="${this.darkMode ? 'sun' : 'moon'}"
              title="Toggle theme"
            ></ui-icon-button>

            <!-- Notifications -->
            <button
              class="relative p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
            >
              <ui-icon
                name="bell"
                size="sm"
                class="text-surface-600 dark:text-surface-300"
              ></ui-icon>
              <span class="absolute top-1.5 right-1.5 w-2 h-2 bg-danger-500 rounded-full"></span>
            </button>

            <!-- User Menu -->
            <div class="relative user-menu">
              <button
                @click=${() => (this.userMenuOpen = !this.userMenuOpen)}
                class="flex items-center gap-2 p-1.5 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
              >
                <ui-avatar
                  initials="${this.user?.username
                    ?.split(' ')
                    .map((n: string) => n[0])
                    .join('') || 'U'}"
                  size="sm"
                ></ui-avatar>
                <span
                  class="hidden sm:block text-sm font-medium text-surface-700 dark:text-surface-300"
                >
                  ${this.user?.username || 'Utente'}
                </span>
                <ui-icon name="chevronDown" size="xs" class="text-surface-400"></ui-icon>
              </button>

              <!-- Dropdown -->
              ${this.userMenuOpen
                ? html`
                    <div
                      class="absolute right-0 top-full mt-2 w-56 rounded-lg bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 shadow-strong animate-scale-in origin-top-right"
                    >
                      <div class="p-3 border-b border-surface-200 dark:border-surface-700">
                        <p class="text-sm font-medium text-surface-900 dark:text-white">
                          ${this.user?.username}
                        </p>
                        <p class="text-xs text-surface-500">${this.user?.email}</p>
                      </div>
                      <div class="p-1.5">
                        <button
                          class="flex items-center gap-2 w-full px-3 py-2 text-sm text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700 rounded-md transition-colors"
                        >
                          <ui-icon name="cog" size="xs"></ui-icon>
                          Impostazioni
                        </button>
                        <button
                          @click=${() =>
                            this.dispatchEvent(
                              new CustomEvent('logout', { bubbles: true, composed: true }),
                            )}
                          class="flex items-center gap-2 w-full px-3 py-2 text-sm text-danger-600 dark:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-900/20 rounded-md transition-colors"
                        >
                          <ui-icon name="logout" size="xs"></ui-icon>
                          Esci
                        </button>
                      </div>
                    </div>
                  `
                : ''}
            </div>
          </div>
        </div>
      </header>
    `;
  }
}
