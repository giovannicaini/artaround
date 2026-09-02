/**
 * Costruisce una query string URL da un oggetto di filtri.
 * Scarta automaticamente i valori undefined, null e stringa vuota.
 */
export function buildQueryString(filters: Record<string, unknown>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== '') {
      params.append(key, String(value));
    }
  }
  return params.toString();
}

/**
 * Costruisce un URL completo con i parametri di query dai filtri.
 */
export function buildUrl(base: string, filters: Record<string, unknown>): string {
  const query = buildQueryString(filters);
  return query ? `${base}?${query}` : base;
}
