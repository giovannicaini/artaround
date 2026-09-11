import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { asyncHandler } from '../utils/async-handler.util.js';
import { NavigatorConfigModel, MuseumModel } from '../models/index.js';
import { AppError } from '../middleware/index.js';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { assertCan, getCuratedMuseumIds } from '../utils/policy.util.js';
import { DEFAULT_NAVIGATOR_CONFIG, type NavigatorConfig } from '@artaround/shared';

/**
 * Configurazioni Navigator: una 'global' (al massimo una, per tutto
 * l'ecosistema) o 'museum' (una o più per museo, raggiungibili via QR/link
 * per slug — vedi resolve). Le globali sono solo admin, quelle di museo
 * anche del curatore di quel museo (policy.util.ts, subject 'navigatorConfig').
 */
export class NavigatorConfigController {
  private static readonly HEX_COLOR_REGEX = /^#(?:[0-9a-fA-F]{3}){1,2}$/;
  private static readonly SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

  // Valida branding/content/pwa — struttura annidata, poco adatta alle catene
  // express-validator: stessa scelta già fatta per questa forma di dati in
  // museum.controller.ts/utils.controller.ts (che questa classe sostituisce).
  private static validatePayload(body: Record<string, unknown>): void {
    const name = String(body.name || '').trim();
    const slug = String(body.slug || '').trim();
    const applicability = body.applicability;
    const branding = (body.branding || {}) as Record<string, unknown>;
    const pwa = (body.pwa || {}) as Record<string, unknown>;

    if (!name) throw new AppError(400, 'VALIDATION_ERROR', 'Il nome è obbligatorio');
    if (!slug || !NavigatorConfigController.SLUG_REGEX.test(slug)) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Slug obbligatorio, in kebab-case minuscolo');
    }
    if (applicability !== 'global' && applicability !== 'museum') {
      throw new AppError(400, 'VALIDATION_ERROR', "applicability deve essere 'global' o 'museum'");
    }
    if (applicability === 'museum' && !mongoose.Types.ObjectId.isValid(String(body.museumId))) {
      throw new AppError(400, 'VALIDATION_ERROR', 'museumId non valido per una config di museo');
    }

    const manifestName = String(pwa.manifestName || '').trim();
    const shortName = String(pwa.shortName || '').trim();
    if (!manifestName || !shortName) {
      throw new AppError(400, 'VALIDATION_ERROR', 'pwa.manifestName e pwa.shortName obbligatori');
    }

