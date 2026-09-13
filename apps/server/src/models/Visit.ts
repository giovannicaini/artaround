import mongoose, { Schema, Document } from 'mongoose';
import {
  Visit as IVisit,
  VisitStep,
  VisitStepType,
  VisitGeneralInfo,
  TargetAudience,
  VisitMetadata,
  LanguageLevel,
  SUPPORTED_APP_LANGUAGES,
  DEFAULT_APP_LANGUAGE,
} from '@artaround/shared';

export interface VisitDocument extends Omit<IVisit, '_id'>, Document {}

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
  },
  { _id: false },
);

const visitStepSchema = new Schema<VisitStep>(
  {
    id: { type: String, required: true },
    order: { type: Number, required: true },
    type: {
      type: String,
      enum: Object.values(VisitStepType),
      required: true,
    },
    // Per tappe ARTWORK
    artworkId: String, // Wikidata ID
    itemIds: [{ type: Schema.Types.ObjectId, ref: 'Item' }],
    // Per tappe LOGISTIC
    logisticTitle: String,
    logisticTitleTranslations: { type: Map, of: String, default: undefined },
    logisticText: String,
    logisticTextTranslations: { type: Map, of: String, default: undefined },
    logisticTextAudio: { type: Map, of: generatedAudioSchema, default: undefined },
    logisticIcon: String,
    // Per tappe NAVIGATION
    navigationText: String,
    navigationTextTranslations: { type: Map, of: String, default: undefined },
    navigationTextAudio: { type: Map, of: generatedAudioSchema, default: undefined },
    navigationImage: String,
    navigationVisual: { type: String, enum: ['image', 'map'] },
    fromRoom: String,
    toRoom: String,
    // Per tappe fittizie WAYPOINT è sempre un MapMarker di tipo WAYPOINT
    // Per LOGISTIC/NAVIGATION è un POI qualsiasi (facoltativo)
    mapMarkerId: String,
    // Campi comuni
    isOptional: { type: Boolean, default: false },
    estimatedDuration: Number,
  },
  { _id: false },
);

const generalInfoSchema = new Schema<VisitGeneralInfo>(
  {
    costs: String,
    ticketInfo: String,
    openingHours: String,
    services: [String],
    tips: [String],
    accessibility: String,
    wheelchairAccessible: Boolean,
  },
  { _id: false },
);

const targetAudienceSchema = new Schema<TargetAudience>(
  {
    minAge: Number,
    maxAge: Number,
    languageLevels: [
      {
        type: String,
        enum: Object.values(LanguageLevel),
      },
    ],
    interests: [String],
    estimatedDuration: { type: Number, required: true },
  },
  { _id: false },
);

const visitMetadataSchema = new Schema<VisitMetadata>(
  {
    language: {
      type: String,
      enum: SUPPORTED_APP_LANGUAGES,
      default: DEFAULT_APP_LANGUAGE,
    },
    supportedLanguages: [
      {
        type: String,
        enum: SUPPORTED_APP_LANGUAGES,
      },
    ],
    artworksCount: { type: Number, default: 0 },
    totalItemsCount: { type: Number, default: 0 },
    estimatedDuration: { type: Number, required: true },
    price: { type: Number, default: 0, min: 0 },
    isFree: { type: Boolean, default: true },
    license: { type: String, required: true },
    downloadsCount: { type: Number, default: 0 },
    purchasesCount: { type: Number, default: 0 },
  },
  { _id: false },
);

const visitSchema = new Schema<VisitDocument>(
  {
    museumId: {
      type: String, // Wikidata ID
      required: true,
      index: true,
    },
    authorId: {
      type: String,
      required: true,
      ref: 'User',
      index: true,
    },
    authorName: String,
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    titleTranslations: {
      type: Map,
      of: String,
    },
    descriptionTranslations: {
      type: Map,
      of: String,
    },
    coverImage: String,
    steps: [visitStepSchema],
    generalInfo: generalInfoSchema,
    targetAudience: {
      type: targetAudienceSchema,
      required: true,
    },
    metadata: {
      type: visitMetadataSchema,
      required: true,
    },
    isPublished: {
      type: Boolean,
      default: false,
      index: true,
    },
    publishedAt: Date,
  },
  {
    timestamps: true,
  },
);

// Indici
visitSchema.index({ museumId: 1, isPublished: 1 });
visitSchema.index({ 'metadata.isFree': 1 });
visitSchema.index({ title: 'text', description: 'text' });

export const VisitModel = mongoose.model<VisitDocument>('Visit', visitSchema);
