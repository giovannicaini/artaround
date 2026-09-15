import { LitElement, html, nothing } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';
import QRCode from 'qrcode';
import './ui-icon-button';
import { __ } from '../../services/i18n.service';

/**
 * Overlay centrato con il QR code di un link (Navigator globale o di un
 * museo) — stesso schema di ui-modal (backdrop, Esc per chiudere) ma con un
 * canvas al posto di titolo/messaggio fissi.
 */
@customElement('ui-qr-modal')
export class UiQrModal extends LitElement {
  @property({ type: Boolean }) open = false;
  @property({ type: String }) title = '';
  // URL assoluto da codificare — relativo al dominio corrente se non già assoluto.
  @property({ type: String }) value = '';

  @query('canvas') private canvasEl?: HTMLCanvasElement;

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.style.display = 'block';
    document.addEventListener('keydown', this.handleKeydown);
  }

  disconnectedCallback() {
    document.removeEventListener('keydown', this.handleKeydown);
    super.disconnectedCallback();
  }

  // Un QR va sempre inquadrato da un altro dispositivo, senza il contesto di
  // questa pagina: un percorso relativo lì non vuol dire nulla, serve
  // sempre l'URL assoluto (dominio incluso), sia nel QR che nel testo sotto.
  private get absoluteUrl(): string {
    if (!this.value) return '';
    return new URL(this.value, window.location.origin).toString();
  }

  updated(changed: Map<string, unknown>) {
    if ((changed.has('open') || changed.has('value')) && this.open && this.value) {
      void this.renderQr();
    }
  }

  private async renderQr(): Promise<void> {
    // Aspetta il prossimo frame: al primo render dopo "open" il <canvas> potrebbe non esistere ancora.
    await this.updateComplete;
    if (!this.canvasEl) return;
    try {
      await QRCode.toCanvas(this.canvasEl, this.absoluteUrl, { width: 280, margin: 1 });
    } catch {
      // ignorato: il canvas resta vuoto, non blocca il resto della UI
    }
  }

  private handleKeydown = (e: KeyboardEvent): void => {
    if (this.open && e.key === 'Escape') this.close();
  };

  private close(): void {
    this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
  }

  render() {
    if (!this.open) return nothing;

    return html`
      <div
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        @click=${(e: Event) => e.target === e.currentTarget && this.close()}
      >
        <div
          class="bg-white dark:bg-surface-900 rounded-xl shadow-2xl w-full max-w-xs p-6 text-center space-y-4"
          role="dialog"
          aria-modal="true"
        >
          <div class="flex items-start justify-between gap-2">
            <h3 class="text-base font-semibold text-surface-900 dark:text-white text-left">
              ${this.title || __('QR code')}
            </h3>
            <ui-icon-button
              icon="x"
              .title=${__('Chiudi')}
              @click=${() => this.close()}
            ></ui-icon-button>
          </div>
          <div class="flex justify-center">
            <canvas class="rounded-lg"></canvas>
          </div>
          <p class="text-xs text-surface-500 dark:text-surface-400 break-all">
            ${this.absoluteUrl}
          </p>
        </div>
      </div>
    `;
  }
}
