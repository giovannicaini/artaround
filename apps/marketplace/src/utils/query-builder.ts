/**
 * Build URL query string from filters object.
 * Automatically filters out undefined, null, and empty string values.
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
 * Build a full URL with query parameters from filters.
 */
export function buildUrl(base: string, filters: Record<string, unknown>): string {
  const query = buildQueryString(filters);
  return query ? `${base}?${query}` : base;
}
