import { apiService, type ApiResponse } from './api.service';
import type { Item, ItemContent, ItemMetadata } from '@artaround/shared';

interface PaginatedResponse<T> extends ApiResponse<T> {
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CreateItemData {
  museumId: string;
  objectId: string;
  title: string;
  contents: ItemContent[];
  metadata: ItemMetadata;
  image?: string;
  relatedItems?: string[];
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface UpdateItemData extends Partial<CreateItemData> {}

export interface ItemsResponse {
  items: Item[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ItemFilters {
  museumId?: string;
  authorId?: string;
  isFree?: boolean;
  page?: number;
  limit?: number;
}

export class ItemService {
  async getItems(filters: ItemFilters = {}): Promise<ItemsResponse> {
    const params = new URLSearchParams();

    if (filters.museumId) params.append('museumId', filters.museumId);
    if (filters.authorId) params.append('authorId', filters.authorId);
    if (filters.isFree !== undefined) params.append('isFree', String(filters.isFree));
    if (filters.page) params.append('page', String(filters.page));
    if (filters.limit) params.append('limit', String(filters.limit));

    const queryString = params.toString();
    const url = `/items${queryString ? `?${queryString}` : ''}`;

    const response = (await apiService.get<Item[]>(url)) as PaginatedResponse<Item[]>;

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

  async searchItems(query: string, filters: ItemFilters = {}): Promise<ItemsResponse> {
    const params = new URLSearchParams();
    params.append('q', query);

    if (filters.museumId) params.append('museumId', filters.museumId);
    if (filters.page) params.append('page', String(filters.page));
    if (filters.limit) params.append('limit', String(filters.limit));

    const url = `/items/search?${params.toString()}`;

    const response = (await apiService.get<Item[]>(url)) as PaginatedResponse<Item[]>;

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

    throw new Error(response.message || 'Errore durante la creazione');
  }

  async updateItem(id: string, data: UpdateItemData): Promise<Item | null> {
    const response = await apiService.put<Item>(`/items/${id}`, data);

    if (response.success && response.data) {
      return response.data;
    }

    throw new Error(response.message || "Errore durante l'aggiornamento");
  }

  async deleteItem(id: string): Promise<boolean> {
    const response = await apiService.delete<void>(`/items/${id}`);
    return response.success;
  }
}

export const itemService = new ItemService();
