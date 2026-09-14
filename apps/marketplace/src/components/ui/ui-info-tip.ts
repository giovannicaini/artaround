import { LitElement, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import './ui-icon';
import { __ } from '../../services/i18n.service';

// Stato condiviso da tutte le istanze 'inline' della pagina: il bottone in admin-header
// le apre/chiude tutte insieme, letto anche da ogni nuova istanza al montaggio.
let sharedInlineExpanded = false;

/**
 * Tooltip informativo inline o popover, con stato mostra/nascondi condiviso per pagina.
 */
@customElement('ui-info-tip')
export class UiInfoTip extends LitElement {
  @property({ type: String }) text = '';
  @property({ type: String }) heading = '';
  @property({ type: String }) size: 'xs' | 'sm' = 'xs';
  @property({ type: String }) width: 'sm' | 'md' = 'sm';
  @property({ type: String }) align: 'start' | 'end' = 'start';
  @property({ type: String }) variant: 'popover' | 'inline' = 'popover';

  @state() private open = false;

  private boundOutsideClick = this.handleOutsideClick.bind(this);
  private boundKeydown = this.handleKeydown.bind(this);
  private boundGlobalVisibility = this.handleGlobalVisibility.bind(this);

  // ─── Ciclo di vita ───────────────────────────────────────────
  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    // 'inline' non genera una propria box: bottone e riquadro diventano
    // figli diretti del genitore (h1/h2/h3), che li dispone in flex-wrap.
    this.style.display = this.variant === 'inline' ? 'contents' : 'inline-flex';
    if (this.variant === 'inline') {
      this.open = sharedInlineExpanded;
      window.addEventListener(
        'info-tips-visibility-changed',
        this.boundGlobalVisibility as EventListener,
      );
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('click', this.boundOutsideClick);
    document.removeEventListener('keydown', this.boundKeydown);
    window.removeEventListener(
      'info-tips-visibility-changed',
      this.boundGlobalVisibility as EventListener,
    );
  }

  // ─── Azioni ──────────────────────────────────────────────
  // Bottone on/off: resta aperto finché non lo si riclicca (solo il popover si chiude anche cliccando fuori/Escape).
  private toggle(e: Event) {
    e.stopPropagation();
    if (this.open) {
      this.close();
    } else {
      this.open = true;
      if (this.variant === 'popover') {
        document.addEventListener('click', this.boundOutsideClick);
        document.addEventListener('keydown', this.boundKeydown);
      }
    }
  }

  private close() {
    this.open = false;
    if (this.variant === 'popover') {
      document.removeEventListener('click', this.boundOutsideClick);
      document.removeEventListener('keydown', this.boundKeydown);
    }
  }

  // Click fuori dal componente: chiude — this.contains filtra il click sull'icona stessa che apre.
  private handleOutsideClick(e: MouseEvent) {
    if (!this.contains(e.target as Node)) {
      this.close();
    }
  }

  private handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      this.close();
    }
  }

  // Bottone globale "mostra/nascondi tutte": aggiorna lo stato condiviso, letto dalle istanze montate dopo.
  private handleGlobalVisibility(e: CustomEvent<{ expanded: boolean }>) {
    sharedInlineExpanded = e.detail.expanded;
    this.open = e.detail.expanded;
  }

  // ─── Render ──────────────────────────────────────────────
  render() {
    if (!this.text) return nothing;

    const button = html`
      <button
        type="button"
        class="text-surface-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
        aria-expanded=${this.open}
        aria-label=${__('Maggiori informazioni')}
        @click=${this.toggle}
      >
        <ui-icon name="info" size=${this.size}></ui-icon>
      </button>
    `;

    if (this.variant === 'inline') {
      return html`
        ${button}
        ${this.open
          ? html`
              <div
                role="note"
                class="w-full basis-full order-last mt-2 flex items-start gap-2 rounded-lg border p-3 bg-brand-50 dark:bg-brand-900/20 border-brand-200 dark:border-brand-800 text-xs leading-relaxed text-brand-700 dark:text-brand-300"
              >
                <ui-icon
                  name="info"
                  size="sm"
                  class="text-brand-600 dark:text-brand-400 flex-shrink-0"
                ></ui-icon>
                <div class="min-w-0">
                  ${this.heading
                    ? html`<p class="font-semibold text-brand-800 dark:text-brand-300 mb-1">
                        ${this.heading}
                      </p>`
                    : nothing}${this.text}
                </div>
              </div>
            `
          : nothing}
      `;
    }

    const widthClass = this.width === 'md' ? 'w-80' : 'w-56';
    const alignClass = this.align === 'end' ? 'right-0' : 'left-0';

    return html`
      <span class="relative inline-flex">
        ${button}
        ${this.open
          ? html`
              <div
                role="tooltip"
                class="absolute z-20 top-full mt-1.5 ${alignClass} ${widthClass} rounded-lg border shadow-lg bg-white dark:bg-surface-900 border-surface-200 dark:border-surface-700 p-3 text-xs leading-relaxed text-surface-600 dark:text-surface-400"
              >
                ${this.heading
                  ? html`<p class="font-semibold text-surface-900 dark:text-white mb-1">
                      ${this.heading}
                    </p>`
                  : nothing}${this.text}
              </div>
            `
          : nothing}
      </span>
    `;
  }
}
