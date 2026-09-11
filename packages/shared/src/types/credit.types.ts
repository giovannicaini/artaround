/**
 * Tipi CREDITO
 *
 * Rappresentano il credito residuo che ha ogni utente e le operazioni su di esso
 */

export enum CreditTransactionType {
  TOPUP = 'topup', // Ricarica scelta dall'utente
  PURCHASE = 'purchase', // Acquisto di un item o una visita a pagamento
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
