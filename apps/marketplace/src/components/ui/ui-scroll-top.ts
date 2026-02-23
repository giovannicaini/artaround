import { LitElement, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import './ui-icon';

/**
 * Scroll to Top Button
 *
 * A floating button that appears when the user scrolls down,
 * allowing them to quickly return to the top of the page.
 */
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
    if (!this.visible) return null;

    return html`
      <button
        @click=${this.scrollToTop}
        class="fixed bottom-6 right-6 z-50 flex items-center justify-center w-12 h-12 bg-brand-600 hover:bg-brand-700 text-white rounded-full shadow-lg transition-all duration-300 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
        title="Torna su"
        aria-label="Torna all'inizio della pagina"
      >
        <ui-icon name="chevronUp" size="md"></ui-icon>
      </button>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ui-scroll-top': UiScrollTop;
  }
}
