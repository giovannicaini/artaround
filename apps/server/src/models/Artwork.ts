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
    wikidataId: {
      type: String,
      required: true,
      index: true,
    },

    title: { type: String, required: true },
    description: String,

    museumId: {
      type: String,
      required: true,
      index: true,
    },

    author: String,
    authorWikidataId: { type: String, index: true },

    year: String,
    startYear: Number,
    endYear: Number,

    artworkType: {
      type: String,
      enum: Object.values(ArtworkType), // usa l'enum condiviso, non riscrivere i valori a mano qui
      required: true,
    },
    movement: String,
    movementWikidataId: String,
    style: String,
    styleWikidataId: String,
    period: String,
    periodWikidataId: String,

    dimensions: dimensionsSchema,
    materials: [String],
    technique: String,

    historicalEvents: [String],
    subjects: [String],
    artworkCollection: String, // rinominato da 'collection', andava in conflitto con Document

    image: { type: String, required: true },
    images: [String],

    roomId: { type: String, index: true }, // Museum.rooms[].id
    room: String, // testo libero legacy, fallback per opere non ancora migrate
    floor: String,

    mapPosition: mapPositionSchema,
  },
  {
    timestamps: true,
  },
);

artworkSchema.index({ museumId: 1, room: 1 });
artworkSchema.index({ museumId: 1, wikidataId: 1 }, { unique: true });
artworkSchema.index({ movementWikidataId: 1 });
artworkSchema.index({ title: 'text', author: 'text', description: 'text' });

export const ArtworkModel = mongoose.model<ArtworkDocument>('Artwork', artworkSchema);
