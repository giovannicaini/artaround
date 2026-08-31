import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller.js';
import { authMiddleware } from '../middleware/index.js';

const router = Router();

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Registra un nuovo utente
 *     description: Crea un nuovo account utente con username, email e password
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
 *                 example: mario_rossi
 *               email:
 *                 type: string
 *                 format: email
 *                 example: mario@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *                 example: Password123!
 *               role:
 *                 type: string
 *                 enum: [VISITOR, AUTHOR]
 *                 default: VISITOR
 *     responses:
 *       201:
 *         description: Utente registrato con successo
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *                     token:
 *                       type: string
 *                       example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */
router.post('/register', AuthController.registerValidation, AuthController.register);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login utente
 *     description: Autentica un utente e restituisce un JWT token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, password]
 *             properties:
 *               username:
 *                 type: string
 *                 example: autore1
 *               password:
 *                 type: string
 *                 format: password
 *                 example: 12345678
 *     responses:
 *       200:
 *         description: Login effettuato con successo
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *                     token:
 *                       type: string
 *       401:
 *         description: Credenziali non valide
 */
router.post('/login', AuthController.loginValidation, AuthController.login);

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Ottieni profilo utente corrente
 *     description: Restituisce i dati dell'utente autenticato
 *     security:
 *       - bearerAuth: []
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
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/me', authMiddleware, AuthController.me);

/**
 * @swagger
 * /api/auth/me:
 *   put:
 *     tags: [Auth]
 *     summary: Aggiorna il proprio profilo
 *     description: Self-service — l'utente autenticato aggiorna email e/o preferenze proprie. Non tocca ruolo, roleAssignments, username o isActive (quelli restano riservati agli admin via PUT /api/users/:id).
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profilo aggiornato
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.put('/me', authMiddleware, AuthController.updateMeValidation, AuthController.updateMe);

/**
 * @swagger
 * /api/auth/me/password:
 *   put:
 *     tags: [Auth]
 *     summary: Cambia la propria password
 *     description: Richiede la password attuale per verifica prima di impostarne una nuova.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Password cambiata
 *       401:
 *         description: Password attuale errata o non autenticato
 */
router.put(
  '/me/password',
  authMiddleware,
  AuthController.changePasswordValidation,
  AuthController.changePassword,
);

export default router;
