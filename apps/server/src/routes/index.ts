/*
 * Tutte le rotte qui si riferiscono a /api/....
 * Le altre sono definite in server/srv/index.ts
 * Tutti i commenti JSdoc (elaborati da LLM) servono per popolare i dati di Swagger
 */

import { Router } from 'express';
import authRoutes from './auth.routes.js';
import museumRoutes from './museum.routes.js';
import artworkRoutes from './artwork.routes.js';
import itemRoutes from './item.routes.js';
import visitRoutes from './visit.routes.js';
import marketplaceRoutes from './marketplace.routes.js';
import utilsRoutes from './utils.routes.js';
import uploadRoutes from './upload.routes.js';
import userRoutes from './user.routes.js';
import navigatorConfigRoutes from './navigator-config.routes.js';
import jobRoutes from './job.routes.js';
import notificationRoutes from './notification.routes.js';

const router = Router();

/**
 * @swagger
 * /api:
 *   get:
 *     tags: [Utils]
 *     summary: Info API
 *     description: Endpoint root, elenca gli endpoint disponibili
 *     responses:
 *       200:
 *         description: Elenco endpoint dell'API
 */
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'ArtAround API v1.0',
    endpoints: {
      auth: {
        register: 'POST /api/auth/register',
        login: 'POST /api/auth/login',
        me: 'GET /api/auth/me',
      },
      museums: {
        list: 'GET /api/museums',
        detail: 'GET /api/museums/:id',
        config: 'GET /api/museums/:id/config',
        create: 'POST /api/museums (admin)',
      },
      artworks: {
        list: 'GET /api/artworks',
        byMuseum: 'GET /api/artworks/museum/:museumId',
        byWikidata: 'GET /api/artworks/wikidata/:wikidataId',
        detail: 'GET /api/artworks/:id',
        create: 'POST /api/artworks (curator)',
        update: 'PUT /api/artworks/:id (curator)',
        delete: 'DELETE /api/artworks/:id (admin)',
      },
      items: {
        list: 'GET /api/items',
        search: 'GET /api/items/search',
        byArtwork: 'GET /api/items/artwork/:artworkId',
        byReference: 'GET /api/items/reference/:referenceType/:referenceId',
        detail: 'GET /api/items/:id',
        create: 'POST /api/items (auth)',
        update: 'PUT /api/items/:id (owner)',
        delete: 'DELETE /api/items/:id (owner)',
      },
      visits: {
        list: 'GET /api/visits',
        byMuseum: 'GET /api/visits/museum/:museumId',
        myVisits: 'GET /api/visits/my-visits (auth)',
        detail: 'GET /api/visits/:id',
        create: 'POST /api/visits (auth)',
        update: 'PUT /api/visits/:id (owner)',
        publish: 'POST /api/visits/:id/publish (owner)',
        unpublish: 'POST /api/visits/:id/unpublish (owner)',
        delete: 'DELETE /api/visits/:id (owner)',
      },
      marketplace: {
        itemCatalog: 'GET /api/marketplace/items',
        visitCatalog: 'GET /api/marketplace/visits',
        myItemPurchases: 'GET /api/marketplace/my-item-purchases (auth)',
        myVisitPurchases: 'GET /api/marketplace/my-visit-purchases (auth)',
        purchaseItem: 'POST /api/marketplace/purchase/item/:itemId (auth)',
        purchaseVisit: 'POST /api/marketplace/purchase/visit/:visitId (auth)',
        creditTopup: 'POST /api/marketplace/credit/topup (auth)',
        creditTransactions: 'GET /api/marketplace/credit/transactions (auth)',
      },
      utils: {
        translate: 'POST /api/utils/translate',
        wikidataEntity: 'GET /api/utils/wikidata/:id',
        wikidataSearch: 'GET /api/utils/wikidata/search',
      },
    },
    documentation: 'See README.md for detailed API documentation',
    timestamp: new Date().toISOString(),
  });
});

/**
 * @swagger
 * /api/health:
 *   get:
 *     tags: [Utils]
 *     summary: Controllo di stato
 *     description: Verifica che il server sia in esecuzione
 *     responses:
 *       200:
 *         description: Server raggiungibile
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
  });
});

router.use('/auth', authRoutes);
router.use('/museums', museumRoutes);
router.use('/artworks', artworkRoutes);
router.use('/items', itemRoutes);
router.use('/visits', visitRoutes);
router.use('/marketplace', marketplaceRoutes);
router.use('/utils', utilsRoutes);
router.use('/uploads', uploadRoutes);
router.use('/users', userRoutes);
router.use('/navigator-configs', navigatorConfigRoutes);
router.use('/jobs', jobRoutes);
router.use('/notifications', notificationRoutes);

export default router;
