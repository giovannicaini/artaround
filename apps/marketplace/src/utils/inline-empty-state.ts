import { html, nothing } from 'lit';
import '../components/ui/ui-icon';

export interface InlineEmptyStateOptions {
  icon: string;
  text: string;
  subtext?: string;
}

/**
 * Stato vuoto compatto (icona sbiadita + testo) usato dentro tab/pannelli, più piccolo del riquadro a piena pagina di <ui-empty>.
 */
export function renderInlineEmptyState(options: InlineEmptyStateOptions) {
  const { icon, text, subtext } = options;
  return html`
    <div class="text-center py-8 text-surface-500 dark:text-surface-400">
      <ui-icon name=${icon} size="lg" class="mb-2 opacity-50"></ui-icon>
      <p>${text}</p>
      ${subtext ? html`<p class="text-sm mt-1">${subtext}</p>` : nothing}
    </div>
  `;
}
