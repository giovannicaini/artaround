/*
 * File: /src/components/ui/ui-card.ts                                                   *
 * Project: @artaround/marketplace                                                       *
 * Last Modified: 14/09/2026                                                             *
 * Author: Giovanni Caini (giovanni.caini@studio.unibo.it)                               *
 * -----                                                                                 *
 * MIT License                                                                           *
 *                                                                                       *
 * Copyright (c) 2026 Giovanni Caini                                                     *
 *                                                                                       *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of       *
 * this software and associated documentation files (the "Software"), to deal in         *
 * the Software without restriction, including without limitation the rights to          *
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies         *
 * of the Software, and to permit persons to whom the Software is furnished to do        *
 * so, subject to the following conditions:                                              *
 *                                                                                       *
 * The above copyright notice and this permission notice shall be included in all        *
 * copies or substantial portions of the Software.                                       *
 *                                                                                       *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR            *
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,              *
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE           *
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER                *
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,         *
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE         *
 * SOFTWARE.                                                                             *
 * ************************************************************************************* *
 */

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
