/*
 * File: /src/routes/visit.routes.ts                                                     *
 * Project: @artaround/server                                                            *
 * Last Modified: 09/09/2026                                                             *
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
 * Rotte REST per la gestione delle visite guidate.
 */
import { Router } from 'express';
import { VisitController } from '../controllers/visit.controller.js';
import { authMiddleware as authenticate, optionalAuthMiddleware } from '../middleware/index.js';
import { authorizeCreate } from '../utils/policy.util.js';

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     VisitStep:
 *       type: object
 *       required:
 *         - order
 *         - type
 *       properties:
 *         order:
 *           type: number
 *           description: Ordine della tappa nella sequenza della visita
 *         type:
 *           type: string
 *           enum: [artwork, logistic, navigation]
 *         artworkId:
 *           type: string
 *           description: ID Wikidata dell'opera (richiesto per le tappe artwork)
 *         itemIds:
 *           type: array
 *           items:
 *             type: string
 *           description: ID degli item di contenuto disponibili per questa tappa (solo per tappe artwork)
 *         logisticTitle:
 *           type: string
 *           description: Titolo della tappa logistica (es. "Informazioni utili")
 *         logisticText:
 *           type: string
 *           description: Testo informativo (per tappe logistiche)
 *         logisticIcon:
 *           type: string
 *           description: Nome icona per la tappa logistica (ticket, info, clock, ecc.)
 *         navigationText:
 *           type: string
 *           description: Indicazioni di navigazione (per tappe di navigazione)
 *         navigationImage:
 *           type: string
 *           description: URL dell'immagine che mostra il percorso
 *         fromRoom:
 *           type: string
 *           description: Sala/area di partenza (per la navigazione)
 *         toRoom:
 *           type: string
 *           description: Sala/area di destinazione (per la navigazione)
 *     Visit:
 *       type: object
 *       required:
 *         - museumId
 *         - title
 *         - description
 *         - steps
 *         - targetAudience
 *       properties:
 *         museumId:
 *           type: string
 *           description: ID Wikidata del museo
 *         title:
 *           type: string
 *         description:
 *           type: string
 *         steps:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/VisitStep'
 *         generalInfo:
 *           type: object
 *           properties:
 *             estimatedDuration:
 *               type: number
 *             difficulty:
 *               type: string
 *             accessibilityFeatures:
 *               type: array
 *               items:
 *                 type: string
 *         targetAudience:
 *           type: object
 *           properties:
 *             languageLevels:
 *               type: array
 *               items:
 *                 type: string
 *                 enum: [infantile, elementare, medio, specialistico]
 *             ageGroups:
 *               type: array
 *               items:
 *                 type: string
 *         authorId:
 *           type: string
 *         isPublished:
 *           type: boolean
 */

/**
 * @swagger
 * /api/visits:
 *   get:
 *     tags: [Visits]
 *     summary: Lista tutte le visite
 *     description: Ottiene la lista delle visite con filtri
 *     parameters:
 *       - in: query
 *         name: museumId
 *         schema:
 *           type: string
 *         description: ID Wikidata del museo
 *       - in: query
 *         name: authorId
 *         schema:
 *           type: string
 *       - in: query
 *         name: isPublished
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: isFree
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: languageLevel
 *         schema:
 *           type: string
 *           enum: [infantile, elementare, medio, specialistico]
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Lista visite con paginazione
 */
router.get('/', VisitController.getAll);

/**
 * @swagger
 * /api/visits/my-visits:
 *   get:
 *     tags: [Visits]
 *     summary: Ottieni le mie visite
 *     description: Ottiene le visite create dall'utente autenticato
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Visite dell'utente
 */
router.get('/my-visits', authenticate, VisitController.getMyVisits);

/**
 * @swagger
 * /api/visits/museum/{museumId}:
 *   get:
 *     tags: [Visits]
 *     summary: Ottieni le visite di un museo
 *     description: Ottiene tutte le visite di un museo specifico
 *     parameters:
 *       - in: path
 *         name: museumId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID Wikidata del museo
 *       - in: query
 *         name: isPublished
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Visite del museo
 */
router.get('/museum/:museumId', VisitController.getByMuseum);

/**
 * @swagger
 * /api/visits/{id}:
 *   get:
 *     tags: [Visits]
 *     summary: Ottieni visita per ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Dettagli visita
 *       404:
 *         description: Visita non trovata
 */
router.get('/:id', optionalAuthMiddleware, VisitController.getById);

/**
 * @swagger
 * /api/visits:
 *   post:
 *     tags: [Visits]
 *     summary: Crea visita
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Visit'
 *     responses:
 *       201:
 *         description: Visita creata
 */
router.post(
  '/',
  authenticate,
  authorizeCreate('visit'),
  VisitController.createValidation,
  VisitController.create,
);

/**
 * @swagger
 * /api/visits/{id}:
 *   put:
 *     tags: [Visits]
 *     summary: Aggiorna visita
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Visit'
 *     responses:
 *       200:
 *         description: Visita aggiornata
 */
router.put('/:id', authenticate, VisitController.updateValidation, VisitController.update);

/**
 * @swagger
 * /api/visits/{id}/publish:
 *   post:
 *     tags: [Visits]
 *     summary: Pubblica visita
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Visita pubblicata
 */
router.post('/:id/publish', authenticate, VisitController.publish);

/**
 * @swagger
 * /api/visits/{id}/unpublish:
 *   post:
 *     tags: [Visits]
 *     summary: Rimuovi pubblicazione visita
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Pubblicazione rimossa
 */
router.post('/:id/unpublish', authenticate, VisitController.unpublish);

/**
 * @swagger
 * /api/visits/{id}:
 *   delete:
 *     tags: [Visits]
 *     summary: Elimina visita
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Visita eliminata
 */
router.delete('/:id', authenticate, VisitController.delete);

/**
 * @swagger
 * /api/visits/{id}/generate-audio:
 *   post:
 *     tags: [Visits]
 *     summary: Genera l'audio mancante di questa visita (Admin o curatore del museo)
 *     description: >
 *       Come /api/museums/{id}/generate-audio ma limitato alle tappe e agli item di
 *       questa sola visita. Avvia un job in background e risponde subito con il suo id
 *       (l'avanzamento si segue da GET /api/jobs) — solo un job "generate-audio" alla
 *       volta, ovunque.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       202:
 *         description: Generazione avviata, con l'id del job
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       409:
 *         description: C'è già un job "generate-audio" in corso
 */
router.post('/:id/generate-audio', authenticate, VisitController.generateAudio);

/**
 * @swagger
 * /api/visits/{id}/sync-languages:
 *   post:
 *     tags: [Visits]
 *     summary: Sincronizza le traduzioni di questa visita (Admin o curatore del museo)
 *     description: >
 *       Come /api/museums/{id}/sync-languages ma limitato a questa sola visita (lei
 *       stessa + gli item che referenzia), con le lingue attive già impostate sul museo.
 *       Avvia un job in background e risponde subito con il suo id (l'avanzamento si
 *       segue da GET /api/jobs) — solo un job "sync-languages" alla volta, ovunque.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       202:
 *         description: Sincronizzazione avviata, con l'id del job
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       409:
 *         description: C'è già un job "sync-languages" in corso
 */
router.post('/:id/sync-languages', authenticate, VisitController.syncLanguages);

export default router;
