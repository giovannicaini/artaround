import { Router } from 'express';
import { MuseumController } from '../controllers/museum.controller';
import { authMiddleware, roleMiddleware } from '../middleware';
import { UserRole } from '@artaround/shared';

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
 * /api/museums/{id}/config:
 *   get:
 *     tags: [Museums]
 *     summary: Configurazione museo
 *     description: Ottiene il file di configurazione JSON del museo
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del museo
 *     responses:
 *       200:
 *         description: Configurazione museo
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   description: Configurazione personalizzata del museo
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get('/:id/config', MuseumController.getConfig);

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
 *                   country:
 *                     type: string
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
  roleMiddleware(UserRole.ADMIN),
  MuseumController.createValidation,
  MuseumController.create
);

router.put(
  '/:id',
  authMiddleware,
  roleMiddleware(UserRole.ADMIN),
  MuseumController.update
);

router.delete(
  '/:id',
  authMiddleware,
  roleMiddleware(UserRole.ADMIN),
  MuseumController.delete
);

export default router;
