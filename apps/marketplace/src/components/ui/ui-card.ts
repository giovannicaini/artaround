import { LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('ui-card')
export class UiCard extends LitElement {
  @property({ type: String }) padding: 'none' | 'sm' | 'md' | 'lg' = 'md';
  @property({ type: Boolean }) border = true;
  @property({ type: Boolean }) shadow = true;
  @property({ type: Boolean }) hover = false;

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
        'hover:shadow-medium',
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
}
