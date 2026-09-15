/*
 * File: /src/routes/upload.routes.ts                                                    *
 * Project: @artaround/server                                                            *
 * Last Modified: 05/09/2026                                                             *
 * Author: Giovanni Caini (giovanni.caini@studio.unibo.it)                               *
 * -----                                                                                 *
 * MIT License                                                                           *
 *                                                                                       *
 * Copyright (c) 2026 Giovanni Caini                                                     *
 *                                                                                       *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of       *
 * this software and associated documentation files (the "Software"), to deal in         *
 * the Software without restriction, including without limitation the rights to          *
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies         *
 * of the Software, and to permit persons to whom the Software is furnished to do        *
 * so, subject to the following conditions:                                              *
 *                                                                                       *
 * The above copyright notice and this permission notice shall be included in all        *
 * copies or substantial portions of the Software.                                       *
 *                                                                                       *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR            *
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,              *
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE           *
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER                *
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,         *
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE         *
 * SOFTWARE.                                                                             *
 * ************************************************************************************* *
 */

/**
 * Rotte per il caricamento di file (immagini, audio).
 */
import { Router } from 'express';
import { UploadController } from '../controllers/upload.controller.js';
import { upload } from '../utils/upload.service.js';
import { authMiddleware } from '../middleware/index.js';
// Caricare/eliminare file non è un'azione da semplice visitatore: richiede di
// essere admin, o curatore/autore di almeno un museo.
import { authorizeContentCreator as authorizeUploader } from '../utils/policy.util.js';

const router = Router();

/**
 * @swagger
 * /api/uploads:
 *   post:
 *     tags: [Uploads]
 *     summary: Upload e processa un'immagine
 *     description: Carica un'immagine, la processa (ridimensiona/ritaglia) e la salva sul server
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *               - category
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               category:
 *                 type: string
 *                 enum: [museums, items, artworks, visits, users, misc]
 *               width:
 *                 type: integer
 *               height:
 *                 type: integer
 *               fit:
 *                 type: string
 *                 enum: [cover, contain, fill, inside, outside]
 *               quality:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 100
 *               format:
 *                 type: string
 *                 enum: [jpeg, png, webp]
 *               cropX:
 *                 type: number
 *               cropY:
 *                 type: number
 *               cropWidth:
 *                 type: number
 *               cropHeight:
 *                 type: number
 *               oldPath:
 *                 type: string
 *                 description: Percorso dell'immagine precedente da eliminare
 *     responses:
 *       200:
 *         description: Immagine caricata con successo
 */
router.post(
  '/',
  authMiddleware,
  authorizeUploader,
  upload.single('file'),
  UploadController.uploadImage,
);

/**
 * @swagger
 * /api/uploads/from-url:
 *   post:
 *     tags: [Uploads]
 *     summary: Scarica e processa un'immagine da URL
 *     description: Scarica un'immagine da un URL esterno, la processa e la salva sul server
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - url
 *               - category
 *             properties:
 *               url:
 *                 type: string
 *               category:
 *                 type: string
 *                 enum: [museums, items, artworks, visits, users, misc]
 *               width:
 *                 type: integer
 *               height:
 *                 type: integer
 *               quality:
 *                 type: integer
 *               format:
 *                 type: string
 *                 enum: [jpeg, png, webp]
 *               cropX:
 *                 type: number
 *               cropY:
 *                 type: number
 *               cropWidth:
 *                 type: number
 *               cropHeight:
 *                 type: number
 *               oldPath:
 *                 type: string
 *     responses:
 *       200:
 *         description: Immagine scaricata e salvata con successo
 */
router.post('/from-url', authMiddleware, authorizeUploader, UploadController.uploadFromUrl);

/**
 * @swagger
 * /api/uploads:
 *   delete:
 *     tags: [Uploads]
 *     summary: Elimina un'immagine caricata
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - path
 *             properties:
 *               path:
 *                 type: string
 *                 description: Percorso dell'immagine (es. /uploads/museums/abc123.webp)
 *     responses:
 *       200:
 *         description: Immagine eliminata
 */
router.delete('/', authMiddleware, authorizeUploader, UploadController.deleteImage);

export default router;
