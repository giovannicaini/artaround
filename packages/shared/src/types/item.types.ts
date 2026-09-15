/*
 * File: /src/types/item.types.ts                                                        *
 * Project: @artaround/shared                                                            *
 * Last Modified: 14/09/2026                                                             *
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
 * Tipi Item (Contenuti)
 *
 * Gli Item sono contenuti RIUSABILI (testo/audio) che possono riferirsi a:
 * - Opere (descrizioni di opere fisiche)
 * - Autori/Artisti (biografie, stili)
 * - Movimenti artistici (Barocco, Rinascimento, ecc.)
 * - Periodi storici (contesto)
 * - Musei (info generali sul museo)
 *
 * NOTA: le info logistiche e le indicazioni di navigazione NON sono Item.
 * Sono specifiche di ogni Visita e gestite come proprietà di VisitStep.
 */

import type { AppLanguage } from './i18n.types';

// Una parola trascritta dell'audio generato, con la sua posizione nel testo
// originale già calcolata (charIndex) — l'allineamento parola→testo si fa
// una sola volta, al momento della generazione (vedi audio-generation.service.ts
// lato server), non ad ogni ascolto: il client si limita a confrontare
// audio.currentTime con start/end per sapere quale charIndex evidenziare.
export interface AudioWordTiming {
  word: string;
  start: number; // secondi dall'inizio dell'audio
  end: number;
  charIndex: number; // posizione di questa parola nel testo originale
}

// Audio (generato con OpenAI o caricato a mano) per un testo in una lingua
// specifica. `source` manca sui documenti creati prima della sua
// introduzione: sempre 'ai' in quel caso (era l'unico modo di produrne uno),
// quindi il client la tratta come 'ai' quando assente — vedi
// item-audio-panel.ts.
export interface GeneratedAudio {
  url: string;
  words: AudioWordTiming[];
  source?: 'ai' | 'manual';
}

// ========================================
// ITEM (contenuto testuale/audio)
// ========================================

export interface Item {
  _id: string; // ObjectId MongoDB

  // Contesto museo
  museumId: string;

  // Riferimento - a cosa si riferisce questo item
  referenceType: ItemReferenceType;
  referenceId?: string; // ID Wikidata dell'entità referenziata (opera, autore, movimento, ecc.)
  referenceTitle?: string; // Titolo/nome per la visualizzazione (cache dal riferimento)

  // Contenuto
  sourceLanguage: AppLanguage;
  title: string;
  text: string;
  translatedTitles?: Partial<Record<AppLanguage, string>>; //Traduzioni del titolo
  translatedTexts?: Partial<Record<AppLanguage, string>>; //Traduzioni del testo
  // Audio generato con OpenAI per il testo (sorgente e/o tradotto), per
  // lingua — vedi MuseumController.generateItemAudioForMuseum. Invalidato
  // (rimosso, mai lasciato a leggere un testo che non c'è più) quando
  // text/translatedTexts cambiano, vedi ItemController.update.
  audio?: Partial<Record<AppLanguage, GeneratedAudio>>;

  // Caratteristiche del contenuto
  duration: ContentDuration; // 3s, 15s, 1min, 4min
  languageLevel: LanguageLevel; // infantile, elementare, medio, specialistico

  // Autore
  authorId: string; // ID dell'utente che ha creato questo contenuto
  // Mai salvato: risolto dall'authorId al momento della risposta, vedi
  // author-name.util.ts lato server.
  authorName?: string;

  // Licenza e prezzo
  license: LicenseType;
  price: number; // 0 per gratis
  isFree: boolean;

  // Media
  image?: string; // Immagine opzionale (se assente, usa l'immagine dell'opera quando applicabile)

  // Statistiche
  usageCount: number; // Quante volte usato nelle visite

  // Metadati
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
}

// ========================================
// TIPI DI CONTENUTO
// ========================================

export enum ItemReferenceType {
  ARTWORK = 'artwork', // Si riferisce a un'opera specifica
  AUTHOR = 'author', // Riguarda un artista/autore
  MOVEMENT = 'movement', // Riguarda un movimento artistico (Barocco, Rinascimento, ecc.)
  PERIOD = 'period', // Riguarda un periodo storico
  MUSEUM = 'museum', // Riguarda il museo stesso
}

