import { Request, Response } from 'express';
import { asyncHandler } from '../utils/async-handler.util.js';
import {
  ItemModel,
  ItemPurchase,
  VisitModel,
  VisitPurchase,
  User,
  CreditTransaction,
} from '../models/index.js';
import { AppError } from '../middleware/index.js';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { buildMuseumIdFilterValue } from '../utils/museum-id.util.js';
import { parsePagination, buildPaginationMeta } from '../utils/pagination.util.js';
import { applyCoverImageFallback } from '../utils/visit-cover-image.util.js';
import { attachAuthorNames } from '../utils/author-name.util.js';
import { CreditTransactionType } from '@artaround/shared';

// Arrotonda ai centesimi: i saldi/importi sono euro come float (stessa
// convenzione di Item.price/Visit.metadata.price), non centesimi interi —
// senza arrotondare qui la sottrazione/somma ripetuta di float accumula
// scarti (es. 0.1 + 0.2 !== 0.3).
function round2(amount: number): number {
  return Math.round(amount * 100) / 100;
}

export class MarketplaceController {
  // GET /api/marketplace/items — catalogo item con filtri e ordinamento
  static getItems = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const {
      museumId,
      isFree,
      minRating,
      referenceType,
      duration,
      languageLevel,
      search,
      sortBy = 'createdAt',
    } = req.query;

    const filter: Record<string, unknown> = {};
    const museumIdFilter = await buildMuseumIdFilterValue(museumId as string | undefined);
    if (museumIdFilter !== undefined) filter.museumId = museumIdFilter;
    if (isFree !== undefined) filter.isFree = isFree === 'true';
    if (minRating) filter.rating = { $gte: parseFloat(minRating as string) };
    if (referenceType) filter.referenceType = referenceType;
    if (duration) filter.duration = duration;
    if (languageLevel) filter.languageLevel = languageLevel;
    if (search) {
      const q = String(search).trim();
      if (q) {
        filter.$or = [
          { title: { $regex: q, $options: 'i' } },
          { text: { $regex: q, $options: 'i' } },
        ];
      }
    }

    const { page, limit, skip } = parsePagination(req.query, 20);

    let sort: Record<string, 1 | -1> = { createdAt: -1 };
    if (sortBy === 'rating') sort = { rating: -1 };
    if (sortBy === 'price') sort = { price: 1 };
    if (sortBy === 'usage') sort = { usageCount: -1 };

    const [items, total] = await Promise.all([
      ItemModel.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      ItemModel.countDocuments(filter),
    ]);
    await attachAuthorNames(items);

