import { LitElement, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import './ui-icon';
import { __ } from '../../services/i18n.service';

// Stato condiviso da tutte le istanze 'inline' della pagina corrente: il
// bottone in admin-header (vedi toggleAllInfoTips) le apre/chiude tutte
// insieme dispatchando 'info-tips-visibility-changed' su window. Letto anche
// da ogni nuova istanza al montaggio, così una pagina aperta dopo un "mostra
// tutte" parte già espansa invece che chiusa.
let sharedInlineExpanded = false;

/**
 * UI Info Tip
 *
 * Icona "i" che, al click, mostra una spiegazione contestuale — usata
 * accanto a titoli di pagina/sezione e a label di campo per spiegare cosa
 * fanno senza occupare spazio permanente nel layout.
 *
 * Due varianti per due contesti diversi:
 * - `popover` (default): riquadro fluttuante sopra il testo, per label di
 *   campo e altri contesti compatti/in riga dove non c'è spazio per un box —
 *   si chiude anche cliccando fuori o con Escape, come un vero popover.
 * - `inline`: riquadro a piena larghezza che si apre nel flusso normale,
 *   sotto il titolo — per titoli di pagina/sezione. Il genitore diretto
 *   (h1/h2/h3) deve avere `flex-wrap` perché il riquadro possa andare a
 *   capo sotto testo e icona; se un fratello nella stessa riga flex ha un
 *   ruolo diverso dal titolo (es. un bottone azione), quella riga va allineata
 *   `items-start`, altrimenti il fratello finisce centrato verticalmente
 *   contro tutto il blocco titolo+riquadro. Il bottone è un vero on/off: resta
 *   aperto finché non lo si riclicca, cliccare altrove sulla pagina non lo
 *   chiude.
 *
 * @example
 * ```html
 * <ui-info-tip text=${__('Il museo su cui stai lavorando ora.')}></ui-info-tip>
 * <h1 class="flex items-center gap-2 flex-wrap">
 *   Titolo
 *   <ui-info-tip variant="inline" text=${__('Spiegazione della pagina.')}></ui-info-tip>
 * </h1>
 * ```
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
  // Bottone on/off: resta aperto finché non lo si riclicca. Solo il popover
  // (un vero overlay fluttuante) si chiude anche cliccando fuori o con
  // Escape — l'inline vive nel flusso della pagina, non serve "richiuderlo da
  // solo".
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

  // Click fuori dal componente: chiude — sullo stesso click che apre il
  // popover questo handler viene comunque invocato (il listener è già
  // attivo quando l'evento arriva al document in bubbling), ma this.contains
  // è vero per il click sull'icona stessa e lo filtra.
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

  // Bottone globale in admin-header ("mostra/nascondi tutte le info di
  // pagina"): aggiorna anche lo stato condiviso, letto dalle istanze montate
  // successivamente (es. dopo un cambio pagina).
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
