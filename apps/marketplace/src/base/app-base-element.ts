import { LitElement } from 'lit';

/**
 * Base element class for all marketplace components.
 * Disables Shadow DOM to use global Tailwind styles.
 */
export class AppBaseElement extends LitElement {
  createRenderRoot() {
    return this;
  }

  /**
   * Scroll the page to the top.
   * Use when changing views within a component.
   */
  protected scrollToTop(): void {
    window.scrollTo(0, 0);
  }
}
