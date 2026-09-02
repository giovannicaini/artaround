import { Request, Response, NextFunction } from 'express';
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
import { UserRole, CreditTransactionType } from '@artaround/shared';

// i saldi sono euro come float, arrotondo per evitare scarti tipo 0.1+0.2 !== 0.3
function round2(amount: number): number {
  return Math.round(amount * 100) / 100;
}

export class MarketplaceController {
  static async getItems(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        museumId,
        isFree,
        minRating,
        sortBy = 'createdAt',
        page = '1',
        limit = '20',
      } = req.query;

      const filter: Record<string, unknown> = {};
      const museumIdFilter = await buildMuseumIdFilterValue(museumId as string | undefined);
      if (museumIdFilter !== undefined) filter.museumId = museumIdFilter;
      if (isFree !== undefined) filter.isFree = isFree === 'true';
      if (minRating) filter.rating = { $gte: parseFloat(minRating as string) };

      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const skip = (pageNum - 1) * limitNum;

      let sort: Record<string, 1 | -1> = { createdAt: -1 };
      if (sortBy === 'rating') sort = { rating: -1 };
      if (sortBy === 'price') sort = { price: 1 };
      if (sortBy === 'usage') sort = { usageCount: -1 };

      const [items, total] = await Promise.all([
        ItemModel.find(filter).sort(sort).skip(skip).limit(limitNum),
        ItemModel.countDocuments(filter),
      ]);

      res.json({
        success: true,
        data: items,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async getVisits(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        museumId,
        isFree,
        minRating,
        sortBy = 'createdAt',
        page = '1',
        limit = '20',
      } = req.query;

      const filter: Record<string, unknown> = { isPublished: true };
      const museumIdFilter = await buildMuseumIdFilterValue(museumId as string | undefined);
      if (museumIdFilter !== undefined) filter.museumId = museumIdFilter;
      if (isFree !== undefined) filter['metadata.isFree'] = isFree === 'true';
      if (minRating) filter['metadata.rating'] = { $gte: parseFloat(minRating as string) };

      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const skip = (pageNum - 1) * limitNum;

      let sort: Record<string, 1 | -1> = { createdAt: -1 };
      if (sortBy === 'rating') sort = { 'metadata.rating': -1 };
      if (sortBy === 'price') sort = { 'metadata.price': 1 };
      if (sortBy === 'downloads') sort = { 'metadata.downloadsCount': -1 };

      const [visits, total] = await Promise.all([
        VisitModel.find(filter).sort(sort).skip(skip).limit(limitNum),
        VisitModel.countDocuments(filter),
      ]);

      res.json({
        success: true,
        data: visits,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async purchaseVisit(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { visitId } = req.params;

      if (!req.user) {
        throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
      }

      // le visite le compra chiunque, non solo gli autori (a differenza degli item)
      const visit = await VisitModel.findById(visitId);
      if (!visit) {
        throw new AppError(404, 'VISIT_NOT_FOUND', 'Visit not found');
      }

      if (visit.authorId === req.user.id) {
        throw new AppError(400, 'OWN_VISIT_PURCHASE', 'You cannot purchase your own visit');
      }

      if (!visit.isPublished) {
        throw new AppError(400, 'VISIT_NOT_PUBLISHED', 'This visit is not available for purchase');
      }

      const existing = await VisitPurchase.findOne({
        userId: req.user.id,
        visitId,
      });

      if (existing) {
        throw new AppError(409, 'ALREADY_PURCHASED', 'You have already purchased this visit');
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

      const purchase = new VisitPurchase({
        visitId,
        userId: req.user.id,
        price: visit.metadata.price,
      });

      await purchase.save();

      visit.metadata.purchasesCount += 1;
      visit.metadata.downloadsCount += 1;
      await visit.save();

      res.status(201).json({
        success: true,
        data: purchase,
        message: 'Visit purchased successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  static async purchaseItem(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { itemId } = req.params;

      if (!req.user) {
        throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
      }

      // gli item li comprano solo gli autori, li riusano per costruire visite
      if (req.user.role !== UserRole.AUTHOR) {
        throw new AppError(
          403,
          'FORBIDDEN',
          'Solo gli autori possono acquistare contenuti dal marketplace',
        );
      }

      const item = await ItemModel.findById(itemId);
      if (!item) {
        throw new AppError(404, 'ITEM_NOT_FOUND', 'Item not found');
      }

      if (item.authorId === req.user.id) {
        throw new AppError(400, 'OWN_ITEM_PURCHASE', 'You cannot purchase your own item');
      }

      const existing = await ItemPurchase.findOne({
        userId: req.user.id,
        itemId,
      });

      if (existing) {
        throw new AppError(409, 'ALREADY_PURCHASED', 'You have already purchased this item');
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
        message: 'Item purchased successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  static async getMyPurchases(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
      }

      const purchases = await VisitPurchase.find({ userId: req.user.id })
        .sort({ purchasedAt: -1 })
        .populate('visitId');

      res.json({
        success: true,
        data: purchases,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getMyItemPurchases(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
      }

      const purchases = await ItemPurchase.find({ userId: req.user.id })
        .sort({ purchasedAt: -1 })
        .populate('itemId');

      res.json({
        success: true,
        data: purchases,
      });
    } catch (error) {
      next(error);
    }
  }

  // scala price dal saldo e registra il movimento, va chiamata prima di
  // creare l'acquisto così se il credito non basta non si crea niente
  private static async chargeCredit(
    userId: string,
    price: number,
    relatedType: 'item' | 'visit',
    relatedId: string,
    description?: string,
  ): Promise<void> {
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
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

  static async getCreditBalance(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
      }

      const user = await User.findById(req.user.id);
      if (!user) {
        throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
      }

      res.json({
        success: true,
        data: { balance: user.creditBalance },
      });
    } catch (error) {
      next(error);
    }
  }

  // ricarica simulata, nessun pagamento reale collegato
  static async topUpCredit(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
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
        throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
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
    } catch (error) {
      next(error);
    }
  }

  static async getCreditTransactions(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
      }

      const transactions = await CreditTransaction.find({ userId: req.user.id })
        .sort({ createdAt: -1 })
        .limit(50);

      res.json({
        success: true,
        data: transactions,
      });
    } catch (error) {
      next(error);
    }
  }
}
