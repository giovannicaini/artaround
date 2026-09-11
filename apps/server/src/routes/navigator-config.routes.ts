import { Router } from 'express';
import { NavigatorConfigController } from '../controllers/navigator-config.controller.js';
import { authMiddleware } from '../middleware/index.js';

const router = Router();

/**
 * @swagger
 * /api/navigator-configs/resolve:
 *   get:
 *     tags: [Navigator]
 *     summary: Risolve la configurazione Navigator attiva
 *     description: Pubblico — usato dall'app Navigator per sapere quale branding/config applicare, dato un museo e/o uno slug richiesto via link/QR.
 *     parameters:
 *       - in: query
 *         name: museumId
 *         schema: { type: string }
 *       - in: query
 *         name: slug
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Configurazione risolta (o il default di piattaforma)
 */
router.get('/resolve', NavigatorConfigController.resolve);

/**
 * @swagger
 * /api/navigator-configs/manifest:
 *   get:
 *     tags: [Navigator]
 *     summary: Web App Manifest della configurazione risolta
 *     description: Pubblico — manifest.webmanifest reale, generato dai campi pwa.* della configurazione risolta con la stessa logica di /resolve.
 *     parameters:
 *       - in: query
 *         name: museumId
 *         schema: { type: string }
 *       - in: query
 *         name: slug
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Web App Manifest (application/manifest+json)
 */
router.get('/manifest', NavigatorConfigController.manifest);

/**
 * @swagger
 * /api/navigator-configs:
 *   get:
 *     tags: [Navigator]
 *     summary: Lista configurazioni Navigator
 *     description: Admin — tutte. Curatore — solo quelle dei musei di cui è curatore.
 *     security:
 *       - bearerAuth: []
 */
router.get('/', authMiddleware, NavigatorConfigController.list);

/**
 * @swagger
 * /api/navigator-configs:
 *   post:
 *     tags: [Navigator]
 *     summary: Crea una configurazione Navigator
 *     description: Globale — solo admin (al massimo una in tutto il sistema). Di museo — admin o curatore di quel museo.
 *     security:
 *       - bearerAuth: []
 */
router.post('/', authMiddleware, NavigatorConfigController.create);

/**
 * @swagger
 * /api/navigator-configs/{id}:
 *   put:
 *     tags: [Navigator]
 *     summary: Aggiorna una configurazione Navigator
 *     description: applicability e museumId non sono modificabili dopo la creazione.
 *     security:
 *       - bearerAuth: []
 */
router.put('/:id', authMiddleware, NavigatorConfigController.update);

/**
 * @swagger
 * /api/navigator-configs/{id}:
 *   delete:
 *     tags: [Navigator]
 *     summary: Elimina una configurazione Navigator
 *     security:
 *       - bearerAuth: []
 */
router.delete('/:id', authMiddleware, NavigatorConfigController.delete);

export default router;
