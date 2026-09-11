export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * Legge page/limit dalla query string (req.query.page, req.query.limit),
 * applica un default e calcola skip.
 */
export const parsePagination = (
  query: { page?: unknown; limit?: unknown },
  defaultLimit = 20,
): PaginationParams => {
  const page = Math.max(1, parseInt(String(query.page ?? ''), 10) || 1);
  const limit = Math.max(1, parseInt(String(query.limit ?? ''), 10) || defaultLimit);
  return { page, limit, skip: (page - 1) * limit };
};

/** Costruisce il blocco `pagination` da restituire nella risposta. */
export const buildPaginationMeta = (
  total: number,
  page: number,
  limit: number,
): PaginationMeta => ({
  page,
  limit,
  total,
  totalPages: Math.ceil(total / limit),
});
