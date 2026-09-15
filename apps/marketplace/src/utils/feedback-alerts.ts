/*
 * File: /src/utils/feedback-alerts.ts                                                   *
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

import { html, nothing } from 'lit';
import '../components/ui/ui-alert';

export interface FeedbackAlertsOptions {
  error?: string;
  success?: string;
  errorTitle?: string;
  className?: string;
  showRetry?: boolean;
  onRetry?: () => void;
  dismissible?: boolean;
  onDismissError?: () => void;
  onDismissSuccess?: () => void;
}

/**
 * Coppia di alert errore/successo, entrambi nascosti se il rispettivo testo è vuoto.
 */
export function renderFeedbackAlerts(options: FeedbackAlertsOptions) {
  const {
    error,
    success,
    errorTitle,
    className,
    showRetry,
    onRetry,
    dismissible,
    onDismissError,
    onDismissSuccess,
  } = options;

  return html`
    ${error
      ? html`<ui-alert
          variant="danger"
          .title=${errorTitle || ''}
          .message=${error}
          class=${className || nothing}
          ?showRetry=${showRetry}
          ?dismissible=${dismissible}
          @retry=${onRetry}
          @dismiss=${onDismissError}
        ></ui-alert>`
      : nothing}
    ${success
      ? html`<ui-alert
          variant="success"
          .message=${success}
          class=${className || nothing}
          ?dismissible=${dismissible}
          @dismiss=${onDismissSuccess}
        ></ui-alert>`
      : nothing}
  `;
}
