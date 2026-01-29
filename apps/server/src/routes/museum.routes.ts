import { Router } from 'express';
import { MuseumController } from '../controllers/museum.controller';
import { authMiddleware, roleMiddleware } from '../middleware';
import { UserRole } from '@artaround/shared';

const router = Router();

// Public routes
router.get('/', MuseumController.getAll);
router.get('/:id', MuseumController.getById);
router.get('/:id/config', MuseumController.getConfig);

// Protected routes (admin only)
router.post(
  '/',
  authMiddleware,
  roleMiddleware(UserRole.ADMIN),
  MuseumController.createValidation,
  MuseumController.create
);

router.put(
  '/:id',
  authMiddleware,
  roleMiddleware(UserRole.ADMIN),
  MuseumController.update
);

router.delete(
  '/:id',
  authMiddleware,
  roleMiddleware(UserRole.ADMIN),
  MuseumController.delete
);

export default router;
