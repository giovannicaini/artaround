import { Router } from 'express';
import {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  addRoleAssignment,
  removeRoleAssignment,
  getUsersByResource,
} from '../controllers/user.controller.js';
import { authMiddleware, requireRole } from '../middleware/auth.middleware.js';
import { UserRole } from '@artaround/shared';

const router = Router();

// solo admin, tutte le rotte
router.use(authMiddleware);
router.use(requireRole([UserRole.ADMIN]));

router.get('/', getUsers);
router.get('/by-resource/:resourceType/:resourceId', getUsersByResource);
router.get('/:id', getUserById);
router.post('/', createUser);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);
router.post('/:id/role-assignments', addRoleAssignment);
router.delete('/:id/role-assignments', removeRoleAssignment);

export default router;
