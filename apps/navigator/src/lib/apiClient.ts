import type {
  Museum,
  MuseumConfigResponse,
  Visit,
  Item,
  Artwork,
  User,
  LoginRequest,
  VisitPurchase,
} from '@artaround/shared';

// API base URL - configurable via environment variable
const API_BASE = import.meta.env.VITE_API_URL || '/api';
const TOKEN_KEY = 'authToken';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Stessa chiave del marketplace (localStorage è condiviso: stesso dominio,
// path diverso), quindi un login nell'uno vale anche nell'altro.
export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // storage non disponibile (privacy mode/quota) - login resta valido per la sessione corrente
  }
}

export function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignorato
  }
}

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    if (response.status === 401) clearToken();
    throw new ApiError(
      response.status,
      errorData.code || 'UNKNOWN_ERROR',
      errorData.message || `Errore API: ${response.status}`,
    );
  }

  const json: ApiResponse<T> = await response.json();
  return json.data;
}

export const api = {
  // Auth
  login: (credentials: LoginRequest): Promise<{ user: User; token: string }> =>
    request<{ user: User; token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    }),

  me: (): Promise<User> => request<User>('/auth/me'),

  // Museums
  getMuseums: (city?: string): Promise<Museum[]> => {
    const params = city ? `?city=${encodeURIComponent(city)}` : '';
    return request<Museum[]>(`/museums${params}`);
  },

  getMuseum: (id: string): Promise<Museum> => request<Museum>(`/museums/${id}`),

  getMuseumConfig: (id: string): Promise<MuseumConfigResponse> =>
    request<MuseumConfigResponse>(`/museums/${id}/config`),

  // Visits
  getVisits: (museumId?: string, options?: { isFree?: boolean }): Promise<Visit[]> => {
    const params = new URLSearchParams();
    if (museumId) params.set('museumId', museumId);
    if (options?.isFree !== undefined) params.set('isFree', String(options.isFree));
    const query = params.toString();
    return request<Visit[]>(`/visits${query ? `?${query}` : ''}`);
  },

  getVisit: (id: string): Promise<Visit> => request<Visit>(`/visits/${id}`),

  // Artworks
  getArtwork: (wikidataId: string): Promise<Artwork> =>
    request<Artwork>(`/artworks/wikidata/${wikidataId}`),

  getArtworksByMuseum: (museumWikidataId: string): Promise<Artwork[]> =>
    request<Artwork[]>(`/artworks/museum/${museumWikidataId}`),

  // Items (content)
  getItem: (id: string): Promise<Item> => request<Item>(`/items/${id}`),

  getItemsForArtwork: (artworkWikidataId: string): Promise<Item[]> =>
    request<Item[]>(`/items?referenceType=artwork&referenceId=${artworkWikidataId}`),

  getItems: (filters?: { referenceType?: string; referenceId?: string }): Promise<Item[]> => {
    const params = new URLSearchParams();
    if (filters?.referenceType) params.set('referenceType', filters.referenceType);
    if (filters?.referenceId) params.set('referenceId', filters.referenceId);
    const query = params.toString();
    return request<Item[]>(`/items${query ? `?${query}` : ''}`);
  },

  // Marketplace / acquisti
  getMyPurchases: (): Promise<VisitPurchase[]> =>
    request<VisitPurchase[]>('/marketplace/my-purchases'),

  purchaseVisit: (visitId: string): Promise<VisitPurchase> =>
    request<VisitPurchase>(`/marketplace/purchase/visit/${visitId}`, { method: 'POST' }),
};
