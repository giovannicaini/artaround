/*
 * File: /src/utils/museum-id.util.ts                                                    *
 * Project: @artaround/server                                                            *
 * Last Modified: 02/09/2026                                                             *
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
 * Risolve un museumId (che sia l'_id Mongo o la QID Wikidata) in tutte le forme con cui quel museo può comparire nelle altre collezioni.
 */
import mongoose from 'mongoose';
import { MuseumModel } from '../models/index.js';

// Musei, opere, item e visite sono salvati con `museumId` uguale alla QID Wikidata del
// museo (stabile fra un reseed e l'altro, a differenza dell'_id Mongo che cambia ogni
// volta che il museo viene ricreato). Il client però conosce e passa quasi sempre l'_id
// Mongo (preso da `Museum._id`).
//
// Questa funzione risolve un museumId in ingresso (che sia un _id Mongo o già una QID)
// in tutti i valori con cui quel museo può essere effettivamente salvato sulle altre
// collezioni, così i filtri find/aggregate matchano indipendentemente dal formato usato
// dal chiamante.
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

// Costruisce il valore da assegnare a `filter.museumId` in una query Mongoose: un match
// diretto se c'è un solo candidato, altrimenti un $in su tutti i candidati risolti.
export const buildMuseumIdFilterValue = async (
  museumId: string | string[] | undefined | null,
): Promise<string | { $in: string[] } | undefined> => {
  const candidates = await resolveMuseumIdCandidates(museumId);
  if (candidates.length === 0) return undefined;
  return candidates.length === 1 ? candidates[0] : { $in: candidates };
};

// Trova UN museo per _id Mongo o QID Wikidata indifferentemente. Usata dagli
// endpoint pubblici (GET /museums/:id, /:id/config) — a differenza dei filtri
// find/aggregate sopra, qui serve il documento vero e proprio, non un valore
// di filtro. Prima di questa funzione, un id in formato QID (es. arrivato
// come Visit.museumId, che è quasi sempre salvato così — vedi il commento in
// cima al file) faceva fallire MuseumModel.findById() con un CastError non
// gestito dall'error handler, restituendo un fuorviante 500 invece di
// trovare comunque il museo o rispondere 404.
export const findMuseumByAnyId = async (id: string | string[] | undefined | null) => {
  const normalized = (Array.isArray(id) ? id[0] : id)?.trim() || '';
  if (!normalized) return null;

  if (mongoose.Types.ObjectId.isValid(normalized)) {
    const byObjectId = await MuseumModel.findById(normalized);
    if (byObjectId) return byObjectId;
  }
  return MuseumModel.findOne({ wikidataId: normalized });
};
