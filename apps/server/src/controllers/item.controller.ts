import { Request, Response } from 'express';
import { asyncHandler } from '../utils/async-handler.util.js';
import { body, validationResult } from 'express-validator';
import { ItemModel, MuseumModel } from '../models/index.js';
import { AppError } from '../middleware/index.js';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { buildMuseumIdFilterValue } from '../utils/museum-id.util.js';
import { parsePagination, buildPaginationMeta } from '../utils/pagination.util.js';
import { assertCan } from '../utils/policy.util.js';
import { mapToRecord } from '../utils/mongoose-map.util.js';
import { deleteGeneratedAudioFile } from '../utils/audio-generation.service.js';
import { buildUsableItemsFilter } from '../utils/item-access.util.js';
import {
  ItemReferenceType,
  ContentDuration,
  LanguageLevel,
  DEFAULT_APP_LANGUAGE,
  SUPPORTED_APP_LANGUAGES,
  isSupportedAppLanguage,
  type AppLanguage,
  type GeneratedAudio,
} from '@artaround/shared';

/**
 * Controller Item
 *
 * Gestisce i contenuti che fanno riferimento a opere, autori, movimenti, ecc.
 */

export class ItemController {
  // Lingue attive del museo, usate per capire quali traduzioni servono a un item
  private static async getMuseumActiveLanguages(museumId: string): Promise<AppLanguage[]> {
    const museum = await MuseumModel.findById(museumId).select('activeLanguages').lean();
    if (!museum) {
      throw new AppError(404, 'MUSEUM_NOT_FOUND', 'Museo non trovato');
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

  // Blocca il salvataggio se titolo/testo non sono tradotti in tutte le lingue attive
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
        throw new AppError(400, 'VALIDATION_ERROR', `Traduzioni mancanti per la lingua '${lang}'`);
      }
    }
  }

  // Regole di validazione per la creazione (usate da POST /api/items)
  static createValidation = [
    body('museumId').isString().notEmpty().withMessage("L'ID del museo è obbligatorio"),
    body('referenceType')
      .isIn(Object.values(ItemReferenceType))
      .withMessage('Tipo di riferimento non valido'),
    body('referenceId')
      .optional()
      .isString()
      .withMessage("L'ID di riferimento deve essere una stringa"),
    body('title').trim().notEmpty().withMessage('Il titolo è obbligatorio'),
    body('text').trim().notEmpty().withMessage('Il testo è obbligatorio'),
    body('sourceLanguage')
      .optional()
      .isIn(SUPPORTED_APP_LANGUAGES)
      .withMessage(`sourceLanguage deve essere una tra: ${SUPPORTED_APP_LANGUAGES.join(', ')}`),
    body('translatedTitles')
      .optional()
      .isObject()
      .withMessage('translatedTitles deve essere un oggetto'),
    body('translatedTexts')
      .optional()
      .isObject()
      .withMessage('translatedTexts deve essere un oggetto'),
    body('duration').isIn(Object.values(ContentDuration)).withMessage('Durata non valida'),
    body('languageLevel')
      .isIn(Object.values(LanguageLevel))
      .withMessage('Livello linguistico non valido'),
    body('license').notEmpty().withMessage('La licenza è obbligatoria'),
  ];

  // Regole di validazione per l'aggiornamento (usate da PUT /api/items/:id):
  static updateValidation = [
    body('title').optional().trim().notEmpty().withMessage('Il titolo è obbligatorio'),
    body('text').optional().trim().notEmpty().withMessage('Il testo è obbligatorio'),
    body('translatedTitles')
      .optional()
      .isObject()
      .withMessage('translatedTitles deve essere un oggetto'),
    body('translatedTexts')
      .optional()
      .isObject()
      .withMessage('translatedTexts deve essere un oggetto'),
    body('duration')
      .optional()
      .isIn(Object.values(ContentDuration))
      .withMessage('Durata non valida'),
    body('languageLevel')
      .optional()
      .isIn(Object.values(LanguageLevel))
      .withMessage('Livello linguistico non valido'),
    body('license').optional().notEmpty().withMessage('La licenza è obbligatoria'),
  ];

  // GET /api/items — lista item con filtri (museo, riferimento, durata, livello...) e paginazione
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

  // GET /api/items/artwork/:artworkId — item collegati a un'opera (per ID Wikidata)
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

  // GET /api/items/reference/:referenceType/:referenceId — item per riferimento generico (ogni tipo)
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

  // GET /api/items/artwork/:artworkId/usable — come getByArtwork, ma ristretto
  // a ciò che l'utente autenticato può abbinare a una tappa che sta
  // costruendo: propri contenuti, gratuiti, o già acquistati (vedi
  // buildUsableItemsFilter) — a differenza del catalogo pubblico, dove
  // chiunque vede tutto per poterlo valutare/acquistare.
  static getUsableItemsForArtwork = asyncHandler(
    async (req: AuthRequest, res: Response): Promise<void> => {
      const { artworkId } = req.params;
      const { duration, languageLevel } = req.query;

      if (!req.user) {
        throw new AppError(401, 'UNAUTHORIZED', 'Autenticazione richiesta');
      }

      const filter: Record<string, unknown> = {
        referenceType: ItemReferenceType.ARTWORK,
        referenceId: artworkId,
        ...(await buildUsableItemsFilter(req.user.id)),
      };
      if (duration) filter.duration = duration;
      if (languageLevel) filter.languageLevel = languageLevel;

      const items = await ItemModel.find(filter).sort({ createdAt: -1 }).lean();

      res.json({ success: true, data: items });
    },
  );

  // GET /api/items/reference-type/:referenceType/usable?museumId=X — item di
  // un museo per tipo di riferimento (AUTHOR/MOVEMENT/PERIOD/MUSEUM),
  // ristretti come sopra — usata dalle tappe "Contenuto" nell'editor visite.
  static getUsableItemsByReferenceType = asyncHandler(
    async (req: AuthRequest, res: Response): Promise<void> => {
      const { referenceType } = req.params;
      const { museumId } = req.query;

      if (!req.user) {
        throw new AppError(401, 'UNAUTHORIZED', 'Autenticazione richiesta');
      }
      if (!museumId) {
        throw new AppError(400, 'VALIDATION_ERROR', 'museumId è obbligatorio');
      }

      const museumIdFilter = await buildMuseumIdFilterValue(museumId as string);
      const filter: Record<string, unknown> = {
        referenceType,
        ...(museumIdFilter !== undefined ? { museumId: museumIdFilter } : {}),
        ...(await buildUsableItemsFilter(req.user.id)),
      };

      const items = await ItemModel.find(filter).sort({ createdAt: -1 }).lean();

      res.json({ success: true, data: items });
    },
  );

  // GET /api/items/search — ricerca testuale su titolo/testo, con filtri e paginazione
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

  // GET /api/items/:id — dettaglio di un singolo item
  static getById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    const item = await ItemModel.findById(id).lean();
    if (!item) {
      throw new AppError(404, 'ITEM_NOT_FOUND', 'Item non trovato');
    }

    res.json({
      success: true,
      data: item,
    });
  });

  // POST /api/items — crea l'item verificando copertura traduzioni (solo autore autenticato)
  static create = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Validazione fallita', errors.array());
    }

    if (!req.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Autenticazione richiesta');
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
        `sourceLanguage deve essere una tra: ${SUPPORTED_APP_LANGUAGES.join(', ')}`,
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
      message: 'Item creato con successo',
    });
  });

  // PUT /api/items/:id — aggiorna l'item (owner, admin o curatore)
  static update = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Validazione fallita', errors.array());
    }

    const { id } = req.params;

    if (!req.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Autenticazione richiesta');
    }

    const item = await ItemModel.findById(id);
    if (!item) {
      throw new AppError(404, 'ITEM_NOT_FOUND', 'Item non trovato');
    }

    // Proprietario (ovunque), o curatore del museo a cui appartiene l'item.
    await assertCan(
      req.user,
      'manage',
      'item',
      { museumId: item.museumId, authorId: item.authorId },
      'Puoi aggiornare solo i tuoi item o quelli dei musei che curi',
    );

    // Per invalidare l'audio generato del testo/traduzione che sta per
    // cambiare: serve il valore prima che Object.assign lo sovrascriva.
    const oldText = item.text;
    const oldTranslatedTexts = mapToRecord(item.translatedTexts);

    const updateData = { ...req.body };
    delete updateData.museumId;
    Object.assign(item, updateData);
    if (req.body.price !== undefined) {
      item.isFree = req.body.price === 0;
    }

    // Un audio che legge un testo diverso da quello scritto ora è
    // semplicemente sbagliato: va tolto (file su disco incluso), non
    // rigenerato subito (costerebbe una chiamata OpenAI ad ogni salvataggio)
    // — tornerà a leggere con la sintesi del browser finché non si rilancia
    // "Genera audio mancante" per il museo.
    if (item.audio) {
      const audio = mapToRecord<GeneratedAudio>(item.audio);
      let audioChanged = false;

      if (req.body.text !== undefined && req.body.text !== oldText && audio[item.sourceLanguage]) {
        await deleteGeneratedAudioFile(audio[item.sourceLanguage]);
        delete audio[item.sourceLanguage];
        audioChanged = true;
      }

      if (req.body.translatedTexts !== undefined) {
        const newTranslatedTexts = mapToRecord(item.translatedTexts);
        for (const lang of Object.keys(audio)) {
          if (lang === item.sourceLanguage) continue;
          if (newTranslatedTexts[lang] !== oldTranslatedTexts[lang]) {
            await deleteGeneratedAudioFile(audio[lang]);
            delete audio[lang];
            audioChanged = true;
          }
        }
      }

      if (audioChanged) item.set('audio', audio);
    }

    await item.save();

    res.json({
      success: true,
      data: item,
      message: 'Item aggiornato con successo',
    });
  });

  // DELETE /api/items/:id — elimina l'item (owner, admin o curatore)
  static delete = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const { id } = req.params;

    if (!req.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Autenticazione richiesta');
    }

    const item = await ItemModel.findById(id);
    if (!item) {
      throw new AppError(404, 'ITEM_NOT_FOUND', 'Item non trovato');
    }

    // Stesso criterio dell'update.
    await assertCan(
      req.user,
      'manage',
      'item',
      { museumId: item.museumId, authorId: item.authorId },
      'Puoi eliminare solo i tuoi item o quelli dei musei che curi',
    );

    await item.deleteOne();

    res.json({
      success: true,
      message: 'Item eliminato con successo',
    });
  });

  // GET /api/items/my-items — item creati dall'utente autenticato
  static getMyItems = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Autenticazione richiesta');
    }

    const items = await ItemModel.find({ authorId: req.user.id }).sort({ createdAt: -1 }).lean();

    res.json({
      success: true,
      data: items,
    });
  });
}
