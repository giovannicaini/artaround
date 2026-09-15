/*
 * File: /src/routes/museum.routes.ts                                                    *
 * Project: @artaround/server                                                            *
 * Last Modified: 12/09/2026                                                             *
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
 * Rotte REST per la gestione dei musei: anagrafica, piantine, sale, marker, curatori, lingue, audio.
 */
import { Router } from 'express';
import { MuseumController } from '../controllers/museum.controller.js';
import { authMiddleware, requireAdmin } from '../middleware/index.js';
import { authorizeResource } from '../utils/policy.util.js';

const router = Router();

/**
 * @swagger
 * /api/museums:
 *   get:
 *     tags: [Museums]
 *     summary: Lista tutti i musei
 *     description: Ottiene la lista di tutti i musei disponibili
 *     responses:
 *       200:
 *         description: Lista musei
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
 *                     $ref: '#/components/schemas/Museum'
 */
router.get('/', MuseumController.getAll);

/**
 * @swagger
 * /api/museums/role-requests:
 *   get:
 *     tags: [Museum Role Requests]
 *     summary: Richieste di ruolo da revisionare (Admin, o curatore per i propri musei)
 *     security:
 *       - bearerAuth: []
 */
router.get('/role-requests', authMiddleware, MuseumController.listReviewableRoleRequests);

/**
 * @swagger
 * /api/museums/{id}:
 *   get:
 *     tags: [Museums]
 *     summary: Dettaglio museo
 *     description: Ottiene i dettagli di un museo specifico
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del museo
 *     responses:
 *       200:
 *         description: Dettagli museo
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Museum'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get('/:id', MuseumController.getById);

/**
 * @swagger
 * /api/museums:
 *   post:
 *     tags: [Museums]
 *     summary: Crea nuovo museo (Admin only)
 *     description: Crea un nuovo museo nel sistema
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, description, location]
 *             properties:
 *               name:
 *                 type: string
 *                 example: Museo della Scienza
 *               description:
 *                 type: string
 *               location:
 *                 type: object
 *                 properties:
 *                   address:
 *                     type: string
 *                   city:
 *                     type: string
 *                   nation:
 *                     type: string
 *                   country:
 *                     type: string
 *                     description: Alias legacy (deprecated)
 *                   coordinates:
 *                     type: object
 *                     properties:
 *                       lat:
 *                         type: number
 *                       lng:
 *                         type: number
 *               configFile:
 *                 type: object
 *     responses:
 *       201:
 *         description: Museo creato
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Museum'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
router.post(
  '/',
  authMiddleware,
  requireAdmin,
  MuseumController.createValidation,
  MuseumController.create,
);

/**
 * @swagger
 * /api/museums/{id}:
 *   put:
 *     tags: [Museums]
 *     summary: Aggiorna un museo (Admin o curatore del museo)
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
 *         description: Museo aggiornato
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Museum'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.put(
  '/:id',
  authMiddleware,
  authorizeResource('museum', 'manage'),
  MuseumController.updateValidation,
  MuseumController.update,
);

/**
 * @swagger
 * /api/museums/{id}/sync-languages:
 *   post:
 *     tags: [Museums]
 *     summary: Sincronizza le lingue attive del museo (Admin o curatore del museo)
 *     description: >
 *       Aggiorna subito activeLanguages, poi avvia in background la rigenerazione delle
 *       traduzioni mancanti degli item e delle visite del museo — risponde subito con
 *       l'id del job da seguire (GET /api/jobs), non aspetta la fine. Solo un job
 *       "sync-languages" alla volta, ovunque.
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
 *             type: object
 *             required: [activeLanguages]
 *             properties:
 *               activeLanguages:
 *                 type: array
 *                 items:
 *                   type: string
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
router.post(
  '/:id/sync-languages',
  authMiddleware,
  authorizeResource('museum', 'manage'),
  MuseumController.syncLanguagesValidation,
  MuseumController.syncLanguages,
);

/**
 * @swagger
 * /api/museums/{id}/generate-audio:
 *   post:
 *     tags: [Museums]
 *     summary: Genera l'audio mancante di item e tappe del museo (Admin o curatore del museo)
 *     description: >
 *       Avvia in background la generazione con OpenAI dell'audio (voce + evidenziazione
 *       sincronizzata) dei testi che non ne hanno ancora, per la lingua sorgente e le
 *       lingue attive già tradotte. Azione esplicita, separata da sync-languages per il
 *       costo/tempo che comporta — può durare ore: risponde subito con l'id del job da
 *       seguire (GET /api/jobs), non aspetta la fine. Solo un job "generate-audio" alla
 *       volta, ovunque (anche a livello di singola visita, vedi
 *       /api/visits/{id}/generate-audio).
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
router.post(
  '/:id/generate-audio',
  authMiddleware,
  authorizeResource('museum', 'manage'),
  MuseumController.generateAudio,
);

/**
 * @swagger
 * /api/museums/{id}:
 *   delete:
 *     tags: [Museums]
 *     summary: Elimina un museo (Admin only)
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
 *         description: Museo eliminato
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.delete('/:id', authMiddleware, requireAdmin, MuseumController.delete);

/**
 * @swagger
 * /api/museums/{id}/curators:
 *   get:
 *     tags: [Museum Curators]
 *     summary: Lista curatori del museo
 *     security:
 *       - bearerAuth: []
 */
