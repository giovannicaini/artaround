import type { LitElement } from 'lit';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Constructor<T = LitElement> = new (...args: any[]) => T;

export interface HistorySyncInterface {
  emitPageStateChange(detail: Record<string, unknown>): void;
}

/**
 * Dispatch di 'page-state-changed' verso app-root: ogni pagina calcola il proprio `detail`.
 */
export function HistorySyncMixin<TBase extends Constructor>(
  superClass: TBase,
): Constructor<HistorySyncInterface> & TBase {
  class HistorySyncClass extends superClass {
    emitPageStateChange(detail: Record<string, unknown>): void {
      this.dispatchEvent(
        new CustomEvent('page-state-changed', { detail, bubbles: true, composed: true }),
      );
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return HistorySyncClass as any;
}
