import { Router } from 'express';
import { VisitController } from '../controllers/visit.controller.js';
import {
  authMiddleware as authenticate,
  roleMiddleware as authorizeRoles,
} from '../middleware/index.js';
import { UserRole } from '@artaround/shared';

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
 *           description: Step order in the visit sequence
 *         type:
 *           type: string
 *           enum: [artwork, logistic, navigation]
 *         artworkId:
 *           type: string
 *           description: Artwork Wikidata ID (required for artwork steps)
 *         itemIds:
 *           type: array
 *           items:
 *             type: string
 *           description: Content item IDs available for this step (only for artwork steps)
 *         logisticTitle:
 *           type: string
 *           description: Title for logistic step (e.g., "Informazioni utili")
 *         logisticText:
 *           type: string
 *           description: Logistic info text (for logistic steps)
 *         logisticIcon:
 *           type: string
 *           description: Icon name for logistic step (ticket, info, clock, etc.)
 *         navigationText:
 *           type: string
 *           description: Navigation instructions (for navigation steps)
 *         navigationImage:
 *           type: string
 *           description: Image URL showing the path
 *         fromRoom:
 *           type: string
 *           description: Starting room/area (for navigation)
 *         toRoom:
 *           type: string
 *           description: Destination room/area (for navigation)
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
 *           description: Museum's Wikidata ID
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
 *     summary: Get all visits
 *     description: Get list of visits with filters
 *     parameters:
 *       - in: query
 *         name: museumId
 *         schema:
 *           type: string
 *         description: Museum's Wikidata ID
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
 *         description: List of visits with pagination
 */
router.get('/', VisitController.getAll);

/**
 * @swagger
 * /api/visits/my-visits:
 *   get:
 *     tags: [Visits]
 *     summary: Get my visits
 *     description: Get visits created by authenticated user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User's visits
 */
router.get('/my-visits', authenticate, VisitController.getMyVisits);

/**
 * @swagger
 * /api/visits/museum/{museumId}:
 *   get:
 *     tags: [Visits]
 *     summary: Get visits for a museum
 *     description: Get all visits for a specific museum
 *     parameters:
 *       - in: path
 *         name: museumId
 *         required: true
 *         schema:
 *           type: string
 *         description: Museum's Wikidata ID
 *       - in: query
 *         name: isPublished
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Visits for the museum
 */
router.get('/museum/:museumId', VisitController.getByMuseum);

/**
 * @swagger
 * /api/visits/{id}:
 *   get:
 *     tags: [Visits]
 *     summary: Get visit by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Visit details
 *       404:
 *         description: Visit not found
 */
router.get('/:id', VisitController.getById);

/**
 * @swagger
 * /api/visits:
 *   post:
 *     tags: [Visits]
 *     summary: Create visit
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
 *         description: Visit created
 */
router.post(
  '/',
  authenticate,
  authorizeRoles(UserRole.ADMIN, UserRole.AUTHOR, UserRole.CURATOR),
  VisitController.createValidation,
  VisitController.create,
);

/**
 * @swagger
 * /api/visits/{id}:
 *   put:
 *     tags: [Visits]
 *     summary: Update visit
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
 *         description: Visit updated
 */
router.put(
  '/:id',
  authenticate,
  authorizeRoles(UserRole.ADMIN, UserRole.AUTHOR, UserRole.CURATOR),
  VisitController.update,
);

/**
 * @swagger
 * /api/visits/{id}/steps:
 *   post:
 *     tags: [Visits]
 *     summary: Add step to visit
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
 *             $ref: '#/components/schemas/VisitStep'
 *     responses:
 *       200:
 *         description: Step added
 */
router.post(
  '/:id/steps',
  authenticate,
  authorizeRoles(UserRole.ADMIN, UserRole.AUTHOR, UserRole.CURATOR),
  VisitController.addStep,
);

/**
 * @swagger
 * /api/visits/{id}/steps/{stepOrder}:
 *   put:
 *     tags: [Visits]
 *     summary: Update step in visit
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: stepOrder
 *         required: true
 *         schema:
 *           type: number
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VisitStep'
 *     responses:
 *       200:
 *         description: Step updated
 */
router.put(
  '/:id/steps/:stepOrder',
  authenticate,
  authorizeRoles(UserRole.ADMIN, UserRole.AUTHOR, UserRole.CURATOR),
  VisitController.updateStep,
);

/**
 * @swagger
 * /api/visits/{id}/steps/{stepOrder}:
 *   delete:
 *     tags: [Visits]
 *     summary: Delete step from visit
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: stepOrder
 *         required: true
 *         schema:
 *           type: number
 *     responses:
 *       200:
 *         description: Step deleted
 */
router.delete(
  '/:id/steps/:stepOrder',
  authenticate,
  authorizeRoles(UserRole.ADMIN, UserRole.AUTHOR, UserRole.CURATOR),
  VisitController.deleteStep,
);

/**
 * @swagger
 * /api/visits/{id}/reorder:
 *   post:
 *     tags: [Visits]
 *     summary: Reorder visit steps
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
 *             properties:
 *               stepOrders:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     oldOrder:
 *                       type: number
 *                     newOrder:
 *                       type: number
 *     responses:
 *       200:
 *         description: Steps reordered
 */
router.post(
  '/:id/reorder',
  authenticate,
  authorizeRoles(UserRole.ADMIN, UserRole.AUTHOR, UserRole.CURATOR),
  VisitController.reorderSteps,
);

/**
 * @swagger
 * /api/visits/{id}/publish:
 *   post:
 *     tags: [Visits]
 *     summary: Publish visit
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
 *         description: Visit published
 */
router.post(
  '/:id/publish',
  authenticate,
  authorizeRoles(UserRole.ADMIN, UserRole.AUTHOR, UserRole.CURATOR),
  VisitController.publish,
);

/**
 * @swagger
 * /api/visits/{id}/unpublish:
 *   post:
 *     tags: [Visits]
 *     summary: Unpublish visit
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
 *         description: Visit unpublished
 */
router.post(
  '/:id/unpublish',
  authenticate,
  authorizeRoles(UserRole.ADMIN, UserRole.AUTHOR, UserRole.CURATOR),
  VisitController.unpublish,
);

/**
 * @swagger
 * /api/visits/{id}:
 *   delete:
 *     tags: [Visits]
 *     summary: Delete visit
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
 *         description: Visit deleted
 */
router.delete(
  '/:id',
  authenticate,
  authorizeRoles(UserRole.ADMIN, UserRole.AUTHOR, UserRole.CURATOR),
  VisitController.delete,
);

export default router;
