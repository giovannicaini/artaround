import mongoose, { Schema, Document, Types } from 'mongoose';
import {
  Visit as IVisit,
  VisitItem,
  LogisticNote,
  NavigationNote,
  TargetAudience,
  VisitMetadata,
} from '@artaround/shared';
import { CompetenceLevel, TimePreference } from '@artaround/shared';

export interface VisitDocument extends Omit<IVisit, '_id'>, Document {}

const visitItemSchema = new Schema(
  {
    itemId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'Item',
    },
    order: {
      type: Number,
      required: true,
    },
    isOptional: {
      type: Boolean,
      default: false,
    },
    alternatives: [{ type: Schema.Types.ObjectId, ref: 'Item' }],
  },
  { _id: false },
);

const logisticNoteSchema = new Schema<LogisticNote>(
  {
    order: { type: Number, required: true },
    text: { type: String, required: true },
    type: {
      type: String,
      enum: ['info', 'warning', 'direction'],
      default: 'info',
    },
  },
  { _id: false },
);

const navigationNoteSchema = new Schema(
  {
    fromItemId: { type: Schema.Types.ObjectId, required: true, ref: 'Item' },
    toItemId: { type: Schema.Types.ObjectId, required: true, ref: 'Item' },
    text: { type: String, required: true },
    estimatedTime: { type: Number },
  },
  { _id: false },
);

const targetAudienceSchema = new Schema<TargetAudience>(
  {
    minAge: { type: Number },
    maxAge: { type: Number },
    competenceLevel: [
      {
        type: String,
        enum: Object.values(CompetenceLevel),
      },
    ],
    interests: [{ type: String }],
    timeRequired: {
      type: String,
      enum: Object.values(TimePreference),
      required: true,
    },
  },
  { _id: false },
);

const visitMetadataSchema = new Schema<VisitMetadata>(
  {
    language: { type: String, default: 'it' },
    duration: { type: Number, required: true }, // minutes
    itemsCount: { type: Number, required: true },
    price: { type: Number, default: 0, min: 0 },
    isFree: { type: Boolean, default: true },
    license: { type: String, required: true },
    rating: { type: Number, min: 0, max: 5 },
    downloadsCount: { type: Number, default: 0 },
    purchasesCount: { type: Number, default: 0 },
  },
  { _id: false },
);

const visitSchema = new Schema<VisitDocument>(
  {
    museumId: {
      type: String,
      required: true,
      ref: 'Museum',
    },
    authorId: {
      type: String,
      required: true,
      ref: 'User',
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    items: [
      {
        type: visitItemSchema,
        required: true,
      },
    ],
    logisticNotes: [logisticNoteSchema],
    navigationNotes: [navigationNoteSchema],
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
    },
    publishedAt: { type: Date },
  },
  {
    timestamps: true,
  },
);

// Indexes
visitSchema.index({ museumId: 1 });
visitSchema.index({ authorId: 1 });
visitSchema.index({ isPublished: 1 });
visitSchema.index({ 'metadata.isFree': 1 });
visitSchema.index({ 'metadata.rating': -1 });

export const Visit = mongoose.model<VisitDocument>('Visit', visitSchema);
