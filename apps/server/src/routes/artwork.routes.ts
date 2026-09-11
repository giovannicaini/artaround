import { Router } from 'express';
import {
  getArtworks,
  getArtwork,
  getArtworkByWikidataId,
  createArtwork,
  createArtworkValidation,
  updateArtwork,
  updateArtworkValidation,
  deleteArtwork,
  getArtworksByMuseum,
  updateArtworkMapPosition,
} from '../controllers/artwork.controller.js';
import { authMiddleware as authenticate } from '../middleware/index.js';
import { authorizeCreate } from '../utils/policy.util.js';

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Artwork:
 *       type: object
 *       required:
 *         - wikidataId
 *         - museumId
 *         - title
 *         - artworkType
 *       properties:
 *         wikidataId:
 *           type: string
 *           description: Q number Wikidata (es. Q12418 per la Gioconda)
 *         museumId:
 *           type: string
 *           description: ID Wikidata del museo proprietario dell'opera
 *         title:
 *           type: string
 *         titleTranslations:
 *           type: object
 *           additionalProperties:
 *             type: string
 *         authorWikidataId:
 *           type: string
 *           description: ID Wikidata dell'artista
 *         authorName:
 *           type: string
 *         year:
 *           type: string
 *         artworkType:
 *           type: string
 *           enum: [painting, sculpture, drawing, photograph, mosaic, fresco, tapestry, ceramic, furniture, installation, other]
 *         dimensions:
 *           type: object
 *           properties:
 *             height:
 *               type: number
 *             width:
 *               type: number
 *             depth:
 *               type: number
 *             diameter:
 *               type: number
 *             unit:
 *               type: string
 *               enum: [cm, m, in]
 *         movementWikidataId:
 *           type: string
 *         styleWikidataId:
 *           type: string
 *         imageUrl:
 *           type: string
 *         thumbnailUrl:
 *           type: string
 *         room:
 *           type: string
 *         floor:
 *           type: string
 *         mapPosition:
 *           type: object
 *           properties:
 *             floorId:
 *               type: string
 *             x:
 *               type: number
 *             y:
 *               type: number
 *             rotation:
 *               type: number
 */

/**
 * @swagger
 * /api/artworks:
 *   get:
 *     summary: Lista tutte le opere
 *     tags: [Artworks]
 *     parameters:
 *       - in: query
 *         name: museumId
 *         schema:
 *           type: string
 *         description: Filtra per ID Wikidata del museo
 *       - in: query
 *         name: authorWikidataId
 *         schema:
 *           type: string
 *         description: Filtra per ID Wikidata dell'autore
 *       - in: query
 *         name: artworkType
 *         schema:
 *           type: string
 *         description: Filtra per tipo di opera
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Ricerca testuale
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       200:
 *         description: Lista opere con paginazione
 */
router.get('/', getArtworks);

/**
 * @swagger
 * /api/artworks/museum/{museumId}:
 *   get:
 *     summary: Lista tutte le opere di un museo specifico
 *     tags: [Artworks]
 *     parameters:
 *       - in: path
 *         name: museumId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID Wikidata del museo
 *     responses:
 *       200:
 *         description: Lista opere del museo
 */
router.get('/museum/:museumId', getArtworksByMuseum);

/**
 * @swagger
 * /api/artworks/wikidata/{wikidataId}:
 *   get:
 *     summary: Ottieni opera per ID Wikidata
 *     tags: [Artworks]
 *     parameters:
 *       - in: path
 *         name: wikidataId
 *         required: true
 *         schema:
 *           type: string
 *         description: Q number Wikidata dell'opera
 *     responses:
 *       200:
 *         description: L'opera
 *       404:
 *         description: Opera non trovata
 */
router.get('/wikidata/:wikidataId', getArtworkByWikidataId);

/**
 * @swagger
 * /api/artworks/{id}:
 *   get:
 *     summary: Ottieni opera per ID (MongoDB _id)
 *     tags: [Artworks]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: L'opera
 *       404:
 *         description: Opera non trovata
 */
router.get('/:id', getArtwork);

/**
 * @swagger
 * /api/artworks:
 *   post:
 *     summary: Crea una nuova opera
 *     tags: [Artworks]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Artwork'
 *     responses:
 *       201:
 *         description: Opera creata
 *       409:
 *         description: Esiste già un'opera con questo ID Wikidata
 */
router.post('/', authenticate, authorizeCreate('artwork'), createArtworkValidation, createArtwork);

/**
 * @swagger
 * /api/artworks/{id}:
 *   put:
 *     summary: Aggiorna un'opera
 *     tags: [Artworks]
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
 *             $ref: '#/components/schemas/Artwork'
 *     responses:
 *       200:
 *         description: Opera aggiornata
 *       404:
 *         description: Opera non trovata
 */
router.put('/:id', authenticate, updateArtworkValidation, updateArtwork);

/**
 * @swagger
 * /api/artworks/{id}/map-position:
 *   put:
 *     summary: Aggiorna la posizione sulla mappa dell'opera
 *     tags: [Artworks]
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
 *             properties:
 *               floorId:
 *                 type: string
 *               x:
 *                 type: number
 *               y:
 *                 type: number
 *               rotation:
 *                 type: number
 *     responses:
 *       200:
 *         description: Posizione sulla mappa aggiornata
 */
router.put('/:id/map-position', authenticate, updateArtworkMapPosition);

/**
 * @swagger
 * /api/artworks/{id}:
 *   delete:
 *     summary: Elimina un'opera
 *     tags: [Artworks]
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
 *         description: Opera eliminata
 *       404:
 *         description: Opera non trovata
 */
router.delete('/:id', authenticate, deleteArtwork);

export default router;
