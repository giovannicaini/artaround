import mongoose from 'mongoose';
import { MuseumModel } from '../models/index.js';

// opere/item/visite salvano museumId come QID Wikidata, ma il client passa
// quasi sempre l'_id Mongo: questa funzione risolve l'id in ingresso (in
// qualsiasi dei due formati) in tutti i valori con cui il museo può essere
// salvato, così i filtri find/aggregate matchano a prescindere dal formato
export const resolveMuseumIdCandidates = async (
  museumId: string | string[] | undefined | null,
): Promise<string[]> => {
  const normalized = (Array.isArray(museumId) ? museumId[0] : museumId)?.trim() || '';
  if (!normalized) return [];

  const candidates = new Set<string>([normalized]);

  if (mongoose.Types.ObjectId.isValid(normalized)) {
    const museum = await MuseumModel.findById(normalized).select('_id wikidataId').lean();
    if (museum?._id) {
      candidates.add(String(museum._id));
    }
    if (museum?.wikidataId) {
      candidates.add(museum.wikidataId);
    }
    return Array.from(candidates);
  }

  const museum = await MuseumModel.findOne({ wikidataId: normalized })
    .select('_id wikidataId')
    .lean();
  if (museum?._id) {
    candidates.add(String(museum._id));
  }
  if (museum?.wikidataId) {
    candidates.add(museum.wikidataId);
  }

  return Array.from(candidates);
};

// per un filtro Mongoose: match diretto se c'è un solo candidato, $in altrimenti
export const buildMuseumIdFilterValue = async (
  museumId: string | string[] | undefined | null,
): Promise<string | { $in: string[] } | undefined> => {
  const candidates = await resolveMuseumIdCandidates(museumId);
  if (candidates.length === 0) return undefined;
  return candidates.length === 1 ? candidates[0] : { $in: candidates };
};

// trova un museo per _id o QID indifferentemente, usata dagli endpoint
// pubblici dove serve il documento e non solo un valore di filtro
export const findMuseumByAnyId = async (id: string | string[] | undefined | null) => {
  const normalized = (Array.isArray(id) ? id[0] : id)?.trim() || '';
  if (!normalized) return null;

  if (mongoose.Types.ObjectId.isValid(normalized)) {
    const byObjectId = await MuseumModel.findById(normalized);
    if (byObjectId) return byObjectId;
  }
  return MuseumModel.findOne({ wikidataId: normalized });
};
