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

const router = Router();

// API Info - Root endpoint
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
        addStep: 'POST /api/visits/:id/steps (owner)',
        updateStep: 'PUT /api/visits/:id/steps/:stepOrder (owner)',
        deleteStep: 'DELETE /api/visits/:id/steps/:stepOrder (owner)',
        reorderSteps: 'POST /api/visits/:id/reorder (owner)',
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

// Health check
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
  });
});

// Mount routes
router.use('/auth', authRoutes);
router.use('/museums', museumRoutes);
router.use('/artworks', artworkRoutes);
router.use('/items', itemRoutes);
router.use('/visits', visitRoutes);
router.use('/marketplace', marketplaceRoutes);
router.use('/utils', utilsRoutes);
router.use('/uploads', uploadRoutes);
router.use('/users', userRoutes);

export default router;
