import { Router } from 'express';
import authRoutes from './auth.routes.js';
import museumRoutes from './museum.routes.js';
import itemRoutes from './item.routes.js';
import visitRoutes from './visit.routes.js';
import marketplaceRoutes from './marketplace.routes.js';
import utilsRoutes from './utils.routes.js';

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
      items: {
        list: 'GET /api/items',
        search: 'GET /api/items/search',
        detail: 'GET /api/items/:id',
        create: 'POST /api/items (auth)',
        update: 'PUT /api/items/:id (owner)',
        delete: 'DELETE /api/items/:id (owner)',
      },
      visits: {
        list: 'GET /api/visits',
        myVisits: 'GET /api/visits/my-visits (auth)',
        detail: 'GET /api/visits/:id',
        create: 'POST /api/visits (auth)',
        update: 'PUT /api/visits/:id (owner)',
        delete: 'DELETE /api/visits/:id (owner)',
        publish: 'POST /api/visits/:id/publish (owner)',
      },
      marketplace: {
        catalog: 'GET /api/marketplace/visits',
        myPurchases: 'GET /api/marketplace/my-purchases (auth)',
        purchase: 'POST /api/marketplace/purchase/:visitId (auth)',
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
router.use('/items', itemRoutes);
router.use('/visits', visitRoutes);
router.use('/marketplace', marketplaceRoutes);
router.use('/utils', utilsRoutes);

export default router;
