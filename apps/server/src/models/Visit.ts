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

const visitStepSchema = new Schema<VisitStep>(
  {
    id: { type: String, required: true },
    order: { type: Number, required: true },
    type: {
      type: String,
      enum: Object.values(VisitStepType),
      required: true,
    },
    // For ARTWORK steps
    artworkId: String, // Wikidata ID
    itemIds: [{ type: Schema.Types.ObjectId, ref: 'Item' }],
    selectedItemId: { type: Schema.Types.ObjectId, ref: 'Item' },
    // For LOGISTIC steps
    logisticTitle: String,
    logisticText: String,
    logisticIcon: String,
    // For NAVIGATION steps
    navigationText: String,
    navigationImage: String,
    fromRoom: String,
    toRoom: String,
    // Common
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
    rating: { type: Number, min: 0, max: 5 },
    ratingsCount: { type: Number, default: 0 },
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

// Indexes
visitSchema.index({ museumId: 1, isPublished: 1 });
visitSchema.index({ 'metadata.isFree': 1 });
visitSchema.index({ 'metadata.rating': -1 });
visitSchema.index({ title: 'text', description: 'text' });

export const VisitModel = mongoose.model<VisitDocument>('Visit', visitSchema);