// ========================================
// CARATTERISTICHE DEL CONTENUTO
// ========================================

export enum ContentDuration {
  FLASH = '3s', // Menzione ultra-breve
  SHORT = '15s', // Panoramica rapida
  MEDIUM = '1min', // Spiegazione standard
  LONG = '4min', // Analisi dettagliata
}

export enum LanguageLevel {
  CHILDREN = 'infantile', // Per bambini (5-10 anni)
  ELEMENTARY = 'elementare', // Linguaggio semplice (10-14 anni / visitatori occasionali)
  MEDIUM = 'medio', // Standard (adulti con cultura generale)
  SPECIALIST = 'specialistico', // Livello esperto/accademico
}

// ========================================
// LICENZA
// ========================================

export enum LicenseType {
  CC0 = 'CC0', // Dominio pubblico
  CC_BY = 'CC-BY', // Attribuzione
  CC_BY_SA = 'CC-BY-SA', // Attribuzione-Condividi allo stesso modo
  CC_BY_NC = 'CC-BY-NC', // Attribuzione-Non commerciale
  CC_BY_NC_SA = 'CC-BY-NC-SA', // Attribuzione-Non commerciale-Condividi allo stesso modo
  PROPRIETARY = 'proprietary', // Tutti i diritti riservati
}

// ========================================
// INTEGRAZIONE WIKIDATA
// ========================================

// le proprietà non sempre appaiono con i codici giusti su Wikidata: problema di difficile risoluzione
export interface WikidataEntity {
  id: string; // Q number (es. Q42207)
  label: string;
  description?: string;
  imageUrl?: string;

  // Proprietà comuni
  instanceOf?: string[]; // P31 - tipo di entità
  author?: string; // P170 - nome del creatore
  authorId?: string; // P170 - ID Wikidata del creatore
  movement?: string; // P135 - nome del movimento/stile
  movementId?: string; // P135 - ID Wikidata del movimento
  style?: string;
  styleId?: string;
  inception?: string; // P571 - data di creazione
  epoch?: string;
  location?: string; // P276 - luogo
  locationId?: string; // P276 - ID Wikidata del luogo
  year?: string;
  period?: string;
  periodId?: string;
  technique?: string;
  materials?: string[];
  room?: string;
  floor?: string;
  dimensionHeight?: number;
  dimensionWidth?: number;
  dimensionDepth?: number;
  dimensionUnit?: 'cm' | 'm';
  properties?: Record<string, unknown>; // Proprietà raw per eventuali ricerche aggiuntive

  // Solo per i musei (WikidataService.searchMuseums), se disponibili.
  address?: string;
  postalCode?: string;
  city?: string;
  country?: string;
  coordinates?: { lat: number; lng: number };
}

// ========================================
// FILTRI E QUERY SUGLI ITEM
// ========================================

export interface ItemFilters {
  museumId?: string;
  referenceType?: ItemReferenceType;
  referenceId?: string;
  authorId?: string;
  duration?: ContentDuration;
  languageLevel?: LanguageLevel;
  isFree?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

// ========================================
// REQUESTS ITEM
// ========================================

export interface CreateItemData {
  museumId: string;
  sourceLanguage?: AppLanguage;
  referenceType: ItemReferenceType;
  referenceId?: string; // ID Wikidata per opera/autore/movimento/museo
  referenceTitle?: string;
  title: string;
  text: string;
  translatedTitles?: Partial<Record<AppLanguage, string>>;
  translatedTexts?: Partial<Record<AppLanguage, string>>;
  duration: ContentDuration;
  languageLevel: LanguageLevel;
  license: LicenseType;
  price?: number;
  tags?: string[];
  image?: string;
}

export type UpdateItemData = Partial<CreateItemData>;

// ========================================
// RIEPILOGO ITEM (per le liste)
// ========================================

export interface ItemSummary {
  _id: string;
  title: string;
  referenceType: ItemReferenceType;
  referenceTitle?: string;
  duration: ContentDuration;
  languageLevel: LanguageLevel;
  isFree: boolean;
  price: number;
  authorName?: string;
  image?: string;
}
