import type {
  Museum,
  MuseumConfigResponse,
  NavigatorAppConfig,
  Visit,
  Item,
  Artwork,
  User,
  LoginRequest,
  RegisterRequest,
  UserPreferences,
  VisitPurchase,
} from '@artaround/shared';

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

// stessa chiave del marketplace, localStorage è condiviso: un login vale per entrambi
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
    // login resta valido per questa sessione anche senza storage
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

  register: (data: RegisterRequest): Promise<{ user: User; token: string }> =>
    request<{ user: User; token: string }>('/auth/register', {
      method: 'POST',
      // il Navigator crea sempre visitatori, nessuna scelta di ruolo
      body: JSON.stringify({ ...data, role: 'visitor' }),
    }),

  me: (): Promise<User> => request<User>('/auth/me'),

  updatePreferences: (preferences: Partial<UserPreferences>): Promise<User> =>
    request<User>('/auth/me', {
      method: 'PUT',
      body: JSON.stringify({ preferences }),
    }),

  // Museums
  getMuseums: (city?: string): Promise<Museum[]> => {
    const params = city ? `?city=${encodeURIComponent(city)}` : '';
    return request<Museum[]>(`/museums${params}`);
  },

  getMuseum: (id: string): Promise<Museum> => request<Museum>(`/museums/${id}`),

  getMuseumConfig: (id: string): Promise<MuseumConfigResponse> =>
    request<MuseumConfigResponse>(`/museums/${id}/config`),

  // default di piattaforma, usati quando il museo non ha un navigatorConfig proprio
  getNavigatorDefaultConfigs: (): Promise<NavigatorAppConfig[]> =>
    request<NavigatorAppConfig[]>('/utils/navigator-default-config'),

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
