// credito in euro del marketplace, nessun pagamento reale collegato per ora.
// questo registro tiene solo lo storico dei movimenti di saldo, gli acquisti
// veri e propri stanno in VisitPurchase/ItemPurchase

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
  amount: number; // > 0, arrotondato ai centesimi
}

export interface TopUpCreditResponse {
  balance: number;
  transaction: CreditTransaction;
}

export interface CreditBalanceResponse {
  balance: number;
}
