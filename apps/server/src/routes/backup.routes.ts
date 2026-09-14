import { Router } from 'express';
import { BackupController } from '../controllers/backup.controller.js';
import { authMiddleware as authenticate } from '../middleware/index.js';
import { requireAdmin } from '../middleware/role.middleware.js';

const router = Router();

// Tutte le route di questo file: solo amministratori.
router.use(authenticate, requireAdmin);

/**
 * @swagger
 * /api/admin/backups:
 *   get:
 *     tags: [Backups]
 *     summary: Lista gli snapshot di database + uploads (solo admin)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista backup
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *   post:
 *     tags: [Backups]
 *     summary: Avvia la creazione di un nuovo snapshot (solo admin)
 *     description: >
 *       Dump di tutte le collezioni Mongo (EJSON) + archivio della cartella
 *       uploads. Avviato in background, risponde 202 subito: il progresso si
 *       segue rileggendo la lista. Un solo backup/ripristino alla volta.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       202:
 *         description: Creazione avviata
 *       409:
 *         description: C'è già un backup o ripristino in corso
 */
router.get('/', BackupController.list);
router.post('/', BackupController.createValidation, BackupController.create);

/**
 * @swagger
 * /api/admin/backups/{id}/restore:
 *   post:
 *     tags: [Backups]
 *     summary: Ripristina database + uploads da uno snapshot (solo admin)
 *     description: >
 *       Sovrascrive TUTTO lo stato attuale (database e cartella uploads) con
 *       quello dello snapshot scelto — operazione distruttiva e irreversibile
 *       sui dati creati dopo lo snapshot. Avviata in background, risponde 202 subito.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       202:
 *         description: Ripristino avviato
 *       409:
 *         description: Backup non pronto, o un'altra operazione è già in corso
 */
router.post('/:id/restore', BackupController.restore);

/**
 * @swagger
 * /api/admin/backups/{id}:
 *   delete:
 *     tags: [Backups]
 *     summary: Elimina uno snapshot (solo admin)
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
 *         description: Backup eliminato
 */
router.delete('/:id', BackupController.remove);

export default router;
