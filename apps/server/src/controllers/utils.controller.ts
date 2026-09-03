import { Request, Response } from 'express';
import { asyncHandler } from '../utils/async-handler.util.js';
import { body, validationResult } from 'express-validator';
import axios from 'axios';
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

  static getNavigatorDefaultConfigs = asyncHandler(
    async (req: AuthRequest, res: Response): Promise<void> => {
      const config = await AppConfigModel.findOne({
        key: UtilsController.NAVIGATOR_DEFAULT_CONFIG_KEY,
      })
        .select('navigatorDefaultConfigs')
        .lean();

      res.json({
        success: true,
        data: config?.navigatorDefaultConfigs || [],
      });
    },
  );

  static updateNavigatorDefaultConfigs = asyncHandler(
    async (req: AuthRequest, res: Response): Promise<void> => {
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
    },
  );

  // Ottieni entità Wikidata
  static getWikidataEntity = asyncHandler(async (req: Request, res: Response): Promise<void> => {
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
  });

  // Cerca su Wikidata
  static searchWikidata = asyncHandler(async (req: Request, res: Response): Promise<void> => {
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
  });

  static geocodeAddress = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const address = String(req.query.address || '').trim();
    const city = String(req.query.city || '').trim();
    const postalCode = String(req.query.postalCode || '').trim();
    const nation = String(req.query.nation || '').trim() || 'Italia';

    const query = [address, postalCode, city, nation].filter(Boolean).join(', ');

    if (!query) {
      throw new AppError(400, 'MISSING_QUERY', 'Address query is required');
    }

    type NominatimAddress = {
      city?: string;
      town?: string;
      village?: string;
      municipality?: string;
      hamlet?: string;
      postcode?: string;
    };

    type NominatimResult = {
      lat: string;
      lon: string;
      display_name?: string;
      place_id?: number;
      importance?: number;
      address?: NominatimAddress;
    };

    const normalizeText = (value: string): string =>
      value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();

    const normalizedCity = normalizeText(city);
    const normalizedPostalCode = postalCode.replace(/\s+/g, '').toLowerCase();

    const countryCodeByNation: Record<string, string> = {
      italia: 'it',
      italy: 'it',
      france: 'fr',
      francia: 'fr',
      germany: 'de',
      germania: 'de',
      spain: 'es',
      spagna: 'es',
    };

    const normalizedNation = normalizeText(nation);
    const nationCountryCode = countryCodeByNation[normalizedNation] || undefined;

    const nominatimRequest = async (params: Record<string, string>) => {
      const response = await axios.get<NominatimResult[]>(
        'https://nominatim.openstreetmap.org/search',
        {
          params: {
            format: 'jsonv2',
            addressdetails: '1',
            limit: '8',
            ...params,
          },
          headers: {
            'User-Agent': 'ArtAround/1.0 (geocoding)',
            'Accept-Language': 'it',
          },
          timeout: 10000,
        },
      );

      return Array.isArray(response.data) ? response.data : [];
    };

    const scoreResult = (result: NominatimResult): number => {
      let score = Number(result.importance || 0) * 10;
      const addressData = result.address || {};

      const localities = [
        addressData.city,
        addressData.town,
        addressData.village,
        addressData.municipality,
        addressData.hamlet,
      ]
        .filter(Boolean)
        .map((value) => normalizeText(String(value)));

      if (normalizedCity) {
        if (localities.some((value) => value === normalizedCity)) {
          score += 200;
        } else if (
          localities.some(
            (value) => value.includes(normalizedCity) || normalizedCity.includes(value),
          )
        ) {
          score += 120;
        } else if (normalizeText(result.display_name || '').includes(normalizedCity)) {
          score += 40;
        }
      }

      if (normalizedPostalCode) {
        const resultPostcode = String(addressData.postcode || '')
          .replace(/\s+/g, '')
          .toLowerCase();

        if (resultPostcode && resultPostcode === normalizedPostalCode) {
          score += 80;
        } else if (resultPostcode && resultPostcode !== normalizedPostalCode) {
          score -= 100;
        }
      }

      return score;
    };

    let candidates: NominatimResult[] = [];

    const structuredParams: Record<string, string> = {
      street: address,
      city,
      country: nation,
    };

    if (postalCode) {
      structuredParams.postalcode = postalCode;
    }

    if (nationCountryCode) {
      structuredParams.countrycodes = nationCountryCode;
    }

    candidates = await nominatimRequest(structuredParams);

    if (candidates.length === 0) {
      const freeTextParams: Record<string, string> = { q: query };
      if (nationCountryCode) {
        freeTextParams.countrycodes = nationCountryCode;
      }
      candidates = await nominatimRequest(freeTextParams);
    }

    const bestCandidate = candidates
      .map((result) => ({ result, score: scoreResult(result) }))
      .sort((left, right) => right.score - left.score)[0];

    if (!bestCandidate || (normalizedCity && bestCandidate.score < 100)) {
      res.json({
        success: true,
        data: null,
        message: 'No geocoding result found',
      });
      return;
    }

    res.json({
      success: true,
      data: {
        lat: Number(bestCandidate.result.lat),
        lng: Number(bestCandidate.result.lon),
        displayName: bestCandidate.result.display_name || query,
        provider: 'nominatim',
        placeId: bestCandidate.result.place_id,
      },
    });
  });

  // Traduci testo
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

  static translate = asyncHandler(async (req: Request, res: Response): Promise<void> => {
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
  });

  static translateBatch = asyncHandler(async (req: Request, res: Response): Promise<void> => {
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
  });

  static aiHealth = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const result = await AIService.checkOpenAIHealth();

    res.status(result.ok ? 200 : 503).json({
      success: result.ok,
      data: result,
    });
  });
}
