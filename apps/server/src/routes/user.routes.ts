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

/**
 * User Routes
 *
 * All routes require authentication and admin role.
 */

// Middleware: all routes require auth and admin role
router.use(authMiddleware);
router.use(requireRole([UserRole.ADMIN]));

// GET /users - Get all users with pagination and filters
router.get('/', getUsers);

// GET /users/by-resource/:resourceType/:resourceId - Get users with roles on a resource
router.get('/by-resource/:resourceType/:resourceId', getUsersByResource);

// GET /users/:id - Get single user
router.get('/:id', getUserById);

// POST /users - Create new user
router.post('/', createUser);

// PUT /users/:id - Update user
router.put('/:id', updateUser);

// DELETE /users/:id - Delete/deactivate user
router.delete('/:id', deleteUser);

// POST /users/:id/role-assignments - Add role assignment
router.post('/:id/role-assignments', addRoleAssignment);

// DELETE /users/:id/role-assignments - Remove role assignment
router.delete('/:id/role-assignments', removeRoleAssignment);

export default router;
