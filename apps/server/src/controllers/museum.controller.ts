import { Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { ItemModel, MuseumModel, VisitModel } from '../models/index.js';
import { AppError } from '../middleware/index.js';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { TranslationService } from '../utils/translation.service.js';
import {
  MuseumFloor,
  MapMarker,
  FloorConnection,
  MarkerType,
  ConnectionType,
  RoleAssignment,
  SUPPORTED_APP_LANGUAGES,
  DEFAULT_APP_LANGUAGE,
  type AppLanguage,
  type MuseumRoom,
} from '@artaround/shared';

export class MuseumController {
  private static readonly HEX_COLOR_REGEX = /^#(?:[0-9a-fA-F]{3}){1,2}$/;
  private static readonly SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

  private static normalizeActiveLanguages(activeLanguages: unknown): AppLanguage[] | undefined {
    if (activeLanguages === undefined) {
      return undefined;
    }

    if (!Array.isArray(activeLanguages)) {
      throw new AppError(400, 'VALIDATION_ERROR', 'activeLanguages must be an array');
    }

    const normalized = Array.from(
      new Set(
        activeLanguages.map((value) =>
          String(value || '')
            .trim()
            .toLowerCase(),
        ),
      ),
    ).filter(Boolean);

    if (normalized.length === 0) {
      throw new AppError(400, 'VALIDATION_ERROR', 'activeLanguages cannot be empty');
    }

    for (const lang of normalized) {
      if (!SUPPORTED_APP_LANGUAGES.includes(lang as AppLanguage)) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          `Invalid active language '${lang}'. Allowed: ${SUPPORTED_APP_LANGUAGES.join(', ')}`,
        );
      }
    }

    return normalized as AppLanguage[];
  }

  private static validateNavigatorConfigsPayload(navigatorConfigs: unknown): void {
    if (navigatorConfigs === undefined) {
      return;
    }

    if (!Array.isArray(navigatorConfigs)) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'navigatorConfigs must be an array when provided',
      );
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
      if (!slug || !MuseumController.SLUG_REGEX.test(slug)) {
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

        if (!MuseumController.HEX_COLOR_REGEX.test(color.value)) {
          throw new AppError(
            400,
            'VALIDATION_ERROR',
            `${prefix}.${color.key} must be a valid HEX color`,
          );
        }
      }
    }
  }

  private static normalizeLocationPayload(rawLocation: unknown): Record<string, unknown> {
    if (!rawLocation || typeof rawLocation !== 'object') {
      throw new AppError(400, 'VALIDATION_ERROR', 'location is required');
    }

    const location = { ...(rawLocation as Record<string, unknown>) };
    const nation = String(location.nation || location.country || '')
      .trim()
      .replace(/\s+/g, ' ');

    if (!nation) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Nation is required');
    }

    location.nation = nation;
    location.country = nation;
    delete location.region;

    return location;
  }

  // Validation rules
  static createValidation = [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('description').trim().notEmpty().withMessage('Description is required'),
    body('location.address').notEmpty().withMessage('Address is required'),
    body('location.city').notEmpty().withMessage('City is required'),
    body('location').custom((value) => {
      const nation = value?.nation || value?.country;
      if (!nation || !String(nation).trim()) {
        throw new Error('Nation is required');
      }
      return true;
    }),
  ];

  static floorValidation = [
    body('id').trim().notEmpty().withMessage('Floor ID is required'),
    body('name').trim().notEmpty().withMessage('Floor name is required'),
    body('level').isNumeric().withMessage('Floor level must be a number'),
    body('svgContent').trim().notEmpty().withMessage('SVG content is required'),
    body('dimensions.width').isNumeric().withMessage('Width is required'),
    body('dimensions.height').isNumeric().withMessage('Height is required'),
  ];

  static markerValidation = [
    body('id').trim().notEmpty().withMessage('Marker ID is required'),
    body('floorId').trim().notEmpty().withMessage('Floor ID is required'),
    body('x').isNumeric().withMessage('X coordinate is required'),
    body('y').isNumeric().withMessage('Y coordinate is required'),
    body('type').isIn(Object.values(MarkerType)).withMessage('Invalid marker type'),
  ];

  static connectionValidation = [
    body('id').trim().notEmpty().withMessage('Connection ID is required'),
    body('type').isIn(Object.values(ConnectionType)).withMessage('Invalid connection type'),
    body('x').isNumeric().withMessage('X coordinate is required'),
    body('y').isNumeric().withMessage('Y coordinate is required'),
    body('targetFloorId').trim().notEmpty().withMessage('Target floor ID is required'),
  ];

  static syncLanguagesValidation = [
    body('activeLanguages').isArray({ min: 1 }).withMessage('activeLanguages is required'),
  ];

  private static mapToRecord(value: unknown): Record<string, string> {
    if (value instanceof Map) {
      return Object.fromEntries(value.entries()) as Record<string, string>;
    }

    if (value && typeof value === 'object') {
      return { ...(value as Record<string, string>) };
    }

    return {};
  }

  private static async syncItemTranslationsForMuseum(
    museumId: string,
    activeLanguages: AppLanguage[],
  ): Promise<{
    scanned: number;
    updated: number;
    generated: number;
    removed: number;
    failed: number;
  }> {
    const items = await ItemModel.find({ museumId });

    let updated = 0;
    let generated = 0;
    let removed = 0;
    let failed = 0;

    for (const item of items) {
      try {
        const sourceLang = (item.sourceLanguage || DEFAULT_APP_LANGUAGE) as AppLanguage;
        const targetLanguages = activeLanguages.filter((lang) => lang !== sourceLang);

        const titleTranslations = MuseumController.mapToRecord(item.translatedTitles);
        const textTranslations = MuseumController.mapToRecord(item.translatedTexts);

        let itemChanged = false;
        const filteredTitleTranslations: Record<string, string> = {};
        const filteredTextTranslations: Record<string, string> = {};

        for (const lang of targetLanguages) {
          const titleValue = titleTranslations[lang];
          const textValue = textTranslations[lang];

          if (titleValue && titleValue.trim()) {
            filteredTitleTranslations[lang] = titleValue;
          }
          if (textValue && textValue.trim()) {
            filteredTextTranslations[lang] = textValue;
          }
        }

        const removedTitleCount =
          Object.keys(titleTranslations).length - Object.keys(filteredTitleTranslations).length;
        const removedTextCount =
          Object.keys(textTranslations).length - Object.keys(filteredTextTranslations).length;

        if (removedTitleCount > 0 || removedTextCount > 0) {
          removed += removedTitleCount + removedTextCount;
          itemChanged = true;
        }

        const batchItems: Array<{ key: string; text: string; targetLang: string }> = [];

        for (const lang of targetLanguages) {
          if (!filteredTitleTranslations[lang]) {
            batchItems.push({ key: `${lang}:title`, text: item.title, targetLang: lang });
          }
          if (!filteredTextTranslations[lang]) {
            batchItems.push({ key: `${lang}:text`, text: item.text, targetLang: lang });
          }
        }

        if (batchItems.length > 0) {
          const translations = await TranslationService.batchTranslate(sourceLang, batchItems);

          for (const lang of targetLanguages) {
            const titleKey = `${lang}:title`;
            const textKey = `${lang}:text`;

            if (!filteredTitleTranslations[lang] && translations[titleKey]) {
              filteredTitleTranslations[lang] = translations[titleKey];
              generated += 1;
              itemChanged = true;
            }
            if (!filteredTextTranslations[lang] && translations[textKey]) {
              filteredTextTranslations[lang] = translations[textKey];
              generated += 1;
              itemChanged = true;
            }
          }
        }

        if (itemChanged) {
          item.set('translatedTitles', filteredTitleTranslations);
          item.set('translatedTexts', filteredTextTranslations);
          await item.save();
          updated += 1;
        }
      } catch {
        failed += 1;
      }
    }

    return {
      scanned: items.length,
      updated,
      generated,
      removed,
      failed,
    };
  }

  private static async syncVisitTranslationsForMuseum(
    museumId: string,
    activeLanguages: AppLanguage[],
  ): Promise<{
    scanned: number;
    updated: number;
    generated: number;
    removed: number;
    failed: number;
  }> {
    const visits = await VisitModel.find({ museumId });

    let updated = 0;
    let generated = 0;
    let removed = 0;
    let failed = 0;

    for (const visit of visits) {
      try {
        const sourceLang = (visit.metadata?.language || DEFAULT_APP_LANGUAGE) as AppLanguage;
        const targetLanguages = activeLanguages.filter((lang) => lang !== sourceLang);

        const titleTranslations = MuseumController.mapToRecord(visit.titleTranslations);
        const descriptionTranslations = MuseumController.mapToRecord(visit.descriptionTranslations);

        let visitChanged = false;
        const filteredTitleTranslations: Record<string, string> = {};
        const filteredDescriptionTranslations: Record<string, string> = {};

        for (const lang of targetLanguages) {
          const titleValue = titleTranslations[lang];
          const descriptionValue = descriptionTranslations[lang];

          if (titleValue && titleValue.trim()) {
            filteredTitleTranslations[lang] = titleValue;
          }
          if (descriptionValue && descriptionValue.trim()) {
            filteredDescriptionTranslations[lang] = descriptionValue;
          }
        }

        const removedTitleCount =
          Object.keys(titleTranslations).length - Object.keys(filteredTitleTranslations).length;
        const removedDescriptionCount =
          Object.keys(descriptionTranslations).length -
          Object.keys(filteredDescriptionTranslations).length;

        if (removedTitleCount > 0 || removedDescriptionCount > 0) {
          removed += removedTitleCount + removedDescriptionCount;
          visitChanged = true;
        }

        const batchItems: Array<{ key: string; text: string; targetLang: string }> = [];

        for (const lang of targetLanguages) {
          if (!filteredTitleTranslations[lang]) {
            batchItems.push({ key: `${lang}:title`, text: visit.title, targetLang: lang });
          }
          if (!filteredDescriptionTranslations[lang]) {
            batchItems.push({
              key: `${lang}:description`,
              text: visit.description,
              targetLang: lang,
            });
          }
        }

        if (batchItems.length > 0) {
          const translations = await TranslationService.batchTranslate(sourceLang, batchItems);

          for (const lang of targetLanguages) {
            const titleKey = `${lang}:title`;
            const descriptionKey = `${lang}:description`;

            if (!filteredTitleTranslations[lang] && translations[titleKey]) {
              filteredTitleTranslations[lang] = translations[titleKey];
              generated += 1;
              visitChanged = true;
            }
            if (!filteredDescriptionTranslations[lang] && translations[descriptionKey]) {
              filteredDescriptionTranslations[lang] = translations[descriptionKey];
              generated += 1;
              visitChanged = true;
            }
          }
        }

        const metadata = {
          ...(visit.metadata || {}),
          language: sourceLang,
          supportedLanguages: activeLanguages,
        };

        if (
          JSON.stringify(visit.metadata?.supportedLanguages || []) !==
          JSON.stringify(activeLanguages)
        ) {
          visitChanged = true;
        }

        if (visitChanged) {
          visit.set('titleTranslations', filteredTitleTranslations);
          visit.set('descriptionTranslations', filteredDescriptionTranslations);
          visit.set('metadata', metadata);
          await visit.save();
          updated += 1;
        }
      } catch {
        failed += 1;
      }
    }

    return {
      scanned: visits.length,
      updated,
      generated,
      removed,
      failed,
    };
  }

  // Get all museums
  static async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { city, isActive } = req.query;

      const filter: Record<string, unknown> = {};
      if (city) filter['location.city'] = city;
      if (isActive !== undefined) filter.isActive = isActive === 'true';

      const museums = await MuseumModel.find(filter).sort({ name: 1 });

      res.json({
        success: true,
        data: museums,
      });
    } catch (error) {
      next(error);
    }
  }

  // Get museum by ID
  static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const idParam = req.params.id;
      const id = Array.isArray(idParam) ? idParam[0] : idParam;

      if (!id) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Museum id is required');
      }

      const museum = await MuseumModel.findById(id);
      if (!museum) {
        throw new AppError(404, 'MUSEUM_NOT_FOUND', 'Museum not found');
      }

      res.json({
        success: true,
        data: museum,
      });
    } catch (error) {
      next(error);
    }
  }

  // Get museum config (services and info)
  static async getConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const museum = await MuseumModel.findById(id);

      if (!museum) {
        throw new AppError(404, 'MUSEUM_NOT_FOUND', 'Museum not found');
      }

      // Return museum services and floor info as config
      const config = {
        wikidataId: museum.wikidataId,
        name: museum.name,
        services: museum.services,
        navigatorConfigs: museum.navigatorConfigs || [],
        floors: museum.floors?.map((f) => ({
          id: f.id,
          name: f.name,
          level: f.level,
          markersCount: f.markers?.length || 0,
        })),
      };

      res.json({
        success: true,
        data: config,
      });
    } catch (error) {
      next(error);
    }
  }

  // Create museum (admin only)
  static async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Validation failed', errors.array());
      }

      MuseumController.validateNavigatorConfigsPayload(req.body.navigatorConfigs);

      const activeLanguages = MuseumController.normalizeActiveLanguages(req.body.activeLanguages);
      const location = MuseumController.normalizeLocationPayload(req.body.location);

      const museum = new MuseumModel({
        ...req.body,
        location,
        activeLanguages: activeLanguages ?? [DEFAULT_APP_LANGUAGE],
      });
      await museum.save();

      res.status(201).json({
        success: true,
        data: museum,
        message: 'Museum created successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  // Update museum
  static async update(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      MuseumController.validateNavigatorConfigsPayload(req.body.navigatorConfigs);

      const activeLanguages = MuseumController.normalizeActiveLanguages(req.body.activeLanguages);
      const location =
        req.body.location !== undefined
          ? MuseumController.normalizeLocationPayload(req.body.location)
          : undefined;

      const updatePayload = {
        ...req.body,
        ...(location ? { location } : {}),
        ...(activeLanguages ? { activeLanguages } : {}),
      };

      const museum = await MuseumModel.findByIdAndUpdate(id, updatePayload, {
        new: true,
        runValidators: true,
      });

      if (!museum) {
        throw new AppError(404, 'MUSEUM_NOT_FOUND', 'Museum not found');
      }

      res.json({
        success: true,
        data: museum,
        message: 'Museum updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  static async syncLanguages(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Validation failed', errors.array());
      }

      const idParam = req.params.id;
      const id = Array.isArray(idParam) ? idParam[0] : idParam;

      if (!id) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Museum id is required');
      }
      const normalizedActiveLanguages = MuseumController.normalizeActiveLanguages(
        req.body.activeLanguages,
      );

      if (!normalizedActiveLanguages) {
        throw new AppError(400, 'VALIDATION_ERROR', 'activeLanguages is required');
      }

      const museum = await MuseumModel.findById(id);
      if (!museum) {
        throw new AppError(404, 'MUSEUM_NOT_FOUND', 'Museum not found');
      }

      museum.activeLanguages = normalizedActiveLanguages;
      await museum.save();

      const [itemSync, visitSync] = await Promise.all([
        MuseumController.syncItemTranslationsForMuseum(id, normalizedActiveLanguages),
        MuseumController.syncVisitTranslationsForMuseum(id, normalizedActiveLanguages),
      ]);

      res.json({
        success: true,
        data: {
          museumId: id,
          activeLanguages: normalizedActiveLanguages,
          items: itemSync,
          visits: visitSync,
        },
        message: 'Lingue museo sincronizzate su contenuti e visite esistenti',
      });
    } catch (error) {
      next(error);
    }
  }

  // Delete museum
  static async delete(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const museum = await MuseumModel.findByIdAndDelete(id);
      if (!museum) {
        throw new AppError(404, 'MUSEUM_NOT_FOUND', 'Museum not found');
      }

      res.json({
        success: true,
        message: 'Museum deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  // ========================================
  // FLOOR MANAGEMENT
  // ========================================

  // Get all floors for a museum
  static async getFloors(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const museum = await MuseumModel.findById(id);
      if (!museum) {
        throw new AppError(404, 'MUSEUM_NOT_FOUND', 'Museum not found');
      }

      res.json({
        success: true,
        data: museum.floors || [],
      });
    } catch (error) {
      next(error);
    }
  }

  // Get a specific floor
  static async getFloor(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id, floorId } = req.params;

      const museum = await MuseumModel.findById(id);
      if (!museum) {
        throw new AppError(404, 'MUSEUM_NOT_FOUND', 'Museum not found');
      }

      const floor = museum.floors?.find((f) => f.id === floorId);
      if (!floor) {
        throw new AppError(404, 'FLOOR_NOT_FOUND', 'Floor not found');
      }

      res.json({
        success: true,
        data: floor,
      });
    } catch (error) {
      next(error);
    }
  }

  // Add a new floor
  static async addFloor(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Validation failed', errors.array());
      }

      const { id } = req.params;
      const floorData: MuseumFloor = {
        ...req.body,
        markers: req.body.markers || [],
        connections: req.body.connections || [],
      };

      const museum = await MuseumModel.findById(id);
      if (!museum) {
        throw new AppError(404, 'MUSEUM_NOT_FOUND', 'Museum not found');
      }

      // Check if floor ID already exists
      if (museum.floors?.some((f) => f.id === floorData.id)) {
        throw new AppError(400, 'FLOOR_EXISTS', 'A floor with this ID already exists');
      }

      // Initialize floors array if needed
      if (!museum.floors) {
        museum.floors = [];
      }

      museum.floors.push(floorData);

      // Sort floors by level
      museum.floors.sort((a, b) => a.level - b.level);

      await museum.save();

      res.status(201).json({
        success: true,
        data: floorData,
        message: 'Floor added successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  // Update a floor
  static async updateFloor(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id, floorId } = req.params;

      const museum = await MuseumModel.findById(id);
      if (!museum) {
        throw new AppError(404, 'MUSEUM_NOT_FOUND', 'Museum not found');
      }

      const floorIndex = museum.floors?.findIndex((f) => f.id === floorId);
      if (floorIndex === undefined || floorIndex === -1) {
        throw new AppError(404, 'FLOOR_NOT_FOUND', 'Floor not found');
      }

      // Update floor data, preserving markers and connections if not provided.
      // museum.floors[i] è un subdocument Mongoose: i suoi campi non sono proprietà
      // enumerabili "piatte", quindi {...existingFloor} non li copiava in modo
      // affidabile (un PUT parziale poteva perdere name/level/dimensions e fallire
      // la validazione Mongoose). JSON round-trip forza un plain object su cui lo
      // spread funziona come atteso (il floor non ha campi Date, è sicuro).
      const existingFloor = JSON.parse(
        JSON.stringify(museum.floors![floorIndex]),
      ) as MuseumFloor;
      museum.floors![floorIndex] = {
        ...existingFloor,
        ...req.body,
        id: floorId, // Prevent ID change
        markers: req.body.markers || existingFloor.markers,
        connections: req.body.connections || existingFloor.connections,
      };

      // Re-sort floors by level
      museum.floors!.sort((a, b) => a.level - b.level);

      await museum.save();

      res.json({
        success: true,
        data: museum.floors![floorIndex],
        message: 'Floor updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  // Delete a floor
  static async deleteFloor(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id, floorId } = req.params;

      const museum = await MuseumModel.findById(id);
      if (!museum) {
        throw new AppError(404, 'MUSEUM_NOT_FOUND', 'Museum not found');
      }

      const floorIndex = museum.floors?.findIndex((f) => f.id === floorId);
      if (floorIndex === undefined || floorIndex === -1) {
        throw new AppError(404, 'FLOOR_NOT_FOUND', 'Floor not found');
      }

      museum.floors!.splice(floorIndex, 1);
      await museum.save();

      res.json({
        success: true,
        message: 'Floor deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  // ========================================
  // ROOM MANAGEMENT (gestione parallela ai marker: vedi MuseumRoom)
  // ========================================

  static roomValidation = [
    body('id').trim().notEmpty().withMessage('Room ID is required'),
    body('name').trim().notEmpty().withMessage('Room name is required'),
  ];

  static roomRenameValidation = [
    body('name').trim().notEmpty().withMessage('Room name is required'),
  ];

  static roomOutlineValidation = [
    body('floorId').trim().notEmpty().withMessage('Floor ID is required'),
    body('polygon')
      .isArray({ min: 3 })
      .withMessage('Il contorno deve avere almeno 3 punti'),
    body('polygon.*.x').isNumeric().withMessage('Invalid polygon point'),
    body('polygon.*.y').isNumeric().withMessage('Invalid polygon point'),
  ];

  // Get all rooms of the museum (indipendenti dal piano finché non contornate)
  static async getRooms(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const museum = await MuseumModel.findById(id);
      if (!museum) {
        throw new AppError(404, 'MUSEUM_NOT_FOUND', 'Museum not found');
      }

      res.json({
        success: true,
        data: museum.rooms || [],
      });
    } catch (error) {
      next(error);
    }
  }

  // Create a new room (solo id/name: il contorno si aggiunge dopo)
  static async createRoom(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Validation failed', errors.array());
      }

      const { id } = req.params;
      const roomData: MuseumRoom = { id: req.body.id, name: req.body.name };

      const museum = await MuseumModel.findById(id);
      if (!museum) {
        throw new AppError(404, 'MUSEUM_NOT_FOUND', 'Museum not found');
      }

      if (museum.rooms?.some((r) => r.id === roomData.id)) {
        throw new AppError(400, 'ROOM_EXISTS', 'A room with this ID already exists');
      }

      if (!museum.rooms) {
        museum.rooms = [];
      }
      museum.rooms.push(roomData);
      await museum.save();

      res.status(201).json({
        success: true,
        data: roomData,
        message: 'Room created successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  // Rinomina una sala (solo name — non tocca floorId/polygon)
  static async updateRoom(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Validation failed', errors.array());
      }

      const { id, roomId } = req.params;

      const museum = await MuseumModel.findById(id);
      if (!museum) {
        throw new AppError(404, 'MUSEUM_NOT_FOUND', 'Museum not found');
      }

      const room = museum.rooms?.find((r) => r.id === roomId);
      if (!room) {
        throw new AppError(404, 'ROOM_NOT_FOUND', 'Room not found');
      }

      room.name = req.body.name;
      await museum.save();

      res.json({
        success: true,
        data: room,
        message: 'Room updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  // Contorna una sala sulla piantina: floorId + poligono chiuso (endpoint
  // separato dal rename, così un contorno malformato non può essere salvato
  // aggirando la validazione di roomOutlineValidation).
  static async outlineRoom(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Validation failed', errors.array());
      }

      const { id, roomId } = req.params;

      const museum = await MuseumModel.findById(id);
      if (!museum) {
        throw new AppError(404, 'MUSEUM_NOT_FOUND', 'Museum not found');
      }

      const room = museum.rooms?.find((r) => r.id === roomId);
      if (!room) {
        throw new AppError(404, 'ROOM_NOT_FOUND', 'Room not found');
      }

      const floor = museum.floors?.find((f) => f.id === req.body.floorId);
      if (!floor) {
        throw new AppError(404, 'FLOOR_NOT_FOUND', 'Floor not found');
      }

      room.floorId = req.body.floorId;
      room.polygon = req.body.polygon;
      await museum.save();

      res.json({
        success: true,
        data: room,
        message: 'Room outline updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  // Rimuove solo il contorno di una sala (torna disponibile senza piano/poligono)
  static async removeRoomOutline(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { id, roomId } = req.params;

      const museum = await MuseumModel.findById(id);
      if (!museum) {
        throw new AppError(404, 'MUSEUM_NOT_FOUND', 'Museum not found');
      }

      const room = museum.rooms?.find((r) => r.id === roomId);
      if (!room) {
        throw new AppError(404, 'ROOM_NOT_FOUND', 'Room not found');
      }

      room.floorId = undefined;
      room.polygon = undefined;
      await museum.save();

      res.json({
        success: true,
        data: room,
        message: 'Room outline removed successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  // Delete a room
  static async deleteRoom(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id, roomId } = req.params;

      const museum = await MuseumModel.findById(id);
      if (!museum) {
        throw new AppError(404, 'MUSEUM_NOT_FOUND', 'Museum not found');
      }

      const roomIndex = museum.rooms?.findIndex((r) => r.id === roomId);
      if (roomIndex === undefined || roomIndex === -1) {
        throw new AppError(404, 'ROOM_NOT_FOUND', 'Room not found');
      }

      museum.rooms!.splice(roomIndex, 1);
      await museum.save();

      res.json({
        success: true,
        message: 'Room deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  // ========================================
  // MARKER MANAGEMENT
  // ========================================

  // Get all markers for a floor
  static async getMarkers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id, floorId } = req.params;

      const museum = await MuseumModel.findById(id);
      if (!museum) {
        throw new AppError(404, 'MUSEUM_NOT_FOUND', 'Museum not found');
      }

      const floor = museum.floors?.find((f) => f.id === floorId);
      if (!floor) {
        throw new AppError(404, 'FLOOR_NOT_FOUND', 'Floor not found');
      }

      res.json({
        success: true,
        data: floor.markers || [],
      });
    } catch (error) {
      next(error);
    }
  }

  // Add a marker to a floor
  static async addMarker(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Validation failed', errors.array());
      }

      const { id, floorId } = req.params;
      const markerData: MapMarker = {
        ...req.body,
        floorId,
        isVisible: req.body.isVisible !== false,
      };

      const museum = await MuseumModel.findById(id);
      if (!museum) {
        throw new AppError(404, 'MUSEUM_NOT_FOUND', 'Museum not found');
      }

      const floorIndex = museum.floors?.findIndex((f) => f.id === floorId);
      if (floorIndex === undefined || floorIndex === -1) {
        throw new AppError(404, 'FLOOR_NOT_FOUND', 'Floor not found');
      }

      // Check if marker ID already exists on this floor
      if (museum.floors![floorIndex].markers?.some((m) => m.id === markerData.id)) {
        throw new AppError(400, 'MARKER_EXISTS', 'A marker with this ID already exists');
      }

      if (!museum.floors![floorIndex].markers) {
        museum.floors![floorIndex].markers = [];
      }

      museum.floors![floorIndex].markers!.push(markerData);
      await museum.save();

      res.status(201).json({
        success: true,
        data: markerData,
        message: 'Marker added successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  // Update a marker
  static async updateMarker(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id, floorId, markerId } = req.params;

      const museum = await MuseumModel.findById(id);
      if (!museum) {
        throw new AppError(404, 'MUSEUM_NOT_FOUND', 'Museum not found');
      }

      const floorIndex = museum.floors?.findIndex((f) => f.id === floorId);
      if (floorIndex === undefined || floorIndex === -1) {
        throw new AppError(404, 'FLOOR_NOT_FOUND', 'Floor not found');
      }

      const markerIndex = museum.floors![floorIndex].markers?.findIndex((m) => m.id === markerId);
      if (markerIndex === undefined || markerIndex === -1) {
        throw new AppError(404, 'MARKER_NOT_FOUND', 'Marker not found');
      }

      museum.floors![floorIndex].markers![markerIndex] = {
        ...museum.floors![floorIndex].markers![markerIndex],
        ...req.body,
        id: markerId, // Prevent ID change
        floorId, // Ensure floor ID stays correct
      };

      await museum.save();

      res.json({
        success: true,
        data: museum.floors![floorIndex].markers![markerIndex],
        message: 'Marker updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  // Delete a marker
  static async deleteMarker(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id, floorId, markerId } = req.params;

      const museum = await MuseumModel.findById(id);
      if (!museum) {
        throw new AppError(404, 'MUSEUM_NOT_FOUND', 'Museum not found');
      }

      const floorIndex = museum.floors?.findIndex((f) => f.id === floorId);
      if (floorIndex === undefined || floorIndex === -1) {
        throw new AppError(404, 'FLOOR_NOT_FOUND', 'Floor not found');
      }

      const markerIndex = museum.floors![floorIndex].markers?.findIndex((m) => m.id === markerId);
      if (markerIndex === undefined || markerIndex === -1) {
        throw new AppError(404, 'MARKER_NOT_FOUND', 'Marker not found');
      }

      museum.floors![floorIndex].markers!.splice(markerIndex, 1);
      await museum.save();

      res.json({
        success: true,
        message: 'Marker deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  // Bulk update markers (for drag & drop repositioning)
  static async updateMarkers(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id, floorId } = req.params;
      const { markers } = req.body;

      if (!Array.isArray(markers)) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Markers must be an array');
      }

      const museum = await MuseumModel.findById(id);
      if (!museum) {
        throw new AppError(404, 'MUSEUM_NOT_FOUND', 'Museum not found');
      }

      const floorIndex = museum.floors?.findIndex((f) => f.id === floorId);
      if (floorIndex === undefined || floorIndex === -1) {
        throw new AppError(404, 'FLOOR_NOT_FOUND', 'Floor not found');
      }

      // Replace all markers with the new array
      museum.floors![floorIndex].markers = markers.map(
        (m: Partial<MapMarker>) =>
          ({
            ...m,
            floorId,
          }) as MapMarker,
      );

      await museum.save();

      res.json({
        success: true,
        data: museum.floors![floorIndex].markers,
        message: 'Markers updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  // ========================================
  // CONNECTION MANAGEMENT
  // ========================================

  // Add a connection between floors
  static async addConnection(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Validation failed', errors.array());
      }

      const { id, floorId } = req.params;
      const connectionData: FloorConnection = {
        ...req.body,
        isAccessible: req.body.isAccessible || false,
      };

      const museum = await MuseumModel.findById(id);
      if (!museum) {
        throw new AppError(404, 'MUSEUM_NOT_FOUND', 'Museum not found');
      }

      const floorIndex = museum.floors?.findIndex((f) => f.id === floorId);
      if (floorIndex === undefined || floorIndex === -1) {
        throw new AppError(404, 'FLOOR_NOT_FOUND', 'Floor not found');
      }

      // Check target floor exists
      if (!museum.floors?.some((f) => f.id === connectionData.targetFloorId)) {
        throw new AppError(400, 'TARGET_FLOOR_NOT_FOUND', 'Target floor not found');
      }

      if (!museum.floors![floorIndex].connections) {
        museum.floors![floorIndex].connections = [];
      }

      museum.floors![floorIndex].connections!.push(connectionData);
      await museum.save();

      res.status(201).json({
        success: true,
        data: connectionData,
        message: 'Connection added successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  // Delete a connection
  static async deleteConnection(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { id, floorId, connectionId } = req.params;

      const museum = await MuseumModel.findById(id);
      if (!museum) {
        throw new AppError(404, 'MUSEUM_NOT_FOUND', 'Museum not found');
      }

      const floorIndex = museum.floors?.findIndex((f) => f.id === floorId);
      if (floorIndex === undefined || floorIndex === -1) {
        throw new AppError(404, 'FLOOR_NOT_FOUND', 'Floor not found');
      }

      const connectionIndex = museum.floors![floorIndex].connections?.findIndex(
        (c) => c.id === connectionId,
      );
      if (connectionIndex === undefined || connectionIndex === -1) {
        throw new AppError(404, 'CONNECTION_NOT_FOUND', 'Connection not found');
      }

      museum.floors![floorIndex].connections!.splice(connectionIndex, 1);
      await museum.save();

      res.json({
        success: true,
        message: 'Connection deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  // ========================================
  // CURATOR MANAGEMENT
  // ========================================

  // Get curators for a museum
  static async getCurators(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { User } = await import('../models/index.js');
      const { ResourceType, ContextualRole } = await import('@artaround/shared');

      // Verify museum exists
      const museum = await MuseumModel.findById(id);
      if (!museum) {
        throw new AppError(404, 'MUSEUM_NOT_FOUND', 'Museum not found');
      }

      // Find users who have MANAGER role on this museum
      const curators = await User.find({
        roleAssignments: {
          $elemMatch: {
            resourceType: ResourceType.MUSEUM,
            resourceId: id,
            role: ContextualRole.MANAGER,
          },
        },
      }).select('-password');

      res.json({
        success: true,
        data: curators,
      });
    } catch (error) {
      next(error);
    }
  }

  // Add a curator to a museum
  static async addCurator(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { userId } = req.body;
      const { User } = await import('../models/index.js');
      const { ResourceType, ContextualRole } = await import('@artaround/shared');

      if (!userId) {
        throw new AppError(400, 'VALIDATION_ERROR', 'User ID is required');
      }

      // Verify museum exists
      const museum = await MuseumModel.findById(id);
      if (!museum) {
        throw new AppError(404, 'MUSEUM_NOT_FOUND', 'Museum not found');
      }

      // Verify user exists
      const user = await User.findById(userId);
      if (!user) {
        throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
      }

      // Check if already a curator
      const isAlreadyCurator = user.roleAssignments?.some(
        (assignment: RoleAssignment) =>
          assignment.resourceType === ResourceType.MUSEUM &&
          assignment.resourceId === id &&
          assignment.role === ContextualRole.MANAGER,
      );

      if (isAlreadyCurator) {
        throw new AppError(400, 'ALREADY_CURATOR', 'User is already a curator of this museum');
      }

      // Add role assignment
      if (!user.roleAssignments) {
        user.roleAssignments = [];
      }

      user.roleAssignments.push({
        role: ContextualRole.MANAGER,
        resourceType: ResourceType.MUSEUM,
        resourceId: id as string,
        assignedAt: new Date(),
        assignedBy: req.user!.id,
      });

      await user.save();

      res.status(201).json({
        success: true,
        message: `User ${user.username} added as curator of ${museum.name}`,
        data: {
          userId: user._id,
          username: user.username,
          email: user.email,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // Remove a curator from a museum
  static async removeCurator(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id, userId } = req.params;
      const { User } = await import('../models/index.js');
      const { ResourceType, ContextualRole } = await import('@artaround/shared');

      // Verify museum exists
      const museum = await MuseumModel.findById(id);
      if (!museum) {
        throw new AppError(404, 'MUSEUM_NOT_FOUND', 'Museum not found');
      }

      // Verify user exists
      const user = await User.findById(userId);
      if (!user) {
        throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
      }

      // Find and remove the role assignment
      const assignmentIndex = user.roleAssignments?.findIndex(
        (assignment: RoleAssignment) =>
          assignment.resourceType === ResourceType.MUSEUM &&
          assignment.resourceId === id &&
          assignment.role === ContextualRole.MANAGER,
      );

      if (assignmentIndex === undefined || assignmentIndex === -1) {
        throw new AppError(400, 'NOT_A_CURATOR', 'User is not a curator of this museum');
      }

      user.roleAssignments!.splice(assignmentIndex, 1);
      await user.save();

      res.json({
        success: true,
        message: `User ${user.username} removed as curator of ${museum.name}`,
      });
    } catch (error) {
      next(error);
    }
  }
}