    const colors = [
      { key: 'branding.primaryColor', value: String(branding.primaryColor || ''), required: true },
      { key: 'branding.secondaryColor', value: String(branding.secondaryColor || '') },
      { key: 'branding.backgroundColor', value: String(branding.backgroundColor || '') },
      { key: 'pwa.themeColor', value: String(pwa.themeColor || ''), required: true },
      { key: 'pwa.backgroundColor', value: String(pwa.backgroundColor || ''), required: true },
    ];
    for (const color of colors) {
      if (!color.value) {
        if (color.required) {
          throw new AppError(400, 'VALIDATION_ERROR', `${color.key} è obbligatorio`);
        }
        continue;
      }
      if (!NavigatorConfigController.HEX_COLOR_REGEX.test(color.value)) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          `${color.key} deve essere un colore HEX valido`,
        );
      }
    }
  }

  // GET /api/navigator-configs — admin: tutte; curatore: solo le config dei propri musei
  static list = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    if (!req.user) throw new AppError(401, 'UNAUTHORIZED', 'Autenticazione richiesta');

    const filter = req.user.isAdmin
      ? {}
      : { applicability: 'museum', museumId: { $in: await getCuratedMuseumIds(req.user.id) } };

    const configs = await NavigatorConfigModel.find(filter).sort({ createdAt: 1 }).lean();
    res.json({ success: true, data: configs });
  });

  // POST /api/navigator-configs
  static create = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    if (!req.user) throw new AppError(401, 'UNAUTHORIZED', 'Autenticazione richiesta');
    NavigatorConfigController.validatePayload(req.body);

    const { applicability, museumId } = req.body as {
      applicability: 'global' | 'museum';
      museumId?: string;
    };

    await assertCan(
      req.user,
      'manage',
      'navigatorConfig',
      { museumId: applicability === 'museum' ? museumId : undefined },
      applicability === 'global'
        ? 'Solo un amministratore può creare la configurazione globale'
        : 'Puoi creare configurazioni solo per i musei di cui sei curatore',
    );

    if (applicability === 'museum') {
      const museum = await MuseumModel.exists({ _id: museumId });
      if (!museum) throw new AppError(404, 'MUSEUM_NOT_FOUND', 'Museo non trovato');
    } else {
      const existingGlobal = await NavigatorConfigModel.exists({ applicability: 'global' });
      if (existingGlobal) {
        throw new AppError(409, 'GLOBAL_CONFIG_EXISTS', 'Esiste già una configurazione globale');
      }
    }

    const existingSlug = await NavigatorConfigModel.exists({ slug: req.body.slug });
    if (existingSlug) {
      throw new AppError(409, 'SLUG_TAKEN', `Slug già in uso: ${req.body.slug}`);
    }

    const config = new NavigatorConfigModel({
      name: req.body.name,
      slug: req.body.slug,
      applicability,
      museumId: applicability === 'museum' ? museumId : undefined,
      branding: req.body.branding,
      content: req.body.content,
      pwa: req.body.pwa,
    });
    await config.save();

    res
      .status(201)
      .json({ success: true, data: config, message: 'Configurazione creata con successo' });
  });

  // PUT /api/navigator-configs/:id — applicability e museumId non sono modificabili
  // (per cambiare scope si cancella e ricrea, evita casi limite sui permessi)
  static update = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    if (!req.user) throw new AppError(401, 'UNAUTHORIZED', 'Autenticazione richiesta');

    const config = await NavigatorConfigModel.findById(req.params.id);
    if (!config)
      throw new AppError(404, 'NAVIGATOR_CONFIG_NOT_FOUND', 'Configurazione non trovata');

    await assertCan(
      req.user,
      'manage',
      'navigatorConfig',
      { museumId: config.applicability === 'museum' ? config.museumId : undefined },
      'Non hai i permessi per modificare questa configurazione',
    );

    NavigatorConfigController.validatePayload({
      ...req.body,
      applicability: config.applicability,
      museumId: config.museumId,
    });

    if (req.body.slug !== config.slug) {
      const existingSlug = await NavigatorConfigModel.exists({ slug: req.body.slug });
      if (existingSlug) {
        throw new AppError(409, 'SLUG_TAKEN', `Slug già in uso: ${req.body.slug}`);
      }
    }

    config.name = req.body.name;
    config.slug = req.body.slug;
    config.branding = req.body.branding;
    config.content = req.body.content;
    config.pwa = req.body.pwa;
    await config.save();

    res.json({ success: true, data: config, message: 'Configurazione aggiornata con successo' });
  });

  // DELETE /api/navigator-configs/:id
  static delete = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    if (!req.user) throw new AppError(401, 'UNAUTHORIZED', 'Autenticazione richiesta');

    const config = await NavigatorConfigModel.findById(req.params.id);
    if (!config)
      throw new AppError(404, 'NAVIGATOR_CONFIG_NOT_FOUND', 'Configurazione non trovata');

    await assertCan(
      req.user,
      'manage',
      'navigatorConfig',
      { museumId: config.applicability === 'museum' ? config.museumId : undefined },
      'Non hai i permessi per eliminare questa configurazione',
    );

    await config.deleteOne();
    res.json({ success: true, message: 'Configurazione eliminata con successo' });
  });

  /**
   * Risolve quale config applicare, in ordine di specificità:
   * 1. slug richiesto esplicitamente (link/QR) — se compatibile col museumId
   *    dato (globale, o il suo museumId coincide, o non è stato richiesto
   *    nessun museumId).
   * 2. museumId dato — la prima config di quel museo (ordine di creazione).
   * 3. la config globale, o il fallback hardcoded se non esiste ancora.
   */
  private static async resolveConfig(
    museumId: string | undefined,
    slug: string | undefined,
  ): Promise<NavigatorConfig> {
    if (slug) {
      const bySlug = await NavigatorConfigModel.findOne({ slug }).lean();
      if (
        bySlug &&
        (bySlug.applicability === 'global' || !museumId || bySlug.museumId === museumId)
      ) {
        return bySlug as unknown as NavigatorConfig;
      }
    }

    if (museumId) {
      const byMuseum = await NavigatorConfigModel.findOne({ applicability: 'museum', museumId })
        .sort({ createdAt: 1 })
        .lean();
      if (byMuseum) return byMuseum as unknown as NavigatorConfig;
    }

    const global = await NavigatorConfigModel.findOne({ applicability: 'global' }).lean();
    if (global) return global as unknown as NavigatorConfig;

    return { _id: '', createdAt: new Date(0), updatedAt: new Date(0), ...DEFAULT_NAVIGATOR_CONFIG };
  }

  // GET /api/navigator-configs/resolve?museumId=&slug= — pubblico, usato dal Navigator
  static resolve = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const museumId = typeof req.query.museumId === 'string' ? req.query.museumId : undefined;
    const slug = typeof req.query.slug === 'string' ? req.query.slug : undefined;
    const config = await NavigatorConfigController.resolveConfig(museumId, slug);
    res.json({ success: true, data: config });
  });

  // GET /api/navigator-configs/manifest?museumId=&slug= — pubblico, manifest.webmanifest reale servito al Navigator
  static manifest = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const museumId = typeof req.query.museumId === 'string' ? req.query.museumId : undefined;
    const slug = typeof req.query.slug === 'string' ? req.query.slug : undefined;
    const config = await NavigatorConfigController.resolveConfig(museumId, slug);
    const startUrl =
      config.applicability === 'museum' ? `/navigator/?ncfg=${config.slug}` : config.pwa.startUrl;

    res.setHeader('Content-Type', 'application/manifest+json');
    res.json({
      name: config.pwa.manifestName,
      short_name: config.pwa.shortName,
      description: config.pwa.description,
      start_url: startUrl,
      scope: config.pwa.scope,
      display: config.pwa.display,
      orientation: config.pwa.orientation,
      theme_color: config.pwa.themeColor,
      background_color: config.pwa.backgroundColor,
      icons: [
        config.pwa.icon192 && { src: config.pwa.icon192, sizes: '192x192', type: 'image/png' },
        config.pwa.icon512 && { src: config.pwa.icon512, sizes: '512x512', type: 'image/png' },
        config.pwa.iconMaskable && {
          src: config.pwa.iconMaskable,
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable',
        },
      ].filter(Boolean),
    });
  });
}