router.get(
  '/:id/curators',
  authMiddleware,
  authorizeResource('museum', 'manage'),
  MuseumController.getCurators,
);

/**
 * @swagger
 * /api/museums/{id}/curators:
 *   post:
 *     tags: [Museum Curators]
 *     summary: Assegna un curatore al museo (Admin only)
 *     security:
 *       - bearerAuth: []
 */
router.post('/:id/curators', authMiddleware, requireAdmin, MuseumController.addCurator);

/**
 * @swagger
 * /api/museums/{id}/curators/{userId}:
 *   delete:
 *     tags: [Museum Curators]
 *     summary: Rimuove un curatore dal museo (Admin only)
 *     security:
 *       - bearerAuth: []
 */
router.delete(
  '/:id/curators/:userId',
  authMiddleware,
  requireAdmin,
  MuseumController.removeCurator,
);

/**
 * @swagger
 * /api/museums/{id}/authors:
 *   post:
 *     tags: [Museum Authors]
 *     summary: Promuove un utente già a sistema ad autore del museo (Admin, o curatore di questo museo)
 *     security:
 *       - bearerAuth: []
 */
router.post(
  '/:id/authors',
  authMiddleware,
  authorizeResource('museum', 'manage'),
  MuseumController.addAuthor,
);

/**
 * @swagger
 * /api/museums/{id}/authors/{userId}:
 *   delete:
 *     tags: [Museum Authors]
 *     summary: Revoca il ruolo autore (Admin, o curatore di questo museo)
 *     security:
 *       - bearerAuth: []
 */
router.delete(
  '/:id/authors/:userId',
  authMiddleware,
  authorizeResource('museum', 'manage'),
  MuseumController.removeAuthor,
);

/**
 * @swagger
 * /api/museums/{id}/floors:
 *   get:
 *     tags: [Museum Floors]
 *     summary: Lista piani del museo
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lista piani
 */
router.get('/:id/floors', MuseumController.getFloors);

/**
 * @swagger
 * /api/museums/{id}/floors/{floorId}:
 *   get:
 *     tags: [Museum Floors]
 *     summary: Dettaglio piano
 */
router.get('/:id/floors/:floorId', MuseumController.getFloor);

/**
 * @swagger
 * /api/museums/{id}/floors:
 *   post:
 *     tags: [Museum Floors]
 *     summary: Aggiunge un piano con mappa SVG
 *     security:
 *       - bearerAuth: []
 */
router.post(
  '/:id/floors',
  authMiddleware,
  authorizeResource('museum', 'manage'),
  MuseumController.floorValidation,
  MuseumController.addFloor,
);

/**
 * @swagger
 * /api/museums/{id}/floors/{floorId}:
 *   put:
 *     tags: [Museum Floors]
 *     summary: Aggiorna un piano
 */
router.put(
  '/:id/floors/:floorId',
  authMiddleware,
  authorizeResource('museum', 'manage'),
  MuseumController.updateFloor,
);

/**
 * @swagger
 * /api/museums/{id}/floors/{floorId}:
 *   delete:
 *     tags: [Museum Floors]
 *     summary: Elimina un piano
 */
router.delete(
  '/:id/floors/:floorId',
  authMiddleware,
  authorizeResource('museum', 'manage'),
  MuseumController.deleteFloor,
);

/**
 * @swagger
 * /api/museums/{id}/rooms:
 *   get:
 *     tags: [Museum Rooms]
 *     summary: Lista sale del museo
 */
router.get('/:id/rooms', MuseumController.getRooms);

/**
 * @swagger
 * /api/museums/{id}/rooms:
 *   post:
 *     tags: [Museum Rooms]
 *     summary: Crea una sala (solo nome, il contorno si aggiunge dopo)
 *     security:
 *       - bearerAuth: []
 */
router.post(
  '/:id/rooms',
  authMiddleware,
  authorizeResource('museum', 'manage'),
  MuseumController.roomValidation,
  MuseumController.createRoom,
);

/**
 * @swagger
 * /api/museums/{id}/rooms/{roomId}:
 *   put:
 *     tags: [Museum Rooms]
 *     summary: Rinomina una sala
 */
router.put(
  '/:id/rooms/:roomId',
  authMiddleware,
  authorizeResource('museum', 'manage'),
  MuseumController.roomRenameValidation,
  MuseumController.updateRoom,
);

/**
 * @swagger
 * /api/museums/{id}/rooms/{roomId}/outline:
 *   put:
 *     tags: [Museum Rooms]
 *     summary: Contorna una sala su una piantina (piano + poligono chiuso)
 */
