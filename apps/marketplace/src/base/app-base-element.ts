import { LitElement } from 'lit';

/**
 * Classe base per tutti i componenti del marketplace.
 * Disabilita lo Shadow DOM per usare gli stili Tailwind globali.
 */
export class AppBaseElement extends LitElement {
  createRenderRoot() {
    return this;
  }

  /**
   * Scorre la pagina fino in cima.
   * Da usare quando si cambia vista all'interno di un componente.
   */
  protected scrollToTop(): void {
    window.scrollTo(0, 0);
  }
}
