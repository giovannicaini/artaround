import mongoose, { Schema, Document } from 'mongoose';
import { Item as IItem, ItemContent, ItemMetadata, ContentDuration, LicenseType } from '@artaround/shared';
import { CompetenceLevel } from '@artaround/shared';

export interface ItemDocument extends Omit<IItem, '_id'>, Document {}

const itemContentSchema = new Schema<ItemContent>({
  duration: { 
    type: String, 
    enum: Object.values(ContentDuration),
    required: true,
  },
  language: { 
    type: String, 
    enum: Object.values(CompetenceLevel),
    required: true,
  },
  text: { 
    type: String, 
    required: true,
  },
  translatedTexts: {
    type: Map,
    of: String,
  },
}, { _id: false });

const itemMetadataSchema = new Schema<ItemMetadata>({
  author: { type: String },
  style: { type: String },
  epoch: { type: String },
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
  tags: [{ type: String }],
}, { _id: false });

const itemSchema = new Schema<ItemDocument>({
  museumId: { 
    type: String, 
    required: true,
    ref: 'Museum',
  },
  objectId: { 
    type: String, 
    required: true, // Wikidata ID
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
  contents: [{ 
    type: itemContentSchema, 
    required: true,
  }],
  metadata: { 
    type: itemMetadataSchema, 
    required: true,
  },
  image: { type: String }, // base64 or URL
  relatedItems: [{ type: String }],
}, {
  timestamps: true,
});

// Indexes
itemSchema.index({ museumId: 1 });
itemSchema.index({ authorId: 1 });
itemSchema.index({ objectId: 1 });
itemSchema.index({ 'metadata.isFree': 1 });
itemSchema.index({ 'metadata.tags': 1 });

export const Item = mongoose.model<ItemDocument>('Item', itemSchema);
