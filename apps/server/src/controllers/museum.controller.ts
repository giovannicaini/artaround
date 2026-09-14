import { Request, Response } from 'express';
import { asyncHandler } from '../utils/async-handler.util.js';
import { body, validationResult } from 'express-validator';
import { ItemModel, MuseumModel, VisitModel, MuseumRoleRequestModel } from '../models/index.js';
import { AppError } from '../middleware/index.js';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { TranslationService } from '../utils/translation.service.js';
import { findMuseumByAnyId, buildMuseumIdFilterValue } from '../utils/museum-id.util.js';
import { assertCanApproveRoleRequest } from '../utils/policy.util.js';
import {
  generateAudioForText,
  deleteGeneratedAudioFile,
} from '../utils/audio-generation.service.js';
import { mapToRecord } from '../utils/mongoose-map.util.js';
import * as jobsService from '../utils/jobs.service.js';
import type { JobProgress } from '../models/Job.js';
import {
  notifyMany,
  notify,
  resolveRoleRequestNotifications,
} from '../utils/notifications.service.js';
import {
  MuseumFloor,
  MapMarker,
  FloorConnection,
  MarkerType,
  ConnectionType,
  MuseumRole,
  MUSEUM_SERVICE_TYPES,
  type MuseumRoleAssignment,
  SUPPORTED_APP_LANGUAGES,
  DEFAULT_APP_LANGUAGE,
  type AppLanguage,
  type MuseumRoom,
  type GeneratedAudio,
} from '@artaround/shared';

