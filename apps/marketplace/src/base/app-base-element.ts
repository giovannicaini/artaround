import { LitElement } from 'lit';

// niente Shadow DOM così Tailwind (globale) funziona su tutti i componenti
export class AppBaseElement extends LitElement {
  createRenderRoot() {
    return this;
  }

  protected scrollToTop(): void {
    window.scrollTo(0, 0);
  }
}
