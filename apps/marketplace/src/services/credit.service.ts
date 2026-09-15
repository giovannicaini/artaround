/*
 * File: /src/services/credit.service.ts                                                 *
 * Project: @artaround/marketplace                                                       *
 * Last Modified: 02/09/2026                                                             *
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

import { apiService, getErrorMessage } from './api.service';
import type { CreditTransaction, TopUpCreditResponse } from '@artaround/shared';

/**
 * Ricarica e saldo del credito marketplace dell'utente.
 */
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
