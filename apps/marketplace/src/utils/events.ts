/**
 * Dispatch a custom event with bubble and composed options.
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
