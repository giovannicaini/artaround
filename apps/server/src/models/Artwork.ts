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
    // Wikidata ID as primary identifier
    wikidataId: {
      type: String,
      required: true,
      index: true,
    },

    // Basic info
    title: { type: String, required: true },
    description: String,

    // Museum (Wikidata ID)
    museumId: {
      type: String,
      required: true,
      index: true,
    },

    // Author/Artist
    author: String,
    authorWikidataId: { type: String, index: true },

    // Dating
    year: String,
    startYear: Number,
    endYear: Number,

    // Classification
    artworkType: {
      type: String,
      // Derivato dall'enum condiviso invece di duplicarlo qui a mano: un elenco
      // hardcoded era rimasto disallineato dopo il redesign dell'enum (4 categorie
      // su 10 - photograph, new_media, manuscript_book, decorative_object - non
      // erano mai salvabili, fallivano sempre con un errore di validazione Mongoose).
      enum: Object.values(ArtworkType),
      required: true,
    },
    movement: String,
    movementWikidataId: String,
    style: String,
    styleWikidataId: String,
    period: String,
    periodWikidataId: String,

    // Physical properties
    dimensions: dimensionsSchema,
    materials: [String],
    technique: String,

    // Context
    historicalEvents: [String],
    subjects: [String],
    artworkCollection: String, // Renamed from 'collection' to avoid Document conflict

    // Media
    image: { type: String, required: true },
    images: [String],

    // Location in museum
    roomId: { type: String, index: true }, // Museum.rooms[].id
    room: String, // testo libero legacy, fallback per opere non ancora migrate
    floor: String,

    // Map position
    mapPosition: mapPositionSchema,
  },
  {
    timestamps: true,
  },
);

// Indexes for common queries
artworkSchema.index({ museumId: 1, room: 1 });
artworkSchema.index({ museumId: 1, wikidataId: 1 }, { unique: true });
artworkSchema.index({ movementWikidataId: 1 });
artworkSchema.index({ title: 'text', author: 'text', description: 'text' });

export const ArtworkModel = mongoose.model<ArtworkDocument>('Artwork', artworkSchema);
