import { Request, Response } from 'express';
import { asyncHandler } from '../utils/async-handler.util.js';
import { body, validationResult } from 'express-validator';
import axios from 'axios';
import { WikidataService } from '../utils/wikidata.service.js';
import { MuseumModel } from '../models/index.js';
import { TranslationService } from '../utils/translation.service.js';
import { AIService } from '../utils/ai.service.js';
import { AppError } from '../middleware/index.js';
import mongoose from 'mongoose';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { isVoiceCommandId, type VoiceCommandId } from '@artaround/shared';

// Descrizioni per il prompt di classificazione — un ID per riga, mai
// esposte al client (che vede solo l'ID scelto).
const VOICE_COMMAND_DESCRIPTIONS: { id: VoiceCommandId; description: string }[] = [
  { id: 'next', description: 'vai alla tappa successiva' },
  { id: 'prev', description: 'torna alla tappa precedente' },
  { id: 'play', description: 'avvia o riprendi la lettura' },
  { id: 'stop', description: 'ferma la lettura' },
  { id: 'whatIsThis', description: 'chiede cosa sta guardando/ascoltando ora' },
  { id: 'more', description: 'vuole un contenuto più lungo/approfondito' },
  { id: 'less', description: 'vuole un contenuto più breve' },
  { id: 'tooHard', description: 'il contenuto è troppo difficile, semplificalo' },
  { id: 'tooSimple', description: 'il contenuto è troppo semplice, approfondisci' },
  { id: 'author', description: "chiede chi è l'autore dell'opera" },
  { id: 'style', description: 'chiede lo stile o movimento artistico' },
  { id: 'repeat', description: 'ripeti lo stesso contenuto da capo' },
  { id: 'exit', description: "chiede dov'è l'uscita" },
  { id: 'toilette', description: "chiede dov'è il bagno" },
  { id: 'bar', description: "chiede dov'è il bar" },
  { id: 'shop', description: "chiede dov'è il negozio/shop" },
  { id: 'obstacles', description: 'chiede se il percorso ha ostacoli o è accessibile' },
  { id: 'help', description: 'chiede quali comandi vocali sono disponibili' },
  {
    id: 'speedUp',
    description:
      'vuole che la lettura ad alta voce sia più veloce (es. "più veloce", "aumenta la velocità", "parla più in fretta")',
  },
  {
    id: 'speedDown',
    description:
      'vuole che la lettura ad alta voce sia più lenta (es. "più lento", "rallenta", "diminuisci la velocità")',
  },
  {
    id: 'speedNormal',
    description: 'vuole che la lettura ad alta voce torni alla velocità normale/predefinita',
  },
];

export class UtilsController {
  // GET /api/utils/wikidata/:id — dettaglio di un'entità Wikidata
  static getWikidataEntity = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    if (!id || Array.isArray(id)) {
      throw new AppError(400, 'INVALID_ID', 'ID Wikidata non valido');
    }

    const entity = await WikidataService.getEntity(id);
    if (!entity) {
      throw new AppError(404, 'ENTITY_NOT_FOUND', 'Entità Wikidata non trovata');
    }

    res.json({
      success: true,
      data: entity,
    });
  });

  // GET /api/utils/wikidata-search — cerca musei/autori/movimenti/opere su Wikidata
  static searchWikidata = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { q, limit = '10', type = 'artwork', museumId } = req.query;

    if (!q) {
      throw new AppError(400, 'MISSING_QUERY', 'La query di ricerca è obbligatoria');
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
      // Filtrata sul museo: se non trova nulla resta vuota, non allarga la
      // ricerca a tutti i musei (romperebbe il senso del filtro richiesto).
      results = await WikidataService.searchArtworksInMuseum(
        q as string,
        museumWikidataId,
        parsedLimit,
      );
    } else {
      results = await WikidataService.search(q as string, parsedLimit);
    }

    res.json({
      success: true,
      data: results,
    });
  });

  // GET /api/utils/geocode — geocodifica un indirizzo via Nominatim, scegliendo il
  // risultato migliore in base a città/CAP quando forniti
  static geocodeAddress = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const address = String(req.query.address || '').trim();
    const city = String(req.query.city || '').trim();
    const postalCode = String(req.query.postalCode || '').trim();
    const nation = String(req.query.nation || '').trim() || 'Italia';

    const query = [address, postalCode, city, nation].filter(Boolean).join(', ');

    if (!query) {
      throw new AppError(400, 'MISSING_QUERY', "L'indirizzo di ricerca è obbligatorio");
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
        message: 'Nessun risultato di geocodifica trovato',
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

  // Validazione per POST /api/utils/translate
  static translateValidation = [
    body('text').notEmpty().withMessage('Il testo è obbligatorio'),
    body('sourceLang').notEmpty().withMessage('La lingua di origine è obbligatoria'),
    body('targetLang').notEmpty().withMessage('La lingua di destinazione è obbligatoria'),
  ];

  // Validazione per POST /api/utils/translate-batch
  static translateBatchValidation = [
    body('sourceLang').notEmpty().withMessage('La lingua di origine è obbligatoria'),
    body('items').isArray({ min: 1 }).withMessage("L'array items è obbligatorio"),
    body('items.*.key').notEmpty().withMessage('La chiave di ogni item è obbligatoria'),
    body('items.*.text').notEmpty().withMessage('Il testo di ogni item è obbligatorio'),
    body('items.*.targetLang').notEmpty().withMessage('La targetLang di ogni item è obbligatoria'),
  ];

  // POST /api/utils/translate — traduce un singolo testo tra due lingue
  static translate = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Validazione fallita', errors.array());
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

  // POST /api/utils/translate-batch — traduce più testi in un'unica chiamata
  static translateBatch = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Validazione fallita', errors.array());
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

  // GET /api/utils/ai-health — verifica che OpenAI sia configurata e raggiungibile
  static aiHealth = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const result = await AIService.checkOpenAIHealth();

    res.status(result.ok ? 200 : 503).json({
      success: result.ok,
      data: result,
    });
  });

  // Validazione per POST /api/utils/voice-command
  static voiceCommandValidation = [
    body('text').notEmpty().withMessage('Il testo è obbligatorio'),
    body('language').notEmpty().withMessage('La lingua è obbligatoria'),
  ];

  // POST /api/utils/voice-command — classifica un comando vocale del
  // Navigator in uno degli ID fissi previsti, o null se nessuno è
  // pertinente. Usata come fallback quando il match locale a pattern
  // (Navigator, parseVoiceCommand) non riconosce la frase.
  static voiceCommand = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Validazione fallita', errors.array());
    }

    const { text, language } = req.body as { text: string; language: string };

    const commandDescriptions = VOICE_COMMAND_DESCRIPTIONS.map(
      ({ id, description }) => `- ${id}: ${description}`,
    ).join('\n');

    const systemInstruction =
      `Interpreti comandi vocali di un visitatore di museo, in lingua "${language}". ` +
      `Scegli l'ID più adatto tra questi (mai altro):\n${commandDescriptions}\n` +
      `Se nessuno è pertinente, rispondi con {"command": null}. Rispondi sempre con un oggetto JSON in questa forma, mai col solo valore null.`;

    const result = await AIService.generateJson<{ command: string | null } | null>(
      systemInstruction,
      text,
      { temperature: 0 },
    ).catch(() => null);

    const command = isVoiceCommandId(result?.command) ? result.command : null;

    res.json({
      success: true,
      data: { command },
    });
  });
}
