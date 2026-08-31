import { Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { ItemModel, MuseumModel } from '../models/index.js';
import { AppError } from '../middleware/index.js';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { buildMuseumIdFilterValue } from '../utils/museum-id.util.js';
import {
  ItemReferenceType,
  ContentDuration,
  LanguageLevel,
  DEFAULT_APP_LANGUAGE,
  SUPPORTED_APP_LANGUAGES,
  isSupportedAppLanguage,
  type AppLanguage,
} from '@artaround/shared';

/**
 * Item Controller
 *
 * Manages content items that reference artworks, authors, movements, etc.
 */

export class ItemController {
  private static async getMuseumActiveLanguages(museumId: string): Promise<AppLanguage[]> {
    const museum = await MuseumModel.findById(museumId).select('activeLanguages').lean();
    if (!museum) {
      throw new AppError(404, 'MUSEUM_NOT_FOUND', 'Museum not found');
    }

    const activeLanguagesRaw = Array.isArray(museum.activeLanguages)
      ? museum.activeLanguages
      : [DEFAULT_APP_LANGUAGE];
    const activeLanguages = activeLanguagesRaw
      .map((lang) =>
        String(lang || '')
          .trim()
          .toLowerCase(),
      )
      .filter((lang): lang is AppLanguage => isSupportedAppLanguage(lang));

    return activeLanguages.length > 0 ? activeLanguages : [DEFAULT_APP_LANGUAGE];
  }

  private static ensureItemLanguageCoverage(
    activeLanguages: AppLanguage[],
    sourceLanguage: AppLanguage,
    title: string,
    text: string,
    translatedTitles: Record<string, string>,
    translatedTexts: Record<string, string>,
  ): void {
    for (const lang of activeLanguages) {
      const hasTitle =
        lang === sourceLanguage ? Boolean(title.trim()) : Boolean(translatedTitles[lang]?.trim());
      const hasText =
        lang === sourceLanguage ? Boolean(text.trim()) : Boolean(translatedTexts[lang]?.trim());

      if (!hasTitle || !hasText) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          `Missing required translations for language '${lang}'`,
        );
      }
    }
  }

  // Validation rules for the new Item structure
  static createValidation = [
    body('museumId').isString().notEmpty().withMessage('Museum ID is required'),
    body('referenceType')
      .isIn(Object.values(ItemReferenceType))
      .withMessage('Invalid reference type'),
    body('referenceId').optional().isString().withMessage('Reference ID must be a string'),
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('text').trim().notEmpty().withMessage('Text is required'),
    body('sourceLanguage')
      .optional()
      .isIn(SUPPORTED_APP_LANGUAGES)
      .withMessage(`sourceLanguage must be one of: ${SUPPORTED_APP_LANGUAGES.join(', ')}`),
    body('translatedTitles')
      .optional()
      .isObject()
      .withMessage('translatedTitles must be an object'),
    body('translatedTexts').optional().isObject().withMessage('translatedTexts must be an object'),
    body('contentMatrix')
      .isArray({ min: 1 })
      .withMessage('At least one content matrix entry required'),
    body('contentMatrix.*.duration')
      .isIn(Object.values(ContentDuration))
      .withMessage('Invalid duration'),
    body('contentMatrix.*.languageLevel')
      .isIn(Object.values(LanguageLevel))
      .withMessage('Invalid language level'),
    body('license').notEmpty().withMessage('License is required'),
  ];

  // Get all items with filters and pagination
  static async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        museumId,
        referenceType,
        referenceId,
        authorId,
        duration,
        languageLevel,
        isFree,
        page = '1',
        limit = '50',
      } = req.query;

      const filter: Record<string, unknown> = {};
      if (referenceType) filter.referenceType = referenceType;
      if (referenceId) filter.referenceId = referenceId;
      if (authorId) filter.authorId = authorId;
      if (duration) filter['contentMatrix.duration'] = duration;
      if (languageLevel) filter['contentMatrix.languageLevel'] = languageLevel;
      if (isFree !== undefined) filter.isFree = isFree === 'true';

      const museumIdFilter = await buildMuseumIdFilterValue(museumId as string | undefined);
      if (museumIdFilter !== undefined) {
        filter.museumId = museumIdFilter;
      }

      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const skip = (pageNum - 1) * limitNum;

      const [items, total] = await Promise.all([
        ItemModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
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

  // Get items for a specific artwork (by Wikidata ID)
  static async getByArtwork(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { artworkId } = req.params;
      const { duration, languageLevel } = req.query;

      const filter: Record<string, unknown> = {
        referenceType: ItemReferenceType.ARTWORK,
        referenceId: artworkId,
      };

      if (duration) filter['contentMatrix.duration'] = duration;
      if (languageLevel) filter['contentMatrix.languageLevel'] = languageLevel;

      const items = await ItemModel.find(filter).sort({ createdAt: -1 }).lean();

      res.json({
        success: true,
        data: items,
      });
    } catch (error) {
      next(error);
    }
  }

  // Get items for a specific author (by Wikidata ID)
  static async getByAuthor(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { authorWikidataId } = req.params;

      const items = await ItemModel.find({
        referenceType: ItemReferenceType.AUTHOR,
        referenceId: authorWikidataId,
      })
        .sort({ createdAt: -1 })
        .lean();

      res.json({
        success: true,
        data: items,
      });
    } catch (error) {
      next(error);
    }
  }

  // Get items by reference (generic - works for any reference type)
  static async getByReference(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { referenceType, referenceId } = req.params;

      const items = await ItemModel.find({
        referenceType,
        referenceId,
      })
        .sort({ createdAt: -1 })
        .lean();

      res.json({
        success: true,
        data: items,
      });
    } catch (error) {
      next(error);
    }
  }

  // Search items
  static async search(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { q, museumId, referenceType, tags, page = '1', limit = '50' } = req.query;

      const filter: Record<string, unknown> = {};
      const andFilters: Record<string, unknown>[] = [];

      if (q) {
        andFilters.push({
          $or: [
            { title: { $regex: q, $options: 'i' } },
            { 'contentMatrix.content.text': { $regex: q, $options: 'i' } },
          ],
        });
      }

      if (referenceType) filter.referenceType = referenceType;
      if (tags) filter.tags = { $in: (tags as string).split(',') };

      const museumIdFilter = await buildMuseumIdFilterValue(museumId as string | undefined);
      if (museumIdFilter !== undefined) {
        filter.museumId = museumIdFilter;
      }

      if (andFilters.length > 0) {
        filter.$and = andFilters;
      }

      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const skip = (pageNum - 1) * limitNum;

      const [items, total] = await Promise.all([
        ItemModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
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

  // Get item by ID
  static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const item = await ItemModel.findById(id).lean();
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
        isFree: req.body.price === 0 || req.body.price === undefined,
      };

      const sourceLanguageRaw = String(
        req.body.sourceLanguage || DEFAULT_APP_LANGUAGE,
      ).toLowerCase();
      if (!isSupportedAppLanguage(sourceLanguageRaw)) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          `sourceLanguage must be one of: ${SUPPORTED_APP_LANGUAGES.join(', ')}`,
        );
      }

      const activeLanguages = await ItemController.getMuseumActiveLanguages(
        String(req.body.museumId),
      );

      const translatedTitles = (req.body.translatedTitles || {}) as Record<string, string>;
      const translatedTexts = (req.body.translatedTexts || {}) as Record<string, string>;

      ItemController.ensureItemLanguageCoverage(
        activeLanguages,
        sourceLanguageRaw,
        String(req.body.title || ''),
        String(req.body.text || ''),
        translatedTitles,
        translatedTexts,
      );

      itemData.sourceLanguage = sourceLanguageRaw;
      itemData.translatedTitles = translatedTitles;
      itemData.translatedTexts = translatedTexts;

      const item = new ItemModel(itemData);
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

      const item = await ItemModel.findById(id);
      if (!item) {
        throw new AppError(404, 'ITEM_NOT_FOUND', 'Item not found');
      }

      // Check ownership
      if (item.authorId !== req.user.id && req.user.role !== 'admin') {
        throw new AppError(403, 'FORBIDDEN', 'You can only update your own items');
      }

      const updateData = { ...req.body };
      delete updateData.museumId;
      Object.assign(item, updateData);
      if (req.body.price !== undefined) {
        item.isFree = req.body.price === 0;
      }
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

      const item = await ItemModel.findById(id);
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

  // Get user's own items
  static async getMyItems(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
      }

      const items = await ItemModel.find({ authorId: req.user.id }).sort({ createdAt: -1 }).lean();

      res.json({
        success: true,
        data: items,
      });
    } catch (error) {
      next(error);
    }
  }
}
