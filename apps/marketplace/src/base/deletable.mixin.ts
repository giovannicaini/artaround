import { state } from 'lit/decorators.js';
import type { LitElement } from 'lit';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Constructor<T = LitElement> = new (...args: any[]) => T;

export interface DeletableInterface {
  deleteModalOpen: boolean;
  entityToDelete: unknown;
  deleting: boolean;
  openDeleteModal(entity: unknown): void;
  closeDeleteModal(): void;
}

/**
 * Stato e apertura/chiusura del modale di conferma eliminazione, comuni a ogni pagina. entityToDelete è `unknown`: un mixin generico parametrizzato spezza l'inferenza degli altri mixin.
 */
export function DeletableMixin<TBase extends Constructor>(
  superClass: TBase,
): Constructor<DeletableInterface> & TBase {
  class DeletableClass extends superClass {
    @state() deleteModalOpen = false;
    @state() entityToDelete: unknown = null;
    @state() deleting = false;

    openDeleteModal(entity: unknown): void {
      this.entityToDelete = entity;
      this.deleteModalOpen = true;
    }

    closeDeleteModal(): void {
      this.deleteModalOpen = false;
      this.entityToDelete = null;
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return DeletableClass as any;
}
