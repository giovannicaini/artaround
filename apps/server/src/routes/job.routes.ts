import { Router } from 'express';
import { JobController } from '../controllers/job.controller.js';
import { authMiddleware as authenticate } from '../middleware/index.js';

const router = Router();

/**
 * @swagger
 * /api/jobs:
 *   get:
 *     tags: [Jobs]
 *     summary: Lista i job in background (attivi + ultimi conclusi)
 *     description: >
 *       Job attivi (sempre inclusi) più gli ultimi conclusi, filtrati ai musei che
 *       l'utente autenticato può gestire (admin: tutti). Pensata per il pannello
 *       notifiche del marketplace, interrogata a polling.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista job
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/', authenticate, JobController.list);

/**
 * @swagger
 * /api/jobs/{id}/cancel:
 *   post:
 *     tags: [Jobs]
 *     summary: Richiede l'interruzione di un job in corso
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
 *         description: Interruzione richiesta (o job già concluso)
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.post('/:id/cancel', authenticate, JobController.cancel);

export default router;
