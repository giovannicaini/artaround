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
 *           description: Ordine della tappa nella sequenza della visita
 *         type:
 *           type: string
 *           enum: [artwork, logistic, navigation]
 *         artworkId:
 *           type: string
 *           description: ID Wikidata dell'opera (richiesto per le tappe artwork)
 *         itemIds:
 *           type: array
 *           items:
 *             type: string
 *           description: ID degli item di contenuto disponibili per questa tappa (solo per tappe artwork)
 *         logisticTitle:
 *           type: string
 *           description: Titolo della tappa logistica (es. "Informazioni utili")
 *         logisticText:
 *           type: string
 *           description: Testo informativo (per tappe logistiche)
 *         logisticIcon:
 *           type: string
 *           description: Nome icona per la tappa logistica (ticket, info, clock, ecc.)
 *         navigationText:
 *           type: string
 *           description: Indicazioni di navigazione (per tappe di navigazione)
 *         navigationImage:
 *           type: string
 *           description: URL dell'immagine che mostra il percorso
 *         fromRoom:
 *           type: string
 *           description: Sala/area di partenza (per la navigazione)
 *         toRoom:
 *           type: string
 *           description: Sala/area di destinazione (per la navigazione)
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
 *           description: ID Wikidata del museo
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
 *     summary: Lista tutte le visite
 *     description: Ottiene la lista delle visite con filtri
 *     parameters:
 *       - in: query
 *         name: museumId
 *         schema:
 *           type: string
 *         description: ID Wikidata del museo
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
 *         description: Lista visite con paginazione
 */
router.get('/', VisitController.getAll);

/**
 * @swagger
 * /api/visits/my-visits:
 *   get:
 *     tags: [Visits]
 *     summary: Ottieni le mie visite
 *     description: Ottiene le visite create dall'utente autenticato
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Visite dell'utente
 */
router.get('/my-visits', authenticate, VisitController.getMyVisits);

/**
 * @swagger
 * /api/visits/museum/{museumId}:
 *   get:
 *     tags: [Visits]
 *     summary: Ottieni le visite di un museo
 *     description: Ottiene tutte le visite di un museo specifico
 *     parameters:
 *       - in: path
 *         name: museumId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID Wikidata del museo
 *       - in: query
 *         name: isPublished
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Visite del museo
 */
router.get('/museum/:museumId', VisitController.getByMuseum);

/**
 * @swagger
 * /api/visits/{id}:
 *   get:
 *     tags: [Visits]
 *     summary: Ottieni visita per ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Dettagli visita
 *       404:
 *         description: Visita non trovata
 */
router.get('/:id', VisitController.getById);

/**
 * @swagger
 * /api/visits:
 *   post:
 *     tags: [Visits]
 *     summary: Crea visita
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
 *         description: Visita creata
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
 *     summary: Aggiorna visita
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
 *         description: Visita aggiornata
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
 *     summary: Aggiungi tappa alla visita
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
 *         description: Tappa aggiunta
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
 *     summary: Aggiorna tappa della visita
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
 *         description: Tappa aggiornata
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
 *     summary: Elimina tappa dalla visita
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
 *         description: Tappa eliminata
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
 *     summary: Riordina le tappe della visita
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
 *         description: Tappe riordinate
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
 *     summary: Pubblica visita
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
  authenticate,
  authorizeRoles(UserRole.ADMIN, UserRole.AUTHOR, UserRole.CURATOR),
  VisitController.publish,
);

/**
 * @swagger
 * /api/visits/{id}/unpublish:
 *   post:
 *     tags: [Visits]
 *     summary: Rimuovi pubblicazione visita
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
 *         description: Pubblicazione rimossa
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
  authenticate,
  authorizeRoles(UserRole.ADMIN, UserRole.AUTHOR, UserRole.CURATOR),
  VisitController.delete,
);

export default router;
