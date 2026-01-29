import { Router } from 'express';
import { UtilsController } from '../controllers/utils.controller';
import { authMiddleware } from '../middleware';

const router = Router();

// Wikidata routes (public)
router.get('/wikidata/:id', UtilsController.getWikidataEntity);
router.get('/wikidata-search', UtilsController.searchWikidata);

// Translation routes (protected)
router.post(
  '/translate',
  authMiddleware,
  UtilsController.translateValidation,
  UtilsController.translate
);

export default router;
