import { Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { WikidataService } from '../utils/wikidata.service.js';
import { TranslationService } from '../utils/translation.service.js';
import { AppError } from '../middleware/index.js';

export class UtilsController {
  // Get Wikidata entity
  static async getWikidataEntity(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      if (!id || Array.isArray(id)) {
        throw new AppError(400, 'INVALID_ID', 'Invalid Wikidata ID');
      }

      const entity = await WikidataService.getEntity(id);
      if (!entity) {
        throw new AppError(404, 'ENTITY_NOT_FOUND', 'Wikidata entity not found');
      }

      res.json({
        success: true,
        data: entity,
      });
    } catch (error) {
      next(error);
    }
  }

  // Search Wikidata
  static async searchWikidata(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { q, limit = '10' } = req.query;

      if (!q) {
        throw new AppError(400, 'MISSING_QUERY', 'Search query is required');
      }

      const results = await WikidataService.search(q as string, parseInt(limit as string, 10));

      res.json({
        success: true,
        data: results,
      });
    } catch (error) {
      next(error);
    }
  }

  // Translate text
  static translateValidation = [
    body('text').notEmpty().withMessage('Text is required'),
    body('sourceLang').notEmpty().withMessage('Source language is required'),
    body('targetLang').notEmpty().withMessage('Target language is required'),
  ];

  static async translate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Validation failed', errors.array());
      }

      const { text, sourceLang, targetLang } = req.body;

      const translatedText = await TranslationService.translate(text, sourceLang, targetLang);

      res.json({
        success: true,
        data: {
          translatedText,
          sourceLang,
          targetLang,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}
