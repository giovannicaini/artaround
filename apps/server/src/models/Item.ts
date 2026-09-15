/*
 * File: /src/models/Item.ts                                                             *
 * Project: @artaround/server                                                            *
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
 * Schema Mongoose di un item (contenuto/approfondimento su opera, autore, movimento o museo, con traduzioni e audio generati).
 */
import mongoose, { Schema, Document } from 'mongoose';
import {
  Item as IItem,
  ItemReferenceType,
  ContentDuration,
  LanguageLevel,
  LicenseType,
  SUPPORTED_APP_LANGUAGES,
  DEFAULT_APP_LANGUAGE,
} from '@artaround/shared';

export interface ItemDocument extends Omit<IItem, '_id'>, Document {}

// Audio generato con OpenAI per un testo in una lingua — vedi
// audio-generation.service.ts. words[].charIndex è già allineato al testo,
// calcolato una sola volta alla generazione (non ad ogni ascolto).
const generatedAudioSchema = new Schema(
  {
    url: { type: String, required: true },
    words: [
      {
        word: { type: String, required: true },
        start: { type: Number, required: true },
        end: { type: Number, required: true },
        charIndex: { type: Number, required: true },
      },
    ],
    // Assente sui documenti creati prima della sua introduzione: trattato
    // come 'ai' in quel caso (era l'unico modo di produrne uno) — vedi
    // GeneratedAudio in item.types.ts.
    source: { type: String, enum: ['ai', 'manual'] },
  },
  { _id: false },
);

const itemSchema = new Schema<ItemDocument>(
  {
    // Contesto museo
    museumId: {
      type: String,
      required: true,
      index: true,
    },

    // Riferimento - a cosa si riferisce questo item
    referenceType: {
      type: String,
      enum: Object.values(ItemReferenceType),
      required: true,
      index: true,
    },
    referenceId: {
      type: String, // Wikidata ID
      index: true,
    },
    referenceTitle: String,

    // Contenuto
    sourceLanguage: {
      type: String,
      enum: SUPPORTED_APP_LANGUAGES,
      default: DEFAULT_APP_LANGUAGE,
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    text: {
      type: String,
      required: true,
    },
    translatedTitles: {
      type: Map,
      of: String,
    },
    translatedTexts: {
      type: Map,
      of: String,
    },
    audio: {
      type: Map,
      of: generatedAudioSchema,
      default: undefined,
    },

    // Caratteristiche del contenuto
    duration: {
      type: String,
      enum: Object.values(ContentDuration),
      required: true,
    },
    languageLevel: {
      type: String,
      enum: Object.values(LanguageLevel),
      required: true,
    },

    // Autore — il nome visualizzato si risolve sempre da authorId al momento
    // della risposta (vedi author-name.util.ts), mai salvato qui: niente
    // cache da tenere allineata se l'autore cambia username.
    authorId: {
      type: String,
      required: true,
      ref: 'User',
      index: true,
    },

    // Licenza e prezzo
    license: {
      type: String,
      enum: Object.values(LicenseType),
      default: LicenseType.CC_BY,
    },
    price: {
      type: Number,
      default: 0,
      min: 0,
    },
    isFree: {
      type: Boolean,
      default: true,
    },

    // Media
    image: String,

    // Statistiche
    usageCount: {
      type: Number,
      default: 0,
    },

    // Metadati
    tags: [String],
  },
  {
    timestamps: true,
  },
);

// Indici
itemSchema.index({ referenceType: 1, referenceId: 1 });
itemSchema.index({ museumId: 1, referenceType: 1 });
itemSchema.index({ isFree: 1 });
itemSchema.index({ duration: 1, languageLevel: 1 });
itemSchema.index({ title: 'text', text: 'text' });

export const ItemModel = mongoose.model<ItemDocument>('Item', itemSchema);
