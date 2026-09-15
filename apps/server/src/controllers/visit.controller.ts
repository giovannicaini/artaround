/*
 * File: /src/controllers/visit.controller.ts                                            *
 * Project: @artaround/server                                                            *
 * Last Modified: 14/09/2026                                                             *
 * Author: Giovanni Caini (giovanni.caini@studio.unibo.it)                               *
 * -----                                                                                 *
 * MIT License                                                                           *
 *                                                                                       *
 * Copyright (c) 2026 Giovanni Caini                                                     *
 *                                                                                       *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of       *
 * this software and associated documentation files (the "Software"), to deal in         *
 * the Software without restriction, including without limitation the rights to          *
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies         *
 * of the Software, and to permit persons to whom the Software is furnished to do        *
 * so, subject to the following conditions:                                              *
 *                                                                                       *
 * The above copyright notice and this permission notice shall be included in all        *
 * copies or substantial portions of the Software.                                       *
 *                                                                                       *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR            *
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,              *
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE           *
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER                *
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,         *
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE         *
 * SOFTWARE.                                                                             *
 * ************************************************************************************* *
 */

/**
 * CRUD delle visite guidate: tappe, pubblicazione, sincronizzazione lingue e generazione audio per una singola visita.
 */
import { Request, Response } from 'express';
import { asyncHandler } from '../utils/async-handler.util.js';
import { body, validationResult } from 'express-validator';
import { VisitModel, MuseumModel, VisitPurchase } from '../models/index.js';
import { AppError } from '../middleware/index.js';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { buildMuseumIdFilterValue, findMuseumByAnyId } from '../utils/museum-id.util.js';
import { parsePagination, buildPaginationMeta } from '../utils/pagination.util.js';
import { assertCan } from '../utils/policy.util.js';
import { mapToRecord } from '../utils/mongoose-map.util.js';
import { deleteGeneratedAudioFile } from '../utils/audio-generation.service.js';
import { applyCoverImageFallback } from '../utils/visit-cover-image.util.js';
import { attachAuthorNames } from '../utils/author-name.util.js';
import { MuseumController } from './museum.controller.js';
import * as jobsService from '../utils/jobs.service.js';
import {
  VisitStepType,
  LanguageLevel,
  DEFAULT_APP_LANGUAGE,
  SUPPORTED_APP_LANGUAGES,
  isSupportedAppLanguage,
  type AppLanguage,
  type GeneratedAudio,
} from '@artaround/shared';

// Controller Visite
//
// Gestisce le visite - sequenze ordinate di opere con item per ogni tappa

export class VisitController {
  // Lingue attive del museo, usate per capire quali traduzioni servono a una visita
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

