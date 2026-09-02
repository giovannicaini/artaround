import { state } from 'lit/decorators.js';
import { preferencesService } from '../services/preferences.service';
import type { LitElement } from 'lit';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Constructor<T = LitElement> = new (...args: any[]) => T;

export interface MuseumAwareInterface {
  selectedMuseumId: string | null;
  onMuseumChanged(): void;
  emitSelectMuseum(): void;
}

// tiene traccia del museo selezionato e reagisce ai cambi
export function MuseumAwareMixin<T extends Constructor<LitElement>>(
  superClass: T,
): Constructor<MuseumAwareInterface> & T {
  class MuseumAwareClass extends superClass {
    @state() selectedMuseumId: string | null = null;

    private _museumChangeHandler = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      this.selectedMuseumId = detail?._id || null;
      this.onMuseumChanged();
    };

    connectedCallback() {
      super.connectedCallback();
      this.selectedMuseumId = preferencesService.getSelectedMuseumId();
      window.addEventListener('museum-changed', this._museumChangeHandler);
    }

    disconnectedCallback() {
      window.removeEventListener('museum-changed', this._museumChangeHandler);
      super.disconnectedCallback();
    }

    onMuseumChanged(): void {
      // da sovrascrivere nelle sottoclassi
    }

    emitSelectMuseum(): void {
      this.dispatchEvent(
        new CustomEvent('select-museum', {
          bubbles: true,
          composed: true,
        }),
      );
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return MuseumAwareClass as any;
}
