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

import type { FloorConnection, MuseumRoom, MapPoint } from '@artaround/shared';

export interface MuseumDocument extends Omit<IMuseum, '_id'>, Document {}

const locationSchema = new Schema<MuseumLocation>(
  {
    address: { type: String, required: true },
    city: { type: String, required: true },
    nation: { type: String, required: true },
    country: String,
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
    artworkId: String, // id wikidata, per i marker di tipo opera
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

const mapPointSchema = new Schema<MapPoint>(
  {
    x: { type: Number, required: true },
    y: { type: Number, required: true },
  },
  { _id: false },
);

// creata con solo id/title da "Modifica Museo", floorId/polygon si
// riempiono dopo quando viene contornata in "Piantina e mappa"
const roomSchema = new Schema<MuseumRoom>(
  {
    id: { type: String, required: true },
    title: { type: String, required: true },
    subtitle: String,
    floorId: String,
    polygon: [mapPointSchema],
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
      homeTitleTranslations: {
        type: Map,
        of: String,
        default: undefined,
      },
      homeSubtitle: String,
      homeSubtitleTranslations: {
        type: Map,
        of: String,
        default: undefined,
      },
      welcomeText: String,
      welcomeTextTranslations: {
        type: Map,
        of: String,
        default: undefined,
      },
      openingImage: String,
    },
    pwa: {
      manifestName: { type: String, required: true },
      shortName: { type: String, required: true },
      description: String,
      descriptionTranslations: {
        type: Map,
        of: String,
        default: undefined,
      },
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
    wikidataId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

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

    location: {
      type: locationSchema,
      required: true,
    },

    images: [String],
    coverImage: String,

    floors: [floorSchema],
    rooms: [roomSchema], // Artwork.roomId referenzia una di queste

    services: servicesSchema,
    navigatorConfigs: [navigatorConfigSchema],

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

museumSchema.index({ name: 'text', description: 'text' });
museumSchema.index({ 'location.city': 1 });

export const MuseumModel = mongoose.model<MuseumDocument>('Museum', museumSchema);
