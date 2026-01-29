import { Router } from 'express';
import authRoutes from './auth.routes';
import museumRoutes from './museum.routes';
import itemRoutes from './item.routes';
import visitRoutes from './visit.routes';
import marketplaceRoutes from './marketplace.routes';
import utilsRoutes from './utils.routes';

const router = Router();

// Mount routes
router.use('/auth', authRoutes);
router.use('/museums', museumRoutes);
router.use('/items', itemRoutes);
router.use('/visits', visitRoutes);
router.use('/marketplace', marketplaceRoutes);
router.use('/utils', utilsRoutes);

// Health check
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
  });
});

export default router;
