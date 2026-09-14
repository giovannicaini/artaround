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
