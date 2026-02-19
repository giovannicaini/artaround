import { LitElement } from 'lit';

/**
 * Base element class for all marketplace components.
 * Disables Shadow DOM to use global Tailwind styles.
 */
export class AppBaseElement extends LitElement {
  createRenderRoot() {
    return this;
  }
}
