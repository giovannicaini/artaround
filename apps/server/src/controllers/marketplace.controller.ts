import { Request, Response, NextFunction } from 'express';
import { VisitModel, VisitPurchase } from '../models/index.js';
import { AppError } from '../middleware/index.js';
import { AuthRequest } from '../middleware/auth.middleware.js';

export class MarketplaceController {
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
      if (museumId) filter.museumId = museumId;
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

      const visit = await VisitModel.findById(visitId);
      if (!visit) {
        throw new AppError(404, 'VISIT_NOT_FOUND', 'Visit not found');
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
}
