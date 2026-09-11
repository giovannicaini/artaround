import mongoose, { Schema, Document } from 'mongoose';
import {
  ArtworkType,
  type Artwork,
  type ArtworkDimensions,
  type ArtworkMapPosition,
} from '@artaround/shared';

export interface ArtworkDocument extends Omit<Artwork, '_id'>, Document {}

const dimensionsSchema = new Schema<ArtworkDimensions>(
  {
    height: Number,
    width: Number,
    depth: Number,
    diameter: Number,
    unit: { type: String, enum: ['cm', 'm'], default: 'cm' },
    displayText: String,
  },
  { _id: false },
);

const mapPositionSchema = new Schema<ArtworkMapPosition>(
  {
    floorId: { type: String, required: true },
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    rotation: Number,
  },
  { _id: false },
);

const artworkSchema = new Schema<ArtworkDocument>(
  {
    // ID Wikidata come identificatore primario
    wikidataId: {
      type: String,
      required: true,
      index: true,
    },

    // Info di base
    title: { type: String, required: true },
    description: String,

    // Museo (ID Wikidata)
    museumId: {
      type: String,
      required: true,
      index: true,
    },

    // Autore/Artista
    author: String,
    authorWikidataId: { type: String, index: true },

    // Datazione
    year: String,
    startYear: Number,
    endYear: Number,

    // Classificazione
    artworkType: {
      type: String,
      enum: Object.values(ArtworkType),
      required: true,
    },
    movement: String,
    movementWikidataId: String,
    style: String,
    styleWikidataId: String,
    period: String,
    periodWikidataId: String,

    // Proprietà fisiche
    dimensions: dimensionsSchema,
    materials: [String],
    technique: String,

    // Contesto
    historicalEvents: [String],
    subjects: [String],
    artworkCollection: String,

    // Media
    image: { type: String, required: true },
    images: [String],

    // Posizione nel museo
    roomId: { type: String, index: true }, // Museum.rooms[].id
    room: String, // Testo libero, non visibilte all'utente per poi impostare l'id corretto della stanza
    floor: String,

    // Posizione sulla mappa
    mapPosition: mapPositionSchema,
  },
  {
    timestamps: true,
  },
);

// Indici per le query comuni
artworkSchema.index({ museumId: 1, room: 1 });
artworkSchema.index({ museumId: 1, wikidataId: 1 }, { unique: true });
artworkSchema.index({ movementWikidataId: 1 });
artworkSchema.index({ title: 'text', author: 'text', description: 'text' });

export const ArtworkModel = mongoose.model<ArtworkDocument>('Artwork', artworkSchema);
