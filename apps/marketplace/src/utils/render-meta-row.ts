import { html, nothing } from 'lit';

/**
 * Riga di metadati separati da un punto (autore, tipo, durata...), riusata da ogni card.
 */
export function renderMetaRow(parts: Array<string | undefined | false>) {
  const visible = parts.filter((part): part is string => Boolean(part));
  if (visible.length === 0) return nothing;

  return html`
    <div
      class="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-surface-500 dark:text-surface-400 mb-2"
    >
      ${visible.map(
        (part, index) => html`
          ${index > 0
            ? html`<span class="text-surface-300 dark:text-surface-700">•</span>`
            : nothing}
          <span>${part}</span>
        `,
      )}
    </div>
  `;
}
