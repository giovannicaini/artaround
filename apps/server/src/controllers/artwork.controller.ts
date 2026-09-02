import { Request, Response, NextFunction } from 'express';
import { ArtworkModel } from '../models/index.js';
import type { ArtworkFilters as SharedArtworkFilters } from '@artaround/shared';
import { resolveMuseumIdCandidates } from '../utils/museum-id.util.js';

/**
 * Artwork Controller
 *
 * Manages CRUD operations for artworks (physical pieces in museums)
 */

type YearRange = {
  startYear?: number;
  endYear?: number;
};

type ArtworkQueryFilters = SharedArtworkFilters & {
  author?: string;
  movement?: string;
};

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

// GET /api/artworks
export const getArtworks = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Extract and type-check filters from query
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
      page: req.query.page ? Number(req.query.page) : 1,
      limit: req.query.limit ? Number(req.query.limit) : 50,
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

    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const skip = (page - 1) * limit;

    const [artworks, total] = await Promise.all([
      ArtworkModel.find(query).sort({ title: 1 }).skip(skip).limit(limit).lean(),
      ArtworkModel.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: artworks,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/artworks/:id
export const getArtwork = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const artwork = await ArtworkModel.findById(id).lean();

    if (!artwork) {
      return res.status(404).json({ success: false, error: 'Artwork not found' });
    }

    res.json({ success: true, data: artwork });
  } catch (error) {
    next(error);
  }
};

// GET /api/artworks/wikidata/:wikidataId
export const getArtworkByWikidataId = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { wikidataId } = req.params;

    const artwork = await ArtworkModel.findOne({ wikidataId }).lean();

    if (!artwork) {
      return res.status(404).json({ success: false, error: 'Artwork not found' });
    }

    res.json({ success: true, data: artwork });
  } catch (error) {
    next(error);
  }
};

// POST /api/artworks
export const createArtwork = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const yearRange = parseTechnicalYearRange(req.body?.year);
    const artworkData = {
      ...req.body,
      startYear: yearRange.startYear,
      endYear: yearRange.endYear,
    };

    // Check if artwork with this wikidataId already exists in the same museum
    const existing = await ArtworkModel.findOne({
      wikidataId: artworkData.wikidataId,
      museumId: artworkData.museumId,
    });
    if (existing) {
      return res.status(409).json({
        error: 'Artwork with this Wikidata ID already exists in this museum',
        existingId: existing._id,
      });
    }

    const artwork = new ArtworkModel(artworkData);
    await artwork.save();

    res.status(201).json({ success: true, data: artwork });
  } catch (error) {
    next(error);
  }
};

// PUT /api/artworks/:id
export const updateArtwork = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body } as Record<string, unknown>;
    delete updateData.wikidataId;

    if (Object.prototype.hasOwnProperty.call(updateData, 'year')) {
      const yearRange = parseTechnicalYearRange(updateData.year);
      updateData.startYear = yearRange.startYear;
      updateData.endYear = yearRange.endYear;
    }

    const artwork = await ArtworkModel.findByIdAndUpdate(id, updateData, { new: true });

    if (!artwork) {
      return res.status(404).json({ success: false, error: 'Artwork not found' });
    }

    res.json({ success: true, data: artwork });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/artworks/:id
export const deleteArtwork = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const artwork = await ArtworkModel.findByIdAndDelete(id);

    if (!artwork) {
      return res.status(404).json({ success: false, error: 'Artwork not found' });
    }

    res.json({ success: true, message: 'Artwork deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// GET /api/artworks/museum/:museumId
export const getArtworksByMuseum = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { museumId } = req.params;
    const museumIdCandidates = await resolveMuseumIdCandidates(museumId);

    const artworks = await ArtworkModel.find({
      museumId:
        museumIdCandidates.length <= 1 ? museumIdCandidates[0] : { $in: museumIdCandidates },
    })
      .sort({ room: 1, title: 1 })
      .lean();

    res.json({ success: true, data: artworks });
  } catch (error) {
    next(error);
  }
};

// PUT /api/artworks/:id/map-position
export const updateArtworkMapPosition = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { floorId, x, y, rotation } = req.body;

    const mapPosition = { floorId, x, y, rotation };

    const artwork = await ArtworkModel.findByIdAndUpdate(id, { mapPosition }, { new: true });

    if (!artwork) {
      return res.status(404).json({ success: false, error: 'Artwork not found' });
    }

    res.json({ success: true, data: artwork });
  } catch (error) {
    next(error);
  }
};
