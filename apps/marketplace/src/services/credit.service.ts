import { apiService, getErrorMessage } from './api.service';
import type { CreditTransaction, TopUpCreditResponse } from '@artaround/shared';

export class CreditService {
  async topUp(amount: number): Promise<{ balance: number; error?: string }> {
    const response = await apiService.post<TopUpCreditResponse>('/marketplace/credit/topup', {
      amount,
    });

    if (response.success && response.data) {
      return { balance: response.data.balance };
    }

    return { balance: 0, error: getErrorMessage(response, 'Ricarica non riuscita') };
  }

  async getTransactions(): Promise<CreditTransaction[]> {
    const response = await apiService.get<CreditTransaction[]>('/marketplace/credit/transactions');

    if (!response.success || !response.data) {
      throw new Error(getErrorMessage(response, 'Impossibile caricare i movimenti di credito'));
    }

    return response.data;
  }
}

export const creditService = new CreditService();
