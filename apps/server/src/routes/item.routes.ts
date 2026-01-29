import { Router } from 'express';
import { ItemController } from '../controllers/item.controller';
import { authMiddleware, roleMiddleware } from '../middleware';
import { UserRole } from '@artaround/shared';

const router = Router();

// Public routes
router.get('/', ItemController.getAll);
router.get('/search', ItemController.search);
router.get('/:id', ItemController.getById);

// Protected routes (author only)
router.post(
  '/',
  authMiddleware,
  roleMiddleware(UserRole.AUTHOR),
  ItemController.createValidation,
  ItemController.create
);

router.put(
  '/:id',
  authMiddleware,
  roleMiddleware(UserRole.AUTHOR, UserRole.ADMIN),
  ItemController.update
);

router.delete(
  '/:id',
  authMiddleware,
  roleMiddleware(UserRole.AUTHOR, UserRole.ADMIN),
  ItemController.delete
);

export default router;
