import { LitElement, html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import './ui-icon';
import { __ } from '../../services/i18n.service';

@customElement('ui-scroll-top')
export class UiScrollTop extends LitElement {
  @state() private visible = false;

  private scrollThreshold = 300;

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener('scroll', this.handleScroll);
    this.handleScroll();
  }

  disconnectedCallback() {
    window.removeEventListener('scroll', this.handleScroll);
    super.disconnectedCallback();
  }

  private handleScroll = () => {
    this.visible = window.scrollY > this.scrollThreshold;
  };

  private scrollToTop() {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }

  render() {
    if (!this.visible) return nothing;

    return html`
      <button
        @click=${this.scrollToTop}
        class="fixed bottom-6 right-6 z-50 flex items-center justify-center w-12 h-12 bg-brand-600 hover:bg-brand-700 text-white rounded-full shadow-lg transition-all duration-300 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
        .title=${__('Torna su')}
        aria-label=${__("Torna all'inizio della pagina")}
      >
        <ui-icon name="chevron-up" size="md"></ui-icon>
      </button>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ui-scroll-top': UiScrollTop;
  }
}
