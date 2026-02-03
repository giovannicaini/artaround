import { LitElement, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { User } from '@artaround/shared';
import { AdminSidebar } from './admin-sidebar';
import './admin-header';

@customElement('admin-layout')
export class AdminLayout extends LitElement {
  @property({ type: String }) currentRoute = 'dashboard';
  @property({ type: String }) pageTitle = 'Dashboard';
  @property({ type: Object }) user: User | null = null;
  @state() private sidebarCollapsed = false;

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.updateLayoutClasses();
  }

  updated() {
    this.updateLayoutClasses();
  }

  private updateLayoutClasses() {
    // Apply layout classes to the host element and update main content margin
    this.classList.add('block', 'min-h-screen', 'bg-surface-50', 'dark:bg-surface-950');

    // Find and update the main content area
    const main = this.querySelector('.admin-main-content') as HTMLElement;
    if (main) {
      main.classList.remove('lg:ml-64', 'lg:ml-16');
      main.classList.add(this.sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64');
    }
  }

  private handleSidebarToggle() {
    this.sidebarCollapsed = !this.sidebarCollapsed;
    this.updateLayoutClasses();
  }

  private handleMenuToggle() {
    const sidebar = this.querySelector('admin-sidebar') as AdminSidebar | null;
    if (sidebar) {
      sidebar.toggleMobile();
    }
  }

  private handleNavigate(e: CustomEvent) {
    this.dispatchEvent(
      new CustomEvent('navigate', {
        detail: e.detail,
        bubbles: true,
        composed: true,
      }),
    );
  }

  render() {
    const marginClass = this.sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64';

    return html`
      <admin-sidebar
        .currentRoute=${this.currentRoute}
        ?collapsed=${this.sidebarCollapsed}
        @navigate=${this.handleNavigate}
      ></admin-sidebar>

      <admin-header
        .title=${this.pageTitle}
        .user=${this.user}
        ?sidebarCollapsed=${this.sidebarCollapsed}
        @menu-toggle=${this.handleMenuToggle}
        @sidebar-toggle=${this.handleSidebarToggle}
        @logout=${() =>
          this.dispatchEvent(new CustomEvent('logout', { bubbles: true, composed: true }))}
      ></admin-header>

      <main
        class="admin-main-content ${marginClass} pt-16 min-h-screen transition-all duration-300"
      >
        <div class="p-4 lg:p-6">
          <!-- Content will be injected here by app-root -->
        </div>
      </main>
    `;
  }
}
