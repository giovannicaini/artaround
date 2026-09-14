import { Router } from 'express';
import { ItemController } from '../controllers/item.controller.js';
import { authMiddleware as authenticate } from '../middleware/index.js';
import { authorizeCreate } from '../utils/policy.util.js';
import { audioUpload } from '../utils/upload.service.js';

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
 *         - text
 *         - duration
 *         - languageLevel
 *         - license
 *       properties:
 *         referenceType:
 *           type: string
 *           enum: [artwork, author, movement, period, museum]
 *           description: Tipo di entità a cui si riferisce questo item
 *         referenceId:
 *           type: string
 *           description: ID Wikidata dell'entità referenziata
 *         title:
 *           type: string
 *         titleTranslations:
 *           type: object
 *         text:
 *           type: string
 *           description: Testo descrittivo, sia per lo schermo sia per la sintesi vocale
 *         translatedTexts:
 *           type: object
 *         duration:
 *           type: string
 *           enum: ['3s', '15s', '1min', '4min', '10min']
 *           description: Un item = una combinazione durata×livello linguistico
 *         languageLevel:
 *           type: string
 *           enum: [infantile, elementare, medio, specialistico]
 *         authorId:
 *           type: string
 *           description: ID dell'utente che ha creato il contenuto
 *         license:
 *           type: string
 *           enum: [CC0, CC-BY, CC-BY-SA, CC-BY-NC, CC-BY-NC-SA, proprietary]
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
 *     summary: Lista tutti gli item
 *     description: Ottiene la lista degli item di contenuto con filtri
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
 *         description: ID Wikidata dell'entità referenziata
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
 *         description: Lista item con paginazione
 */
router.get('/', ItemController.getAll);

/**
 * @swagger
 * /api/items/search:
 *   get:
 *     tags: [Items]
 *     summary: Cerca item
 *     description: Ricerca full-text negli item
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Termine di ricerca
 *       - in: query
 *         name: referenceType
 *         schema:
 *           type: string
 *       - in: query
 *         name: tags
 *         schema:
 *           type: string
 *         description: Tag separati da virgola
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
 *         description: Risultati della ricerca
 */
router.get('/search', ItemController.search);

/**
 * @swagger
 * /api/items/my-items:
 *   get:
 *     tags: [Items]
 *     summary: Ottieni i miei item
 *     description: Ottiene gli item creati dall'utente autenticato
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Item dell'utente
 */
router.get('/my-items', authenticate, ItemController.getMyItems);

/**
 * @swagger
 * /api/items/artwork/{artworkId}:
 *   get:
 *     tags: [Items]
 *     summary: Ottieni gli item di un'opera
 *     description: Ottiene tutti gli item di contenuto che si riferiscono a un'opera specifica
 *     parameters:
 *       - in: path
 *         name: artworkId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID Wikidata dell'opera
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
 *         description: Item dell'opera
 */
router.get('/artwork/:artworkId', ItemController.getByArtwork);

/**
 * @swagger
 * /api/items/artwork/{artworkId}/usable:
 *   get:
 *     tags: [Items]
 *     summary: Item di un'opera abbinabili a una tappa (autenticato)
 *     description: >
 *       Come /api/items/artwork/{artworkId} ma ristretto a ciò che l'utente
 *       autenticato può abbinare a una tappa che sta costruendo: propri
 *       contenuti, gratuiti, o già acquistati — a differenza del catalogo
 *       pubblico, dove chiunque vede tutto per poterlo valutare/acquistare.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: artworkId
 *         required: true
 *         schema:
 *           type: string
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
 *         description: Item dell'opera che l'utente può usare
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/artwork/:artworkId/usable', authenticate, ItemController.getUsableItemsForArtwork);

/**
 * @swagger
 * /api/items/reference/{referenceType}/{referenceId}:
 *   get:
 *     tags: [Items]
 *     summary: Ottieni item per riferimento
 *     description: Ottiene gli item di contenuto per tipo e ID di riferimento
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
 *         description: ID Wikidata
 *     responses:
 *       200:
 *         description: Item per il riferimento richiesto
 */
router.get('/reference/:referenceType/:referenceId', ItemController.getByReference);

/**
 * @swagger
 * /api/items/reference-type/{referenceType}/usable:
 *   get:
 *     tags: [Items]
 *     summary: Item di un museo per tipo di riferimento, abbinabili a una tappa (autenticato)
 *     description: >
 *       Item di tipo autore/movimento/periodo/museo per il museo indicato,
 *       ristretti come /api/items/artwork/{artworkId}/usable — usata dalle
 *       tappe "Contenuto" dell'editor visite.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: referenceType
 *         required: true
 *         schema:
 *           type: string
 *           enum: [author, movement, period, museum]
 *       - in: query
 *         name: museumId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Item del tipo richiesto che l'utente può usare
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get(
  '/reference-type/:referenceType/usable',
  authenticate,
  ItemController.getUsableItemsByReferenceType,
);

/**
 * @swagger
 * /api/items/{id}:
 *   get:
 *     tags: [Items]
 *     summary: Ottieni item per ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Dettagli item
 *       404:
 *         description: Item non trovato
 */
router.get('/:id', ItemController.getById);

/**
 * @swagger
 * /api/items:
 *   post:
 *     tags: [Items]
 *     summary: Crea item
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
 *         description: Item creato
 */
router.post(
  '/',
  authenticate,
  authorizeCreate('item'),
  ItemController.createValidation,
  ItemController.create,
);

/**
 * @swagger
 * /api/items/{id}:
 *   put:
 *     tags: [Items]
 *     summary: Aggiorna item
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
 *         description: Item aggiornato
 */
router.put('/:id', authenticate, ItemController.updateValidation, ItemController.update);

/**
 * @swagger
 * /api/items/{id}/audio:
 *   post:
 *     tags: [Items]
 *     summary: Carica l'audio di una lingua (owner, admin o curatore)
 *     description: >
 *       Sostituisce l'audio esistente di quella lingua, se presente (file
 *       precedente eliminato). A differenza dell'audio generato con
 *       "genera-audio", un audio caricato non ha evidenziazione parola per
 *       parola nel Navigator.
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
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               language:
 *                 type: string
 *     responses:
 *       200:
 *         description: Audio caricato
 */
router.post('/:id/audio', authenticate, audioUpload.single('file'), ItemController.uploadAudio);

/**
 * @swagger
 * /api/items/{id}/audio/{language}:
 *   delete:
 *     tags: [Items]
 *     summary: Elimina l'audio di una lingua (owner, admin o curatore)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: language
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Audio eliminato
 */
router.delete('/:id/audio/:language', authenticate, ItemController.deleteAudio);

/**
 * @swagger
 * /api/items/{id}/generate-audio:
 *   post:
 *     tags: [Items]
 *     summary: Genera con OpenAI l'audio mancante di questo item (owner, admin o curatore)
 *     description: >
 *       Genera l'audio (voce + evidenziazione parola per parola) per la
 *       lingua sorgente e ogni traduzione già scritta che non ha ancora un
 *       audio (caricato o generato) — sincrono, risponde solo a fine
 *       generazione.
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
 *         description: Audio generato
 */
router.post('/:id/generate-audio', authenticate, ItemController.generateAudio);

/**
 * @swagger
 * /api/items/{id}:
 *   delete:
 *     tags: [Items]
 *     summary: Elimina item
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
 *         description: Item eliminato
 */
router.delete('/:id', authenticate, ItemController.delete);

export default router;
