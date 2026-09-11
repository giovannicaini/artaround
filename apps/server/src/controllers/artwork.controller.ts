import { Request, Response } from 'express';
import { asyncHandler } from '../utils/async-handler.util.js';
import { body, validationResult } from 'express-validator';
import { parsePagination, buildPaginationMeta } from '../utils/pagination.util.js';
import { ArtworkModel } from '../models/index.js';
import { ArtworkType, type ArtworkFilters as SharedArtworkFilters } from '@artaround/shared';
import { resolveMuseumIdCandidates } from '../utils/museum-id.util.js';
import { AppError } from '../middleware/index.js';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { assertCan } from '../utils/policy.util.js';

/**
 * Controller Opere
 *
 * Gestisce le operazioni CRUD per le opere (pezzi fisici nei musei)
 */

// Regole di validazione per la creazione (usate da POST /api/artworks)
export const createArtworkValidation = [
  body('wikidataId').trim().notEmpty().withMessage("L'ID Wikidata è obbligatorio"),
  body('museumId').trim().notEmpty().withMessage("L'ID del museo è obbligatorio"),
  body('title').trim().notEmpty().withMessage('Il titolo è obbligatorio'),
  body('artworkType').isIn(Object.values(ArtworkType)).withMessage('Tipo di opera non valido'),
  body('image').trim().notEmpty().withMessage("L'immagine è obbligatoria"),
];

// Regole di validazione per l'aggiornamento (usate da PUT /api/artworks/:id):
// stessi campi della creazione, ma tutti opzionali visto che è un update parziale
export const updateArtworkValidation = [
  body('title').optional().trim().notEmpty().withMessage('Il titolo non può essere vuoto'),
  body('artworkType')
    .optional()
    .isIn(Object.values(ArtworkType))
    .withMessage('Tipo di opera non valido'),
  body('image').optional().trim().notEmpty().withMessage("L'immagine non può essere vuota"),
];

type YearRange = {
  startYear?: number;
  endYear?: number;
};

type ArtworkQueryFilters = SharedArtworkFilters & {
  author?: string;
  movement?: string;
};

// Converte un numero romano in intero, per interpretare i secoli
const parseRoman = (value: string): number | null => {
  const roman = value.toUpperCase();
  const map: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100 };

  let total = 0;
  for (let i = 0; i < roman.length; i++) {
    const current = map[roman[i]];
    const next = map[roman[i + 1]];
    if (!current) return null;
    if (next && current < next) {
      total -= current;
    } else {
      total += current;
    }
  }

  return total > 0 ? total : null;
};

// Ricava startYear/endYear dal campo "year" testuale (range, secolo romano/arabo o anno singolo)
const parseTechnicalYearRange = (yearValue: unknown): YearRange => {
  if (typeof yearValue !== 'string') return {};

  const year = yearValue.trim();
  if (!year) return {};

  const rangeMatch = year.match(/(-?\d{1,4})\s*[-–/]\s*(-?\d{1,4})/);
  if (rangeMatch) {
    const first = Number(rangeMatch[1]);
    const second = Number(rangeMatch[2]);
    if (!Number.isNaN(first) && !Number.isNaN(second)) {
      return {
        startYear: Math.min(first, second),
        endYear: Math.max(first, second),
      };
    }
  }

  const centuryRomanMatch = year.match(/\b([ivxlc]+)\s*secolo\b/i);
  if (centuryRomanMatch) {
    const century = parseRoman(centuryRomanMatch[1]);
    if (century && century <= 50) {
      return {
        startYear: (century - 1) * 100 + 1,
        endYear: century * 100,
      };
    }
  }

  const centuryArabicMatch = year.match(/\b(\d{1,2})\s*secolo\b/i);
  if (centuryArabicMatch) {
    const century = Number(centuryArabicMatch[1]);
    if (!Number.isNaN(century) && century > 0 && century <= 50) {
      return {
        startYear: (century - 1) * 100 + 1,
        endYear: century * 100,
      };
    }
  }

  const singleMatch = year.match(/-?\d{1,4}/);
  if (singleMatch) {
    const parsedYear = Number(singleMatch[0]);
    if (!Number.isNaN(parsedYear)) {
      return { startYear: parsedYear, endYear: parsedYear };
    }
  }

  return {};
};

// GET /api/artworks — lista opere con filtri (autore, movimento, anno, ricerca) e paginazione
export const getArtworks = asyncHandler(async (req: Request, res: Response) => {
  // Estrae e verifica i filtri dalla query
  const filters: ArtworkQueryFilters = {
    museumId: req.query.museumId as string | undefined,
    author: req.query.author as string | undefined,
    authorWikidataId: req.query.authorWikidataId as string | undefined,
    artworkType: req.query.artworkType as ArtworkQueryFilters['artworkType'],
    movement: req.query.movement as string | undefined,
    movementWikidataId: req.query.movementWikidataId as string | undefined,
    room: req.query.room as string | undefined,
    floor: req.query.floor as string | undefined,
    yearFrom: req.query.yearFrom ? Number(req.query.yearFrom) : undefined,
    yearTo: req.query.yearTo ? Number(req.query.yearTo) : undefined,
    search: req.query.search as string | undefined,
  };

  const query: Record<string, unknown> = {};

  if (filters.museumId) {
    const museumIdCandidates = await resolveMuseumIdCandidates(filters.museumId);
    query.museumId =
      museumIdCandidates.length <= 1 ? museumIdCandidates[0] : { $in: museumIdCandidates };
  }
  if (filters.author) query.author = filters.author;
  if (filters.authorWikidataId) query.authorWikidataId = filters.authorWikidataId;
  if (filters.artworkType) query.artworkType = filters.artworkType;
  if (filters.movement) query.movement = filters.movement;
  if (filters.movementWikidataId) query.movementWikidataId = filters.movementWikidataId;
  if (filters.room) query.room = filters.room;
  if (filters.floor) query.floor = filters.floor;

  if (filters.yearFrom || filters.yearTo) {
    if (filters.yearFrom) query.startYear = { $gte: filters.yearFrom };
    if (filters.yearTo) query.endYear = { $lte: filters.yearTo };
  }

  if (filters.search) {
    const trimmedSearch = filters.search.trim();
    const escapedSearch = trimmedSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const searchRegex = new RegExp(escapedSearch, 'i');

    query.$or = [
      { title: searchRegex },
      { author: searchRegex },
      { movement: searchRegex },
      { description: searchRegex },
      { year: searchRegex },
      { room: searchRegex },
      { floor: searchRegex },
      { wikidataId: searchRegex },
    ];
  }

  const { page, limit, skip } = parsePagination(req.query, 50);

  const [artworks, total] = await Promise.all([
    ArtworkModel.find(query).sort({ title: 1 }).skip(skip).limit(limit).lean(),
    ArtworkModel.countDocuments(query),
  ]);

  res.json({
    success: true,
    data: artworks,
    pagination: buildPaginationMeta(total, page, limit),
  });
});

