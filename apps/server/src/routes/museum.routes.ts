import { Router } from 'express';
import { MuseumController } from '../controllers/museum.controller.js';
import { authMiddleware, roleMiddleware } from '../middleware/index.js';
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
  MuseumController.create,
);

router.put('/:id', authMiddleware, roleMiddleware(UserRole.ADMIN), MuseumController.update);

router.delete('/:id', authMiddleware, roleMiddleware(UserRole.ADMIN), MuseumController.delete);

// ========================================
// FLOOR ROUTES
// ========================================

/**
 * @swagger
 * /api/museums/{id}/floors:
 *   get:
 *     tags: [Museum Floors]
 *     summary: Lista piani del museo
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lista piani
 */
router.get('/:id/floors', MuseumController.getFloors);

/**
 * @swagger
 * /api/museums/{id}/floors/{floorId}:
 *   get:
 *     tags: [Museum Floors]
 *     summary: Dettaglio piano
 */
router.get('/:id/floors/:floorId', MuseumController.getFloor);

/**
 * @swagger
 * /api/museums/{id}/floors:
 *   post:
 *     tags: [Museum Floors]
 *     summary: Aggiunge un piano con mappa SVG
 *     security:
 *       - bearerAuth: []
 */
router.post(
  '/:id/floors',
  authMiddleware,
  roleMiddleware(UserRole.ADMIN, UserRole.AUTHOR),
  MuseumController.floorValidation,
  MuseumController.addFloor,
);

/**
 * @swagger
 * /api/museums/{id}/floors/{floorId}:
 *   put:
 *     tags: [Museum Floors]
 *     summary: Aggiorna un piano
 */
router.put(
  '/:id/floors/:floorId',
  authMiddleware,
  roleMiddleware(UserRole.ADMIN, UserRole.AUTHOR),
  MuseumController.updateFloor,
);

/**
 * @swagger
 * /api/museums/{id}/floors/{floorId}:
 *   delete:
 *     tags: [Museum Floors]
 *     summary: Elimina un piano
 */
router.delete(
  '/:id/floors/:floorId',
  authMiddleware,
  roleMiddleware(UserRole.ADMIN),
  MuseumController.deleteFloor,
);

// ========================================
// MARKER ROUTES (POI)
// ========================================

/**
 * @swagger
 * /api/museums/{id}/floors/{floorId}/markers:
 *   get:
 *     tags: [Map Markers]
 *     summary: Lista marker di un piano
 */
router.get('/:id/floors/:floorId/markers', MuseumController.getMarkers);

/**
 * @swagger
 * /api/museums/{id}/floors/{floorId}/markers:
 *   post:
 *     tags: [Map Markers]
 *     summary: Aggiunge un marker (POI)
 */
router.post(
  '/:id/floors/:floorId/markers',
  authMiddleware,
  roleMiddleware(UserRole.ADMIN, UserRole.AUTHOR),
  MuseumController.markerValidation,
  MuseumController.addMarker,
);

/**
 * @swagger
 * /api/museums/{id}/floors/{floorId}/markers:
 *   put:
 *     tags: [Map Markers]
 *     summary: Aggiorna tutti i marker (bulk update)
 */
router.put(
  '/:id/floors/:floorId/markers',
  authMiddleware,
  roleMiddleware(UserRole.ADMIN, UserRole.AUTHOR),
  MuseumController.updateMarkers,
);

/**
 * @swagger
 * /api/museums/{id}/floors/{floorId}/markers/{markerId}:
 *   put:
 *     tags: [Map Markers]
 *     summary: Aggiorna un marker
 */
router.put(
  '/:id/floors/:floorId/markers/:markerId',
  authMiddleware,
  roleMiddleware(UserRole.ADMIN, UserRole.AUTHOR),
  MuseumController.updateMarker,
);

/**
 * @swagger
 * /api/museums/{id}/floors/{floorId}/markers/{markerId}:
 *   delete:
 *     tags: [Map Markers]
 *     summary: Elimina un marker
 */
router.delete(
  '/:id/floors/:floorId/markers/:markerId',
  authMiddleware,
  roleMiddleware(UserRole.ADMIN, UserRole.AUTHOR),
  MuseumController.deleteMarker,
);

// ========================================
// CONNECTION ROUTES (Stairs, Elevators)
// ========================================

/**
 * @swagger
 * /api/museums/{id}/floors/{floorId}/connections:
 *   post:
 *     tags: [Floor Connections]
 *     summary: Aggiunge un collegamento tra piani
 */
router.post(
  '/:id/floors/:floorId/connections',
  authMiddleware,
  roleMiddleware(UserRole.ADMIN, UserRole.AUTHOR),
  MuseumController.connectionValidation,
  MuseumController.addConnection,
);

/**
 * @swagger
 * /api/museums/{id}/floors/{floorId}/connections/{connectionId}:
 *   delete:
 *     tags: [Floor Connections]
 *     summary: Elimina un collegamento
 */
router.delete(
  '/:id/floors/:floorId/connections/:connectionId',
  authMiddleware,
  roleMiddleware(UserRole.ADMIN, UserRole.AUTHOR),
  MuseumController.deleteConnection,
);

export default router;
