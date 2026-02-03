import mongoose, { Schema, Document } from 'mongoose';
import {
  Museum as IMuseum,
  MuseumLocation,
  MuseumFloor,
  MapMarker,
  MarkerType,
  ConnectionType,
  AccessibilityInfo,
} from '@artaround/shared';

import type { FloorConnection } from '@artaround/shared';

export interface MuseumDocument extends Omit<IMuseum, '_id'>, Document {}

const locationSchema = new Schema<MuseumLocation>(
  {
    address: { type: String, required: true },
    city: { type: String, required: true },
    country: { type: String, required: true },
    coordinates: {
      lat: { type: Number },
      lng: { type: Number },
    },
  },
  { _id: false },
);

const accessibilityInfoSchema = new Schema<AccessibilityInfo>(
  {
    wheelchairAccessible: { type: Boolean, default: false },
    hasSteps: { type: Boolean, default: false },
    stepCount: { type: Number },
    hasRamp: { type: Boolean, default: false },
    visualAids: { type: Boolean, default: false },
    audioAids: { type: Boolean, default: false },
    notes: { type: String },
  },
  { _id: false },
);

const mapMarkerSchema = new Schema<MapMarker>(
  {
    id: { type: String, required: true },
    floorId: { type: String }, // Optional for legacy config
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    type: {
      type: String,
      enum: Object.values(MarkerType),
      required: true,
    },
    label: { type: String },
    description: { type: String },
    itemId: { type: String }, // Reference to Item for artwork markers
    icon: { type: String },
    isVisible: { type: Boolean, default: true },
    focalPoint: {
      x: { type: Number, default: 50 },
      y: { type: Number, default: 50 },
    },
    focalZoom: { type: Number, default: 1 },
    accessibilityInfo: { type: accessibilityInfoSchema },
  },
  { _id: false },
);

const floorConnectionSchema = new Schema<FloorConnection>(
  {
    id: { type: String, required: true },
    type: {
      type: String,
      enum: Object.values(ConnectionType),
      required: true,
    },
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    targetFloorId: { type: String, required: true },
    targetX: { type: Number },
    targetY: { type: Number },
    label: { type: String },
    isAccessible: { type: Boolean, default: false },
  },
  { _id: false },
);

const floorSchema = new Schema<MuseumFloor>(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    level: { type: Number, required: true },
    svgContent: { type: String, required: true }, // Raw SVG content
    svgUrl: { type: String },
    dimensions: {
      width: { type: Number, required: true },
      height: { type: Number, required: true },
    },
    markers: [mapMarkerSchema],
    connections: [floorConnectionSchema],
  },
  { _id: false },
);

const museumSchema = new Schema<MuseumDocument>(
  {
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
    configFile: { type: String }, // Legacy: JSON config as string
    floors: [floorSchema], // New: Multi-floor map system
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes
museumSchema.index({ name: 1 });
museumSchema.index({ 'location.city': 1 });
museumSchema.index({ isActive: 1 });

export const Museum = mongoose.model<MuseumDocument>('Museum', museumSchema);
