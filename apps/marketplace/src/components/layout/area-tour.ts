import { LitElement, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { User } from '@artaround/shared';
import { preferencesService, type TourId } from '../../services/preferences.service';
import { getTourSlides } from '../../utils/tour-content';
import '../ui/ui-tour';

/**
 * Ospita uno dei tour per area (benvenuto, autore, gestione museo, piantina, amministrazione).
 */
@customElement('area-tour')
export class AreaTour extends LitElement {
  @property({ type: String }) tourId: TourId | null = null;
  // Solo il tour di benvenuto lo usa (per adattare la slide finale a chi è
  // già autore/curatore) — vedi tour-content.ts, getWelcomeTourSlides.
  @property({ type: Object }) user: User | null = null;

  createRenderRoot() {
    return this;
  }

  private handleFinished() {
    if (this.tourId) {
      preferencesService.markTourSeen(this.tourId);
    }
    this.dispatchEvent(new CustomEvent('tour-finished', { bubbles: true, composed: true }));
  }

  render() {
    if (!this.tourId) return nothing;

    return html`
      <ui-tour
        .slides=${getTourSlides(this.tourId, this.user)}
        @tour-finished=${this.handleFinished}
      ></ui-tour>
    `;
  }
}
