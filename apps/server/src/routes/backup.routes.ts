/*
 * File: /src/routes/backup.routes.ts                                                    *
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
 * Rotte per gli snapshot di database + uploads (solo admin): creazione, lista, ripristino, eliminazione.
 */
import { Router } from 'express';
import { BackupController } from '../controllers/backup.controller.js';
import { authMiddleware as authenticate } from '../middleware/index.js';
import { requireAdmin } from '../middleware/role.middleware.js';

const router = Router();

// Tutte le route di questo file: solo amministratori.
router.use(authenticate, requireAdmin);

/**
 * @swagger
 * /api/admin/backups:
 *   get:
 *     tags: [Backups]
 *     summary: Lista gli snapshot di database + uploads (solo admin)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista backup
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *   post:
 *     tags: [Backups]
 *     summary: Avvia la creazione di un nuovo snapshot (solo admin)
 *     description: >
 *       Dump di tutte le collezioni Mongo (EJSON) + archivio della cartella
 *       uploads. Avviato in background, risponde 202 subito: il progresso si
 *       segue rileggendo la lista. Un solo backup/ripristino alla volta.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       202:
 *         description: Creazione avviata
 *       409:
 *         description: C'è già un backup o ripristino in corso
 */
router.get('/', BackupController.list);
router.post('/', BackupController.createValidation, BackupController.create);

/**
 * @swagger
 * /api/admin/backups/{id}/restore:
 *   post:
 *     tags: [Backups]
 *     summary: Ripristina database + uploads da uno snapshot (solo admin)
 *     description: >
 *       Sovrascrive TUTTO lo stato attuale (database e cartella uploads) con
 *       quello dello snapshot scelto — operazione distruttiva e irreversibile
 *       sui dati creati dopo lo snapshot. Avviata in background, risponde 202 subito.
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
 *         description: Ripristino avviato
 *       409:
 *         description: Backup non pronto, o un'altra operazione è già in corso
 */
router.post('/:id/restore', BackupController.restore);

/**
 * @swagger
 * /api/admin/backups/{id}:
 *   delete:
 *     tags: [Backups]
 *     summary: Elimina uno snapshot (solo admin)
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
 *         description: Backup eliminato
 */
router.delete('/:id', BackupController.remove);

export default router;
