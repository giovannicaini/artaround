import { Request, Response, NextFunction } from 'express';
import { ItemModel, ItemPurchase, VisitModel, VisitPurchase } from '../models/index.js';
import { AppError } from '../middleware/index.js';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { buildMuseumIdFilterValue } from '../utils/museum-id.util.js';
import { UserRole } from '@artaround/shared';

export class MarketplaceController {
  // Get item catalog
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

  // Get published visits (marketplace catalog)
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

      // Sorting
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

  // Purchase visit (simulated)
  static async purchaseVisit(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { visitId } = req.params;

      if (!req.user) {
        throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
      }

      // Il marketplace è pensato per gli autori che riacquistano contenuti da riutilizzare
      // nelle proprie visite (vedi label "Acquistabile solo dagli autori" lato frontend):
      // prima questo vincolo esisteva solo lato client, chiunque poteva comprare chiamando
      // direttamente l'API.
      if (req.user.role !== UserRole.AUTHOR) {
        throw new AppError(
          403,
          'FORBIDDEN',
          'Solo gli autori possono acquistare contenuti dal marketplace',
        );
      }

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

      // Check if already purchased
      const existing = await VisitPurchase.findOne({
        userId: req.user.id,
        visitId,
      });

      if (existing) {
        throw new AppError(409, 'ALREADY_PURCHASED', 'You have already purchased this visit');
      }

      // Create purchase record (simulated payment)
      const purchase = new VisitPurchase({
        visitId,
        userId: req.user.id,
        price: visit.metadata.price,
      });

      await purchase.save();

      // Update visit statistics
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

  // Purchase item
  static async purchaseItem(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { itemId } = req.params;

      if (!req.user) {
        throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
      }

      // Stesso vincolo di purchaseVisit: solo gli autori possono acquistare, applicato
      // finora solo lato frontend (canBuyItem) e quindi aggirabile chiamando l'API.
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

  // Get user's purchased visits
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

  // Get user's purchased items
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
}
