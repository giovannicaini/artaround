import { apiService, type PaginatedApiResponse, getErrorMessage } from './api.service';
import type { Item, ItemFilters, CreateItemData, UpdateItemData } from '@artaround/shared';

export interface ItemsResponse {
  items: Item[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export class ItemService {
  async getItems(filters: ItemFilters = {}): Promise<ItemsResponse> {
    const params = new URLSearchParams();

    if (filters.museumId) params.append('museumId', filters.museumId);
    if (filters.referenceType) params.append('referenceType', filters.referenceType);
    if (filters.referenceId) params.append('referenceId', filters.referenceId);
    if (filters.authorId) params.append('authorId', filters.authorId);
    if (filters.duration) params.append('duration', filters.duration);
    if (filters.languageLevel) params.append('languageLevel', filters.languageLevel);
    if (filters.isFree !== undefined) params.append('isFree', String(filters.isFree));
    if (filters.page) params.append('page', String(filters.page));
    if (filters.limit) params.append('limit', String(filters.limit));
    if (filters.search) params.append('search', filters.search);

    const queryString = params.toString();
    const url = `/items${queryString ? `?${queryString}` : ''}`;

    const response = (await apiService.get<Item[]>(url)) as PaginatedApiResponse<Item[]>;

    if (response.success && response.data) {
      return {
        items: response.data,
        pagination: response.pagination || {
          page: filters.page || 1,
          limit: filters.limit || 50,
          total: response.data.length,
          totalPages: 1,
        },
      };
    }

    return { items: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0 } };
  }

  async getItemsForArtwork(
    artworkWikidataId: string,
    options?: { duration?: string; languageLevel?: string },
  ): Promise<Item[]> {
    const params = new URLSearchParams();
    if (options?.duration) params.append('duration', options.duration);
    if (options?.languageLevel) params.append('languageLevel', options.languageLevel);

    const queryString = params.toString();
    const url = `/items/artwork/${artworkWikidataId}${queryString ? `?${queryString}` : ''}`;

    const response = await apiService.get<Item[]>(url);

    if (response.success && response.data) {
      return response.data;
    }

    return [];
  }

  async getItemsByReference(referenceType: string, referenceId: string): Promise<Item[]> {
    const url = `/items/reference/${referenceType}/${referenceId}`;
    const response = await apiService.get<Item[]>(url);

    if (response.success && response.data) {
      return response.data;
    }

    return [];
  }

  // Come getItemsForArtwork, ma ristretto a ciò che l'utente autenticato può
  // abbinare a una tappa che sta costruendo: propri contenuti, gratuiti, o
  // già acquistati (vedi ItemController.getUsableItemsForArtwork) — a
  // differenza del catalogo pubblico, dove si vede tutto per valutare
  // l'acquisto.
  async getUsableItemsForArtwork(
    artworkWikidataId: string,
    options?: { duration?: string; languageLevel?: string },
  ): Promise<Item[]> {
    const params = new URLSearchParams();
    if (options?.duration) params.append('duration', options.duration);
    if (options?.languageLevel) params.append('languageLevel', options.languageLevel);

    const queryString = params.toString();
    const url = `/items/artwork/${artworkWikidataId}/usable${queryString ? `?${queryString}` : ''}`;

    const response = await apiService.get<Item[]>(url);
    return response.success && response.data ? response.data : [];
  }

  // Item di un museo per tipo di riferimento (autore/movimento/periodo/museo),
  // ristretti come sopra — usata dalle tappe "Contenuto" dell'editor visite.
  async getUsableItemsByReferenceType(referenceType: string, museumId: string): Promise<Item[]> {
    const url = `/items/reference-type/${referenceType}/usable?museumId=${encodeURIComponent(museumId)}`;
    const response = await apiService.get<Item[]>(url);
    return response.success && response.data ? response.data : [];
  }

  async searchItems(query: string, filters: ItemFilters = {}): Promise<ItemsResponse> {
    const params = new URLSearchParams();
    params.append('q', query);

    if (filters.museumId) params.append('museumId', filters.museumId);
    if (filters.referenceType) params.append('referenceType', filters.referenceType);
    if (filters.page) params.append('page', String(filters.page));
    if (filters.limit) params.append('limit', String(filters.limit));

    const url = `/items/search?${params.toString()}`;

    const response = (await apiService.get<Item[]>(url)) as PaginatedApiResponse<Item[]>;

    if (response.success && response.data) {
      return {
        items: response.data,
        pagination: response.pagination || {
          page: filters.page || 1,
          limit: filters.limit || 50,
          total: response.data.length,
          totalPages: 1,
        },
      };
    }

    return { items: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0 } };
  }

  async getMyItems(): Promise<Item[]> {
    const response = await apiService.get<Item[]>('/items/my-items');

    if (response.success && response.data) {
      return response.data;
    }

    return [];
  }

  async getItem(id: string): Promise<Item | null> {
    const response = await apiService.get<Item>(`/items/${id}`);

    if (response.success && response.data) {
      return response.data;
    }

    return null;
  }

  async createItem(data: CreateItemData): Promise<Item | null> {
    const response = await apiService.post<Item>('/items', data);

    if (response.success && response.data) {
      return response.data;
    }

    throw new Error(getErrorMessage(response, 'Errore durante la creazione'));
  }

  async updateItem(id: string, data: UpdateItemData): Promise<Item | null> {
    const response = await apiService.put<Item>(`/items/${id}`, data);

    if (response.success && response.data) {
      return response.data;
    }

    throw new Error(getErrorMessage(response, "Errore durante l'aggiornamento"));
  }

  async deleteItem(id: string): Promise<boolean> {
    const response = await apiService.delete<void>(`/items/${id}`);
    return response.success;
  }
}

export const itemService = new ItemService();