    res.json({
      success: true,
      data: items,
      pagination: buildPaginationMeta(total, page, limit),
    });
  });

  // GET /api/marketplace/visits — catalogo delle visite pubblicate, con filtri e ordinamento
  static getVisits = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { museumId, isFree, languageLevel, search, sortBy = 'createdAt' } = req.query;

    const filter: Record<string, unknown> = { isPublished: true };
    const museumIdFilter = await buildMuseumIdFilterValue(museumId as string | undefined);
    if (museumIdFilter !== undefined) filter.museumId = museumIdFilter;
    if (isFree !== undefined) filter['metadata.isFree'] = isFree === 'true';
    if (languageLevel) filter['targetAudience.languageLevels'] = languageLevel;
    if (search) {
      const q = String(search).trim();
      if (q) {
        filter.$or = [
          { title: { $regex: q, $options: 'i' } },
          { description: { $regex: q, $options: 'i' } },
        ];
      }
    }

    const { page, limit, skip } = parsePagination(req.query, 20);

    // Ordinamento
    let sort: Record<string, 1 | -1> = { createdAt: -1 };
    if (sortBy === 'price') sort = { 'metadata.price': 1 };
    if (sortBy === 'downloads') sort = { 'metadata.downloadsCount': -1 };

    const [visits, total] = await Promise.all([
      VisitModel.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      VisitModel.countDocuments(filter),
    ]);
    await attachAuthorNames(visits);

    res.json({
      success: true,
      data: await applyCoverImageFallback(visits),
      pagination: buildPaginationMeta(total, page, limit),
    });
  });

  // POST /api/marketplace/purchase/visit/:visitId — acquista visita (simulato)
  static purchaseVisit = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const { visitId } = req.params;

    if (!req.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Autenticazione richiesta');
    }

    // Le visite sono il prodotto finito destinato al visitatore finale: per specifica
    // il Navigator (app usata durante la visita) fornisce "accesso al marketplace" per
    // scegliere/acquistare la visita da eseguire, quindi qui NON va ristretto agli autori
    // (a differenza degli item, mattoncini che gli autori riusano per costruire nuove
    // visite — vedi purchaseItem).
    const visit = await VisitModel.findById(visitId);
    if (!visit) {
      throw new AppError(404, 'VISIT_NOT_FOUND', 'Visita non trovata');
    }

    if (visit.authorId === req.user.id) {
      throw new AppError(400, 'OWN_VISIT_PURCHASE', 'Non puoi acquistare la tua stessa visita');
    }

    if (!visit.isPublished) {
      throw new AppError(
        400,
        'VISIT_NOT_PUBLISHED',
        "Questa visita non è disponibile per l'acquisto",
      );
    }

    // Controlla se già acquistato
    const existing = await VisitPurchase.findOne({
      userId: req.user.id,
      visitId,
    });

    if (existing) {
      throw new AppError(409, 'ALREADY_PURCHASED', 'Hai già acquistato questa visita');
    }

    if (visit.metadata.price > 0) {
      await MarketplaceController.chargeCredit(
        req.user.id,
        visit.metadata.price,
        'visit',
        String(visitId),
        visit.title,
      );
    }

    // Create purchase record (pagata col credito se a pagamento, nessun
    // pagamento reale coinvolto — vedi chargeCredit)
    const purchase = new VisitPurchase({
      visitId,
      userId: req.user.id,
      price: visit.metadata.price,
    });

    await purchase.save();

    // Aggiorna le statistiche della visita
    visit.metadata.purchasesCount += 1;
    visit.metadata.downloadsCount += 1;
    await visit.save();

    res.status(201).json({
      success: true,
      data: purchase,
      message: 'Visita acquistata con successo',
    });
  });

  // POST /api/marketplace/purchase/item/:itemId — acquista item (solo autori)
  static purchaseItem = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const { itemId } = req.params;

    if (!req.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Autenticazione richiesta');
    }

    // "Essere curatore/autore di almeno un museo" è già richiesto dalla route
    // (authorizeContentCreator, vedi marketplace.routes.ts): gli item sono
    // mattoncini di contenuto pensati per essere riusati da chi crea contenuti
    // nel costruire nuove visite, non un prodotto per il visitatore finale —
    // a differenza delle visite (vedi purchaseVisit).
    const item = await ItemModel.findById(itemId);
    if (!item) {
      throw new AppError(404, 'ITEM_NOT_FOUND', 'Item non trovato');
    }

    if (item.authorId === req.user.id) {
      throw new AppError(400, 'OWN_ITEM_PURCHASE', 'Non puoi acquistare il tuo stesso item');
    }

    const existing = await ItemPurchase.findOne({
      userId: req.user.id,
      itemId,
    });

    if (existing) {
      throw new AppError(409, 'ALREADY_PURCHASED', 'Hai già acquistato questo item');
    }

    if (item.price > 0) {
      await MarketplaceController.chargeCredit(
        req.user.id,
        item.price,
        'item',
        String(itemId),
        item.title,
      );
    }

    const purchase = new ItemPurchase({
      itemId,
      userId: req.user.id,
      price: item.price,
    });

    await purchase.save();

    item.usageCount += 1;
    await item.save();

    res.status(201).json({
      success: true,
      data: purchase,
      message: 'Item acquistato con successo',
    });
  });

  // GET /api/marketplace/my-visit-purchases — visite acquistate dall'utente autenticato
  static getMyPurchases = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Autenticazione richiesta');
    }

    const purchases = await VisitPurchase.find({ userId: req.user.id })
      .sort({ purchasedAt: -1 })
      .populate('visitId')
      .lean();

    // I sotto-documenti popolati sono referenziati dagli stessi oggetti in
    // `purchases`: applyCoverImageFallback/attachAuthorNames li mutano
    // in place, quindi basta passarli, senza dover ricostruire la risposta.
    const populatedVisits = purchases.map((p) => p.visitId).filter(Boolean) as unknown as Array<{
      museumId: string;
      coverImage?: string;
      authorId: string;
      authorName?: string;
    }>;
    await applyCoverImageFallback(populatedVisits);
    await attachAuthorNames(populatedVisits);

    res.json({
      success: true,
      data: purchases,
    });
  });

  // GET /api/marketplace/my-item-purchases — item acquistati dall'utente autenticato
  static getMyItemPurchases = asyncHandler(
    async (req: AuthRequest, res: Response): Promise<void> => {
      if (!req.user) {
        throw new AppError(401, 'UNAUTHORIZED', 'Autenticazione richiesta');
      }

      const purchases = await ItemPurchase.find({ userId: req.user.id })
        .sort({ purchasedAt: -1 })
        .populate('itemId')
        .lean();

      const populatedItems = purchases.map((p) => p.itemId).filter(Boolean) as unknown as Array<{
        authorId: string;
        authorName?: string;
      }>;
      await attachAuthorNames(populatedItems);

      res.json({
        success: true,
        data: purchases,
      });
    },
  );

  // ─── Credito ────────────────────────────────────────────
  /**
   * Addebita `price` euro sul saldo dell'utente e registra il movimento.
   * Lancia INSUFFICIENT_CREDIT se il saldo non basta — va chiamata PRIMA di
   * creare il record di acquisto, così un saldo insufficiente blocca
   * l'acquisto invece di crearlo comunque "gratis".
   */
  private static async chargeCredit(
    userId: string,
    price: number,
    relatedType: 'item' | 'visit',
    relatedId: string,
    description?: string,
  ): Promise<void> {
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', 'Utente non trovato');
    }

    if (user.creditBalance < price) {
      const missing = round2(price - user.creditBalance);
      throw new AppError(
        402,
        'INSUFFICIENT_CREDIT',
        `Credito insufficiente: mancano €${missing.toFixed(2)}. Ricarica il tuo credito per continuare.`,
        { balance: user.creditBalance, price, missing },
      );
    }

    user.creditBalance = round2(user.creditBalance - price);
    await user.save();

    await new CreditTransaction({
      userId,
      type: CreditTransactionType.PURCHASE,
      amount: round2(-price),
      balanceAfter: user.creditBalance,
      description,
      relatedType,
      relatedId,
    }).save();
  }

  /**
   * POST /api/marketplace/credit/topup — ricarica credito (simulata): l'utente sceglie
   * una cifra e il saldo viene accreditato direttamente, senza nessun pagamento reale —
   * non c'è ancora un gateway di pagamento collegato.
   */
  static topUpCredit = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Autenticazione richiesta');
    }

    const amount = Number(req.body?.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new AppError(400, 'INVALID_AMOUNT', "L'importo deve essere un numero positivo");
    }
    if (amount > 1000) {
      throw new AppError(400, 'AMOUNT_TOO_HIGH', 'Massimo €1000 per singola ricarica');
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', 'Utente non trovato');
    }

    user.creditBalance = round2(user.creditBalance + round2(amount));
    await user.save();

    const transaction = await new CreditTransaction({
      userId: req.user.id,
      type: CreditTransactionType.TOPUP,
      amount: round2(amount),
      balanceAfter: user.creditBalance,
      description: 'Ricarica credito',
    }).save();

    res.status(201).json({
      success: true,
      data: { balance: user.creditBalance, transaction },
    });
  });

  // GET /api/marketplace/credit/transactions — storico movimenti di credito (più recenti prima)
  static getCreditTransactions = asyncHandler(
    async (req: AuthRequest, res: Response): Promise<void> => {
      if (!req.user) {
        throw new AppError(401, 'UNAUTHORIZED', 'Autenticazione richiesta');
      }

      const transactions = await CreditTransaction.find({ userId: req.user.id })
        .sort({ createdAt: -1 })
        .limit(50);

      res.json({
        success: true,
        data: transactions,
      });
    },
  );
}
