import { Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { WikidataService } from '../utils/wikidata.service.js';
import { AppConfigModel, MuseumModel } from '../models/index.js';
import { TranslationService } from '../utils/translation.service.js';
import { AIService } from '../utils/ai.service.js';
import { AppError } from '../middleware/index.js';
import mongoose from 'mongoose';
import { AuthRequest } from '../middleware/auth.middleware.js';

export class UtilsController {
  private static readonly HEX_COLOR_REGEX = /^#(?:[0-9a-fA-F]{3}){1,2}$/;
  private static readonly SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  private static readonly NAVIGATOR_DEFAULT_CONFIG_KEY = 'navigator-default-configs';

  private static validateNavigatorConfigsPayload(navigatorConfigs: unknown): void {
    if (!Array.isArray(navigatorConfigs)) {
      throw new AppError(400, 'VALIDATION_ERROR', 'navigatorConfigs must be an array');
    }

    if (navigatorConfigs.length === 0) {
      return;
    }

    const slugSet = new Set<string>();

    for (const [index, rawConfig] of navigatorConfigs.entries()) {
      const config = rawConfig as Record<string, unknown>;
      const prefix = `navigatorConfigs[${index}]`;

      const id = String(config.id || '').trim();
      const name = String(config.name || '').trim();
      const slug = String(config.slug || '').trim();

      const branding = (config.branding || {}) as Record<string, unknown>;
      const pwa = (config.pwa || {}) as Record<string, unknown>;

      const primaryColor = String(branding.primaryColor || '').trim();
      const secondaryColor = String(branding.secondaryColor || '').trim();
      const themeColor = String(pwa.themeColor || '').trim();
      const backgroundColor = String(pwa.backgroundColor || '').trim();

      const manifestName = String(pwa.manifestName || '').trim();
      const shortName = String(pwa.shortName || '').trim();
      const startUrl = String(pwa.startUrl || '').trim();
      const scope = String(pwa.scope || '').trim();
      const icon192 = String(pwa.icon192 || '').trim();
      const icon512 = String(pwa.icon512 || '').trim();

      if (!id) {
        throw new AppError(400, 'VALIDATION_ERROR', `${prefix}.id is required`);
      }
      if (!name) {
        throw new AppError(400, 'VALIDATION_ERROR', `${prefix}.name is required`);
      }
      if (!slug || !UtilsController.SLUG_REGEX.test(slug)) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          `${prefix}.slug is required and must be lowercase-kebab-case`,
        );
      }
      if (slugSet.has(slug)) {
        throw new AppError(400, 'VALIDATION_ERROR', `Duplicate navigator slug: ${slug}`);
      }
      slugSet.add(slug);

      if (!manifestName) {
        throw new AppError(400, 'VALIDATION_ERROR', `${prefix}.pwa.manifestName is required`);
      }
      if (!shortName) {
        throw new AppError(400, 'VALIDATION_ERROR', `${prefix}.pwa.shortName is required`);
      }
      if (!startUrl) {
        throw new AppError(400, 'VALIDATION_ERROR', `${prefix}.pwa.startUrl is required`);
      }
      if (!scope) {
        throw new AppError(400, 'VALIDATION_ERROR', `${prefix}.pwa.scope is required`);
      }

      if (!icon192 || !icon512) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          `${prefix}.pwa.icon192 and ${prefix}.pwa.icon512 are required`,
        );
      }

      const colors = [
        { key: 'branding.primaryColor', value: primaryColor },
        { key: 'branding.secondaryColor', value: secondaryColor, optional: true },
        { key: 'pwa.themeColor', value: themeColor },
        { key: 'pwa.backgroundColor', value: backgroundColor },
      ];

      for (const color of colors) {
        if (!color.value && color.optional) {
          continue;
        }

        if (!UtilsController.HEX_COLOR_REGEX.test(color.value)) {
          throw new AppError(
            400,
            'VALIDATION_ERROR',
            `${prefix}.${color.key} must be a valid HEX color`,
          );
        }
      }
    }
  }

  static async getNavigatorDefaultConfigs(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const config = await AppConfigModel.findOne({
        key: UtilsController.NAVIGATOR_DEFAULT_CONFIG_KEY,
      })
        .select('navigatorDefaultConfigs')
        .lean();

      res.json({
        success: true,
        data: config?.navigatorDefaultConfigs || [],
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateNavigatorDefaultConfigs(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const navigatorConfigs = req.body.navigatorConfigs;
      UtilsController.validateNavigatorConfigsPayload(navigatorConfigs);

      const config = await AppConfigModel.findOneAndUpdate(
        { key: UtilsController.NAVIGATOR_DEFAULT_CONFIG_KEY },
        {
          $set: {
            key: UtilsController.NAVIGATOR_DEFAULT_CONFIG_KEY,
            navigatorDefaultConfigs: navigatorConfigs,
          },
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        },
      ).lean();

      res.json({
        success: true,
        data: config?.navigatorDefaultConfigs || [],
        message: 'Navigator default configs updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }

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
      const { q, limit = '10', type = 'artwork', museumId } = req.query;

      if (!q) {
        throw new AppError(400, 'MISSING_QUERY', 'Search query is required');
      }

      const parsedLimit = parseInt(limit as string, 10);
      let results;
      let museumWikidataId: string | null = null;
      const museumIdValue = typeof museumId === 'string' ? museumId : undefined;

      if (museumIdValue) {
        if (/^Q\d+$/i.test(museumIdValue)) {
          museumWikidataId = museumIdValue;
        } else if (mongoose.Types.ObjectId.isValid(museumIdValue)) {
          const museumById = await MuseumModel.findById(museumIdValue).select('wikidataId').lean();
          if (museumById?.wikidataId) {
            museumWikidataId = museumById.wikidataId;
          } else {
            const museumByWikidata = await MuseumModel.findOne({ wikidataId: museumIdValue })
              .select('wikidataId')
              .lean();
            museumWikidataId = museumByWikidata?.wikidataId || null;
          }
        } else {
          const museumByWikidata = await MuseumModel.findOne({ wikidataId: museumIdValue })
            .select('wikidataId')
            .lean();
          museumWikidataId = museumByWikidata?.wikidataId || null;
        }
      }
      if (type === 'museum') {
        results = await WikidataService.searchMuseums(q as string, parsedLimit);
      } else if (type === 'author') {
        results = await WikidataService.searchAuthors(q as string, parsedLimit);
      } else if (type === 'movement') {
        results = await WikidataService.searchMovements(q as string, parsedLimit);
      } else if (museumWikidataId) {
        results = await WikidataService.searchArtworksInMuseum(
          q as string,
          museumWikidataId,
          parsedLimit,
        );

        if (!results || results.length === 0) {
          results = await WikidataService.search(q as string, parsedLimit);
        }
      } else {
        results = await WikidataService.search(q as string, parsedLimit);
      }

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

  static translateBatchValidation = [
    body('sourceLang').notEmpty().withMessage('Source language is required'),
    body('items').isArray({ min: 1 }).withMessage('Items array is required'),
    body('items.*.key').notEmpty().withMessage('Each item key is required'),
    body('items.*.text').notEmpty().withMessage('Each item text is required'),
    body('items.*.targetLang').notEmpty().withMessage('Each item targetLang is required'),
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

  static async translateBatch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Validation failed', errors.array());
      }

      const { sourceLang, items } = req.body as {
        sourceLang: string;
        items: Array<{ key: string; text: string; targetLang: string }>;
      };

      const translations = await TranslationService.batchTranslate(sourceLang, items);

      res.json({
        success: true,
        data: {
          sourceLang,
          translations,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async aiHealth(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await AIService.checkOpenAIHealth();

      res.status(result.ok ? 200 : 503).json({
        success: result.ok,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}
