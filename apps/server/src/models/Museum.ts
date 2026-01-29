import mongoose, { Schema, Document } from 'mongoose';
import { Museum as IMuseum, MuseumLocation } from '@artaround/shared';

export interface MuseumDocument extends Omit<IMuseum, '_id'>, Document {}

const locationSchema = new Schema<MuseumLocation>({
  address: { type: String, required: true },
  city: { type: String, required: true },
  country: { type: String, required: true },
  coordinates: {
    lat: { type: Number },
    lng: { type: Number },
  },
}, { _id: false });

const museumSchema = new Schema<MuseumDocument>({
  name: { 
    type: String, 
    required: true,
    trim: true,
  },
  description: { 
    type: String, 
    required: true,
  },
  location: { 
    type: locationSchema, 
    required: true,
  },
  images: [{ type: String }],
  configFile: { type: String }, // JSON config as string or file path
  isActive: { 
    type: Boolean, 
    default: true,
  },
}, {
  timestamps: true,
});

// Indexes
museumSchema.index({ name: 1 });
museumSchema.index({ 'location.city': 1 });
museumSchema.index({ isActive: 1 });

export const Museum = mongoose.model<MuseumDocument>('Museum', museumSchema);
