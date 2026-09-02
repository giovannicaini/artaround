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
 * Rotte Utenti
 *
 * Tutte le rotte richiedono autenticazione e ruolo admin.
 */

// Middleware: tutte le rotte richiedono auth e ruolo admin
router.use(authMiddleware);
router.use(requireRole([UserRole.ADMIN]));

// GET /users - Ottieni tutti gli utenti con paginazione e filtri
router.get('/', getUsers);

// GET /users/by-resource/:resourceType/:resourceId - Ottieni gli utenti con ruoli su una risorsa
router.get('/by-resource/:resourceType/:resourceId', getUsersByResource);

// GET /users/:id - Ottieni un singolo utente
router.get('/:id', getUserById);

// POST /users - Crea nuovo utente
router.post('/', createUser);

// PUT /users/:id - Aggiorna utente
router.put('/:id', updateUser);

// DELETE /users/:id - Elimina/disattiva utente
router.delete('/:id', deleteUser);

// POST /users/:id/role-assignments - Aggiungi assegnazione di ruolo
router.post('/:id/role-assignments', addRoleAssignment);

// DELETE /users/:id/role-assignments - Rimuovi assegnazione di ruolo
router.delete('/:id/role-assignments', removeRoleAssignment);

export default router;
