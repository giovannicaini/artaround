import { Request, Response } from 'express';
import { asyncHandler } from '../utils/async-handler.util.js';
import { body, validationResult } from 'express-validator';
import { ItemModel, MuseumModel } from '../models/index.js';
import { AppError } from '../middleware/index.js';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { buildMuseumIdFilterValue } from '../utils/museum-id.util.js';
import { parsePagination, buildPaginationMeta } from '../utils/pagination.util.js';
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
 * Controller Item
 *
 * Gestisce i contenuti che fanno riferimento a opere, autori, movimenti, ecc.
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

  // Regole di validazione per la nuova struttura Item
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
    // duration/languageLevel sono campi diretti dell'Item (un item = una combinazione
    // durata×livello). "contentMatrix" era il nome di un vecchio modello ad array
    // annidato, mai più esistito nello schema: questa validazione lo richiedeva
    // comunque, quindi ogni creazione di item falliva sempre con 400.
    body('duration').isIn(Object.values(ContentDuration)).withMessage('Invalid duration'),
    body('languageLevel').isIn(Object.values(LanguageLevel)).withMessage('Invalid language level'),
    body('license').notEmpty().withMessage('License is required'),
  ];

  // Ottieni tutti gli item con filtri e paginazione
  static getAll = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const {
      museumId,
      referenceType,
      referenceId,
      authorId,
      duration,
      languageLevel,
      isFree,
      search,
    } = req.query;

    const filter: Record<string, unknown> = {};
    if (referenceType) filter.referenceType = referenceType;
    if (referenceId) filter.referenceId = referenceId;
    if (authorId) filter.authorId = authorId;
    // NB: duration/languageLevel sono campi diretti dell'Item, non annidati sotto
    // "contentMatrix" (quel path non esiste più nello schema: prima di questo fix
    // questi due filtri non trovavano mai nulla).
    if (duration) filter.duration = duration;
    if (languageLevel) filter.languageLevel = languageLevel;
    if (isFree !== undefined) filter.isFree = isFree === 'true';
    if (search) {
      const q = String(search).trim();
      if (q) {
        filter.$or = [
          { title: { $regex: q, $options: 'i' } },
          { text: { $regex: q, $options: 'i' } },
        ];
      }
    }

    const museumIdFilter = await buildMuseumIdFilterValue(museumId as string | undefined);
    if (museumIdFilter !== undefined) {
      filter.museumId = museumIdFilter;
    }

    const { page, limit, skip } = parsePagination(req.query, 50);

    const [items, total] = await Promise.all([
      ItemModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      ItemModel.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: items,
      pagination: buildPaginationMeta(total, page, limit),
    });
  });

  // Ottieni gli item per un'opera specifica (per ID Wikidata)
  static getByArtwork = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { artworkId } = req.params;
    const { duration, languageLevel } = req.query;

    const filter: Record<string, unknown> = {
      referenceType: ItemReferenceType.ARTWORK,
      referenceId: artworkId,
    };

    if (duration) filter.duration = duration;
    if (languageLevel) filter.languageLevel = languageLevel;

    const items = await ItemModel.find(filter).sort({ createdAt: -1 }).lean();

    res.json({
      success: true,
      data: items,
    });
  });

  // Ottieni gli item per un autore specifico (per ID Wikidata)
  static getByAuthor = asyncHandler(async (req: Request, res: Response): Promise<void> => {
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
  });

  // Ottieni gli item per riferimento (generico - funziona per ogni tipo)
  static getByReference = asyncHandler(async (req: Request, res: Response): Promise<void> => {
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
  });

  // Cerca item
  static search = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { q, museumId, referenceType, tags } = req.query;

    const filter: Record<string, unknown> = {};
    const andFilters: Record<string, unknown>[] = [];

    if (q) {
      andFilters.push({
        $or: [{ title: { $regex: q, $options: 'i' } }, { text: { $regex: q, $options: 'i' } }],
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

    const { page, limit, skip } = parsePagination(req.query, 50);

    const [items, total] = await Promise.all([
      ItemModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      ItemModel.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: items,
      pagination: buildPaginationMeta(total, page, limit),
    });
  });

  // Ottieni item per ID
  static getById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    const item = await ItemModel.findById(id).lean();
    if (!item) {
      throw new AppError(404, 'ITEM_NOT_FOUND', 'Item not found');
    }

    res.json({
      success: true,
      data: item,
    });
  });

  // Crea item (solo autore)
  static create = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
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

    const sourceLanguageRaw = String(req.body.sourceLanguage || DEFAULT_APP_LANGUAGE).toLowerCase();
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
  });

  // Aggiorna item (solo proprietario)
  static update = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const { id } = req.params;

    if (!req.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
    }

    const item = await ItemModel.findById(id);
    if (!item) {
      throw new AppError(404, 'ITEM_NOT_FOUND', 'Item not found');
    }

    // Autore proprietario, admin o curatore (gestisce tutto il contenuto del suo museo,
    // stesso criterio già usato per gli artwork) possono modificare l'item.
    const canManage =
      item.authorId === req.user.id || req.user.role === 'admin' || req.user.role === 'curator';
    if (!canManage) {
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
  });

  // Elimina item (solo proprietario)
  static delete = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const { id } = req.params;

    if (!req.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
    }

    const item = await ItemModel.findById(id);
    if (!item) {
      throw new AppError(404, 'ITEM_NOT_FOUND', 'Item not found');
    }

    // Stesso criterio dell'update: autore proprietario, admin o curatore.
    const canManage =
      item.authorId === req.user.id || req.user.role === 'admin' || req.user.role === 'curator';
    if (!canManage) {
      throw new AppError(403, 'FORBIDDEN', 'You can only delete your own items');
    }

    await item.deleteOne();

    res.json({
      success: true,
      message: 'Item deleted successfully',
    });
  });

  // Ottieni gli item propri dell'utente
  static getMyItems = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
    }

    const items = await ItemModel.find({ authorId: req.user.id }).sort({ createdAt: -1 }).lean();

    res.json({
      success: true,
      data: items,
    });
  });
}
