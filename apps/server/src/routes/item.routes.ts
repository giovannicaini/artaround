import { Router } from 'express';
import { ItemController } from '../controllers/item.controller.js';
import { authMiddleware, roleMiddleware } from '../middleware/index.js';
import { UserRole } from '@artaround/shared';

const router = Router();

/**
 * @swagger
 * /api/items:
 *   get:
 *     tags: [Items]
 *     summary: Lista items (opere d'arte)
 *     description: Ottiene la lista di items con filtri opzionali
 *     parameters:
 *       - in: query
 *         name: museumId
 *         schema:
 *           type: string
 *         description: Filtra per museo
 *       - in: query
 *         name: targetAudience
 *         schema:
 *           type: string
 *           enum: [CHILDREN, FAMILIES, ADULTS, EXPERTS]
 *       - in: query
 *         name: difficulty
 *         schema:
 *           type: string
 *           enum: [BEGINNER, INTERMEDIATE, ADVANCED, EXPERT]
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
 *         description: Lista items
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
 *                     items:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Item'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                         limit:
 *                           type: integer
 *                         total:
 *                           type: integer
 *                         pages:
 *                           type: integer
 */
router.get('/', ItemController.getAll);

/**
 * @swagger
 * /api/items/search:
 *   get:
 *     tags: [Items]
 *     summary: Ricerca items
 *     description: Ricerca full-text negli items
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Termine di ricerca
 *       - in: query
 *         name: museumId
 *         schema:
 *           type: string
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
 *         description: Risultati ricerca
 */
router.get('/search', ItemController.search);

/**
 * @swagger
 * /api/items/{id}:
 *   get:
 *     tags: [Items]
 *     summary: Dettaglio item
 *     description: Ottiene i dettagli completi di un item
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Dettagli item
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Item'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get('/:id', ItemController.getById);

/**
 * @swagger
 * /api/items:
 *   post:
 *     tags: [Items]
 *     summary: Crea nuovo item (Author only)
 *     description: Crea un nuovo item con contenuti multilivello
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [museumId, objectId, contents]
 *             properties:
 *               museumId:
 *                 type: string
 *               objectId:
 *                 type: string
 *                 description: ID Wikidata (es. Q123456)
 *               contents:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     targetAudience:
 *                       type: string
 *                       enum: [CHILDREN, FAMILIES, ADULTS, EXPERTS]
 *                     difficulty:
 *                       type: string
 *                       enum: [BEGINNER, INTERMEDIATE, ADVANCED, EXPERT]
 *                     title:
 *                       type: string
 *                     description:
 *                       type: string
 *                     audioUrl:
 *                       type: string
 *               metadata:
 *                 type: object
 *               image:
 *                 type: string
 *     responses:
 *       201:
 *         description: Item creato
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
router.post(
  '/',
  authMiddleware,
  roleMiddleware(UserRole.AUTHOR),
  ItemController.createValidation,
  ItemController.create,
);

/**
 * @swagger
 * /api/items/{id}:
 *   put:
 *     tags: [Items]
 *     summary: Aggiorna item (Owner/Admin)
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
 *     responses:
 *       200:
 *         description: Item aggiornato
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
  roleMiddleware(UserRole.AUTHOR, UserRole.ADMIN),
  ItemController.update,
);

/**
 * @swagger
 * /api/items/{id}:
 *   delete:
 *     tags: [Items]
 *     summary: Elimina item (Owner/Admin)
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
 *         description: Item eliminato
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.delete(
  '/:id',
  authMiddleware,
  roleMiddleware(UserRole.AUTHOR, UserRole.ADMIN),
  ItemController.delete,
);

export default router;