export class MuseumController {
  // Pulisce/deduplica activeLanguages e verifica che siano lingue supportate
  private static normalizeActiveLanguages(activeLanguages: unknown): AppLanguage[] | undefined {
    if (activeLanguages === undefined) {
      return undefined;
    }

    if (!Array.isArray(activeLanguages)) {
      throw new AppError(400, 'VALIDATION_ERROR', 'activeLanguages deve essere un array');
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
      throw new AppError(400, 'VALIDATION_ERROR', 'activeLanguages non può essere vuoto');
    }

    for (const lang of normalized) {
      if (!SUPPORTED_APP_LANGUAGES.includes(lang as AppLanguage)) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          `Lingua attiva non valida '${lang}'. Ammesse: ${SUPPORTED_APP_LANGUAGES.join(', ')}`,
        );
      }
    }

    return normalized as AppLanguage[];
  }

  // Normalizza location: richiede la nation e allinea il campo legacy "country"
  private static normalizeLocationPayload(rawLocation: unknown): Record<string, unknown> {
    if (!rawLocation || typeof rawLocation !== 'object') {
      throw new AppError(400, 'VALIDATION_ERROR', 'location è obbligatoria');
    }

    const location = { ...(rawLocation as Record<string, unknown>) };
    const nation = String(location.nation || location.country || '')
      .trim()
      .replace(/\s+/g, ' ');

    if (!nation) {
      throw new AppError(400, 'VALIDATION_ERROR', 'La nazione è obbligatoria');
    }

    location.nation = nation;
    location.country = nation;
    delete location.region;

    return location;
  }

  // Regole di validazione per la creazione (usate da POST /api/museums)
  static createValidation = [
    body('name').trim().notEmpty().withMessage('Il nome è obbligatorio'),
    body('description').trim().notEmpty().withMessage('La descrizione è obbligatoria'),
    body('location.address').notEmpty().withMessage("L'indirizzo è obbligatorio"),
    body('location.city').notEmpty().withMessage('La città è obbligatoria'),
    body('location').custom((value) => {
      const nation = value?.nation || value?.country;
      if (!nation || !String(nation).trim()) {
        throw new Error('La nazione è obbligatoria');
      }
      return true;
    }),
  ];

  // Regole di validazione per l'aggiornamento (usate da PUT /api/museums/:id):
  // stessi campi della creazione, ma tutti opzionali visto che è un update parziale.
  // La validazione della nation dentro location resta a carico di normalizeLocationPayload,
  // richiamato dall'handler solo quando location è effettivamente presente nel body.
  static updateValidation = [
    body('name').optional().trim().notEmpty().withMessage('Il nome è obbligatorio'),
    body('description').optional().trim().notEmpty().withMessage('La descrizione è obbligatoria'),
    body('location.address').optional().notEmpty().withMessage("L'indirizzo è obbligatorio"),
    body('location.city').optional().notEmpty().withMessage('La città è obbligatoria'),
    body('services.services.*.type')
      .optional()
      .isIn(MUSEUM_SERVICE_TYPES)
      .withMessage('Tipo di servizio non valido'),
    body('services.services.*.active').optional().isBoolean(),
    body('services.services.*.mapMarkerId').optional({ values: 'falsy' }).isString(),
  ];

  // Validazione per POST /api/museums/:id/floors
  static floorValidation = [
    body('id').trim().notEmpty().withMessage("L'ID piano è obbligatorio"),
    body('name').trim().notEmpty().withMessage('Il nome del piano è obbligatorio'),
    body('level').isNumeric().withMessage('Il livello del piano deve essere un numero'),
    body('svgContent').trim().notEmpty().withMessage('Il contenuto SVG è obbligatorio'),
    body('dimensions.width').isNumeric().withMessage('La larghezza è obbligatoria'),
    body('dimensions.height').isNumeric().withMessage("L'altezza è obbligatoria"),
  ];

  // Validazione per POST /api/museums/:id/floors/:floorId/markers
  static markerValidation = [
    body('id').trim().notEmpty().withMessage("L'ID marker è obbligatorio"),
    body('floorId').trim().notEmpty().withMessage("L'ID piano è obbligatorio"),
    body('x').isNumeric().withMessage('La coordinata X è obbligatoria'),
    body('y').isNumeric().withMessage('La coordinata Y è obbligatoria'),
    body('type').isIn(Object.values(MarkerType)).withMessage('Tipo di marker non valido'),
  ];

  // Validazione per POST /api/museums/:id/floors/:floorId/connections
  static connectionValidation = [
    body('id').trim().notEmpty().withMessage("L'ID collegamento è obbligatorio"),
    body('type').isIn(Object.values(ConnectionType)).withMessage('Tipo di collegamento non valido'),
    body('x').isNumeric().withMessage('La coordinata X è obbligatoria'),
    body('y').isNumeric().withMessage('La coordinata Y è obbligatoria'),
    body('targetFloorId')
      .trim()
      .notEmpty()
      .withMessage("L'ID del piano di destinazione è obbligatorio"),
  ];

  // Validazione per POST /api/museums/:id/sync-languages
  static syncLanguagesValidation = [
    body('activeLanguages').isArray({ min: 1 }).withMessage('activeLanguages è obbligatorio'),
  ];

  // Normalizza una Map Mongoose (o un plain object) in un Record<string, string>

  // Rigenera le traduzioni mancanti degli item del museo (o, se `visitId` è
  // passato, solo degli item davvero usati in QUELLA visita — stessa logica
  // di generateItemAudioForMuseum) e scarta quelle per lingue non più attive
  // (richiamato da runTranslationSyncJob, avviato da syncLanguages, POST
  // /api/museums/:id/sync-languages o /api/visits/:id/sync-languages). Non
  // privato: stesso motivo dei metodi di generazione audio, `jobId` pilota
  // avanzamento/cancellazione.
  static async syncItemTranslationsForMuseum(
    museumId: string,
    activeLanguages: AppLanguage[],
    jobId: string,
    visitId?: string,
  ): Promise<JobProgress> {
    // Item.museumId è salvato come QID Wikidata, non come _id Mongo (che è
    // quello che questo metodo riceve da syncLanguages) — senza risolvere i
    // candidati la query non trova mai nulla, "scanned" resta sempre 0.
    const museumIdFilter = await buildMuseumIdFilterValue(museumId);

    let items;
    if (visitId) {
      const visits = await VisitModel.find({ _id: visitId, museumId: museumIdFilter })
        .select('steps.itemIds')
        .lean();
      const usedItemIds = new Set<string>();
      for (const visit of visits) {
        for (const step of visit.steps || []) {
          for (const itemId of step.itemIds || []) {
            usedItemIds.add(String(itemId));
          }
        }
      }
      items =
        usedItemIds.size === 0
          ? []
          : await ItemModel.find({
              museumId: museumIdFilter,
              _id: { $in: Array.from(usedItemIds) },
            });
    } else {
      items = await ItemModel.find({ museumId: museumIdFilter });
    }

    let updated = 0;
    let generated = 0;
    let removed = 0;
    let failed = 0;

    for (const item of items) {
      if (jobsService.isCancelled(jobId)) break;

      try {
        const sourceLang = (item.sourceLanguage || DEFAULT_APP_LANGUAGE) as AppLanguage;
        const targetLanguages = activeLanguages.filter((lang) => lang !== sourceLang);

        const titleTranslations = mapToRecord(item.translatedTitles);
        const textTranslations = mapToRecord(item.translatedTexts);

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
      } catch (err) {
        failed += 1;
        console.error(`[syncItemTranslationsForMuseum] item ${item._id}:`, err);
      }

      await jobsService.updateProgress(jobId, {
        items: { scanned: items.length, updated, generated, removed, failed },
      });
    }

    return {
      scanned: items.length,
      updated,
      generated,
      removed,
      failed,
    };
  }

  // Stessa logica di syncItemTranslationsForMuseum, ma per le visite del museo
  // (o solo QUELLA visita, se `visitId` è passato). Non privato: stesso
  // motivo, riusato da runTranslationSyncJob.
  static async syncVisitTranslationsForMuseum(
    museumId: string,
    activeLanguages: AppLanguage[],
    jobId: string,
    visitId?: string,
  ): Promise<JobProgress> {
    // Visit.museumId è salvato come QID Wikidata, non come _id Mongo (stesso
    // problema di syncItemTranslationsForMuseum qui sopra).
    const museumIdFilter = await buildMuseumIdFilterValue(museumId);
    const visits = visitId
      ? await VisitModel.find({ _id: visitId, museumId: museumIdFilter })
      : await VisitModel.find({ museumId: museumIdFilter });

    let updated = 0;
    let generated = 0;
    let removed = 0;
    let failed = 0;

    for (const visit of visits) {
      if (jobsService.isCancelled(jobId)) break;

      try {
        const sourceLang = (visit.metadata?.language || DEFAULT_APP_LANGUAGE) as AppLanguage;
        const targetLanguages = activeLanguages.filter((lang) => lang !== sourceLang);

        const titleTranslations = mapToRecord(visit.titleTranslations);
        const descriptionTranslations = mapToRecord(visit.descriptionTranslations);

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

        // Le tappe LOGISTIC/NAVIGATION hanno testo scritto direttamente dal
        // curatore per QUESTA visita (non un Item riusabile) — stesso giro di
        // filtro/traduzione di titolo e descrizione, ma per tappa. Le chiavi
        // del batch sono già distinte da titolo/descrizione della visita, per
        // cui possono viaggiare nella stessa chiamata batchTranslate.
        const stepFieldsByStepId = new Map<
          string,
          Array<{ field: 'logisticTitle' | 'logisticText' | 'navigationText'; source: string }>
        >();
        const filteredStepTranslations: Record<string, Record<string, string>> = {};

        for (const step of visit.steps) {
          const fields: Array<{
            field: 'logisticTitle' | 'logisticText' | 'navigationText';
            source: string;
          }> = [];
          if (step.logisticTitle)
            fields.push({ field: 'logisticTitle', source: step.logisticTitle });
          if (step.logisticText) fields.push({ field: 'logisticText', source: step.logisticText });
          if (step.navigationText)
            fields.push({ field: 'navigationText', source: step.navigationText });
          if (fields.length === 0) continue;
          stepFieldsByStepId.set(step.id, fields);

          for (const { field } of fields) {
            const mapKey = `${step.id}:${field}`;
            const existing = mapToRecord(
              field === 'logisticTitle'
                ? step.logisticTitleTranslations
                : field === 'logisticText'
                  ? step.logisticTextTranslations
                  : step.navigationTextTranslations,
            );
            const filtered: Record<string, string> = {};
            for (const lang of targetLanguages) {
              if (existing[lang]?.trim()) filtered[lang] = existing[lang];
            }
            const removedCount = Object.keys(existing).length - Object.keys(filtered).length;
            if (removedCount > 0) {
              removed += removedCount;
              visitChanged = true;
            }
            filteredStepTranslations[mapKey] = filtered;
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

        for (const [stepId, fields] of stepFieldsByStepId) {
          for (const { field, source } of fields) {
            const mapKey = `${stepId}:${field}`;
            for (const lang of targetLanguages) {
              if (!filteredStepTranslations[mapKey][lang]) {
                batchItems.push({ key: `${lang}:step:${mapKey}`, text: source, targetLang: lang });
              }
            }
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

          for (const [stepId, fields] of stepFieldsByStepId) {
            for (const { field } of fields) {
              const mapKey = `${stepId}:${field}`;
              for (const lang of targetLanguages) {
                const translationKey = `${lang}:step:${mapKey}`;
                if (!filteredStepTranslations[mapKey][lang] && translations[translationKey]) {
                  filteredStepTranslations[mapKey][lang] = translations[translationKey];
                  generated += 1;
                  visitChanged = true;
                }
              }
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
          for (const step of visit.steps) {
            const fields = stepFieldsByStepId.get(step.id);
            if (!fields) continue;
            for (const { field } of fields) {
              const value = filteredStepTranslations[`${step.id}:${field}`];
              if (field === 'logisticTitle') step.logisticTitleTranslations = value;
              else if (field === 'logisticText') step.logisticTextTranslations = value;
              else step.navigationTextTranslations = value;
            }
          }
          visit.markModified('steps');
          await visit.save();
          updated += 1;
        }
      } catch (err) {
        failed += 1;
        console.error(`[syncVisitTranslationsForMuseum] visita ${visit._id}:`, err);
      }

      await jobsService.updateProgress(jobId, {
        visitSteps: { scanned: visits.length, updated, generated, removed, failed },
      });
    }

    return {
      scanned: visits.length,
      updated,
      generated,
      removed,
      failed,
    };
  }

  // Genera con OpenAI l'audio mancante degli item del museo (voce sorgente +
  // ogni lingua attiva già tradotta) — richiamato da generateAudio, POST
  // /api/museums/:id/generate-audio (e dall'equivalente per singola visita,
  // POST /api/visits/:id/generate-audio — VisitController.generateAudio).
  // Azione esplicita e separata dalla traduzione testuale: genera audio
  // reale, costa e richiede tempo per ciascun testo, non va infilata dentro
  // syncLanguages. Non privato: riusato as-is da VisitController.
  //
  // Solo gli item davvero usati in almeno una visita del museo (step.itemIds)
  // — o, se `visitId` è passato, solo quelli usati in QUELLA visita: un museo
  // può avere molto più contenuto "riusabile" segnato di quello incluso in
  // una visita reale — generare l'audio di testi che nessun visitatore
  // ascolterà mai sprecherebbe tempo e costo.
  //
  // `jobId` pilota l'avanzamento (jobsService.updateProgress dopo ogni item)
  // e la cancellazione (jobsService.isCancelled, controllato prima di ogni
  // item — un job fermato a metà lascia comunque salvato quanto già fatto).
  static async generateItemAudioForMuseum(
    museumId: string,
    activeLanguages: AppLanguage[],
    jobId: string,
    visitId?: string,
  ): Promise<JobProgress> {
    const museumIdFilter = await buildMuseumIdFilterValue(museumId);

    const visits = visitId
      ? await VisitModel.find({ _id: visitId, museumId: museumIdFilter })
          .select('steps.itemIds')
          .lean()
      : await VisitModel.find({ museumId: museumIdFilter }).select('steps.itemIds').lean();
    const usedItemIds = new Set<string>();
    for (const visit of visits) {
      for (const step of visit.steps || []) {
        for (const itemId of step.itemIds || []) {
          usedItemIds.add(String(itemId));
        }
      }
    }

    if (usedItemIds.size === 0) {
      return { scanned: 0, updated: 0, generated: 0, removed: 0, failed: 0 };
    }

    const items = await ItemModel.find({
      museumId: museumIdFilter,
      _id: { $in: Array.from(usedItemIds) },
    });

    let updated = 0;
    let generated = 0;
    let removed = 0;
    let failed = 0;

    for (const item of items) {
      if (jobsService.isCancelled(jobId)) break;

      const sourceLang = (item.sourceLanguage || DEFAULT_APP_LANGUAGE) as AppLanguage;
      const translatedTexts = mapToRecord(item.translatedTexts);
      const audio = mapToRecord<GeneratedAudio>(item.audio);

      // Solo la lingua sorgente e le lingue attive già tradotte: generare
      // l'audio di una traduzione che non esiste ancora non ha senso.
      const relevantLanguages = new Set([
        sourceLang,
        ...activeLanguages.filter((lang) => lang !== sourceLang && translatedTexts[lang]),
      ]);

      let itemChanged = false;

      // Rimuove l'audio di lingue non più rilevanti (lingua disattivata, o
      // traduzione che non c'è più) — file su disco incluso, mai lasciato orfano.
      for (const lang of Object.keys(audio)) {
        if (!relevantLanguages.has(lang as AppLanguage)) {
          await deleteGeneratedAudioFile(audio[lang]);
          delete audio[lang];
          removed += 1;
          itemChanged = true;
        }
      }

      for (const lang of relevantLanguages) {
        if (audio[lang]) continue; // già generato

        const text = lang === sourceLang ? item.text : translatedTexts[lang];
        if (!text) continue;

        try {
          audio[lang] = await generateAudioForText(text, lang);
          generated += 1;
          itemChanged = true;
        } catch (err) {
          failed += 1;
          // Non deve far fallire l'intera generazione per un item — ma
          // l'errore va comunque visibile da qualche parte (console/log del
          // processo), altrimenti un fallimento sistematico (quota OpenAI
          // esaurita, credenziali scadute...) resta indistinguibile da un
          // fallimento isolato finché non lo si va a scovare a mano.
          console.error(`[generateItemAudioForMuseum] item ${item._id}, lingua ${lang}:`, err);
        }
      }

      if (itemChanged) {
        item.set('audio', audio);
        await item.save();
        updated += 1;
      }

      await jobsService.updateProgress(jobId, {
        items: { scanned: items.length, updated, generated, removed, failed },
      });
    }

    return { scanned: items.length, updated, generated, removed, failed };
  }

  // Stessa logica di generateItemAudioForMuseum, ma per i testi delle tappe
  // LOGISTIC/NAVIGATION di ogni visita del museo (logisticText/navigationText
  // — logisticTitle non si legge ad alta voce, resta senza audio) — o, se
  // `visitId` è passato, solo di quella visita. Non privato: riusato as-is
  // da VisitController.
  static async generateVisitStepAudioForMuseum(
    museumId: string,
    activeLanguages: AppLanguage[],
    jobId: string,
    visitId?: string,
  ): Promise<JobProgress> {
    const museumIdFilter = await buildMuseumIdFilterValue(museumId);
    const visits = visitId
      ? await VisitModel.find({ _id: visitId, museumId: museumIdFilter })
      : await VisitModel.find({ museumId: museumIdFilter });

    let scanned = 0;
    let updated = 0;
    let generated = 0;
    let removed = 0;
    let failed = 0;

    for (const visit of visits) {
      if (jobsService.isCancelled(jobId)) break;

      const sourceLang = (visit.metadata?.language || DEFAULT_APP_LANGUAGE) as AppLanguage;
      let visitChanged = false;

      for (const step of visit.steps) {
        const fieldsWithText: Array<{
          textField: 'logisticText' | 'navigationText';
          audioField: 'logisticTextAudio' | 'navigationTextAudio';
          translations: Record<string, string>;
        }> = [];

        if (step.logisticText) {
          fieldsWithText.push({
            textField: 'logisticText',
            audioField: 'logisticTextAudio',
            translations: mapToRecord(step.logisticTextTranslations),
          });
        }
        if (step.navigationText) {
          fieldsWithText.push({
            textField: 'navigationText',
            audioField: 'navigationTextAudio',
            translations: mapToRecord(step.navigationTextTranslations),
          });
        }

        for (const { textField, audioField, translations } of fieldsWithText) {
          scanned += 1;
          const audio = mapToRecord<GeneratedAudio>(step[audioField]);

          const relevantLanguages = new Set([
            sourceLang,
            ...activeLanguages.filter((lang) => lang !== sourceLang && translations[lang]),
          ]);

          for (const lang of Object.keys(audio)) {
            if (!relevantLanguages.has(lang as AppLanguage)) {
              await deleteGeneratedAudioFile(audio[lang]);
              delete audio[lang];
              removed += 1;
              visitChanged = true;
            }
          }

          for (const lang of relevantLanguages) {
            if (audio[lang]) continue;
            const text = lang === sourceLang ? step[textField] : translations[lang];
            if (!text) continue;

            try {
              audio[lang] = await generateAudioForText(text, lang);
              generated += 1;
              visitChanged = true;
            } catch (err) {
              failed += 1;
              console.error(
                `[generateVisitStepAudioForMuseum] visita ${visit._id}, ${textField}, lingua ${lang}:`,
                err,
              );
            }
          }

          step[audioField] = audio;
        }
      }

      if (visitChanged) {
        visit.markModified('steps');
        await visit.save();
        updated += 1;
      }

      await jobsService.updateProgress(jobId, {
        visitSteps: { scanned, updated, generated, removed, failed },
      });
    }

    return { scanned, updated, generated, removed, failed };
  }

  // GET /api/museums — lista musei, filtrabile per città e stato attivo
  static getAll = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { city, isActive } = req.query;

    const filter: Record<string, unknown> = {};
    if (city) filter['location.city'] = city;
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    const museums = await MuseumModel.find(filter).sort({ name: 1 });

    res.json({
      success: true,
      data: museums,
    });
  });

  // GET /api/museums/:id — dettaglio museo (accetta sia _id Mongo sia QID Wikidata)
  static getById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const idParam = req.params.id;
    const id = Array.isArray(idParam) ? idParam[0] : idParam;

    if (!id) {
      throw new AppError(400, 'VALIDATION_ERROR', "L'id del museo è obbligatorio");
    }

    // I chiamanti pubblici (Navigator in testa) spesso hanno solo la QID
    // Wikidata del museo — es. Visit.museumId, quasi sempre salvato così —
    // non l'_id Mongo: un findById puro qui faceva fallire con un 500
    // invece di un più corretto 404/200. Vedi findMuseumByAnyId.
    const museum = await findMuseumByAnyId(id);
    if (!museum) {
      throw new AppError(404, 'MUSEUM_NOT_FOUND', 'Museo non trovato');
    }

    res.json({
      success: true,
      data: museum,
    });
  });

  // POST /api/museums — crea museo (solo admin)
  static create = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Validazione fallita', errors.array());
    }

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
      message: 'Museo creato con successo',
    });
  });

  // PUT /api/museums/:id — aggiorna museo (admin o curatore)
  static update = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Validazione fallita', errors.array());
    }

    const { id } = req.params;

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
      throw new AppError(404, 'MUSEUM_NOT_FOUND', 'Museo non trovato');
    }

    res.json({
      success: true,
      data: museum,
      message: 'Museo aggiornato con successo',
    });
  });

  // POST /api/museums/:id/sync-languages — cambia le lingue attive del museo e rigenera
  // le traduzioni mancanti di item e visite collegate
  // Aggiorna subito activeLanguages (serve indipendentemente da quanto dura la
  // sincronizzazione), poi avvia in background la rigenerazione delle traduzioni
  // mancanti/scadute — risponde 202 con l'id del job da seguire (GET /api/jobs),
  // stesso schema di generateAudio. Solo un job "sync-languages" alla volta,
  // ovunque (vedi jobsService.startJob) — indipendente dall'esclusione su
  // "generate-audio", possono girare insieme.
  static syncLanguages = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Validazione fallita', errors.array());
    }

    const idParam = req.params.id;
    const id = Array.isArray(idParam) ? idParam[0] : idParam;

    if (!id) {
      throw new AppError(400, 'VALIDATION_ERROR', "L'id del museo è obbligatorio");
    }
    if (!req.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Autenticazione richiesta');
    }
    const normalizedActiveLanguages = MuseumController.normalizeActiveLanguages(
      req.body.activeLanguages,
    );

    if (!normalizedActiveLanguages) {
      throw new AppError(400, 'VALIDATION_ERROR', 'activeLanguages è obbligatorio');
    }

    const museum = await findMuseumByAnyId(id);
    if (!museum) {
      throw new AppError(404, 'MUSEUM_NOT_FOUND', 'Museo non trovato');
    }

    museum.activeLanguages = normalizedActiveLanguages;
    await museum.save();

    const job = await jobsService.startJob({
      type: 'sync-languages',
      museumId: id,
      startedBy: req.user.id,
    });

    void MuseumController.runTranslationSyncJob(String(job._id), id, normalizedActiveLanguages);

    res.status(202).json({
      success: true,
      data: { jobId: job._id, museumId: id, activeLanguages: normalizedActiveLanguages },
      message: "Sincronizzazione lingue avviata: segui l'avanzamento dalle notifiche",
    });
  });

  // Corpo effettivo della sincronizzazione traduzioni, lanciato SENZA await da
  // syncLanguages (museo intero) e da VisitController.syncLanguages (singola
  // visita) — stesso schema di runAudioGenerationJob qui sotto.
  static async runTranslationSyncJob(
    jobId: string,
    museumId: string,
    activeLanguages: AppLanguage[],
    visitId?: string,
  ): Promise<void> {
    try {
      const [items, visitSteps] = await Promise.all([
        MuseumController.syncItemTranslationsForMuseum(museumId, activeLanguages, jobId, visitId),
        MuseumController.syncVisitTranslationsForMuseum(museumId, activeLanguages, jobId, visitId),
      ]);
      await jobsService.finishJob(
        jobId,
        jobsService.isCancelled(jobId) ? 'cancelled' : 'completed',
        {
          progress: { items, visitSteps },
        },
      );
    } catch (err) {
      console.error(`[runTranslationSyncJob] job ${jobId}:`, err);
      await jobsService.finishJob(jobId, 'failed', {
        error: err instanceof Error ? err.message : 'Errore sconosciuto',
      });
    }
  }

  // Corpo effettivo della generazione, lanciato SENZA await da generateAudio
  // (museo intero) e da VisitController.generateAudio (singola visita) — la
  // richiesta HTTP che lo avvia risponde subito 202 con solo il jobId,
  // l'avanzamento si segue dal job (GET /api/jobs). Avvolta in try/catch
  // perché un'eccezione imprevista deve chiudere il job come "failed",
  // altrimenti resterebbe "running" per sempre bloccando l'esclusione
  // reciproca (vedi jobsService.startJob). Non privato: riusato as-is da
  // VisitController.generateAudio.
  static async runAudioGenerationJob(
    jobId: string,
    museumId: string,
    activeLanguages: AppLanguage[],
    visitId?: string,
  ): Promise<void> {
    try {
      const [items, visitSteps] = await Promise.all([
        MuseumController.generateItemAudioForMuseum(museumId, activeLanguages, jobId, visitId),
        MuseumController.generateVisitStepAudioForMuseum(museumId, activeLanguages, jobId, visitId),
      ]);
      await jobsService.finishJob(
        jobId,
        jobsService.isCancelled(jobId) ? 'cancelled' : 'completed',
        { progress: { items, visitSteps } },
      );
    } catch (err) {
      console.error(`[runAudioGenerationJob] job ${jobId}:`, err);
      await jobsService.finishJob(jobId, 'failed', {
        error: err instanceof Error ? err.message : 'Errore sconosciuto',
      });
    }
  }

  // POST /api/museums/:id/generate-audio — avvia in background la generazione
  // con OpenAI dell'audio mancante di item e tappe del museo (voce sorgente +
  // lingue attive già tradotte), e risponde subito con l'id del job da
  // seguire (GET /api/jobs) — non aspetta la fine, può durare ore. Azione
  // esplicita e separata da syncLanguages: costa e richiede tempo per
  // ciascun testo, non va lanciata automaticamente su tutto il catalogo. Solo
  // un job di questo tipo alla volta, ovunque (vedi jobsService.startJob).
  static generateAudio = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const idParam = req.params.id;
    const id = Array.isArray(idParam) ? idParam[0] : idParam;

    if (!id) {
      throw new AppError(400, 'VALIDATION_ERROR', "L'id del museo è obbligatorio");
    }
    if (!req.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Autenticazione richiesta');
    }

    const museum = await findMuseumByAnyId(id);
    if (!museum) {
      throw new AppError(404, 'MUSEUM_NOT_FOUND', 'Museo non trovato');
    }

    const job = await jobsService.startJob({
      type: 'generate-audio',
      museumId: id,
      startedBy: req.user.id,
    });

    void MuseumController.runAudioGenerationJob(String(job._id), id, museum.activeLanguages);

    res.status(202).json({
      success: true,
      data: { jobId: job._id, museumId: id, activeLanguages: museum.activeLanguages },
      message: "Generazione audio avviata: segui l'avanzamento dalle notifiche",
    });
  });

  // DELETE /api/museums/:id — elimina museo (solo admin)
  static delete = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const { id } = req.params;

    const museum = await MuseumModel.findByIdAndDelete(id);
    if (!museum) {
      throw new AppError(404, 'MUSEUM_NOT_FOUND', 'Museo non trovato');
    }

    res.json({
      success: true,
      message: 'Museo eliminato con successo',
    });
  });

  // ========================================
  // GESTIONE PIANI
  // ========================================

  // GET /api/museums/:id/floors — lista piani del museo
  static getFloors = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    const museum = await findMuseumByAnyId(id);
    if (!museum) {
      throw new AppError(404, 'MUSEUM_NOT_FOUND', 'Museo non trovato');
    }

    res.json({
      success: true,
      data: museum.floors || [],
    });
  });

  // GET /api/museums/:id/floors/:floorId — dettaglio di un piano
  static getFloor = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id, floorId } = req.params;

    const museum = await findMuseumByAnyId(id);
    if (!museum) {
      throw new AppError(404, 'MUSEUM_NOT_FOUND', 'Museo non trovato');
    }

    const floor = museum.floors?.find((f) => f.id === floorId);
    if (!floor) {
      throw new AppError(404, 'FLOOR_NOT_FOUND', 'Piano non trovato');
    }

    res.json({
      success: true,
      data: floor,
    });
  });

  // POST /api/museums/:id/floors — aggiunge un piano e riordina per livello
  static addFloor = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Validazione fallita', errors.array());
    }

    const { id } = req.params;
    const floorData: MuseumFloor = {
      ...req.body,
      markers: req.body.markers || [],
      connections: req.body.connections || [],
    };

    const museum = await findMuseumByAnyId(id);
    if (!museum) {
      throw new AppError(404, 'MUSEUM_NOT_FOUND', 'Museo non trovato');
    }

    // Controlla se l'ID piano esiste già
    if (museum.floors?.some((f) => f.id === floorData.id)) {
      throw new AppError(400, 'FLOOR_EXISTS', 'Esiste già un piano con questo ID');
    }

    // Inizializza l'array dei piani se serve
    if (!museum.floors) {
      museum.floors = [];
    }

    museum.floors.push(floorData);

    // Ordina i piani per livello
    museum.floors.sort((a, b) => a.level - b.level);

    await museum.save();

    res.status(201).json({
      success: true,
      data: floorData,
      message: 'Piano aggiunto con successo',
    });
  });

  // PUT /api/museums/:id/floors/:floorId — aggiorna un piano
  static updateFloor = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const { id, floorId } = req.params;

    const museum = await findMuseumByAnyId(id);
    if (!museum) {
      throw new AppError(404, 'MUSEUM_NOT_FOUND', 'Museo non trovato');
    }

    const floorIndex = museum.floors?.findIndex((f) => f.id === floorId);
    if (floorIndex === undefined || floorIndex === -1) {
      throw new AppError(404, 'FLOOR_NOT_FOUND', 'Piano non trovato');
    }

    // Aggiorna i dati del piano, preservando marker e connessioni se non forniti.
    // museum.floors[i] è un subdocument Mongoose: i suoi campi non sono proprietà
    // enumerabili "piatte", quindi {...existingFloor} non li copiava in modo
    // affidabile (un PUT parziale poteva perdere name/level/dimensions e fallire
    // la validazione Mongoose). JSON round-trip forza un plain object su cui lo
    // spread funziona come atteso (il floor non ha campi Date, è sicuro).
    const existingFloor = JSON.parse(JSON.stringify(museum.floors![floorIndex])) as MuseumFloor;
    museum.floors![floorIndex] = {
      ...existingFloor,
      ...req.body,
      id: floorId, // Prevent ID change
      markers: req.body.markers || existingFloor.markers,
      connections: req.body.connections || existingFloor.connections,
    };

    // Riordina i piani per livello
    museum.floors!.sort((a, b) => a.level - b.level);

    await museum.save();

    res.json({
      success: true,
      data: museum.floors![floorIndex],
      message: 'Piano aggiornato con successo',
    });
  });

  // DELETE /api/museums/:id/floors/:floorId — elimina un piano
  static deleteFloor = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const { id, floorId } = req.params;

    const museum = await findMuseumByAnyId(id);
    if (!museum) {
      throw new AppError(404, 'MUSEUM_NOT_FOUND', 'Museo non trovato');
    }

    const floorIndex = museum.floors?.findIndex((f) => f.id === floorId);
    if (floorIndex === undefined || floorIndex === -1) {
      throw new AppError(404, 'FLOOR_NOT_FOUND', 'Piano non trovato');
    }

    museum.floors!.splice(floorIndex, 1);
    await museum.save();

    res.json({
      success: true,
      message: 'Piano eliminato con successo',
    });
  });

  // ========================================
  // GESTIONE SALE (parallela ai marker: vedi MuseumRoom)
  // ========================================

  // Validazione per POST /api/museums/:id/rooms
  static roomValidation = [
    body('id').trim().notEmpty().withMessage("L'ID sala è obbligatorio"),
    body('title').trim().notEmpty().withMessage('Il titolo della sala è obbligatorio'),
    body('subtitle').optional({ values: 'falsy' }).trim(),
  ];

  // Validazione per PUT /api/museums/:id/rooms/:roomId
  static roomRenameValidation = [
    body('title').trim().notEmpty().withMessage('Il titolo della sala è obbligatorio'),
    body('subtitle').optional({ values: 'falsy' }).trim(),
  ];

  // Validazione per PUT /api/museums/:id/rooms/:roomId/outline
  static roomOutlineValidation = [
    body('floorId').trim().notEmpty().withMessage("L'ID piano è obbligatorio"),
    body('polygon').isArray({ min: 3 }).withMessage('Il contorno deve avere almeno 3 punti'),
    body('polygon.*.x').isNumeric().withMessage('Punto del poligono non valido'),
    body('polygon.*.y').isNumeric().withMessage('Punto del poligono non valido'),
  ];

  // GET /api/museums/:id/rooms — sale del museo (indipendenti dal piano finché non contornate)
  static getRooms = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    const museum = await findMuseumByAnyId(id);
    if (!museum) {
      throw new AppError(404, 'MUSEUM_NOT_FOUND', 'Museo non trovato');
    }

    res.json({
      success: true,
      data: museum.rooms || [],
    });
  });

  // POST /api/museums/:id/rooms — crea una sala (solo id/title/subtitle: il contorno si aggiunge dopo)
  static createRoom = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Validazione fallita', errors.array());
    }

    const { id } = req.params;
    const roomData: MuseumRoom = {
      id: req.body.id,
      title: req.body.title,
      subtitle: req.body.subtitle || undefined,
    };

    const museum = await findMuseumByAnyId(id);
    if (!museum) {
      throw new AppError(404, 'MUSEUM_NOT_FOUND', 'Museo non trovato');
    }

    if (museum.rooms?.some((r) => r.id === roomData.id)) {
      throw new AppError(400, 'ROOM_EXISTS', 'Esiste già una sala con questo ID');
    }

    if (!museum.rooms) {
      museum.rooms = [];
    }
    museum.rooms.push(roomData);
    await museum.save();

    res.status(201).json({
      success: true,
      data: roomData,
      message: 'Sala creata con successo',
    });
  });

  // PUT /api/museums/:id/rooms/:roomId — rinomina una sala (solo title/subtitle, non tocca floorId/polygon)
  static updateRoom = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Validazione fallita', errors.array());
    }

    const { id, roomId } = req.params;

    const museum = await findMuseumByAnyId(id);
    if (!museum) {
      throw new AppError(404, 'MUSEUM_NOT_FOUND', 'Museo non trovato');
    }

    const room = museum.rooms?.find((r) => r.id === roomId);
    if (!room) {
      throw new AppError(404, 'ROOM_NOT_FOUND', 'Sala non trovata');
    }

    room.title = req.body.title;
    room.subtitle = req.body.subtitle || undefined;
    await museum.save();

    res.json({
      success: true,
      data: room,
      message: 'Sala aggiornata con successo',
    });
  });

  // PUT /api/museums/:id/rooms/:roomId/outline — contorna una sala sulla piantina: floorId +
  // poligono chiuso (endpoint separato dal rename, così un contorno malformato non può
  // essere salvato aggirando la validazione di roomOutlineValidation).
  static outlineRoom = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Validazione fallita', errors.array());
    }

    const { id, roomId } = req.params;

    const museum = await findMuseumByAnyId(id);
    if (!museum) {
      throw new AppError(404, 'MUSEUM_NOT_FOUND', 'Museo non trovato');
    }

    const room = museum.rooms?.find((r) => r.id === roomId);
    if (!room) {
      throw new AppError(404, 'ROOM_NOT_FOUND', 'Sala non trovata');
    }

    const floor = museum.floors?.find((f) => f.id === req.body.floorId);
    if (!floor) {
      throw new AppError(404, 'FLOOR_NOT_FOUND', 'Piano non trovato');
    }

    room.floorId = req.body.floorId;
    room.polygon = req.body.polygon;
    await museum.save();

    res.json({
      success: true,
      data: room,
      message: 'Contorno sala aggiornato con successo',
    });
  });

  // DELETE /api/museums/:id/rooms/:roomId/outline — rimuove solo il contorno di una sala
  // (torna disponibile senza piano/poligono)
  static removeRoomOutline = asyncHandler(
    async (req: AuthRequest, res: Response): Promise<void> => {
      const { id, roomId } = req.params;

      const museum = await findMuseumByAnyId(id);
      if (!museum) {
        throw new AppError(404, 'MUSEUM_NOT_FOUND', 'Museo non trovato');
      }

      const room = museum.rooms?.find((r) => r.id === roomId);
      if (!room) {
        throw new AppError(404, 'ROOM_NOT_FOUND', 'Sala non trovata');
      }

      room.floorId = undefined;
      room.polygon = undefined;
      await museum.save();

      res.json({
        success: true,
        data: room,
        message: 'Contorno sala rimosso con successo',
      });
    },
  );

  // DELETE /api/museums/:id/rooms/:roomId — elimina una sala
  static deleteRoom = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const { id, roomId } = req.params;

    const museum = await findMuseumByAnyId(id);
    if (!museum) {
      throw new AppError(404, 'MUSEUM_NOT_FOUND', 'Museo non trovato');
    }

    const roomIndex = museum.rooms?.findIndex((r) => r.id === roomId);
    if (roomIndex === undefined || roomIndex === -1) {
      throw new AppError(404, 'ROOM_NOT_FOUND', 'Sala non trovata');
    }

    museum.rooms!.splice(roomIndex, 1);
    await museum.save();

    res.json({
      success: true,
      message: 'Sala eliminata con successo',
    });
  });

  // ========================================
  // GESTIONE MARKER
  // ========================================

  // GET /api/museums/:id/floors/:floorId/markers — marker di un piano
  static getMarkers = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id, floorId } = req.params;

    const museum = await findMuseumByAnyId(id);
    if (!museum) {
      throw new AppError(404, 'MUSEUM_NOT_FOUND', 'Museo non trovato');
    }

    const floor = museum.floors?.find((f) => f.id === floorId);
    if (!floor) {
      throw new AppError(404, 'FLOOR_NOT_FOUND', 'Piano non trovato');
    }

    res.json({
      success: true,
      data: floor.markers || [],
    });
  });

  // POST /api/museums/:id/floors/:floorId/markers — aggiunge un marker al piano
  static addMarker = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Validazione fallita', errors.array());
    }

    const { id, floorId } = req.params;
    const markerData: MapMarker = {
      ...req.body,
      floorId,
      isVisible: req.body.isVisible !== false,
    };

    const museum = await findMuseumByAnyId(id);
    if (!museum) {
      throw new AppError(404, 'MUSEUM_NOT_FOUND', 'Museo non trovato');
    }

    const floorIndex = museum.floors?.findIndex((f) => f.id === floorId);
    if (floorIndex === undefined || floorIndex === -1) {
      throw new AppError(404, 'FLOOR_NOT_FOUND', 'Piano non trovato');
    }

    // Controlla se l'ID marker esiste già su questo piano
    if (museum.floors![floorIndex].markers?.some((m) => m.id === markerData.id)) {
      throw new AppError(400, 'MARKER_EXISTS', 'Esiste già un marker con questo ID');
    }

    if (!museum.floors![floorIndex].markers) {
      museum.floors![floorIndex].markers = [];
    }

    museum.floors![floorIndex].markers!.push(markerData);
    await museum.save();

    res.status(201).json({
      success: true,
      data: markerData,
      message: 'Marker aggiunto con successo',
    });
  });

  // PUT /api/museums/:id/floors/:floorId/markers/:markerId — aggiorna un marker
  static updateMarker = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const { id, floorId, markerId } = req.params;

    const museum = await findMuseumByAnyId(id);
    if (!museum) {
      throw new AppError(404, 'MUSEUM_NOT_FOUND', 'Museo non trovato');
    }

    const floorIndex = museum.floors?.findIndex((f) => f.id === floorId);
    if (floorIndex === undefined || floorIndex === -1) {
      throw new AppError(404, 'FLOOR_NOT_FOUND', 'Piano non trovato');
    }

    const markerIndex = museum.floors![floorIndex].markers?.findIndex((m) => m.id === markerId);
    if (markerIndex === undefined || markerIndex === -1) {
      throw new AppError(404, 'MARKER_NOT_FOUND', 'Marker non trovato');
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
      message: 'Marker aggiornato con successo',
    });
  });

  // DELETE /api/museums/:id/floors/:floorId/markers/:markerId — elimina un marker
  static deleteMarker = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const { id, floorId, markerId } = req.params;

    const museum = await findMuseumByAnyId(id);
    if (!museum) {
      throw new AppError(404, 'MUSEUM_NOT_FOUND', 'Museo non trovato');
    }

    const floorIndex = museum.floors?.findIndex((f) => f.id === floorId);
    if (floorIndex === undefined || floorIndex === -1) {
      throw new AppError(404, 'FLOOR_NOT_FOUND', 'Piano non trovato');
    }

    const markerIndex = museum.floors![floorIndex].markers?.findIndex((m) => m.id === markerId);
    if (markerIndex === undefined || markerIndex === -1) {
      throw new AppError(404, 'MARKER_NOT_FOUND', 'Marker non trovato');
    }

    museum.floors![floorIndex].markers!.splice(markerIndex, 1);
    await museum.save();

    res.json({
      success: true,
      message: 'Marker eliminato con successo',
    });
  });

  // PUT /api/museums/:id/floors/:floorId/markers — sostituisce tutti i marker del piano
  // in blocco (per il riposizionamento drag & drop)
  static updateMarkers = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const { id, floorId } = req.params;
    const { markers } = req.body;

    if (!Array.isArray(markers)) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Markers deve essere un array');
    }

    const museum = await findMuseumByAnyId(id);
    if (!museum) {
      throw new AppError(404, 'MUSEUM_NOT_FOUND', 'Museo non trovato');
    }

    const floorIndex = museum.floors?.findIndex((f) => f.id === floorId);
    if (floorIndex === undefined || floorIndex === -1) {
      throw new AppError(404, 'FLOOR_NOT_FOUND', 'Piano non trovato');
    }

    // Sostituisce tutti i marker col nuovo array
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
      message: 'Marker aggiornati con successo',
    });
  });

  // ========================================
  // GESTIONE COLLEGAMENTI
  // ========================================

  // POST /api/museums/:id/floors/:floorId/connections — aggiunge un collegamento tra piani
  static addConnection = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Validazione fallita', errors.array());
    }

    const { id, floorId } = req.params;
    const connectionData: FloorConnection = { ...req.body };

    const museum = await findMuseumByAnyId(id);
    if (!museum) {
      throw new AppError(404, 'MUSEUM_NOT_FOUND', 'Museo non trovato');
    }

    const floorIndex = museum.floors?.findIndex((f) => f.id === floorId);
    if (floorIndex === undefined || floorIndex === -1) {
      throw new AppError(404, 'FLOOR_NOT_FOUND', 'Piano non trovato');
    }

    // Controlla che il piano di destinazione esista
    if (!museum.floors?.some((f) => f.id === connectionData.targetFloorId)) {
      throw new AppError(400, 'TARGET_FLOOR_NOT_FOUND', 'Piano di destinazione non trovato');
    }

    if (!museum.floors![floorIndex].connections) {
      museum.floors![floorIndex].connections = [];
    }

    museum.floors![floorIndex].connections!.push(connectionData);
    await museum.save();

    res.status(201).json({
      success: true,
      data: connectionData,
      message: 'Collegamento aggiunto con successo',
    });
  });

  // DELETE /api/museums/:id/floors/:floorId/connections/:connectionId — elimina un collegamento
  static deleteConnection = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const { id, floorId, connectionId } = req.params;

    const museum = await findMuseumByAnyId(id);
    if (!museum) {
      throw new AppError(404, 'MUSEUM_NOT_FOUND', 'Museo non trovato');
    }

    const floorIndex = museum.floors?.findIndex((f) => f.id === floorId);
    if (floorIndex === undefined || floorIndex === -1) {
      throw new AppError(404, 'FLOOR_NOT_FOUND', 'Piano non trovato');
    }

    const connectionIndex = museum.floors![floorIndex].connections?.findIndex(
      (c) => c.id === connectionId,
    );
    if (connectionIndex === undefined || connectionIndex === -1) {
      throw new AppError(404, 'CONNECTION_NOT_FOUND', 'Collegamento non trovato');
    }

    museum.floors![floorIndex].connections!.splice(connectionIndex, 1);
    await museum.save();

    res.json({
      success: true,
      message: 'Collegamento eliminato con successo',
    });
  });

  // ========================================
  // GESTIONE CURATORI (assegnabili solo da un ADMIN)
  // ========================================

  // GET /api/museums/:id/curators — utenti curatori di questo museo
  static getCurators = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const { id } = req.params;
    const { User } = await import('../models/index.js');

    const museum = await findMuseumByAnyId(id);
    if (!museum) {
      throw new AppError(404, 'MUSEUM_NOT_FOUND', 'Museo non trovato');
    }

    const curators = await User.find({
      museumRoles: { $elemMatch: { museumId: id, role: MuseumRole.CURATOR } },
    }).select('-password');

    res.json({
      success: true,
      data: curators,
    });
  });

  // POST /api/museums/:id/curators — assegna il ruolo curatore a un utente (solo admin)
  static addCurator = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const { id } = req.params;
    const { userId } = req.body;
    const { User } = await import('../models/index.js');

    if (!userId) {
      throw new AppError(400, 'VALIDATION_ERROR', "L'ID utente è obbligatorio");
    }

    const museum = await findMuseumByAnyId(id);
    if (!museum) {
      throw new AppError(404, 'MUSEUM_NOT_FOUND', 'Museo non trovato');
    }

    const user = await User.findById(userId);
    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', 'Utente non trovato');
    }

    const isAlreadyCurator = user.museumRoles?.some(
      (assignment: MuseumRoleAssignment) =>
        assignment.museumId === id && assignment.role === MuseumRole.CURATOR,
    );

    if (isAlreadyCurator) {
      throw new AppError(400, 'ALREADY_CURATOR', 'Questo utente è già curatore di questo museo');
    }

    if (!user.museumRoles) {
      user.museumRoles = [];
    }

    user.museumRoles.push({
      museumId: id as string,
      role: MuseumRole.CURATOR,
      assignedAt: new Date(),
      assignedBy: req.user!.id,
    });

    await user.save();

    res.status(201).json({
      success: true,
      message: `Utente ${user.username} aggiunto come curatore di ${museum.name}`,
      data: {
        userId: user._id,
        username: user.username,
        email: user.email,
      },
    });
  });

  // DELETE /api/museums/:id/curators/:userId — revoca il ruolo curatore a un utente (solo admin)
  static removeCurator = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const { id, userId } = req.params;
    const { User } = await import('../models/index.js');

    const museum = await findMuseumByAnyId(id);
    if (!museum) {
      throw new AppError(404, 'MUSEUM_NOT_FOUND', 'Museo non trovato');
    }

    const user = await User.findById(userId);
    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', 'Utente non trovato');
    }

    const assignmentIndex = user.museumRoles?.findIndex(
      (assignment: MuseumRoleAssignment) =>
        assignment.museumId === id && assignment.role === MuseumRole.CURATOR,
    );

    if (assignmentIndex === undefined || assignmentIndex === -1) {
      throw new AppError(400, 'NOT_A_CURATOR', 'Questo utente non è curatore di questo museo');
    }

    user.museumRoles!.splice(assignmentIndex, 1);
    await user.save();

    res.json({
      success: true,
      message: `Utente ${user.username} rimosso come curatore di ${museum.name}`,
    });
  });

  // ========================================
  // GESTIONE AUTORI (assegnabili da un admin, o dal curatore di QUESTO museo)
  // ========================================

  // POST /api/museums/:id/authors — promuove un utente già a sistema ad autore di questo museo
  static addAuthor = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const { id } = req.params;
    const { userId } = req.body;
    const { User } = await import('../models/index.js');

    if (!userId) {
      throw new AppError(400, 'VALIDATION_ERROR', "L'ID utente è obbligatorio");
    }

    const museum = await findMuseumByAnyId(id);
    if (!museum) {
      throw new AppError(404, 'MUSEUM_NOT_FOUND', 'Museo non trovato');
    }

    const user = await User.findById(userId);
    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', 'Utente non trovato');
    }

    const isAlreadyAuthor = user.museumRoles?.some(
      (assignment: MuseumRoleAssignment) =>
        assignment.museumId === id && assignment.role === MuseumRole.AUTHOR,
    );

    if (isAlreadyAuthor) {
      throw new AppError(400, 'ALREADY_AUTHOR', 'Questo utente è già autore di questo museo');
    }

    if (!user.museumRoles) {
      user.museumRoles = [];
    }

    user.museumRoles.push({
      museumId: id as string,
      role: MuseumRole.AUTHOR,
      assignedAt: new Date(),
      assignedBy: req.user!.id,
    });

    await user.save();

    res.status(201).json({
      success: true,
      message: `Utente ${user.username} aggiunto come autore di ${museum.name}`,
      data: {
        userId: user._id,
        username: user.username,
        email: user.email,
      },
    });
  });

  // DELETE /api/museums/:id/authors/:userId — revoca il ruolo autore a un utente
  static removeAuthor = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const { id, userId } = req.params;
    const { User } = await import('../models/index.js');

    const museum = await findMuseumByAnyId(id);
    if (!museum) {
      throw new AppError(404, 'MUSEUM_NOT_FOUND', 'Museo non trovato');
    }

    const user = await User.findById(userId);
    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', 'Utente non trovato');
    }

    const assignmentIndex = user.museumRoles?.findIndex(
      (assignment: MuseumRoleAssignment) =>
        assignment.museumId === id && assignment.role === MuseumRole.AUTHOR,
    );

    if (assignmentIndex === undefined || assignmentIndex === -1) {
      throw new AppError(400, 'NOT_AN_AUTHOR', 'Questo utente non è autore di questo museo');
    }

    user.museumRoles!.splice(assignmentIndex, 1);
    await user.save();

    res.json({
      success: true,
      message: `Utente ${user.username} rimosso come autore di ${museum.name}`,
    });
  });

  // ========================================
  // RICHIESTE DI RUOLO (un utente chiede di diventare curatore/autore di un
  // museo; la conferma spetta a chi potrebbe assegnare quel ruolo direttamente:
  // solo admin per CURATOR, admin o curatore del museo per AUTHOR)
  // ========================================

  static requestRoleValidation = [
    body('role').isIn(Object.values(MuseumRole)).withMessage('Ruolo non valido'),
  ];

  // POST /api/museums/:id/role-requests — un utente chiede di diventare curatore/autore del museo
  static requestRole = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Validazione fallita', errors.array());
    }

    if (!req.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Autenticazione richiesta');
    }

    const { id } = req.params;
    const { role } = req.body as { role: MuseumRole };

    const museum = await findMuseumByAnyId(id);
    if (!museum) {
      throw new AppError(404, 'MUSEUM_NOT_FOUND', 'Museo non trovato');
    }

    const { User } = await import('../models/index.js');
    const user = await User.findById(req.user.id).select('museumRoles').lean();
    const alreadyHasRole = user?.museumRoles?.some(
      (assignment: MuseumRoleAssignment) => assignment.museumId === id && assignment.role === role,
    );
    if (alreadyHasRole) {
      throw new AppError(
        400,
        'ALREADY_ASSIGNED',
        `Sei già ${role === MuseumRole.CURATOR ? 'curatore' : 'autore'} di questo museo`,
      );
    }

    const existingRequest = await MuseumRoleRequestModel.findOne({
      userId: req.user.id,
      museumId: id,
      role,
    });
    if (existingRequest) {
      throw new AppError(
        400,
        'REQUEST_ALREADY_PENDING',
        'Hai già una richiesta in attesa per questo museo e ruolo',
      );
    }

    const request = await MuseumRoleRequestModel.create({
      userId: req.user.id,
      museumId: id,
      role,
    });

    // Notifica chi può approvarla: sempre gli admin, e se il ruolo chiesto è
    // AUTHOR anche i curatori di QUESTO museo (stesso criterio di
    // assertCanApproveRoleRequest — vedi policy.util.ts).
    const admins = await User.find({ isAdmin: true }).select('_id').lean();
    const recipientIds = admins.map((u) => String(u._id));
    if (role === MuseumRole.AUTHOR) {
      const curators = await User.find({
        museumRoles: { $elemMatch: { museumId: id, role: MuseumRole.CURATOR } },
      })
        .select('_id')
        .lean();
      recipientIds.push(...curators.map((u) => String(u._id)));
    }
    const roleLabel = role === MuseumRole.CURATOR ? 'curatore' : 'autore';
    await notifyMany(recipientIds, {
      kind: 'role-request-pending',
      title: 'Nuova richiesta di ruolo',
      message: `${req.user.username} ha richiesto di diventare ${roleLabel} di ${museum.name}`,
      roleRequest: { museumId: id as string, requestId: String(request._id), role },
    });

    res.status(201).json({
      success: true,
      data: request,
      message: 'Richiesta inviata con successo',
    });
  });

  // DELETE /api/museums/:id/role-requests/:requestId — annulla (il richiedente)
  // o rifiuta (chi potrebbe approvarla) una richiesta
  static cancelRoleRequest = asyncHandler(
    async (req: AuthRequest, res: Response): Promise<void> => {
      if (!req.user) {
        throw new AppError(401, 'UNAUTHORIZED', 'Autenticazione richiesta');
      }

      const { id, requestId } = req.params;
      const request = await MuseumRoleRequestModel.findById(requestId);
      if (!request || request.museumId !== id) {
        throw new AppError(404, 'REQUEST_NOT_FOUND', 'Richiesta non trovata');
      }

      const isRejection = request.userId !== req.user.id;
      if (isRejection) {
        await assertCanApproveRoleRequest(
          req.user,
          request.role,
          id as string,
          'Non hai i permessi per gestire questa richiesta',
        );
      }

      // Solo se è un rifiuto (non un ritiro spontaneo, che il richiedente
      // conosce già avendolo fatto lui): notifica l'esito e toglie la
      // notifica "pending" agli altri revisori — vedi requestRole.
      if (isRejection) {
        const roleLabel = request.role === MuseumRole.CURATOR ? 'curatore' : 'autore';
        const museum = await MuseumModel.findById(id).select('name').lean();
        await notify(request.userId, {
          kind: 'role-request-resolved',
          title: 'Richiesta di ruolo rifiutata',
          message: `La tua richiesta di diventare ${roleLabel} di ${museum?.name || 'questo museo'} è stata rifiutata`,
        });
        await resolveRoleRequestNotifications(String(request._id));
      }

      await request.deleteOne();

      res.json({
        success: true,
        message: 'Richiesta rimossa con successo',
      });
    },
  );

  // POST /api/museums/:id/role-requests/:requestId/approve — conferma la richiesta
  static approveRoleRequest = asyncHandler(
    async (req: AuthRequest, res: Response): Promise<void> => {
      if (!req.user) {
        throw new AppError(401, 'UNAUTHORIZED', 'Autenticazione richiesta');
      }

      const { id, requestId } = req.params;
      const request = await MuseumRoleRequestModel.findById(requestId);
      if (!request || request.museumId !== id) {
        throw new AppError(404, 'REQUEST_NOT_FOUND', 'Richiesta non trovata');
      }

      await assertCanApproveRoleRequest(
        req.user,
        request.role,
        id as string,
        'Non hai i permessi per approvare questa richiesta',
      );

      const museum = await findMuseumByAnyId(id);
      if (!museum) {
        await request.deleteOne();
        throw new AppError(404, 'MUSEUM_NOT_FOUND', 'Museo non trovato');
      }

      const { User } = await import('../models/index.js');
      const user = await User.findById(request.userId);
      if (!user) {
        await request.deleteOne();
        throw new AppError(404, 'USER_NOT_FOUND', 'Utente non trovato');
      }

      const alreadyHasRole = user.museumRoles?.some(
        (assignment: MuseumRoleAssignment) =>
          assignment.museumId === id && assignment.role === request.role,
      );
      if (!alreadyHasRole) {
        if (!user.museumRoles) {
          user.museumRoles = [];
        }
        user.museumRoles.push({
          museumId: id as string,
          role: request.role,
          assignedAt: new Date(),
          assignedBy: req.user.id,
        });
        await user.save();
      }

      const roleLabel = request.role === MuseumRole.CURATOR ? 'curatore' : 'autore';

      await notify(request.userId, {
        kind: 'role-request-resolved',
        title: 'Richiesta di ruolo approvata',
        message: `La tua richiesta di diventare ${roleLabel} di ${museum.name} è stata approvata`,
      });
      await resolveRoleRequestNotifications(String(request._id));

      await request.deleteOne();

      res.json({
        success: true,
        message: `Richiesta approvata: ${user.username} è ora ${roleLabel} di ${museum.name}`,
      });
    },
  );

  // GET /api/museums/role-requests — richieste che l'utente può revisionare:
  // tutte se admin, solo quelle dei musei che cura altrimenti
  static listReviewableRoleRequests = asyncHandler(
    async (req: AuthRequest, res: Response): Promise<void> => {
      if (!req.user) {
        throw new AppError(401, 'UNAUTHORIZED', 'Autenticazione richiesta');
      }

      let filter: Record<string, unknown> = {};

      if (!req.user.isAdmin) {
        const { User } = await import('../models/index.js');
        const user = await User.findById(req.user.id).select('museumRoles').lean();
        const curatedMuseumIds = (user?.museumRoles || [])
          .filter((assignment: MuseumRoleAssignment) => assignment.role === MuseumRole.CURATOR)
          .map((assignment: MuseumRoleAssignment) => assignment.museumId);

        if (curatedMuseumIds.length === 0) {
          res.json({ success: true, data: [] });
          return;
        }

        filter = { museumId: { $in: curatedMuseumIds } };
      }

      const requests = await MuseumRoleRequestModel.find(filter).sort({ requestedAt: 1 }).lean();

      // Arricchisce con username e nome museo: chi revisiona (specie un curatore,
      // che non ha accesso a GET /api/users) deve poter capire chi/cosa senza chiamate aggiuntive.
      const { User } = await import('../models/index.js');
      const [users, museums] = await Promise.all([
        User.find({ _id: { $in: requests.map((r) => r.userId) } })
          .select('username email')
          .lean(),
        MuseumModel.find({ _id: { $in: requests.map((r) => r.museumId) } })
          .select('name')
          .lean(),
      ]);
      const userById = new Map(users.map((u) => [String(u._id), u]));
      const museumById = new Map(museums.map((m) => [String(m._id), m]));

      const enriched = requests.map((r) => ({
        ...r,
        username: userById.get(r.userId)?.username,
        museumName: museumById.get(r.museumId)?.name,
      }));

      res.json({
        success: true,
        data: enriched,
      });
    },
  );
}
