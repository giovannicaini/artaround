import { apiService, type PaginatedApiResponse, getErrorMessage } from './api.service';
import type { Item, Visit } from '@artaround/shared';

type PurchaseRecord<T> = {
  _id: string;
  price: number;
  purchasedAt: string;
  itemId?: T;
  visitId?: T;
};

// Porta con sé il codice errore del server (es. INSUFFICIENT_CREDIT) oltre al
// messaggio, così chi chiama può offrire un'azione mirata (es. un pulsante
// "Ricarica credito") invece di un semplice testo d'errore.
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
  async getItems(params?: {
    museumId?: string;
    page?: number;
    limit?: number;
  }): Promise<{ items: Item[]; total: number }> {
    const query = new URLSearchParams();
    if (params?.museumId) query.append('museumId', params.museumId);
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

  async getVisits(params?: {
    museumId?: string;
    page?: number;
    limit?: number;
  }): Promise<{ visits: Visit[]; total: number }> {
    const query = new URLSearchParams();
    if (params?.museumId) query.append('museumId', params.museumId);
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
