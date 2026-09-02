/**
 * Emette un evento custom con le opzioni bubble e composed.
 */
export function emitEvent(element: Element, name: string, detail?: unknown): void {
  element.dispatchEvent(
    new CustomEvent(name, {
      bubbles: true,
      composed: true,
      detail,
    }),
  );
}
