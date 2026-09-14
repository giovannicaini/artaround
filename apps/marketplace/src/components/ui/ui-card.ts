import { LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';

/**
 * Contenitore con bordo/ombra/padding standard, base di ogni card dell'app.
 */
@customElement('ui-card')
export class UiCard extends LitElement {
  @property({ type: String }) padding: 'none' | 'sm' | 'md' | 'lg' = 'md';
  @property({ type: Boolean }) border = true;
  @property({ type: Boolean }) shadow = true;
  @property({ type: Boolean }) hover = false;
  // Al passaggio del mouse, ombra colorata di brand (stesso .shadow-glow del
  // pulsante primario) invece della semplice ombra neutra più marcata.
  @property({ type: Boolean }) hoverGlow = false;

  private get paddingClasses() {
    const paddings: Record<string, string> = {
      none: '',
      sm: 'p-4',
      md: 'p-5',
      lg: 'p-6',
    };
    return paddings[this.padding];
  }

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.applyStyles();
  }

  private applyStyles() {
    this.style.display = 'block';
    this.classList.add('rounded-xl', 'bg-white', 'dark:bg-surface-900');

    if (this.border) {
      this.classList.add('border', 'border-surface-200', 'dark:border-surface-800');
    }

    if (this.shadow) {
      this.classList.add('shadow-soft');
    }

    if (this.hover) {
      this.classList.add(
        'transition-shadow',
        'duration-200',
        this.hoverGlow ? 'hover:shadow-glow' : 'hover:shadow-medium',
        'cursor-pointer',
      );
    }

    if (this.padding !== 'none') {
      const paddingClass = this.paddingClasses;
      if (paddingClass) {
        this.classList.add(...paddingClass.split(' '));
      }
    }
  }

  // Niente render() - i figli sono gestiti dal template Lit del genitore
}
