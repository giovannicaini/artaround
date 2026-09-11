/**
 * Normalizza un campo Mongoose `{type: Map, of: ...}` (translatedTexts,
 * audio, ecc.) in un plain object — a runtime è una vera Map su un documento
 * idratato, ma un plain object su uno `.lean()` o già in JSON. Un solo posto
 * per questa differenza invece di riscriverla in ogni controller che legge
 * uno di questi campi.
 */
export function mapToRecord<T = string>(value: unknown): Record<string, T> {
  if (value instanceof Map) {
    return Object.fromEntries(value.entries()) as Record<string, T>;
  }

  if (value && typeof value === 'object') {
    return { ...(value as Record<string, T>) };
  }

  return {};
}
