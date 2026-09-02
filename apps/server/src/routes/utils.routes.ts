import { Router } from 'express';
import { UtilsController } from '../controllers/utils.controller.js';
import { authMiddleware, roleMiddleware } from '../middleware/index.js';
import { UserRole } from '@artaround/shared';

const router = Router();

/**
 * @swagger
 * /api/utils/navigator-default-configs:
 *   get:
 *     tags: [Utils]
 *     summary: Configurazioni di default del Navigator (Admin only)
 *     description: Ottiene le configurazioni Navigator di piattaforma, usate quando un museo non ha un proprio navigatorConfig
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista configurazioni di default
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
router.get(
  '/navigator-default-configs',
  authMiddleware,
  roleMiddleware(UserRole.ADMIN),
  UtilsController.getNavigatorDefaultConfigs,
);

/**
 * @swagger
 * /api/utils/navigator-default-config:
 *   get:
 *     tags: [Utils]
 *     summary: Configurazioni di default del Navigator (pubblico)
 *     description: Stessi dati di /navigator-default-configs ma senza autenticazione — usata dall'app Navigator, anche da visitatori anonimi.
 *     responses:
 *       200:
 *         description: Lista configurazioni di default
 */
router.get('/navigator-default-config', UtilsController.getNavigatorDefaultConfigs);

/**
 * @swagger
 * /api/utils/navigator-default-configs:
 *   put:
 *     tags: [Utils]
 *     summary: Aggiorna le configurazioni di default del Navigator (Admin only)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [navigatorConfigs]
 *             properties:
 *               navigatorConfigs:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       200:
 *         description: Configurazioni aggiornate
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
router.put(
  '/navigator-default-configs',
  authMiddleware,
  roleMiddleware(UserRole.ADMIN),
  UtilsController.updateNavigatorDefaultConfigs,
);

/**
 * @swagger
 * /api/utils/ai-health:
 *   get:
 *     tags: [Utils]
 *     summary: Verifica connessione OpenAI
 *     description: Esegue un test rapido sulla configurazione OpenAI
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: OpenAI configurata e raggiungibile
 *       503:
 *         description: OpenAI non configurata o non raggiungibile
 */
router.get('/ai-health', authMiddleware, UtilsController.aiHealth);

/**
 * @swagger
 * /api/utils/wikidata/{id}:
 *   get:
 *     tags: [Utils]
 *     summary: Ottieni dati Wikidata
 *     description: Recupera informazioni su un'entità Wikidata (opera d'arte)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID Wikidata (es. Q45585)
 *         example: Q45585
 *     responses:
 *       200:
 *         description: Dati entità Wikidata
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     label:
 *                       type: string
 *                     description:
 *                       type: string
 *                     properties:
 *                       type: object
 *       404:
 *         description: Entità non trovata
 */
router.get('/wikidata/:id', UtilsController.getWikidataEntity);

/**
 * @swagger
 * /api/utils/wikidata-search:
 *   get:
 *     tags: [Utils]
 *     summary: Ricerca su Wikidata
 *     description: Cerca opere d'arte su Wikidata
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Termine di ricerca
 *         example: Monna Lisa
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Risultati ricerca
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       label:
 *                         type: string
 *                       description:
 *                         type: string
 */
router.get('/wikidata-search', UtilsController.searchWikidata);

/**
 * @swagger
 * /api/utils/geocode:
 *   get:
 *     tags: [Utils]
 *     summary: Geocodifica indirizzo
 *     description: Risolve indirizzo/città/CAP/nazione in coordinate lat/lng usando Nominatim (OpenStreetMap)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: address
 *         schema:
 *           type: string
 *         description: Indirizzo (via/piazza e numero civico)
 *       - in: query
 *         name: city
 *         schema:
 *           type: string
 *         description: Città
 *       - in: query
 *         name: postalCode
 *         schema:
 *           type: string
 *         description: CAP
 *       - in: query
 *         name: nation
 *         schema:
 *           type: string
 *         description: Nazione (default Italia)
 *     responses:
 *       200:
 *         description: Coordinate geocodificate
 */
router.get('/geocode', authMiddleware, UtilsController.geocodeAddress);

/**
 * @swagger
 * /api/utils/translate:
 *   post:
 *     tags: [Utils]
 *     summary: Traduci testo con AI
 *     description: Traduce testo usando OpenAI
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [text, targetLanguage]
 *             properties:
 *               text:
 *                 type: string
 *                 description: Testo da tradurre
 *                 example: This is a beautiful painting
 *               targetLanguage:
 *                 type: string
 *                 description: Lingua di destinazione (ISO 639-1)
 *                 example: it
 *               sourceLanguage:
 *                 type: string
 *                 description: Lingua di origine (opzionale, auto-detect)
 *                 example: en
 *               context:
 *                 type: string
 *                 description: Contesto per migliorare la traduzione
 *                 example: Art museum description
 *     responses:
 *       200:
 *         description: Testo tradotto
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     translatedText:
 *                       type: string
 *                       example: Questo è un bellissimo dipinto
 *                     sourceLanguage:
 *                       type: string
 *                     targetLanguage:
 *                       type: string
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post(
  '/translate',
  authMiddleware,
  UtilsController.translateValidation,
  UtilsController.translate,
);

/**
 * @swagger
 * /api/utils/translate-batch:
 *   post:
 *     tags: [Utils]
 *     summary: Traduci più testi in blocco
 *     description: Traduce una lista di testi (ognuno con la propria lingua di destinazione) in un'unica chiamata OpenAI
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [sourceLang, items]
 *             properties:
 *               sourceLang:
 *                 type: string
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [key, text, targetLang]
 *                   properties:
 *                     key:
 *                       type: string
 *                     text:
 *                       type: string
 *                     targetLang:
 *                       type: string
 *     responses:
 *       200:
 *         description: Traduzioni per ogni chiave inviata
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post(
  '/translate-batch',
  authMiddleware,
  UtilsController.translateBatchValidation,
  UtilsController.translateBatch,
);

export default router;
