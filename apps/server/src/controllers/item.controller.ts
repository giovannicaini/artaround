import { Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { Item } from '../models';
import { AppError } from '../middleware';
import { AuthRequest } from '../middleware/auth.middleware';

export class ItemController {
  // Validation rules
  static createValidation = [
    body('museumId').notEmpty().withMessage('Museum ID is required'),
    body('objectId').notEmpty().withMessage('Object ID (Wikidata) is required'),
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('contents').isArray({ min: 1 }).withMessage('At least one content version required'),
    body('metadata.license').notEmpty().withMessage('License is required'),
  ];

  // Get all items with filters and pagination
  static async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        museumId,
        authorId,
        isFree,
        page = '1',
        limit = '50',
      } = req.query;

      const filter: any = {};
      if (museumId) filter.museumId = museumId;
      if (authorId) filter.authorId = authorId;
      if (isFree !== undefined) filter['metadata.isFree'] = isFree === 'true';

      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const skip = (pageNum - 1) * limitNum;

      const [items, total] = await Promise.all([
        Item.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limitNum),
        Item.countDocuments(filter),
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

  // Search items
  static async search(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        q,
        museumId,
        tags,
        page = '1',
        limit = '50',
      } = req.query;

      const filter: any = {};
      
      if (q) {
        filter.$or = [
          { title: { $regex: q, $options: 'i' } },
          { 'contents.text': { $regex: q, $options: 'i' } },
        ];
      }
      
      if (museumId) filter.museumId = museumId;
      if (tags) filter['metadata.tags'] = { $in: (tags as string).split(',') };

      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const skip = (pageNum - 1) * limitNum;

      const [items, total] = await Promise.all([
        Item.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limitNum),
        Item.countDocuments(filter),
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

  // Get item by ID
  static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const item = await Item.findById(id);
      if (!item) {
        throw new AppError(404, 'ITEM_NOT_FOUND', 'Item not found');
      }

      res.json({
        success: true,
        data: item,
      });
    } catch (error) {
      next(error);
    }
  }

  // Create item (author only)
  static async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Validation failed', errors.array());
      }

      if (!req.user) {
        throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
      }

      const itemData = {
        ...req.body,
        authorId: req.user.id,
      };

      const item = new Item(itemData);
      await item.save();

      res.status(201).json({
        success: true,
        data: item,
        message: 'Item created successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  // Update item (owner only)
  static async update(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      if (!req.user) {
        throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
      }

      const item = await Item.findById(id);
      if (!item) {
        throw new AppError(404, 'ITEM_NOT_FOUND', 'Item not found');
      }

      // Check ownership
      if (item.authorId !== req.user.id && req.user.role !== 'admin') {
        throw new AppError(403, 'FORBIDDEN', 'You can only update your own items');
      }

      Object.assign(item, req.body);
      await item.save();

      res.json({
        success: true,
        data: item,
        message: 'Item updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  // Delete item (owner only)
  static async delete(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      if (!req.user) {
        throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
      }

      const item = await Item.findById(id);
      if (!item) {
        throw new AppError(404, 'ITEM_NOT_FOUND', 'Item not found');
      }

      // Check ownership
      if (item.authorId !== req.user.id && req.user.role !== 'admin') {
        throw new AppError(403, 'FORBIDDEN', 'You can only delete your own items');
      }

      await item.deleteOne();

      res.json({
        success: true,
        message: 'Item deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}
