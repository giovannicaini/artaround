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
    museumId: {
      type: String,
      required: true,
      index: true,
    },

    referenceType: {
      type: String,
      enum: Object.values(ItemReferenceType),
      required: true,
      index: true,
    },
    referenceId: {
      type: String, // id wikidata
      index: true,
    },
    referenceTitle: String,

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

    authorId: {
      type: String,
      required: true,
      ref: 'User',
      index: true,
    },
    authorName: String,

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

    image: String,

    usageCount: {
      type: Number,
      default: 0,
    },
    rating: Number,

    tags: [String],
  },
  {
    timestamps: true,
  },
);

itemSchema.index({ referenceType: 1, referenceId: 1 });
itemSchema.index({ museumId: 1, referenceType: 1 });
itemSchema.index({ isFree: 1 });
itemSchema.index({ duration: 1, languageLevel: 1 });
itemSchema.index({ title: 'text', text: 'text' });

export const ItemModel = mongoose.model<ItemDocument>('Item', itemSchema);
