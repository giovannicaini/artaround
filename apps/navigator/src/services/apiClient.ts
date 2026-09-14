/*
 * File: /src/services/apiClient.ts                                                      *
 * Project: @artaround/navigator                                                         *
 * Last Modified: 11/09/2026                                                             *
 * Author: Giovanni Caini (giovanni.caini@studio.unibo.it)                               *
 * -----                                                                                 *
 * MIT License                                                                           *
 *                                                                                       *
 * Copyright (c) 2026 Giovanni Caini                                                     *
 *                                                                                       *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of       *
 * this software and associated documentation files (the "Software"), to deal in         *
 * the Software without restriction, including without limitation the rights to          *
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies         *
 * of the Software, and to permit persons to whom the Software is furnished to do        *
 * so, subject to the following conditions:                                              *
 *                                                                                       *
 * The above copyright notice and this permission notice shall be included in all        *
 * copies or substantial portions of the Software.                                       *
 *                                                                                       *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR            *
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,              *
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE           *
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER                *
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,         *
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE         *
 * SOFTWARE.                                                                             *
 * ************************************************************************************* *
 */

import type {
  Museum,
  NavigatorConfig,
  Visit,
  Item,
  Artwork,
  User,
  LoginRequest,
  RegisterRequest,
  UserPreferences,
  VisitPurchase,
  VisitPurchaseWithVisit,
  AppLanguage,
  VoiceCommandId,
} from '@artaround/shared';

/**
 * Gestione delle richieste all'API del server.
 */

// API base URL - configurabile da .env
const API_BASE = import.meta.env.VITE_API_URL || '/api';

// Chiave in localStorage = chiave del marketplace per unico login
const TOKEN_KEY = 'authToken';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

// Classe per gestire gli errori nelle richieste all'API
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    // Dati extra per errori "informativi"
    public data?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

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

//Wrapper per ogni request all'API, con autenticazione tramite JWT (se già presente il token)
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
    // Risposta d'errore del server: {success:false, error:{code,message}, data?}
    const body = await response.json().catch(() => ({}));
    if (response.status === 401) clearToken();
    throw new ApiError(
      response.status,
      body.error?.code || 'UNKNOWN_ERROR',
      body.error?.message || `Errore API: ${response.status}`,
      body.data,
    );
  }

  const json: ApiResponse<T> = await response.json();
  return json.data;
}

// Collezione di tutte le possibili richieste all'API
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
      // Il Navigator crea sempre visitatori: nessuna scelta di ruolo in
      // un'app pensata per chi visita un museo, non per chi ci lavora.
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

  // Risolve quale NavigatorConfig applicare — globale, di un museo, o quella
  // richiesta esplicitamente via link/QR (slug)
  resolveNavigatorConfig: (params: {
    museumId?: string;
    slug?: string;
  }): Promise<NavigatorConfig> => {
    const query = new URLSearchParams();
    if (params.museumId) query.set('museumId', params.museumId);
    if (params.slug) query.set('slug', params.slug);
    const qs = query.toString();
    return request<NavigatorConfig>(`/navigator-configs/resolve${qs ? `?${qs}` : ''}`);
  },

  // Visite (solo pubblicate)
  getVisits: (museumId?: string, options?: { isFree?: boolean }): Promise<Visit[]> => {
    const params = new URLSearchParams({ isPublished: 'true' });
    if (museumId) params.set('museumId', museumId);
    if (options?.isFree !== undefined) params.set('isFree', String(options.isFree));
    return request<Visit[]>(`/visits?${params.toString()}`);
  },

  getVisit: (id: string): Promise<Visit> => request<Visit>(`/visits/${id}`),

  // Opere
  getArtwork: (wikidataId: string): Promise<Artwork> =>
    request<Artwork>(`/artworks/wikidata/${wikidataId}`),

  getArtworksByMuseum: (museumWikidataId: string): Promise<Artwork[]> =>
    request<Artwork[]>(`/artworks/museum/${museumWikidataId}`),

  // Contenuti
  getItem: (id: string): Promise<Item> => request<Item>(`/items/${id}`),

  getItemsForArtwork: (artworkWikidataId: string): Promise<Item[]> =>
    request<Item[]>(`/items?referenceType=artwork&referenceId=${artworkWikidataId}`),

  // Item di un museo per tipo di riferimento (autore/movimento/periodo/museo), tappe CONTENT
  getItemsByReferenceType: (referenceType: string, museumId: string): Promise<Item[]> =>
    request<Item[]>(
      `/items?referenceType=${referenceType}&museumId=${encodeURIComponent(museumId)}`,
    ),

  getItems: (filters?: { referenceType?: string; referenceId?: string }): Promise<Item[]> => {
    const params = new URLSearchParams();
    if (filters?.referenceType) params.set('referenceType', filters.referenceType);
    if (filters?.referenceId) params.set('referenceId', filters.referenceId);
    const query = params.toString();
    return request<Item[]>(`/items${query ? `?${query}` : ''}`);
  },

  // Marketplace / acquisti
  getMyPurchases: (): Promise<VisitPurchaseWithVisit[]> =>
    request<VisitPurchaseWithVisit[]>('/marketplace/my-purchases'),

  purchaseVisit: (visitId: string): Promise<VisitPurchase> =>
    request<VisitPurchase>(`/marketplace/purchase/visit/${visitId}`, { method: 'POST' }),

  // Fallback AI per i comandi vocali non riconosciuti dal match locale (vedi services/speech.ts).
  classifyVoiceCommand: (text: string, language: AppLanguage): Promise<VoiceCommandId | null> =>
    request<{ command: VoiceCommandId | null }>('/utils/voice-command', {
      method: 'POST',
      body: JSON.stringify({ text, language }),
    }).then((data) => data.command),
};