router.put(
  '/:id/rooms/:roomId/outline',
  authMiddleware,
  authorizeResource('museum', 'manage'),
  MuseumController.roomOutlineValidation,
  MuseumController.outlineRoom,
);

/**
 * @swagger
 * /api/museums/{id}/rooms/{roomId}/outline:
 *   delete:
 *     tags: [Museum Rooms]
 *     summary: Rimuove il contorno di una sala (resta senza piano/poligono)
 */
router.delete(
  '/:id/rooms/:roomId/outline',
  authMiddleware,
  authorizeResource('museum', 'manage'),
  MuseumController.removeRoomOutline,
);

/**
 * @swagger
 * /api/museums/{id}/rooms/{roomId}:
 *   delete:
 *     tags: [Museum Rooms]
 *     summary: Elimina una sala
 */
router.delete(
  '/:id/rooms/:roomId',
  authMiddleware,
  authorizeResource('museum', 'manage'),
  MuseumController.deleteRoom,
);

/**
 * @swagger
 * /api/museums/{id}/floors/{floorId}/markers:
 *   get:
 *     tags: [Map Markers]
 *     summary: Lista marker di un piano
 */
router.get('/:id/floors/:floorId/markers', MuseumController.getMarkers);

/**
 * @swagger
 * /api/museums/{id}/floors/{floorId}/markers:
 *   post:
 *     tags: [Map Markers]
 *     summary: Aggiunge un marker (POI)
 */
router.post(
  '/:id/floors/:floorId/markers',
  authMiddleware,
  authorizeResource('museum', 'manage'),
  MuseumController.markerValidation,
  MuseumController.addMarker,
);

/**
 * @swagger
 * /api/museums/{id}/floors/{floorId}/markers:
 *   put:
 *     tags: [Map Markers]
 *     summary: Aggiorna tutti i marker (bulk update)
 */
router.put(
  '/:id/floors/:floorId/markers',
  authMiddleware,
  authorizeResource('museum', 'manage'),
  MuseumController.updateMarkers,
);

/**
 * @swagger
 * /api/museums/{id}/floors/{floorId}/markers/{markerId}:
 *   put:
 *     tags: [Map Markers]
 *     summary: Aggiorna un marker
 */
router.put(
  '/:id/floors/:floorId/markers/:markerId',
  authMiddleware,
  authorizeResource('museum', 'manage'),
  MuseumController.updateMarker,
);

/**
 * @swagger
 * /api/museums/{id}/floors/{floorId}/markers/{markerId}:
 *   delete:
 *     tags: [Map Markers]
 *     summary: Elimina un marker
 */
router.delete(
  '/:id/floors/:floorId/markers/:markerId',
  authMiddleware,
  authorizeResource('museum', 'manage'),
  MuseumController.deleteMarker,
);

/**
 * @swagger
 * /api/museums/{id}/floors/{floorId}/connections:
 *   post:
 *     tags: [Floor Connections]
 *     summary: Aggiunge un collegamento tra piani
 */
router.post(
  '/:id/floors/:floorId/connections',
  authMiddleware,
  authorizeResource('museum', 'manage'),
  MuseumController.connectionValidation,
  MuseumController.addConnection,
);

/**
 * @swagger
 * /api/museums/{id}/floors/{floorId}/connections/{connectionId}:
 *   delete:
 *     tags: [Floor Connections]
 *     summary: Elimina un collegamento
 */
router.delete(
  '/:id/floors/:floorId/connections/:connectionId',
  authMiddleware,
  authorizeResource('museum', 'manage'),
  MuseumController.deleteConnection,
);

/**
 * @swagger
 * /api/museums/{id}/role-requests:
 *   post:
 *     tags: [Museum Role Requests]
 *     summary: Chiedi di diventare curatore o autore di questo museo
 *     security:
 *       - bearerAuth: []
 */
router.post(
  '/:id/role-requests',
  authMiddleware,
  MuseumController.requestRoleValidation,
  MuseumController.requestRole,
);

/**
 * @swagger
 * /api/museums/{id}/role-requests/{requestId}:
 *   delete:
 *     tags: [Museum Role Requests]
 *     summary: Annulla (il richiedente) o rifiuta (admin/curatore) una richiesta
 *     security:
 *       - bearerAuth: []
 */
router.delete('/:id/role-requests/:requestId', authMiddleware, MuseumController.cancelRoleRequest);

/**
 * @swagger
 * /api/museums/{id}/role-requests/{requestId}/approve:
 *   post:
 *     tags: [Museum Role Requests]
 *     summary: Conferma una richiesta di ruolo (Admin, o curatore del museo per AUTHOR)
 *     security:
 *       - bearerAuth: []
 */
router.post(
  '/:id/role-requests/:requestId/approve',
  authMiddleware,
  MuseumController.approveRoleRequest,
);

export default router;
