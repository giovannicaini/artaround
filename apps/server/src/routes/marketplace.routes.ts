import { Router } from 'express';
import { MarketplaceController } from '../controllers/marketplace.controller.js';
import { authMiddleware } from '../middleware/index.js';
import { authorizeContentCreator } from '../utils/policy.util.js';

const router = Router();

/**
 * @swagger
 * /api/marketplace/items:
 *   get:
 *     tags: [Marketplace]
 *     summary: Catalogo item disponibili
 *     description: Ottiene gli item del marketplace, con filtri e ordinamento
 *     parameters:
 *       - in: query
 *         name: museumId
 *         schema:
 *           type: string
 *       - in: query
 *         name: isFree
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: minRating
 *         schema:
 *           type: number
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [createdAt, rating, price, usage]
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
 *         description: Catalogo item con paginazione
 */
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

/**
 * @swagger
 * /api/marketplace/purchase/item/{itemId}:
 *   post:
 *     tags: [Marketplace]
 *     summary: Acquista item
 *     description: Simula l'acquisto di un item con il credito dell'utente (no pagamento reale). Solo autori.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       201:
 *         description: Acquisto completato
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       402:
 *         description: Credito insufficiente
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       409:
 *         description: Item già acquistato
 */
router.post(
  '/purchase/item/:itemId',
  authMiddleware,
  authorizeContentCreator,
  MarketplaceController.purchaseItem,
);

/**
 * @swagger
 * /api/marketplace/purchase/visit/{visitId}:
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

/**
 * @swagger
 * /api/marketplace/my-visit-purchases:
 *   get:
 *     tags: [Marketplace]
 *     summary: Le mie visite acquistate (alias)
 *     description: Alias di /api/marketplace/my-purchases, stesso comportamento.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista acquisti
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/my-visit-purchases', authMiddleware, MarketplaceController.getMyPurchases);

/**
 * @swagger
 * /api/marketplace/my-item-purchases:
 *   get:
 *     tags: [Marketplace]
 *     summary: I miei item acquistati
 *     description: Ottiene tutti gli item acquistati dall'utente
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista acquisti item
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/my-item-purchases', authMiddleware, MarketplaceController.getMyItemPurchases);

/**
 * @swagger
 * /api/marketplace/credit/topup:
 *   post:
 *     tags: [Marketplace]
 *     summary: Ricarica credito
 *     description: Ricarica simulata, nessun pagamento reale — il saldo viene accreditato subito.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amount]
 *             properties:
 *               amount:
 *                 type: number
 *                 description: Importo in euro, arrotondato ai centesimi
 *     responses:
 *       201:
 *         description: Ricarica completata
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
 *                     balance:
 *                       type: number
 *                     transaction:
 *                       type: object
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post('/credit/topup', authMiddleware, MarketplaceController.topUpCredit);

/**
 * @swagger
 * /api/marketplace/credit/transactions:
 *   get:
 *     tags: [Marketplace]
 *     summary: Storico movimenti di credito
 *     description: Ultimi 50 movimenti (ricariche e acquisti) dell'utente autenticato, più recenti prima
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Storico movimenti
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/credit/transactions', authMiddleware, MarketplaceController.getCreditTransactions);

export default router;
