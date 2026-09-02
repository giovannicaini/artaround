import { Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { VisitModel, MuseumModel } from '../models/index.js';
import { AppError } from '../middleware/index.js';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { buildMuseumIdFilterValue } from '../utils/museum-id.util.js';
import {
  VisitStepType,
  LanguageLevel,
  DEFAULT_APP_LANGUAGE,
  SUPPORTED_APP_LANGUAGES,
  isSupportedAppLanguage,
  type AppLanguage,
  type VisitStep,
} from '@artaround/shared';

/**
 * Controller Visite
 *
 * Gestisce le visite - sequenze ordinate di opere con item per ogni tappa
 */

export class VisitController {
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

  private static ensureVisitLanguageCoverage(
    activeLanguages: AppLanguage[],
    sourceLanguage: AppLanguage,
    title: string,
    description: string,
    titleTranslations: Record<string, string>,
    descriptionTranslations: Record<string, string>,
  ): void {
    for (const lang of activeLanguages) {
      const hasTitle =
        lang === sourceLanguage ? Boolean(title.trim()) : Boolean(titleTranslations[lang]?.trim());
      const hasDescription =
        lang === sourceLanguage
          ? Boolean(description.trim())
          : Boolean(descriptionTranslations[lang]?.trim());

      if (!hasTitle || !hasDescription) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          `Missing required visit translations for language '${lang}'`,
        );
      }
    }
  }

  // Regole di validazione per la nuova struttura Visita
  static createValidation = [
    body('museumId').notEmpty().withMessage('Museum ID (Wikidata) is required'),
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('description').trim().notEmpty().withMessage('Description is required'),
    body('titleTranslations')
      .optional()
      .isObject()
      .withMessage('titleTranslations must be an object'),
    body('descriptionTranslations')
      .optional()
      .isObject()
      .withMessage('descriptionTranslations must be an object'),
    body('metadata.language')
      .optional()
      .isIn(SUPPORTED_APP_LANGUAGES)
      .withMessage(`metadata.language must be one of: ${SUPPORTED_APP_LANGUAGES.join(', ')}`),
    body('steps').isArray({ min: 1 }).withMessage('At least one step required'),
    body('steps.*.order').isNumeric().withMessage('Step order is required'),
    body('steps.*.type').isIn(Object.values(VisitStepType)).withMessage('Invalid step type'),
    body('steps.*.artworkId')
      .if(body('steps.*.type').equals('artwork'))
      .notEmpty()
      .withMessage('Artwork ID is required for artwork steps'),
    body('targetAudience').notEmpty().withMessage('Target audience is required'),
    body('targetAudience.languageLevels')
      .isArray({ min: 1 })
      .withMessage('At least one language level is required'),
    body('targetAudience.languageLevels.*')
      .isIn(Object.values(LanguageLevel))
      .withMessage(
        `Invalid language level. Allowed values: ${Object.values(LanguageLevel).join(', ')}`,
      ),
  ];

  // Ottieni tutte le visite con filtri
  static async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        museumId,
        authorId,
        isPublished,
        isFree,
        languageLevel,
        page = '1',
        limit = '20',
      } = req.query;

      const filter: Record<string, unknown> = {};
      const museumIdFilter = await buildMuseumIdFilterValue(museumId as string | undefined);
      if (museumIdFilter !== undefined) filter.museumId = museumIdFilter;
      if (authorId) filter.authorId = authorId;
      if (isPublished !== undefined) filter.isPublished = isPublished === 'true';
      if (isFree !== undefined) filter['metadata.isFree'] = isFree === 'true';
      if (languageLevel) filter['targetAudience.languageLevels'] = languageLevel;

      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const skip = (pageNum - 1) * limitNum;

      const [visits, total] = await Promise.all([
        VisitModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
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

  // Ottieni visita per ID
  static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const visit = await VisitModel.findById(id).lean();

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

  // Ottieni le visite per museo (usando l'ID Wikidata)
  static async getByMuseum(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { museumId } = req.params;
      const { isPublished } = req.query;

      const museumIdFilter = await buildMuseumIdFilterValue(museumId);
      const filter: Record<string, unknown> = { museumId: museumIdFilter ?? museumId };
      if (isPublished !== undefined) filter.isPublished = isPublished === 'true';

      const visits = await VisitModel.find(filter).sort({ createdAt: -1 }).lean();

      res.json({
        success: true,
        data: visits,
      });
    } catch (error) {
      next(error);
    }
  }

  // Ottieni le visite proprie dell'utente
  static async getMyVisits(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
      }

      const visits = await VisitModel.find({ authorId: req.user.id })
        .sort({ createdAt: -1 })
        .lean();

      res.json({
        success: true,
        data: visits,
      });
    } catch (error) {
      next(error);
    }
  }

  // Crea visita
  static async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Validation failed', errors.array());
      }

      if (!req.user) {
        throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
      }

      // Ordina le tappe per order
      const steps = (req.body.steps || []).sort(
        (a: { order: number }, b: { order: number }) => a.order - b.order,
      );

      const sourceLanguageRaw = String(req.body?.metadata?.language || DEFAULT_APP_LANGUAGE)
        .trim()
        .toLowerCase();
      if (!isSupportedAppLanguage(sourceLanguageRaw)) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          `metadata.language must be one of: ${SUPPORTED_APP_LANGUAGES.join(', ')}`,
        );
      }

      const activeLanguages = await VisitController.getMuseumActiveLanguages(
        String(req.body.museumId),
      );
      const titleTranslations = (req.body.titleTranslations || {}) as Record<string, string>;
      const descriptionTranslations = (req.body.descriptionTranslations || {}) as Record<
        string,
        string
      >;

      VisitController.ensureVisitLanguageCoverage(
        activeLanguages,
        sourceLanguageRaw,
        String(req.body.title || ''),
        String(req.body.description || ''),
        titleTranslations,
        descriptionTranslations,
      );

      const mergedMetadata = {
        ...(req.body.metadata || {}),
        language: sourceLanguageRaw,
        supportedLanguages: activeLanguages,
      };

      const visitData = {
        ...req.body,
        steps,
        authorId: req.user.id,
        isPublished: false,
        metadata: mergedMetadata,
        titleTranslations,
        descriptionTranslations,
      };

      const visit = new VisitModel(visitData);
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

  // Aggiorna visita
  static async update(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      if (!req.user) {
        throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
      }

      const visit = await VisitModel.findById(id);
      if (!visit) {
        throw new AppError(404, 'VISIT_NOT_FOUND', 'Visit not found');
      }

      // Stesso criterio già applicato a artwork/item: proprietario, admin o curatore
      // (gestisce tutto il contenuto del museo assegnato, non solo il proprio).
      const canManage =
        visit.authorId === req.user.id || req.user.role === 'admin' || req.user.role === 'curator';
      if (!canManage) {
        throw new AppError(403, 'FORBIDDEN', 'You can only update your own visits');
      }

      // Ordina le tappe per order se fornito
      if (req.body.steps) {
        req.body.steps = req.body.steps.sort(
          (a: { order: number }, b: { order: number }) => a.order - b.order,
        );
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

  // Aggiungi tappa alla visita
  static async addStep(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      if (!req.user) {
        throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
      }

      const visit = await VisitModel.findById(id);
      if (!visit) {
        throw new AppError(404, 'VISIT_NOT_FOUND', 'Visit not found');
      }

      // Proprietario, admin o curatore (stesso criterio di update/delete).
      const canManageStep =
        visit.authorId === req.user.id || req.user.role === 'admin' || req.user.role === 'curator';
      if (!canManageStep) {
        throw new AppError(403, 'FORBIDDEN', 'You can only modify your own visits');
      }

      const step = req.body;

      // Assegna automaticamente l'order se non fornito
      if (step.order === undefined) {
        const maxOrder = Math.max(...visit.steps.map((s) => s.order), 0);
        step.order = maxOrder + 1;
      }

      visit.steps.push(step);
      visit.steps.sort((a, b) => a.order - b.order);
      await visit.save();

      res.json({
        success: true,
        data: visit,
        message: 'Step added successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  // Aggiorna tappa nella visita
  static async updateStep(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id, stepOrder } = req.params;

      if (!req.user) {
        throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
      }

      const visit = await VisitModel.findById(id);
      if (!visit) {
        throw new AppError(404, 'VISIT_NOT_FOUND', 'Visit not found');
      }

      // Proprietario, admin o curatore (stesso criterio di update/delete).
      const canManageStep =
        visit.authorId === req.user.id || req.user.role === 'admin' || req.user.role === 'curator';
      if (!canManageStep) {
        throw new AppError(403, 'FORBIDDEN', 'You can only modify your own visits');
      }

      const stepIndex = visit.steps.findIndex((s) => s.order === Number(stepOrder));
      if (stepIndex === -1) {
        throw new AppError(404, 'STEP_NOT_FOUND', 'Step not found');
      }

      // visit.steps[stepIndex] è un subdocument Mongoose: spread diretto non ne copia
      // in modo affidabile i campi (stesso problema corretto in museum.controller.ts
      // updateFloor). JSON round-trip forza un plain object prima del merge, per
      // evitare che un PUT parziale perda id/order/type/isOptional e fallisca la
      // validazione Mongoose al save.
      const existingStep = JSON.parse(JSON.stringify(visit.steps[stepIndex])) as VisitStep;
      visit.steps[stepIndex] = { ...existingStep, ...req.body };
      visit.steps.sort((a, b) => a.order - b.order);
      await visit.save();

      res.json({
        success: true,
        data: visit,
        message: 'Step updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  // Elimina tappa dalla visita
  static async deleteStep(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id, stepOrder } = req.params;

      if (!req.user) {
        throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
      }

      const visit = await VisitModel.findById(id);
      if (!visit) {
        throw new AppError(404, 'VISIT_NOT_FOUND', 'Visit not found');
      }

      // Proprietario, admin o curatore (stesso criterio di update/delete).
      const canManageStep =
        visit.authorId === req.user.id || req.user.role === 'admin' || req.user.role === 'curator';
      if (!canManageStep) {
        throw new AppError(403, 'FORBIDDEN', 'You can only modify your own visits');
      }

      visit.steps = visit.steps.filter((s) => s.order !== Number(stepOrder));

      // Riordina le tappe rimanenti
      visit.steps.forEach((step, index) => {
        step.order = index + 1;
      });

      await visit.save();

      res.json({
        success: true,
        data: visit,
        message: 'Step deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  // Riordina le tappe
  static async reorderSteps(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { stepOrders } = req.body; // Array of { oldOrder, newOrder }

      if (!req.user) {
        throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
      }

      const visit = await VisitModel.findById(id);
      if (!visit) {
        throw new AppError(404, 'VISIT_NOT_FOUND', 'Visit not found');
      }

      // Proprietario, admin o curatore (stesso criterio di update/delete).
      const canManageStep =
        visit.authorId === req.user.id || req.user.role === 'admin' || req.user.role === 'curator';
      if (!canManageStep) {
        throw new AppError(403, 'FORBIDDEN', 'You can only modify your own visits');
      }

      // Applica il nuovo ordine
      for (const { oldOrder, newOrder } of stepOrders) {
        const step = visit.steps.find((s) => s.order === oldOrder);
        if (step) {
          step.order = newOrder;
        }
      }

      visit.steps.sort((a, b) => a.order - b.order);
      await visit.save();

      res.json({
        success: true,
        data: visit,
        message: 'Steps reordered successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  // Pubblica visita
  static async publish(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      if (!req.user) {
        throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
      }

      const visit = await VisitModel.findById(id);
      if (!visit) {
        throw new AppError(404, 'VISIT_NOT_FOUND', 'Visit not found');
      }

      // Proprietario, admin o curatore (stesso criterio di update/delete).
      const canManageStep =
        visit.authorId === req.user.id || req.user.role === 'admin' || req.user.role === 'curator';
      if (!canManageStep) {
        throw new AppError(403, 'FORBIDDEN', 'You can only publish your own visits');
      }

      // Valida che la visita abbia il contenuto richiesto
      if (!visit.steps || visit.steps.length === 0) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Visit must have at least one step');
      }

      const artworkSteps = visit.steps.filter((s) => s.type === 'artwork');
      if (artworkSteps.length === 0) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Visit must have at least one artwork step');
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

  // Rimuovi pubblicazione visita
  static async unpublish(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      if (!req.user) {
        throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
      }

      const visit = await VisitModel.findById(id);
      if (!visit) {
        throw new AppError(404, 'VISIT_NOT_FOUND', 'Visit not found');
      }

      // Proprietario, admin o curatore (stesso criterio di update/delete).
      const canManageStep =
        visit.authorId === req.user.id || req.user.role === 'admin' || req.user.role === 'curator';
      if (!canManageStep) {
        throw new AppError(403, 'FORBIDDEN', 'You can only unpublish your own visits');
      }

      visit.isPublished = false;
      await visit.save();

      res.json({
        success: true,
        data: visit,
        message: 'Visit unpublished successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  // Elimina visita
  static async delete(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      if (!req.user) {
        throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
      }

      const visit = await VisitModel.findById(id);
      if (!visit) {
        throw new AppError(404, 'VISIT_NOT_FOUND', 'Visit not found');
      }

      // Stesso criterio dell'update: proprietario, admin o curatore.
      const canManage =
        visit.authorId === req.user.id || req.user.role === 'admin' || req.user.role === 'curator';
      if (!canManage) {
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
