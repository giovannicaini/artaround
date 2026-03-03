import { Router } from 'express';
import { UtilsController } from '../controllers/utils.controller.js';
import { authMiddleware, roleMiddleware } from '../middleware/index.js';
import { UserRole } from '@artaround/shared';

const router = Router();

router.get(
  '/navigator-default-configs',
  authMiddleware,
  roleMiddleware(UserRole.ADMIN),
  UtilsController.getNavigatorDefaultConfigs,
);

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

router.post(
  '/translate-batch',
  authMiddleware,
  UtilsController.translateBatchValidation,
  UtilsController.translateBatch,
);

export default router;
