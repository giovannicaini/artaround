/*
 * File: /src/services/item.service.ts                                                   *
 * Project: @artaround/marketplace                                                       *
 * Last Modified: 14/09/2026                                                             *
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

import {
  apiService,
  type ApiResponse,
  type PaginatedApiResponse,
  getErrorMessage,
} from './api.service';
import type {
  Item,
  ItemFilters,
  CreateItemData,
  UpdateItemData,
  AppLanguage,
} from '@artaround/shared';
import { __ } from './i18n.service';

export interface ItemsResponse {
  items: Item[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * CRUD dei contenuti (item) e ricerca di quelli usabili in una tappa.
 */
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

  // Come getItemsForArtwork, ma ristretto a ciò che l'utente può abbinare: propri, gratuiti o già acquistati.
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

  // multipart/form-data: apiService forza sempre JSON, serve una fetch a mano
  // (stesso pattern di upload.service.ts).
  async uploadAudio(id: string, language: AppLanguage, file: File): Promise<Item> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('language', language);

    const token = localStorage.getItem('authToken');
    const headers: HeadersInit = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`/api/items/${id}/audio`, {
      method: 'POST',
      headers,
      body: formData,
    });
    const body = (await response.json()) as ApiResponse<Item>;

    if (body.success && body.data) return body.data;
    throw new Error(getErrorMessage(body, __("Errore durante il caricamento dell'audio")));
  }

  async deleteAudio(id: string, language: AppLanguage): Promise<Item> {
    const response = await apiService.delete<Item>(`/items/${id}/audio/${language}`);
    if (response.success && response.data) return response.data;
    throw new Error(getErrorMessage(response, __("Errore durante l'eliminazione dell'audio")));
  }

  async generateAudio(id: string): Promise<Item> {
    const response = await apiService.post<Item>(`/items/${id}/generate-audio`, {});
    if (response.success && response.data) return response.data;
    throw new Error(getErrorMessage(response, __("Errore durante la generazione dell'audio")));
  }
}

export const itemService = new ItemService();
