/*
 * File: /src/services/marketplace.service.ts                                            *
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

import { apiService, type PaginatedApiResponse, getErrorMessage } from './api.service';
import type {
  Item,
  Visit,
  ItemReferenceType,
  ContentDuration,
  LanguageLevel,
} from '@artaround/shared';

export interface MarketplaceItemFilters {
  museumId?: string;
  referenceType?: ItemReferenceType;
  duration?: ContentDuration;
  languageLevel?: LanguageLevel;
  isFree?: boolean;
  search?: string;
  sortBy?: 'createdAt' | 'price' | 'usage';
  page?: number;
  limit?: number;
}

export interface MarketplaceVisitFilters {
  museumId?: string;
  languageLevel?: LanguageLevel;
  isFree?: boolean;
  search?: string;
  sortBy?: 'createdAt' | 'price' | 'downloads';
  page?: number;
  limit?: number;
}

type PurchaseRecord<T> = {
  _id: string;
  price: number;
  purchasedAt: string;
  itemId?: T;
  visitId?: T;
};

/**
 * Catalogo e acquisto di item/visite di altri autori nel marketplace.
 */
export class PurchaseError extends Error {
  constructor(
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = 'PurchaseError';
  }
}

export class MarketplaceService {
  async getItems(params?: MarketplaceItemFilters): Promise<{ items: Item[]; total: number }> {
    const query = new URLSearchParams();
    if (params?.museumId) query.append('museumId', params.museumId);
    if (params?.referenceType) query.append('referenceType', params.referenceType);
    if (params?.duration) query.append('duration', params.duration);
    if (params?.languageLevel) query.append('languageLevel', params.languageLevel);
    if (params?.isFree !== undefined) query.append('isFree', String(params.isFree));
    if (params?.search) query.append('search', params.search);
    if (params?.sortBy) query.append('sortBy', params.sortBy);
    if (params?.page) query.append('page', String(params.page));
    if (params?.limit) query.append('limit', String(params.limit));

    const response = (await apiService.get<Item[]>(`/marketplace/items?${query.toString()}`)) as
      | PaginatedApiResponse<Item[]>
      | { success: boolean; data?: Item[]; pagination?: { total?: number } };

    if (!response.success || !response.data) {
      throw new Error(
        getErrorMessage(response as never, 'Impossibile caricare il marketplace item'),
      );
    }

    return {
      items: response.data,
      total: response.pagination?.total || response.data.length,
    };
  }

  async getVisits(params?: MarketplaceVisitFilters): Promise<{ visits: Visit[]; total: number }> {
    const query = new URLSearchParams();
    if (params?.museumId) query.append('museumId', params.museumId);
    if (params?.languageLevel) query.append('languageLevel', params.languageLevel);
    if (params?.isFree !== undefined) query.append('isFree', String(params.isFree));
    if (params?.search) query.append('search', params.search);
    if (params?.sortBy) query.append('sortBy', params.sortBy);
    if (params?.page) query.append('page', String(params.page));
    if (params?.limit) query.append('limit', String(params.limit));

    const response = (await apiService.get<Visit[]>(`/marketplace/visits?${query.toString()}`)) as
      | PaginatedApiResponse<Visit[]>
      | { success: boolean; data?: Visit[]; pagination?: { total?: number } };

    if (!response.success || !response.data) {
      throw new Error(
        getErrorMessage(response as never, 'Impossibile caricare il marketplace visite'),
      );
    }

    return {
      visits: response.data,
      total: response.pagination?.total || response.data.length,
    };
  }

  async purchaseItem(itemId: string): Promise<void> {
    const response = await apiService.post(`/marketplace/purchase/item/${itemId}`, {});
    if (!response.success) {
      const code = typeof response.error === 'object' ? response.error?.code : undefined;
      throw new PurchaseError(getErrorMessage(response, 'Impossibile acquistare item'), code);
    }
  }

  async purchaseVisit(visitId: string): Promise<void> {
    const response = await apiService.post(`/marketplace/purchase/visit/${visitId}`, {});
    if (!response.success) {
      const code = typeof response.error === 'object' ? response.error?.code : undefined;
      throw new PurchaseError(getErrorMessage(response, 'Impossibile acquistare visita'), code);
    }
  }

  async getMyItemPurchases(): Promise<Array<{ purchaseId: string; item: Item; price: number }>> {
    const response = await apiService.get<PurchaseRecord<Item>[]>('/marketplace/my-item-purchases');

    if (!response.success || !response.data) {
      throw new Error(getErrorMessage(response, 'Impossibile caricare acquisti item'));
    }

    return response.data
      .filter((purchase) => Boolean(purchase.itemId))
      .map((purchase) => ({
        purchaseId: purchase._id,
        item: purchase.itemId as Item,
        price: purchase.price,
      }));
  }

  async getMyVisitPurchases(): Promise<Array<{ purchaseId: string; visit: Visit; price: number }>> {
    const response = await apiService.get<PurchaseRecord<Visit>[]>(
      '/marketplace/my-visit-purchases',
    );

    if (!response.success || !response.data) {
      throw new Error(getErrorMessage(response, 'Impossibile caricare acquisti visite'));
    }

    return response.data
      .filter((purchase) => Boolean(purchase.visitId))
      .map((purchase) => ({
        purchaseId: purchase._id,
        visit: purchase.visitId as Visit,
        price: purchase.price,
      }));
  }
}

export const marketplaceService = new MarketplaceService();
