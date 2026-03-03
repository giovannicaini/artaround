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

const itemSchema = new Schema<ItemDocument>(
  {
    // Museum context
    museumId: {
      type: String,
      required: true,
      index: true,
    },

    // Reference - what this item is about
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

    // Content
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

    // Content characteristics
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

    // Authorship
    authorId: {
      type: String,
      required: true,
      ref: 'User',
      index: true,
    },
    authorName: String,

    // Licensing & Pricing
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

    // Statistics
    usageCount: {
      type: Number,
      default: 0,
    },
    rating: Number,

    // Metadata
    tags: [String],
  },
  {
    timestamps: true,
  },
);

// Indexes
itemSchema.index({ referenceType: 1, referenceId: 1 });
itemSchema.index({ museumId: 1, referenceType: 1 });
itemSchema.index({ isFree: 1 });
itemSchema.index({ duration: 1, languageLevel: 1 });
itemSchema.index({ title: 'text', text: 'text' });

export const ItemModel = mongoose.model<ItemDocument>('Item', itemSchema);
