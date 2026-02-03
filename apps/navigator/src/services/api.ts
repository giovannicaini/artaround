import type { Museum, Visit, Item } from '@artaround/shared';

// API base URL - configurable via environment variable
const API_BASE = import.meta.env.VITE_API_URL || '/api';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new ApiError(
      response.status,
      errorData.code || 'UNKNOWN_ERROR',
      errorData.message || `API Error: ${response.status}`,
    );
  }

  const json: ApiResponse<T> = await response.json();
  return json.data;
}

export const api = {
  // Museums
  getMuseums: (city?: string): Promise<Museum[]> => {
    const params = city ? `?city=${encodeURIComponent(city)}` : '';
    return request<Museum[]>(`/museums${params}`);
  },

  getMuseum: (id: string): Promise<Museum> => request<Museum>(`/museums/${id}`),

  // Visits
  getVisits: (museumId?: string, options?: { isFree?: boolean }): Promise<Visit[]> => {
    const params = new URLSearchParams();
    if (museumId) params.set('museumId', museumId);
    if (options?.isFree !== undefined) params.set('isFree', String(options.isFree));
    const query = params.toString();
    return request<Visit[]>(`/visits${query ? `?${query}` : ''}`);
  },

  getVisit: (id: string): Promise<Visit> => request<Visit>(`/visits/${id}`),

  // Items
  getItem: (id: string): Promise<Item> => request<Item>(`/items/${id}`),

  getItems: (museumId?: string): Promise<Item[]> => {
    const params = museumId ? `?museumId=${encodeURIComponent(museumId)}` : '';
    return request<Item[]>(`/items${params}`);
  },

  searchItems: (query: string, museumId?: string): Promise<Item[]> => {
    const params = new URLSearchParams({ q: query });
    if (museumId) params.set('museumId', museumId);
    return request<Item[]>(`/items/search?${params.toString()}`);
  },

  // Get multiple items by IDs
  getItemsByIds: async (ids: string[]): Promise<Item[]> => {
    // Fetch items in parallel
    const items = await Promise.all(ids.map((id) => request<Item>(`/items/${id}`)));
    return items;
  },
};

export { ApiError };
