/*
 * File: /src/routes/utils.routes.ts                                                     *
 * Project: @artaround/server                                                            *
 * Last Modified: 08/09/2026                                                             *
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
 * Rotte di utilità varie: ricerca Wikidata, geocodifica, traduzioni, stato OpenAI, classificazione comandi vocali.
 */
import { Router } from 'express';
import { UtilsController } from '../controllers/utils.controller.js';
import { authMiddleware } from '../middleware/index.js';

const router = Router();

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

/**
 * @swagger
 * /api/utils/voice-command:
 *   post:
 *     tags: [Utils]
 *     summary: Classifica un comando vocale del Navigator
 *     description: Interpreta un testo trascritto e lo associa a uno dei comandi vocali fissi previsti, o null se nessuno è pertinente
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [text, language]
 *             properties:
 *               text:
 *                 type: string
 *                 example: puoi andare al prossimo punto?
 *               language:
 *                 type: string
 *                 example: it
 *     responses:
 *       200:
 *         description: Comando riconosciuto (o null)
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
 *                     command:
 *                       type: string
 *                       nullable: true
 *                       example: next
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post(
  '/voice-command',
  authMiddleware,
  UtilsController.voiceCommandValidation,
  UtilsController.voiceCommand,
);

export default router;
