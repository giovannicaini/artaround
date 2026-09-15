/*
 * File: /src/types/credit.types.ts                                                      *
 * Project: @artaround/shared                                                            *
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

/**
 * Tipi CREDITO
 *
 * Rappresentano il credito residuo che ha ogni utente e le operazioni su di esso
 */

export enum CreditTransactionType {
  TOPUP = 'topup', // Ricarica scelta dall'utente
  PURCHASE = 'purchase', // Acquisto di un item o una visita a pagamento
  EARNING = 'earning', // Incasso dell'autore per la vendita di un proprio item/visita
}

export interface CreditTransaction {
  _id: string;
  userId: string;
  type: CreditTransactionType;
  amount: number; // positivo per una ricarica, negativo per un acquisto
  balanceAfter: number;
  description?: string;
  relatedType?: 'item' | 'visit';
  relatedId?: string;
  createdAt: Date;
}

export interface TopUpCreditData {
  amount: number; // importo da ricaricare
}

export interface TopUpCreditResponse {
  balance: number;
  transaction: CreditTransaction;
}

export interface CreditBalanceResponse {
  balance: number;
}