  // Blocca il salvataggio se titolo/descrizione non sono tradotti in tutte le lingue attive
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
          `Traduzioni mancanti per la visita per la lingua '${lang}'`,
        );
      }
    }
  }

  // Regole di validazione per la creazione (usate da POST /api/visits)
  static createValidation = [
    body('museumId').notEmpty().withMessage("L'ID museo (Wikidata) è obbligatorio"),
    body('title').trim().notEmpty().withMessage('Il titolo è obbligatorio'),
    body('description').trim().notEmpty().withMessage('La descrizione è obbligatoria'),
    body('titleTranslations')
      .optional()
      .isObject()
      .withMessage('titleTranslations deve essere un oggetto'),
    body('descriptionTranslations')
      .optional()
      .isObject()
      .withMessage('descriptionTranslations deve essere un oggetto'),
    body('metadata.language')
      .optional()
      .isIn(SUPPORTED_APP_LANGUAGES)
      .withMessage(`metadata.language deve essere una tra: ${SUPPORTED_APP_LANGUAGES.join(', ')}`),
    body('steps').isArray({ min: 1 }).withMessage('È richiesta almeno una tappa'),
    body('steps.*.order').isNumeric().withMessage("L'ordine della tappa è obbligatorio"),
    body('steps.*.type').isIn(Object.values(VisitStepType)).withMessage('Tipo di tappa non valido'),
    body('steps.*.artworkId')
      .if(body('steps.*.type').equals('artwork'))
      .notEmpty()
      .withMessage("L'ID opera è obbligatorio per le tappe di tipo opera"),
    body('steps.*.contentReferenceType')
      .if(body('steps.*.type').equals('content'))
      .isIn(['author', 'movement', 'period', 'museum'])
      .withMessage('Il tipo di riferimento è obbligatorio per le tappe di approfondimento'),
    body('targetAudience').notEmpty().withMessage('Il target audience è obbligatorio'),
    body('targetAudience.languageLevels')
      .isArray({ min: 1 })
      .withMessage('È richiesto almeno un livello linguistico'),
    body('targetAudience.languageLevels.*')
      .isIn(Object.values(LanguageLevel))
      .withMessage(
        `Livello linguistico non valido. Valori ammessi: ${Object.values(LanguageLevel).join(', ')}`,
      ),
  ];

  // Regole di validazione per l'aggiornamento (usate da PUT /api/visits/:id):
  // stessi campi della creazione, ma tutti opzionali visto che è un update parziale
  static updateValidation = [
    body('title').optional().trim().notEmpty().withMessage('Il titolo è obbligatorio'),
    body('description').optional().trim().notEmpty().withMessage('La descrizione è obbligatoria'),
    body('titleTranslations')
      .optional()
      .isObject()
      .withMessage('titleTranslations deve essere un oggetto'),
    body('descriptionTranslations')
      .optional()
      .isObject()
      .withMessage('descriptionTranslations deve essere un oggetto'),
    body('steps').optional().isArray({ min: 1 }).withMessage('È richiesta almeno una tappa'),
    body('steps.*.order').optional().isNumeric().withMessage("L'ordine della tappa è obbligatorio"),
    body('steps.*.type')
      .optional()
      .isIn(Object.values(VisitStepType))
      .withMessage('Tipo di tappa non valido'),
    body('targetAudience.languageLevels')
      .optional()
      .isArray({ min: 1 })
      .withMessage('È richiesto almeno un livello linguistico'),
    body('targetAudience.languageLevels.*')
      .optional()
      .isIn(Object.values(LanguageLevel))
      .withMessage(
        `Livello linguistico non valido. Valori ammessi: ${Object.values(LanguageLevel).join(', ')}`,
      ),
  ];

  // GET /api/visits — lista visite con filtri (museo, autore, lingua...) e paginazione
  static getAll = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { museumId, authorId, isPublished, isFree, languageLevel } = req.query;

    const filter: Record<string, unknown> = {};
    const museumIdFilter = await buildMuseumIdFilterValue(museumId as string | undefined);
    if (museumIdFilter !== undefined) filter.museumId = museumIdFilter;
    if (authorId) filter.authorId = authorId;
    if (isPublished !== undefined) filter.isPublished = isPublished === 'true';
    if (isFree !== undefined) filter['metadata.isFree'] = isFree === 'true';
    if (languageLevel) filter['targetAudience.languageLevels'] = languageLevel;

    const { page, limit, skip } = parsePagination(req.query, 20);

    const [visits, total] = await Promise.all([
      VisitModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      VisitModel.countDocuments(filter),
    ]);
    await attachAuthorNames(visits);

    res.json({
      success: true,
      data: await applyCoverImageFallback(visits),
      pagination: buildPaginationMeta(total, page, limit),
    });
  });

  // GET /api/visits/:id — dettaglio di una singola visita. Pubblica ma
  // consapevole di chi chiama (optionalAuthMiddleware): una bozza è visibile
  // solo a chi potrebbe modificarla, una visita a pagamento non ancora
  // acquistata non restituisce le tappe.
  static getById = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const { id } = req.params;

    const visit = await VisitModel.findById(id).lean();

    if (!visit) {
      throw new AppError(404, 'VISIT_NOT_FOUND', 'Visita non trovata');
    }
    await attachAuthorNames([visit]);

    if (!visit.isPublished) {
      try {
        await assertCan(
          req.user,
          'manage',
          'visit',
          { museumId: visit.museumId, authorId: visit.authorId },
          'Visita non trovata',
        );
      } catch {
        // Una bozza altrui non deve risultare distinguibile da "non esiste".
        throw new AppError(404, 'VISIT_NOT_FOUND', 'Visita non trovata');
      }
    }

    const isOwner = req.user?.id === visit.authorId;
    if (!isOwner && !visit.metadata.isFree) {
      const owns = req.user
        ? await VisitPurchase.exists({ userId: req.user.id, visitId: id })
        : false;
      if (!owns) {
        res.status(403).json({
          success: false,
          error: { code: 'PURCHASE_REQUIRED', message: 'Visita a pagamento non acquistata' },
          data: {
            title: visit.title,
            coverImage: visit.coverImage,
            price: visit.metadata.price,
          },
        });
        return;
      }
    }

    res.json({
      success: true,
      data: visit,
    });
  });

  // GET /api/visits/museum/:museumId — visite di un museo (accetta ID Wikidata)
  static getByMuseum = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { museumId } = req.params;
    const { isPublished } = req.query;

    const museumIdFilter = await buildMuseumIdFilterValue(museumId);
    const filter: Record<string, unknown> = { museumId: museumIdFilter ?? museumId };
    if (isPublished !== undefined) filter.isPublished = isPublished === 'true';

    const visits = await VisitModel.find(filter).sort({ createdAt: -1 }).lean();

    res.json({
      success: true,
      data: await applyCoverImageFallback(visits),
    });
  });

  // GET /api/visits/my-visits — visite create dall'utente autenticato
  static getMyVisits = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Autenticazione richiesta');
    }

    const visits = await VisitModel.find({ authorId: req.user.id }).sort({ createdAt: -1 }).lean();
    await attachAuthorNames(visits);

    res.json({
      success: true,
      data: await applyCoverImageFallback(visits),
    });
  });

  // POST /api/visits — crea la visita, ordina le tappe e verifica la copertura traduzioni
  static create = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Validazione fallita', errors.array());
    }

    if (!req.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Autenticazione richiesta');
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
        `metadata.language deve essere una tra: ${SUPPORTED_APP_LANGUAGES.join(', ')}`,
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
      message: 'Visita creata con successo',
    });
  });

  // PUT /api/visits/:id — aggiorna la visita (owner, admin o curatore)
  static update = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Validazione fallita', errors.array());
    }

    const { id } = req.params;

    if (!req.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Autenticazione richiesta');
    }

    const visit = await VisitModel.findById(id);
    if (!visit) {
      throw new AppError(404, 'VISIT_NOT_FOUND', 'Visita non trovata');
    }

    // Proprietario (ovunque), o curatore del museo a cui appartiene la visita.
    await assertCan(
      req.user,
      'manage',
      'visit',
      { museumId: visit.museumId, authorId: visit.authorId },
      'Puoi aggiornare solo le tue visite o quelle dei musei che curi',
    );

    // Per invalidare l'audio generato delle tappe il cui testo sta per
    // cambiare (o che stanno per sparire): serve lo stato prima che
    // Object.assign lo sovrascriva.
    const oldStepsById = new Map(
      visit.steps.map((step) => [step.id, JSON.parse(JSON.stringify(step))]),
    );

    // Ordina le tappe per order se fornito
    if (req.body.steps) {
      req.body.steps = req.body.steps.sort(
        (a: { order: number }, b: { order: number }) => a.order - b.order,
      );
    }

    Object.assign(visit, req.body);

    if (req.body.steps) {
      const newStepIds = new Set(visit.steps.map((step) => step.id));
      const sourceLang = (visit.metadata?.language || DEFAULT_APP_LANGUAGE) as AppLanguage;

      // Tappe rimosse in questo salvataggio: il loro audio (se generato) resta
      // orfano sul disco, va eliminato — non solo tolto dal documento.
      for (const [stepId, oldStep] of oldStepsById) {
        if (newStepIds.has(stepId)) continue;
        const orphanedAudio = [
          ...Object.values(mapToRecord<GeneratedAudio>(oldStep.logisticTextAudio)),
          ...Object.values(mapToRecord<GeneratedAudio>(oldStep.navigationTextAudio)),
        ];
        for (const audio of orphanedAudio) {
          await deleteGeneratedAudioFile(audio);
        }
      }

      const fieldPairs = [
        ['logisticText', 'logisticTextAudio', 'logisticTextTranslations'],
        ['navigationText', 'navigationTextAudio', 'navigationTextTranslations'],
      ] as const;

      for (const step of visit.steps) {
        const oldStep = oldStepsById.get(step.id);
        if (!oldStep) continue; // tappa nuova, nessun audio da invalidare

        for (const [textField, audioField, translationsField] of fieldPairs) {
          const audio = mapToRecord<GeneratedAudio>(step[audioField]);
          if (Object.keys(audio).length === 0) continue;
          let audioChanged = false;

          if (step[textField] !== oldStep[textField] && audio[sourceLang]) {
            await deleteGeneratedAudioFile(audio[sourceLang]);
            delete audio[sourceLang];
            audioChanged = true;
          }

          const oldTranslations = mapToRecord(oldStep[translationsField]);
          const newTranslations = mapToRecord(step[translationsField]);
          for (const lang of Object.keys(audio)) {
            if (lang === sourceLang) continue;
            if (newTranslations[lang] !== oldTranslations[lang]) {
              await deleteGeneratedAudioFile(audio[lang]);
              delete audio[lang];
              audioChanged = true;
            }
          }

          if (audioChanged) step[audioField] = audio;
        }
      }

      visit.markModified('steps');
    }

    await visit.save();

    res.json({
      success: true,
      data: visit,
      message: 'Visita aggiornata con successo',
    });
  });

  // POST /api/visits/:id/publish — pubblica la visita (richiede almeno una tappa artwork)
  static publish = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const { id } = req.params;

    if (!req.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Autenticazione richiesta');
    }

    const visit = await VisitModel.findById(id);
    if (!visit) {
      throw new AppError(404, 'VISIT_NOT_FOUND', 'Visita non trovata');
    }

    // Proprietario, o curatore del museo a cui appartiene la visita (stesso criterio di update/delete).
    await assertCan(
      req.user,
      'manage',
      'visit',
      { museumId: visit.museumId, authorId: visit.authorId },
      'Puoi pubblicare solo le tue visite o quelle dei musei che curi',
    );

    // Valida che la visita abbia il contenuto richiesto
    if (!visit.steps || visit.steps.length === 0) {
      throw new AppError(400, 'VALIDATION_ERROR', 'La visita deve avere almeno una tappa');
    }

    const artworkSteps = visit.steps.filter((s) => s.type === 'artwork');
    if (artworkSteps.length === 0) {
      throw new AppError(400, 'VALIDATION_ERROR', 'La visita deve avere almeno una tappa opera');
    }

    visit.isPublished = true;
    visit.publishedAt = new Date();
    await visit.save();

    res.json({
      success: true,
      data: visit,
      message: 'Visita pubblicata con successo',
    });
  });

  // POST /api/visits/:id/unpublish — riporta la visita in bozza
  static unpublish = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const { id } = req.params;

    if (!req.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Autenticazione richiesta');
    }

    const visit = await VisitModel.findById(id);
    if (!visit) {
      throw new AppError(404, 'VISIT_NOT_FOUND', 'Visita non trovata');
    }

    // Proprietario, o curatore del museo a cui appartiene la visita (stesso criterio di update/delete).
    await assertCan(
      req.user,
      'manage',
      'visit',
      { museumId: visit.museumId, authorId: visit.authorId },
      'Puoi rimuovere la pubblicazione solo dalle tue visite o da quelle dei musei che curi',
    );

    visit.isPublished = false;
    await visit.save();

    res.json({
      success: true,
      data: visit,
      message: 'Pubblicazione visita rimossa con successo',
    });
  });

  // DELETE /api/visits/:id — elimina la visita (owner, admin o curatore)
  static delete = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const { id } = req.params;

    if (!req.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Autenticazione richiesta');
    }

    const visit = await VisitModel.findById(id);
    if (!visit) {
      throw new AppError(404, 'VISIT_NOT_FOUND', 'Visita non trovata');
    }

    // Stesso criterio dell'update.
    await assertCan(
      req.user,
      'manage',
      'visit',
      { museumId: visit.museumId, authorId: visit.authorId },
      'Puoi eliminare solo le tue visite o quelle dei musei che curi',
    );

    await visit.deleteOne();

    res.json({
      success: true,
      message: 'Visita eliminata con successo',
    });
  });

  // POST /api/visits/:id/generate-audio — come MuseumController.generateAudio
  // ma limitato a questa sola visita (i suoi step e i soli item che referenzia)
  // invece che all'intero catalogo del museo: stesso job "generate-audio",
  // stessa esclusione reciproca globale (un solo job di questo tipo alla
  // volta, ovunque — vedi jobsService.startJob), risponde subito con l'id
  // del job da seguire (GET /api/jobs).
  static generateAudio = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const { id } = req.params;

    if (!req.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Autenticazione richiesta');
    }

    const visit = await VisitModel.findById(id);
    if (!visit) {
      throw new AppError(404, 'VISIT_NOT_FOUND', 'Visita non trovata');
    }

    // Stesso livello di permesso del bottone a livello di museo: gestire
    // l'audio generato (costa, tocca lo stesso account OpenAI di tutti i
    // musei) resta riservato al curatore del museo, non a un autore qualsiasi
    // della visita.
    const museum = await findMuseumByAnyId(visit.museumId);
    if (!museum) {
      throw new AppError(404, 'MUSEUM_NOT_FOUND', 'Museo della visita non trovato');
    }
    await assertCan(
      req.user,
      'manage',
      'museum',
      { museumId: String(museum._id) },
      "Solo il curatore del museo può generare l'audio di questa visita",
    );

    const job = await jobsService.startJob({
      type: 'generate-audio',
      museumId: String(museum._id),
      visitId: String(visit._id),
      startedBy: req.user.id,
    });

    void MuseumController.runAudioGenerationJob(
      String(job._id),
      String(museum._id),
      museum.activeLanguages,
      String(visit._id),
    );

    res.status(202).json({
      success: true,
      data: { jobId: job._id, museumId: String(museum._id), visitId: String(visit._id) },
      message: "Generazione audio avviata: segui l'avanzamento dalle notifiche",
    });
  });

  // POST /api/visits/:id/sync-languages — come MuseumController.syncLanguages
  // ma limitato a questa sola visita (lei stessa + i soli item che
  // referenzia) invece che all'intero catalogo del museo: usa le lingue
  // attive già impostate sul museo (non le cambia, a differenza della
  // versione a livello museo — qui non ha senso chiedere di nuovo le lingue
  // attive per una singola visita). Stesso job "sync-languages", stessa
  // esclusione reciproca globale, risponde subito con l'id del job.
  static syncLanguages = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const { id } = req.params;

    if (!req.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Autenticazione richiesta');
    }

    const visit = await VisitModel.findById(id);
    if (!visit) {
      throw new AppError(404, 'VISIT_NOT_FOUND', 'Visita non trovata');
    }

    const museum = await findMuseumByAnyId(visit.museumId);
    if (!museum) {
      throw new AppError(404, 'MUSEUM_NOT_FOUND', 'Museo della visita non trovato');
    }
    await assertCan(
      req.user,
      'manage',
      'museum',
      { museumId: String(museum._id) },
      'Solo il curatore del museo può sincronizzare le traduzioni di questa visita',
    );

    const job = await jobsService.startJob({
      type: 'sync-languages',
      museumId: String(museum._id),
      visitId: String(visit._id),
      startedBy: req.user.id,
    });

    void MuseumController.runTranslationSyncJob(
      String(job._id),
      String(museum._id),
      museum.activeLanguages,
      String(visit._id),
    );

    res.status(202).json({
      success: true,
      data: { jobId: job._id, museumId: String(museum._id), visitId: String(visit._id) },
      message: "Sincronizzazione lingue avviata: segui l'avanzamento dalle notifiche",
    });
  });
}
