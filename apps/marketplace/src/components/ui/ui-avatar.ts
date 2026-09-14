import { LitElement, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

/**
 * Avatar circolare con iniziali o immagine, opzionale indicatore online.
 */
@customElement('ui-avatar')
export class UiAvatar extends LitElement {
  @property({ type: String }) src = '';
  @property({ type: String }) alt = '';
  @property({ type: String }) initials = '';
  @property({ type: String }) size: 'xs' | 'sm' | 'md' | 'lg' | 'xl' = 'md';
  @property({ type: Boolean }) online = false;

  @state() private imageError = false;

  // ─── Ciclo di vita ───────────────────────────────────────────
  createRenderRoot() {
    return this;
  }

  // ─── Helper ──────────────────────────────────────────────
  private get sizeClasses() {
    const sizes: Record<string, string> = {
      xs: 'w-6 h-6 text-2xs',
      sm: 'w-8 h-8 text-xs',
      md: 'w-10 h-10 text-sm',
      lg: 'w-12 h-12 text-base',
      xl: 'w-16 h-16 text-lg',
    };
    return sizes[this.size];
  }

  private get statusSizeClasses() {
    const sizes: Record<string, string> = {
      xs: 'w-1.5 h-1.5',
      sm: 'w-2 h-2',
      md: 'w-2.5 h-2.5',
      lg: 'w-3 h-3',
      xl: 'w-4 h-4',
    };
    return sizes[this.size];
  }

  // ─── Render ──────────────────────────────────────────────
  render() {
    return html`
      <div class="relative inline-flex">
        <div
          class="${this
            .sizeClasses} rounded-full overflow-hidden flex items-center justify-center font-semibold bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300"
        >
          ${this.src && !this.imageError
            ? html`
                <img
                  src="${this.src}"
                  alt="${this.alt}"
                  class="w-full h-full object-cover"
                  @error=${() => (this.imageError = true)}
                />
              `
            : html` <span>${this.initials || '?'}</span> `}
        </div>
        ${this.online
          ? html`
              <span
                class="absolute bottom-0 right-0 ${this
                  .statusSizeClasses} bg-success-500 border-2 border-white dark:border-surface-900 rounded-full"
              ></span>
            `
          : nothing}
      </div>
    `;
  }
}
