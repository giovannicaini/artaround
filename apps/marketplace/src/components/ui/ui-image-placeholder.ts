import { LitElement, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

type PlaceholderType = 'artwork' | 'museum' | 'content' | 'user' | 'default';
type PlaceholderSize = 'xs' | 'sm' | 'md' | 'lg' | 'full';

/**
 * Segnaposto per immagine mancante, per tipo di entità.
 */
@customElement('ui-image-placeholder')
export class UiImagePlaceholder extends LitElement {
  @property({ type: String }) type: PlaceholderType = 'default';
  @property({ type: String }) size: PlaceholderSize = 'md';
  @state() private isDark = false;

  // ─── Ciclo di vita ───────────────────────────────────────────
  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();

    // Controlla la dark mode
    this.isDark = document.documentElement.classList.contains('dark');

    // Ascolta i cambi di dark mode
    this.observer = new MutationObserver(() => {
      this.isDark = document.documentElement.classList.contains('dark');
    });
    this.observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.observer?.disconnect();
  }

  private observer?: MutationObserver;

  // ─── Helper ──────────────────────────────────────────────
  private getSizeClasses(): string {
    const sizes: Record<PlaceholderSize, string> = {
      xs: 'w-6 h-6',
      sm: 'w-8 h-8',
      md: 'w-12 h-12',
      lg: 'w-16 h-16',
      full: 'w-24 h-24',
    };
    return sizes[this.size] || sizes.md;
  }

  private getIcon() {
    switch (this.type) {
      case 'artwork':
        // Icona quadro incorniciato
        return html`
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M3 16l5-5 4 4 5-5 4 4" />
            <circle cx="8.5" cy="8.5" r="1.5" />
          </svg>
        `;

      case 'museum':
        // Icona edificio museo
        return html`
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M3 21h18" />
            <path d="M5 21V11" />
            <path d="M19 21V11" />
            <path d="M9 21v-6a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v6" />
            <path d="M3 11l9-7 9 7" />
            <path d="M7 11v4" />
            <path d="M17 11v4" />
          </svg>
        `;

      case 'content':
        // Icona documento/testo
        return html`
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path
              d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
              stroke-linejoin="round"
            />
            <path d="M14 2v6h6" />
            <path d="M16 13H8" />
            <path d="M16 17H8" />
            <path d="M10 9H8" />
          </svg>
        `;

      case 'user':
        // Icona avatar utente
        return html`
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
          </svg>
        `;

      default:
        // Icona immagine generica
        return html`
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="M21 15l-5-5L5 21" />
          </svg>
        `;
    }
  }

  // ─── Render ──────────────────────────────────────────────
  render() {
    const bgClass = this.isDark
      ? 'bg-gradient-to-br from-surface-800 to-surface-900'
      : 'bg-gradient-to-br from-surface-100 to-surface-200';

    const iconColorClass = this.isDark ? 'text-surface-600' : 'text-surface-400';

    return html`
      <div class="flex items-center justify-center w-full h-full ${bgClass}">
        <div class="flex flex-col items-center justify-center gap-2 ${iconColorClass}">
          <div class="flex items-center justify-center ${this.getSizeClasses()}">
            ${this.getIcon()}
          </div>
        </div>
      </div>
    `;
  }
}
