import { html } from 'lit';
import { __ } from '../services/i18n.service';

/**
 * Badge "N filtri" per lo slot .renderSummary di <ui-list-controls>, ripetuto identico in ogni pagina con filtri collassabili.
 */
export function renderControlsSummaryBadge(activeFilterCount: number) {
  return html`
    <ui-badge
      variant=${activeFilterCount > 0 ? 'primary' : 'secondary'}
      .label=${`${activeFilterCount} ${__('filtri')}`}
    ></ui-badge>
  `;
}
