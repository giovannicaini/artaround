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

// tutte le rotte sotto richiedono autenticazione e ruolo admin
router.use(authMiddleware);
router.use(requireRole([UserRole.ADMIN]));

/**
 * @swagger
 * /api/users:
 *   get:
 *     tags: [Users]
 *     summary: Lista utenti (Admin only)
 *     description: Ottiene tutti gli utenti con paginazione e filtri
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Cerca per username o email
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Lista utenti con paginazione
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
router.get('/', getUsers);

/**
 * @swagger
 * /api/users/by-resource/{resourceType}/{resourceId}:
 *   get:
 *     tags: [Users]
 *     summary: Utenti con ruoli su una risorsa (Admin only)
 *     description: Ottiene gli utenti che hanno un'assegnazione di ruolo su una risorsa specifica (museo, visita, item, opera)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: resourceType
 *         required: true
 *         schema:
 *           type: string
 *           enum: [item, visit, artwork, museum]
 *       - in: path
 *         name: resourceId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Utenti con ruoli filtrati sulla risorsa richiesta
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
router.get('/by-resource/:resourceType/:resourceId', getUsersByResource);

/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     tags: [Users]
 *     summary: Dettaglio utente (Admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Dati utente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get('/:id', getUserById);

/**
 * @swagger
 * /api/users:
 *   post:
 *     tags: [Users]
 *     summary: Crea nuovo utente (Admin only)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, email, password]
 *             properties:
 *               username:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               role:
 *                 type: string
 *               isActive:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Utente creato
 *       400:
 *         description: Campi mancanti o email/username già in uso
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
router.post('/', createUser);

/**
 * @swagger
 * /api/users/{id}:
 *   put:
 *     tags: [Users]
 *     summary: Aggiorna utente (Admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               role:
 *                 type: string
 *               isActive:
 *                 type: boolean
 *               preferences:
 *                 type: object
 *     responses:
 *       200:
 *         description: Utente aggiornato
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.put('/:id', updateUser);

/**
 * @swagger
 * /api/users/{id}:
 *   delete:
 *     tags: [Users]
 *     summary: Disattiva utente (Admin only)
 *     description: Soft delete — disattiva l'utente invece di eliminarlo. Un admin non può disattivare se stesso.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Utente disattivato
 *       400:
 *         description: Non puoi disattivare il tuo stesso account
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.delete('/:id', deleteUser);

/**
 * @swagger
 * /api/users/{id}/role-assignments:
 *   post:
 *     tags: [Users]
 *     summary: Assegna un ruolo contestuale (Admin only)
 *     description: Assegna a un utente un ruolo su una risorsa specifica (es. curatore di un museo)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [role, resourceType, resourceId]
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [owner, author, editor, viewer, manager]
 *               resourceType:
 *                 type: string
 *                 enum: [item, visit, artwork, museum]
 *               resourceId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Ruolo assegnato
 *       400:
 *         description: Campi mancanti, ruolo/tipo risorsa non validi, o assegnazione già esistente
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.post('/:id/role-assignments', addRoleAssignment);

/**
 * @swagger
 * /api/users/{id}/role-assignments:
 *   delete:
 *     tags: [Users]
 *     summary: Rimuove un ruolo contestuale (Admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [role, resourceType, resourceId]
 *             properties:
 *               role:
 *                 type: string
 *               resourceType:
 *                 type: string
 *               resourceId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Ruolo rimosso
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.delete('/:id/role-assignments', removeRoleAssignment);

export default router;
