// Credito in euro del marketplace: nessun pagamento reale per ora — l'utente
// sceglie una cifra e il saldo viene semplicemente accreditato (vedi
// MarketplaceController.topUpCredit). Le voci di questo registro sono lo
// storico dei movimenti (ricariche e acquisti), non gli acquisti stessi —
// quelli restano in VisitPurchase/ItemPurchase, che raccontano "cosa" è
// stato comprato mentre questo registro racconta "cosa è successo al saldo".

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
