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
