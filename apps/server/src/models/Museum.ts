import mongoose, { Schema, Document } from 'mongoose';
import {
  Museum as IMuseum,
  MuseumLocation,
  MuseumServices,
  MuseumFloor,
  MapMarker,
  MarkerType,
  ConnectionType,
  AccessibilityInfo,
  SUPPORTED_APP_LANGUAGES,
  DEFAULT_APP_LANGUAGE,
} from '@artaround/shared';

import type { FloorConnection } from '@artaround/shared';

export interface MuseumDocument extends Omit<IMuseum, '_id'>, Document {}

const locationSchema = new Schema<MuseumLocation>(
  {
    address: { type: String, required: true },
    city: { type: String, required: true },
    country: { type: String, required: true },
    region: String,
    postalCode: String,
    coordinates: {
      lat: Number,
      lng: Number,
    },
  },
  { _id: false },
);

const servicesSchema = new Schema<MuseumServices>(
  {
    ticketInfo: String,
    ticketInfoTranslations: {
      type: Map,
      of: String,
      default: undefined,
    },
    openingHours: String,
    openingHoursTranslations: {
      type: Map,
      of: String,
      default: undefined,
    },
    closedDays: String,
    website: String,
    phone: String,
    email: String,
    services: [String],
    accessibility: String,
    wheelchairAccessible: Boolean,
  },
  { _id: false },
);

const accessibilityInfoSchema = new Schema<AccessibilityInfo>(
  {
    wheelchairAccessible: { type: Boolean, default: false },
    hasSteps: { type: Boolean, default: false },
    stepCount: Number,
    hasRamp: { type: Boolean, default: false },
    visualAids: { type: Boolean, default: false },
    audioAids: { type: Boolean, default: false },
    notes: String,
  },
  { _id: false },
);

const mapMarkerSchema = new Schema<MapMarker>(
  {
    id: { type: String, required: true },
    floorId: String,
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    type: {
      type: String,
      enum: Object.values(MarkerType),
      required: true,
    },
    label: String,
    description: String,
    artworkId: String, // Wikidata ID for artwork markers
    icon: String,
    isVisible: { type: Boolean, default: true },
    focalPoint: {
      x: { type: Number, default: 50 },
      y: { type: Number, default: 50 },
    },
    focalZoom: { type: Number, default: 1 },
    accessibilityInfo: accessibilityInfoSchema,
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
    targetX: Number,
    targetY: Number,
    label: String,
    isAccessible: { type: Boolean, default: false },
  },
  { _id: false },
);

const floorSchema = new Schema<MuseumFloor>(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    level: { type: Number, required: true },
    svgContent: { type: String, required: true },
    svgUrl: String,
    dimensions: {
      width: { type: Number, required: true },
      height: { type: Number, required: true },
    },
    markers: [mapMarkerSchema],
    connections: [floorConnectionSchema],
  },
  { _id: false },
);

const navigatorConfigSchema = new Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    slug: { type: String, required: true },
    branding: {
      logo: String,
      splashImage: String,
      primaryColor: { type: String, required: true },
      secondaryColor: String,
    },
    content: {
      homeTitle: String,
      homeSubtitle: String,
      welcomeText: String,
      openingImage: String,
    },
    pwa: {
      manifestName: { type: String, required: true },
      shortName: { type: String, required: true },
      description: String,
      themeColor: { type: String, required: true },
      backgroundColor: { type: String, required: true },
      display: {
        type: String,
        enum: ['standalone', 'fullscreen', 'minimal-ui', 'browser'],
        default: 'standalone',
      },
      orientation: {
        type: String,
        enum: ['any', 'natural', 'landscape', 'portrait'],
        default: 'portrait',
      },
      startUrl: { type: String, default: '/' },
      scope: { type: String, default: '/' },
      icon192: String,
      icon512: String,
      iconMaskable: String,
      appleTouchIcon: String,
    },
  },
  { _id: false },
);

const museumSchema = new Schema<MuseumDocument>(
  {
    // Wikidata ID as primary identifier
    wikidataId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    // Basic info
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    nameTranslations: {
      type: Map,
      of: String,
      default: undefined,
    },
    descriptionTranslations: {
      type: Map,
      of: String,
      default: undefined,
    },
    activeLanguages: {
      type: [String],
      enum: SUPPORTED_APP_LANGUAGES,
      default: [DEFAULT_APP_LANGUAGE],
      required: true,
    },

    // Location
    location: {
      type: locationSchema,
      required: true,
    },

    // Media
    images: [String],
    coverImage: String,

    // Floor maps
    floors: [floorSchema],

    // Services
    services: servicesSchema,

    // Navigator app configurations
    navigatorConfigs: [navigatorConfigSchema],

    // Status
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes
museumSchema.index({ name: 'text', description: 'text' });
museumSchema.index({ 'location.city': 1 });

export const MuseumModel = mongoose.model<MuseumDocument>('Museum', museumSchema);