// GET /api/artworks/:id — dettaglio di una singola opera
export const getArtwork = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const artwork = await ArtworkModel.findById(id).lean();

  if (!artwork) {
    return res.status(404).json({ success: false, error: 'Opera non trovata' });
  }

  res.json({ success: true, data: artwork });
});

// GET /api/artworks/wikidata/:wikidataId — cerca l'opera tramite il suo ID Wikidata
export const getArtworkByWikidataId = asyncHandler(async (req: Request, res: Response) => {
  const { wikidataId } = req.params;

  const artwork = await ArtworkModel.findOne({ wikidataId }).lean();

  if (!artwork) {
    return res.status(404).json({ success: false, error: 'Opera non trovata' });
  }

  res.json({ success: true, data: artwork });
});

// POST /api/artworks — crea l'opera, evitando duplicati per stesso wikidataId+museo
export const createArtwork = asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Validazione fallita', errors.array());
  }

  const yearRange = parseTechnicalYearRange(req.body?.year);
  const artworkData = {
    ...req.body,
    startYear: yearRange.startYear,
    endYear: yearRange.endYear,
  };

  // Controlla se un'opera con questo wikidataId esiste già nello stesso museo
  const existing = await ArtworkModel.findOne({
    wikidataId: artworkData.wikidataId,
    museumId: artworkData.museumId,
  });
  if (existing) {
    return res.status(409).json({
      error: "Esiste già un'opera con questo Wikidata ID in questo museo",
      existingId: existing._id,
    });
  }

  const artwork = new ArtworkModel(artworkData);
  await artwork.save();

  res.status(201).json({ success: true, data: artwork });
});

// PUT /api/artworks/:id — aggiorna l'opera (wikidataId non modificabile)
export const updateArtwork = asyncHandler(async (req: AuthRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Validazione fallita', errors.array());
  }

  const { id } = req.params;

  const artwork = await ArtworkModel.findById(id);
  if (!artwork) {
    return res.status(404).json({ success: false, error: 'Opera non trovata' });
  }

  // Admin, o curatore del museo a cui appartiene l'opera.
  await assertCan(
    req.user,
    'manage',
    'artwork',
    { museumId: artwork.museumId },
    'Puoi modificare solo le opere dei musei che curi',
  );

  const updateData = { ...req.body } as Record<string, unknown>;
  delete updateData.wikidataId;

  if (Object.prototype.hasOwnProperty.call(updateData, 'year')) {
    const yearRange = parseTechnicalYearRange(updateData.year);
    updateData.startYear = yearRange.startYear;
    updateData.endYear = yearRange.endYear;
  }

  Object.assign(artwork, updateData);
  await artwork.save();

  res.json({ success: true, data: artwork });
});

// DELETE /api/artworks/:id — elimina l'opera (admin, o curatore del museo a cui appartiene)
export const deleteArtwork = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const artwork = await ArtworkModel.findById(id);
  if (!artwork) {
    return res.status(404).json({ success: false, error: 'Opera non trovata' });
  }

  await assertCan(
    req.user,
    'manage',
    'artwork',
    { museumId: artwork.museumId },
    'Puoi eliminare solo le opere dei musei che curi',
  );

  await artwork.deleteOne();

  res.json({ success: true, message: 'Opera eliminata con successo' });
});

// GET /api/artworks/museum/:museumId — opere di un museo, ordinate per piano/sala e titolo
export const getArtworksByMuseum = asyncHandler(async (req: Request, res: Response) => {
  const { museumId } = req.params;
  const museumIdCandidates = await resolveMuseumIdCandidates(museumId);

  const artworks = await ArtworkModel.find({
    museumId: museumIdCandidates.length <= 1 ? museumIdCandidates[0] : { $in: museumIdCandidates },
  })
    .sort({ room: 1, title: 1 })
    .lean();

  res.json({ success: true, data: artworks });
});

// PUT /api/artworks/:id/map-position — aggiorna la posizione dell'opera sulla mappa del piano
export const updateArtworkMapPosition = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { floorId, x, y, rotation } = req.body;

  const artwork = await ArtworkModel.findById(id);
  if (!artwork) {
    return res.status(404).json({ success: false, error: 'Opera non trovata' });
  }

  await assertCan(
    req.user,
    'manage',
    'artwork',
    { museumId: artwork.museumId },
    'Puoi spostare solo le opere dei musei che curi',
  );

  artwork.mapPosition = { floorId, x, y, rotation };
  await artwork.save();

  res.json({ success: true, data: artwork });
});
