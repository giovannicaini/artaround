import { Router } from 'express';
import { ItemController } from '../controllers/item.controller.js';
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
 *     Item:
 *       type: object
 *       required:
 *         - referenceType
 *         - title
 *         - contentMatrix
 *         - license
 *       properties:
 *         referenceType:
 *           type: string
 *           enum: [artwork, author, movement, period, museum]
 *           description: Type of entity this item references
 *         referenceId:
 *           type: string
 *           description: Wikidata ID of the referenced entity
 *         title:
 *           type: string
 *         titleTranslations:
 *           type: object
 *         contentMatrix:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               duration:
 *                 type: string
 *                 enum: ['3s', '15s', '1min', '4min', '10min']
 *               languageLevel:
 *                 type: string
 *                 enum: [infantile, elementare, medio, specialistico]
 *               content:
 *                 type: object
 *                 properties:
 *                   type:
 *                     type: string
 *                     enum: [text, audio, video, image, ar]
 *                   text:
 *                     type: string
 *                   audioUrl:
 *                     type: string
 *         authorId:
 *           type: string
 *           description: User ID of the content creator
 *         license:
 *           type: string
 *           enum: [free, cc-by, cc-by-nc, commercial]
 *         price:
 *           type: number
 *         tags:
 *           type: array
 *           items:
 *             type: string
 */

/**
 * @swagger
 * /api/items:
 *   get:
 *     tags: [Items]
 *     summary: Get all items
 *     description: Get list of content items with filters
 *     parameters:
 *       - in: query
 *         name: referenceType
 *         schema:
 *           type: string
 *           enum: [artwork, author, movement, period, museum]
 *       - in: query
 *         name: referenceId
 *         schema:
 *           type: string
 *         description: Wikidata ID of referenced entity
 *       - in: query
 *         name: authorId
 *         schema:
 *           type: string
 *       - in: query
 *         name: duration
 *         schema:
 *           type: string
 *           enum: ['3s', '15s', '1min', '4min', '10min']
 *       - in: query
 *         name: languageLevel
 *         schema:
 *           type: string
 *           enum: [infantile, elementare, medio, specialistico]
 *       - in: query
 *         name: isFree
 *         schema:
 *           type: boolean
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
 *         description: List of items with pagination
 */
router.get('/', ItemController.getAll);

/**
 * @swagger
 * /api/items/search:
 *   get:
 *     tags: [Items]
 *     summary: Search items
 *     description: Full-text search in items
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Search term
 *       - in: query
 *         name: referenceType
 *         schema:
 *           type: string
 *       - in: query
 *         name: tags
 *         schema:
 *           type: string
 *         description: Comma-separated tags
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
 *         description: Search results
 */
router.get('/search', ItemController.search);

/**
 * @swagger
 * /api/items/my-items:
 *   get:
 *     tags: [Items]
 *     summary: Get my items
 *     description: Get items created by authenticated user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User's items
 */
router.get('/my-items', authenticate, ItemController.getMyItems);

/**
 * @swagger
 * /api/items/artwork/{artworkId}:
 *   get:
 *     tags: [Items]
 *     summary: Get items for an artwork
 *     description: Get all content items referencing a specific artwork
 *     parameters:
 *       - in: path
 *         name: artworkId
 *         required: true
 *         schema:
 *           type: string
 *         description: Artwork's Wikidata ID
 *       - in: query
 *         name: duration
 *         schema:
 *           type: string
 *       - in: query
 *         name: languageLevel
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Items for the artwork
 */
router.get('/artwork/:artworkId', ItemController.getByArtwork);

/**
 * @swagger
 * /api/items/author/{authorWikidataId}:
 *   get:
 *     tags: [Items]
 *     summary: Get items for an author
 *     description: Get all content items about a specific artist
 *     parameters:
 *       - in: path
 *         name: authorWikidataId
 *         required: true
 *         schema:
 *           type: string
 *         description: Author's Wikidata ID
 *     responses:
 *       200:
 *         description: Items about the author
 */
router.get('/author/:authorWikidataId', ItemController.getByAuthor);

/**
 * @swagger
 * /api/items/reference/{referenceType}/{referenceId}:
 *   get:
 *     tags: [Items]
 *     summary: Get items by reference
 *     description: Get content items by reference type and ID
 *     parameters:
 *       - in: path
 *         name: referenceType
 *         required: true
 *         schema:
 *           type: string
 *           enum: [artwork, author, movement, period, museum]
 *       - in: path
 *         name: referenceId
 *         required: true
 *         schema:
 *           type: string
 *         description: Wikidata ID
 *     responses:
 *       200:
 *         description: Items for the reference
 */
router.get('/reference/:referenceType/:referenceId', ItemController.getByReference);

/**
 * @swagger
 * /api/items/{id}:
 *   get:
 *     tags: [Items]
 *     summary: Get item by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Item details
 *       404:
 *         description: Item not found
 */
router.get('/:id', ItemController.getById);

/**
 * @swagger
 * /api/items:
 *   post:
 *     tags: [Items]
 *     summary: Create item
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Item'
 *     responses:
 *       201:
 *         description: Item created
 */
router.post(
  '/',
  authenticate,
  authorizeRoles(UserRole.ADMIN, UserRole.AUTHOR, UserRole.CURATOR),
  ItemController.createValidation,
  ItemController.create,
);

/**
 * @swagger
 * /api/items/{id}:
 *   put:
 *     tags: [Items]
 *     summary: Update item
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
 *             $ref: '#/components/schemas/Item'
 *     responses:
 *       200:
 *         description: Item updated
 */
router.put(
  '/:id',
  authenticate,
  authorizeRoles(UserRole.ADMIN, UserRole.AUTHOR, UserRole.CURATOR),
  ItemController.update,
);

/**
 * @swagger
 * /api/items/{id}:
 *   delete:
 *     tags: [Items]
 *     summary: Delete item
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
 *         description: Item deleted
 */
router.delete(
  '/:id',
  authenticate,
  authorizeRoles(UserRole.ADMIN, UserRole.AUTHOR, UserRole.CURATOR),
  ItemController.delete,
);

export default router;
