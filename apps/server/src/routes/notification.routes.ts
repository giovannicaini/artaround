/*
 * File: /src/routes/notification.routes.ts                                              *
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
 * Rotte per le notifiche utente.
 */
import { Router } from 'express';
import { NotificationController } from '../controllers/notification.controller.js';
import { authMiddleware as authenticate } from '../middleware/index.js';

const router = Router();

/**
 * @swagger
 * /api/notifications:
 *   get:
 *     tags: [Notifications]
 *     summary: Lista le notifiche dell'utente autenticato (più recenti prima)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista notifiche
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/', authenticate, NotificationController.list);

/**
 * @swagger
 * /api/notifications/{id}/read:
 *   post:
 *     tags: [Notifications]
 *     summary: Segna una notifica come letta
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
 *         description: Notifica segnata come letta
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post('/:id/read', authenticate, NotificationController.markRead);

/**
 * @swagger
 * /api/notifications/read-all:
 *   post:
 *     tags: [Notifications]
 *     summary: Segna tutte le notifiche dell'utente come lette
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Notifiche segnate come lette
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post('/read-all', authenticate, NotificationController.markAllRead);

export default router;
