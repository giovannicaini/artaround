import { LitElement } from 'lit';

/**
 * Classe base per tutti i componenti del marketplace.
 */
export class AppBaseElement extends LitElement {
  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.style.display = 'block';
  }

  // Scorre la pagina fino in cima.
  protected scrollToTop(): void {
    window.scrollTo(0, 0);
  }
}
