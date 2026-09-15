/*
 * File: /src/routes/navigator-config.routes.ts                                          *
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
 * Rotte per la configurazione di branding/PWA del Navigator.
 */
import { Router } from 'express';
import { NavigatorConfigController } from '../controllers/navigator-config.controller.js';
import { authMiddleware } from '../middleware/index.js';

const router = Router();

/**
 * @swagger
 * /api/navigator-configs/public:
 *   get:
 *     tags: [Navigator]
 *     summary: Elenco pubblico delle configurazioni Navigator
 *     description: Pubblico — nome, slug, applicability, museumId e colore primario di ogni configurazione (globale e di museo), usato per linkare tutti i Navigator esistenti (es. dalla landing page).
 *     responses:
 *       200:
 *         description: Elenco delle configurazioni
 */
router.get('/public', NavigatorConfigController.publicList);

/**
 * @swagger
 * /api/navigator-configs/resolve:
 *   get:
 *     tags: [Navigator]
 *     summary: Risolve la configurazione Navigator attiva
 *     description: Pubblico — usato dall'app Navigator per sapere quale branding/config applicare, dato un museo e/o uno slug richiesto via link/QR.
 *     parameters:
 *       - in: query
 *         name: museumId
 *         schema: { type: string }
 *       - in: query
 *         name: slug
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Configurazione risolta (o il default di piattaforma)
 */
router.get('/resolve', NavigatorConfigController.resolve);

/**
 * @swagger
 * /api/navigator-configs/manifest:
 *   get:
 *     tags: [Navigator]
 *     summary: Web App Manifest della configurazione risolta
 *     description: Pubblico — manifest.webmanifest reale, generato dai campi pwa.* della configurazione risolta con la stessa logica di /resolve.
 *     parameters:
 *       - in: query
 *         name: museumId
 *         schema: { type: string }
 *       - in: query
 *         name: slug
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Web App Manifest (application/manifest+json)
 */
router.get('/manifest', NavigatorConfigController.manifest);

/**
 * @swagger
 * /api/navigator-configs:
 *   get:
 *     tags: [Navigator]
 *     summary: Lista configurazioni Navigator
 *     description: Admin — tutte. Curatore — solo quelle dei musei di cui è curatore.
 *     security:
 *       - bearerAuth: []
 */
router.get('/', authMiddleware, NavigatorConfigController.list);

/**
 * @swagger
 * /api/navigator-configs:
 *   post:
 *     tags: [Navigator]
 *     summary: Crea una configurazione Navigator
 *     description: Globale — solo admin (al massimo una in tutto il sistema). Di museo — admin o curatore di quel museo.
 *     security:
 *       - bearerAuth: []
 */
router.post('/', authMiddleware, NavigatorConfigController.create);

/**
 * @swagger
 * /api/navigator-configs/{id}:
 *   put:
 *     tags: [Navigator]
 *     summary: Aggiorna una configurazione Navigator
 *     description: applicability e museumId non sono modificabili dopo la creazione.
 *     security:
 *       - bearerAuth: []
 */
router.put('/:id', authMiddleware, NavigatorConfigController.update);

/**
 * @swagger
 * /api/navigator-configs/{id}:
 *   delete:
 *     tags: [Navigator]
 *     summary: Elimina una configurazione Navigator
 *     security:
 *       - bearerAuth: []
 */
router.delete('/:id', authMiddleware, NavigatorConfigController.delete);

export default router;
