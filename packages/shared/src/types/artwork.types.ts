/*
 * File: /src/types/artwork.types.ts                                                     *
 * Project: @artaround/shared                                                            *
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
 * Tipi OPERA
 *
 * Rappresenta le opere fisiche nei musei.
 * Usa gli ID Wikidata come identificatori primari dove possibile.
 */

// ========================================
// ARTWORK (Opera fisica nel museo)
// ========================================

export interface Artwork {
  _id: string; // ObjectId MongoDB (interno)
  wikidataId: string; // Q number Wikidata (es. Q28798937) - CHIAVE PRIMARIA per la deduplicazione

  // Info di base
  title: string;
  description?: string;

  // Museo
  museumId: string; // ID Wikidata del museo (es. Q180916 per Galleria Borghese)

  // Autore/Artista
  author?: string; // Nome dell'artista
  authorWikidataId?: string; // Q number Wikidata (es. Q42207 per Caravaggio)

  // Datazione
  year?: string; // "1605", "1598-1601", "XVI secolo", "c. 1510"
  startYear?: number; // Campo tecnico per il filtro per intervallo numerico
  endYear?: number; // Campo tecnico per il filtro per intervallo numerico

  // Classificazione
  artworkType: ArtworkType;
  movement?: string; // "Barocco", "Rinascimento"
  movementWikidataId?: string; // Q number
  style?: string; // "Caravaggismo", "Manierismo"
  styleWikidataId?: string;
  period?: string; // "Cinquecento", "Seicento"
  periodWikidataId?: string;

  // Proprietà fisiche
  dimensions?: ArtworkDimensions;
  materials?: string[]; // "Olio su tela", "Marmo di Carrara"
  technique?: string;

  // Contesto
  historicalEvents?: string[]; // Eventi storici correlati
  subjects?: string[]; // "Mitologia", "Ritratto", "Sacro"
  artworkCollection?: string; // "Collezione Borghese" (non "collection": nome riservato su Document)

  // Media
  image: string; // URL immagine principale
  images?: string[]; // Immagini aggiuntive

  // Posizione nel museo
  roomId?: string; // Riferimento a Museum.rooms[].id — ogni opera dovrebbe averne una
  room?: string; // Testo libero legacy, usato come fallback quando manca roomId
  floor?: string; // "Piano Terra", "Primo Piano"

  // Posizione sulla mappa (collegata alla piantina del museo)
  mapPosition?: ArtworkMapPosition;

  // Metadati
  createdAt: Date;
  updatedAt: Date;
}

export interface ArtworkDimensions {
  height?: number; // in cm
  width?: number;
  depth?: number; // per le sculture
  diameter?: number; // per le opere circolari
  unit: 'cm' | 'm';
  displayText?: string; // "170 × 128 cm"
}

export interface ArtworkMapPosition {
  floorId: string;
  x: number;
  y: number;
  rotation?: number; // gradi 0-360
}
export enum ArtworkType {
  Painting = 'painting',
  Drawing = 'drawing',
  Sculpture = 'sculpture',
  Print = 'print',
  Photograph = 'photograph',
  Installation = 'installation',
  NewMedia = 'new_media',
  ManuscriptBook = 'manuscript_book',
  DecorativeObject = 'decorative_object',
  Other = 'other',
}

// ========================================
// FILTRI SULLE OPERE
// ========================================

export interface ArtworkFilters {
  museumId?: string;
  author?: string;
  authorWikidataId?: string;
  artworkType?: ArtworkType;
  movement?: string;
  movementWikidataId?: string;
  roomId?: string;
  room?: string;
  floor?: string;
  yearFrom?: number;
  yearTo?: number;
  search?: string;
  page?: number;
  limit?: number;
}

// ========================================
// REQUEST DELLE OPERE
// ========================================

export interface CreateArtworkData {
  wikidataId: string;
  museumId: string; // ID Wikidata del museo
  title: string;
  description?: string;
  author?: string;
  authorWikidataId?: string;
  year?: string;
  startYear?: number;
  endYear?: number;
  artworkType: ArtworkType;
  movement?: string;
  movementWikidataId?: string;
  dimensions?: ArtworkDimensions;
  materials?: string[];
  image: string;
  images?: string[];
  roomId?: string;
  room?: string;
  floor?: string;
  mapPosition?: ArtworkMapPosition;
}

export type UpdateArtworkData = Partial<CreateArtworkData>;

// ========================================
// ARTWORK SUMMARY (per le liste)
// ========================================

export interface ArtworkSummary {
  _id: string;
  wikidataId: string;
  title: string;
  author?: string;
  authorWikidataId?: string;
  year?: string;
  artworkType: ArtworkType;
  image: string;
  roomId?: string;
  room?: string;
  hasMapPosition: boolean;
}
