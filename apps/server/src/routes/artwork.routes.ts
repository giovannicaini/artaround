import { Router } from 'express';
import {
  getArtworks,
  getArtwork,
  getArtworkByWikidataId,
  createArtwork,
  updateArtwork,
  deleteArtwork,
  getArtworksByMuseum,
  updateArtworkMapPosition,
} from '../controllers/artwork.controller.js';
import {
  authMiddleware as authenticate,
  roleMiddleware as authorizeRoles,
} from '../middleware/index.js';
import { UserRole } from '@artaround/shared';

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
 *           description: Wikidata Q number (e.g., Q12418 for Mona Lisa)
 *         museumId:
 *           type: string
 *           description: Museum's Wikidata ID that owns the artwork
 *         title:
 *           type: string
 *         titleTranslations:
 *           type: object
 *           additionalProperties:
 *             type: string
 *         authorWikidataId:
 *           type: string
 *           description: Artist's Wikidata ID
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
 *     summary: Get all artworks
 *     tags: [Artworks]
 *     parameters:
 *       - in: query
 *         name: museumId
 *         schema:
 *           type: string
 *         description: Filter by museum Wikidata ID
 *       - in: query
 *         name: authorWikidataId
 *         schema:
 *           type: string
 *         description: Filter by author Wikidata ID
 *       - in: query
 *         name: artworkType
 *         schema:
 *           type: string
 *         description: Filter by artwork type
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Text search
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
 *         description: List of artworks with pagination
 */
router.get('/', getArtworks);

/**
 * @swagger
 * /api/artworks/museum/{museumId}:
 *   get:
 *     summary: Get all artworks for a specific museum
 *     tags: [Artworks]
 *     parameters:
 *       - in: path
 *         name: museumId
 *         required: true
 *         schema:
 *           type: string
 *         description: Museum's Wikidata ID
 *     responses:
 *       200:
 *         description: List of artworks in the museum
 */
router.get('/museum/:museumId', getArtworksByMuseum);

/**
 * @swagger
 * /api/artworks/wikidata/{wikidataId}:
 *   get:
 *     summary: Get artwork by Wikidata ID
 *     tags: [Artworks]
 *     parameters:
 *       - in: path
 *         name: wikidataId
 *         required: true
 *         schema:
 *           type: string
 *         description: Artwork's Wikidata Q number
 *     responses:
 *       200:
 *         description: The artwork
 *       404:
 *         description: Artwork not found
 */
router.get('/wikidata/:wikidataId', getArtworkByWikidataId);

/**
 * @swagger
 * /api/artworks/{id}:
 *   get:
 *     summary: Get artwork by ID (MongoDB _id)
 *     tags: [Artworks]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: The artwork
 *       404:
 *         description: Artwork not found
 */
router.get('/:id', getArtwork);

/**
 * @swagger
 * /api/artworks:
 *   post:
 *     summary: Create a new artwork
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
 *         description: Artwork created
 *       409:
 *         description: Artwork with this Wikidata ID already exists
 */
router.post('/', authenticate, authorizeRoles(UserRole.ADMIN, UserRole.CURATOR), createArtwork);

/**
 * @swagger
 * /api/artworks/{id}:
 *   put:
 *     summary: Update an artwork
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
 *         description: Artwork updated
 *       404:
 *         description: Artwork not found
 */
router.put('/:id', authenticate, authorizeRoles(UserRole.ADMIN, UserRole.CURATOR), updateArtwork);

/**
 * @swagger
 * /api/artworks/{id}/map-position:
 *   put:
 *     summary: Update artwork's map position
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
 *         description: Map position updated
 */
router.put(
  '/:id/map-position',
  authenticate,
  authorizeRoles(UserRole.ADMIN, UserRole.CURATOR),
  updateArtworkMapPosition,
);

/**
 * @swagger
 * /api/artworks/{id}:
 *   delete:
 *     summary: Delete an artwork
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
 *         description: Artwork deleted
 *       404:
 *         description: Artwork not found
 */
router.delete('/:id', authenticate, authorizeRoles(UserRole.ADMIN), deleteArtwork);

export default router;
