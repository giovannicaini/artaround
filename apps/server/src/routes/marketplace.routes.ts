import { Router } from 'express';
import { MarketplaceController } from '../controllers/marketplace.controller';
import { authMiddleware } from '../middleware';

const router = Router();

// Public routes
router.get('/visits', MarketplaceController.getVisits);

// Protected routes
router.post(
  '/purchase/:visitId',
  authMiddleware,
  MarketplaceController.purchaseVisit
);

router.get(
  '/my-purchases',
  authMiddleware,
  MarketplaceController.getMyPurchases
);

export default router;
