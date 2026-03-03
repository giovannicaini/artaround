import { Router } from 'express';
import { MarketplaceController } from '../controllers/marketplace.controller.js';
import { authMiddleware } from '../middleware/index.js';

const router = Router();

router.get('/items', MarketplaceController.getItems);

/**
 * @swagger
 * /api/marketplace/visits:
 *   get:
 *     tags: [Marketplace]
 *     summary: Catalogo visite disponibili
 *     description: Ottiene tutte le visite pubblicate e acquistabili
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
 *       - in: query
 *         name: minPrice
 *         schema:
 *           type: number
 *       - in: query
 *         name: maxPrice
 *         schema:
 *           type: number
 *     responses:
 *       200:
 *         description: Catalogo visite
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
 *                     $ref: '#/components/schemas/Visit'
 */
router.get('/visits', MarketplaceController.getVisits);

router.post('/purchase/item/:itemId', authMiddleware, MarketplaceController.purchaseItem);

/**
 * @swagger
 * /api/marketplace/purchase/{visitId}:
 *   post:
 *     tags: [Marketplace]
 *     summary: Acquista visita
 *     description: Simula l'acquisto di una visita (no pagamento reale)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: visitId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Acquisto completato
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
 *                     purchaseId:
 *                       type: string
 *                     visitId:
 *                       type: string
 *                     price:
 *                       type: number
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.post('/purchase/:visitId', authMiddleware, MarketplaceController.purchaseVisit);
router.post('/purchase/visit/:visitId', authMiddleware, MarketplaceController.purchaseVisit);

/**
 * @swagger
 * /api/marketplace/my-purchases:
 *   get:
 *     tags: [Marketplace]
 *     summary: I miei acquisti
 *     description: Ottiene tutte le visite acquistate dall'utente
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista acquisti
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
 *                     type: object
 *                     properties:
 *                       purchaseId:
 *                         type: string
 *                       visit:
 *                         $ref: '#/components/schemas/Visit'
 *                       purchaseDate:
 *                         type: string
 *                         format: date-time
 *                       price:
 *                         type: number
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/my-purchases', authMiddleware, MarketplaceController.getMyPurchases);
router.get('/my-visit-purchases', authMiddleware, MarketplaceController.getMyPurchases);
router.get('/my-item-purchases', authMiddleware, MarketplaceController.getMyItemPurchases);

export default router;
