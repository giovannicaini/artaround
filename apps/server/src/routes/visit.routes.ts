import { Router } from 'express';
import { VisitController } from '../controllers/visit.controller';
import { authMiddleware, roleMiddleware } from '../middleware';
import { UserRole } from '@artaround/shared';

const router = Router();

// Public routes
router.get('/', VisitController.getAll);
router.get('/:id', VisitController.getById);

// Protected routes
router.get(
  '/user/my-visits',
  authMiddleware,
  VisitController.getMyVisits
);

router.post(
  '/',
  authMiddleware,
  roleMiddleware(UserRole.AUTHOR),
  VisitController.createValidation,
  VisitController.create
);

router.put(
  '/:id',
  authMiddleware,
  roleMiddleware(UserRole.AUTHOR, UserRole.ADMIN),
  VisitController.update
);

router.post(
  '/:id/publish',
  authMiddleware,
  roleMiddleware(UserRole.AUTHOR, UserRole.ADMIN),
  VisitController.publish
);

router.delete(
  '/:id',
  authMiddleware,
  roleMiddleware(UserRole.AUTHOR, UserRole.ADMIN),
  VisitController.delete
);

export default router;
