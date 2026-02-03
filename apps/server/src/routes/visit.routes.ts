import { Router } from 'express';
import { VisitController } from '../controllers/visit.controller.js';
import { authMiddleware, roleMiddleware } from '../middleware/index.js';
import { UserRole } from '@artaround/shared';

const router = Router();

/**
 * @swagger
 * /api/visits:
 *   get:
 *     tags: [Visits]
 *     summary: Lista visite
 *     description: Ottiene la lista di visite con filtri
 *     parameters:
 *       - in: query
 *         name: museumId
 *         schema:
 *           type: string
 *       - in: query
 *         name: targetAudience
 *         schema:
 *           type: string
 *       - in: query
 *         name: difficulty
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lista visite
 */
router.get('/', VisitController.getAll);

/**
 * @swagger
 * /api/visits/{id}:
 *   get:
 *     tags: [Visits]
 *     summary: Dettaglio visita
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Dettagli visita completi
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Visit'
 */
router.get('/:id', VisitController.getById);

/**
 * @swagger
 * /api/visits/user/my-visits:
 *   get:
 *     tags: [Visits]
 *     summary: Le mie visite
 *     description: Ottiene le visite create dall'utente autenticato
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista visite dell'utente
 */
router.get('/user/my-visits', authMiddleware, VisitController.getMyVisits);

/**
 * @swagger
 * /api/visits:
 *   post:
 *     tags: [Visits]
 *     summary: Crea visita (Author)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [museumId, title, items, targetAudience, difficulty]
 *             properties:
 *               museumId:
 *                 type: string
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     itemId:
 *                       type: string
 *                     order:
 *                       type: integer
 *               targetAudience:
 *                 type: string
 *                 enum: [CHILDREN, FAMILIES, ADULTS, EXPERTS]
 *               difficulty:
 *                 type: string
 *                 enum: [BEGINNER, INTERMEDIATE, ADVANCED, EXPERT]
 *               estimatedDuration:
 *                 type: integer
 *               price:
 *                 type: number
 *     responses:
 *       201:
 *         description: Visita creata
 */
router.post(
  '/',
  authMiddleware,
  roleMiddleware(UserRole.AUTHOR),
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
 *     responses:
 *       200:
 *         description: Visita aggiornata
 */
router.put(
  '/:id',
  authMiddleware,
  roleMiddleware(UserRole.AUTHOR, UserRole.ADMIN),
  VisitController.update,
);

/**
 * @swagger
 * /api/visits/{id}/publish:
 *   post:
 *     tags: [Visits]
 *     summary: Pubblica visita
 *     description: Rende la visita disponibile nel marketplace
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
router.post(
  '/:id/publish',
  authMiddleware,
  roleMiddleware(UserRole.AUTHOR, UserRole.ADMIN),
  VisitController.publish,
);

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
router.delete(
  '/:id',
  authMiddleware,
  roleMiddleware(UserRole.AUTHOR, UserRole.ADMIN),
  VisitController.delete,
);

export default router;
