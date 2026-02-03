import { Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { Visit } from '../models/index.js';
import { AppError } from '../middleware/index.js';
import { AuthRequest } from '../middleware/auth.middleware.js';

export class VisitController {
  static createValidation = [
    body('museumId').notEmpty().withMessage('Museum ID is required'),
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('description').trim().notEmpty().withMessage('Description is required'),
    body('items').isArray({ min: 1 }).withMessage('At least one item required'),
    body('targetAudience').notEmpty().withMessage('Target audience is required'),
  ];

  // Get all visits with filters
  static async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { museumId, authorId, isPublished, isFree, page = '1', limit = '20' } = req.query;

      const filter: Record<string, unknown> = {};
      if (museumId) filter.museumId = museumId;
      if (authorId) filter.authorId = authorId;
      if (isPublished !== undefined) filter.isPublished = isPublished === 'true';
      if (isFree !== undefined) filter['metadata.isFree'] = isFree === 'true';

      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const skip = (pageNum - 1) * limitNum;

      const [visits, total] = await Promise.all([
        Visit.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
        Visit.countDocuments(filter),
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

  // Get visit by ID with all items populated
  static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const visit = await Visit.findById(id).populate('items.itemId');

      if (!visit) {
        throw new AppError(404, 'VISIT_NOT_FOUND', 'Visit not found');
      }

      res.json({
        success: true,
        data: visit,
      });
    } catch (error) {
      next(error);
    }
  }

  // Get user's own visits
  static async getMyVisits(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
      }

      const visits = await Visit.find({ authorId: req.user.id }).sort({ createdAt: -1 });

      res.json({
        success: true,
        data: visits,
      });
    } catch (error) {
      next(error);
    }
  }

  // Create visit
  static async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Validation failed', errors.array());
      }

      if (!req.user) {
        throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
      }

      const visitData = {
        ...req.body,
        authorId: req.user.id,
      };

      const visit = new Visit(visitData);
      await visit.save();

      res.status(201).json({
        success: true,
        data: visit,
        message: 'Visit created successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  // Update visit
  static async update(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      if (!req.user) {
        throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
      }

      const visit = await Visit.findById(id);
      if (!visit) {
        throw new AppError(404, 'VISIT_NOT_FOUND', 'Visit not found');
      }

      if (visit.authorId !== req.user.id && req.user.role !== 'admin') {
        throw new AppError(403, 'FORBIDDEN', 'You can only update your own visits');
      }

      Object.assign(visit, req.body);
      await visit.save();

      res.json({
        success: true,
        data: visit,
        message: 'Visit updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  // Publish visit
  static async publish(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      if (!req.user) {
        throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
      }

      const visit = await Visit.findById(id);
      if (!visit) {
        throw new AppError(404, 'VISIT_NOT_FOUND', 'Visit not found');
      }

      if (visit.authorId !== req.user.id && req.user.role !== 'admin') {
        throw new AppError(403, 'FORBIDDEN', 'You can only publish your own visits');
      }

      visit.isPublished = true;
      visit.publishedAt = new Date();
      await visit.save();

      res.json({
        success: true,
        data: visit,
        message: 'Visit published successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  // Delete visit
  static async delete(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      if (!req.user) {
        throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
      }

      const visit = await Visit.findById(id);
      if (!visit) {
        throw new AppError(404, 'VISIT_NOT_FOUND', 'Visit not found');
      }

      if (visit.authorId !== req.user.id && req.user.role !== 'admin') {
        throw new AppError(403, 'FORBIDDEN', 'You can only delete your own visits');
      }

      await visit.deleteOne();

      res.json({
        success: true,
        message: 'Visit deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}
