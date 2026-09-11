import mongoose from 'mongoose';
import { MuseumModel } from '../models/index.js';

/**
 * Riempie coverImage con quella del museo per le visite che non ne hanno una
 * propria — solo per le liste/card mostrate ai visitatori (VisitController.
 * getAll/getByMuseum/getMyVisits, MarketplaceController.getVisits/
 * getMyPurchases): il valore resta calcolato al volo per la risposta, mai
 * scritto sul documento Visit, altrimenti un salvataggio successivo
 * dall'editor lo "congelerebbe" come se fosse stato scelto apposta.
 * VisitController.getById (usato dall'editor) resta perciò non toccato:
 * mostra sempre il valore vero, anche se vuoto.
 *
 * Visit.museumId è quasi sempre una QID Wikidata, ma non sempre (stesso
 * problema ricorrente descritto in museum-id.util.ts) — cerca il museo sia
 * per wikidataId sia per _id Mongo, non solo per wikidataId.
 *
 * Muta gli oggetti passati e li ritorna, così funziona sia su risultati
 * `.lean()` sia su documenti Mongoose (inclusi sotto-documenti popolati via
 * `.populate('visitId')`, dove basta passare quei sotto-documenti).
 */
export async function applyCoverImageFallback<T extends { museumId: string; coverImage?: string }>(
  visits: T[],
): Promise<T[]> {
  const missingMuseumIds = Array.from(
    new Set(visits.filter((v) => !v.coverImage).map((v) => v.museumId)),
  );
  if (missingMuseumIds.length === 0) return visits;

  const validObjectIds = missingMuseumIds.filter((id) => mongoose.Types.ObjectId.isValid(id));

  const museums = await MuseumModel.find({
    $or: [
      { wikidataId: { $in: missingMuseumIds } },
      ...(validObjectIds.length > 0 ? [{ _id: { $in: validObjectIds } }] : []),
    ],
  })
    .select('wikidataId coverImage')
    .lean();

  const coverImageByMuseumId = new Map<string, string | undefined>();
  for (const m of museums) {
    if (m.wikidataId) coverImageByMuseumId.set(m.wikidataId, m.coverImage);
    coverImageByMuseumId.set(String(m._id), m.coverImage);
  }

  for (const visit of visits) {
    if (!visit.coverImage) {
      visit.coverImage = coverImageByMuseumId.get(visit.museumId);
    }
  }
  return visits;
}
