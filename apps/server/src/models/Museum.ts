import mongoose, { Schema, Document } from 'mongoose';
import {
  Museum as IMuseum,
  MuseumLocation,
  MuseumServices,
  MuseumService,
  MuseumFloor,
  MapMarker,
  MarkerType,
  ConnectionType,
  SUPPORTED_APP_LANGUAGES,
  DEFAULT_APP_LANGUAGE,
  MUSEUM_SERVICE_TYPES,
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

// Servizio attivabile dal curatore per il museo (bar, bagni, uscita...) —
// stesso vincolo di tipo dei marker (MUSEUM_SERVICE_TYPES), collegabile a
// uno di essi via mapMarkerId.
const serviceSchema = new Schema<MuseumService>(
  {
    type: {
      type: String,
      enum: MUSEUM_SERVICE_TYPES,
      required: true,
    },
    active: { type: Boolean, default: true },
    description: String,
    descriptionTranslations: {
      type: Map,
      of: String,
      default: undefined,
    },
    mapMarkerId: String,
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
    services: [serviceSchema],
    accessibility: String,
    wheelchairAccessible: Boolean,
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
    // ID Wikidata come identificatore primario
    wikidataId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    // Info di base
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

    // Posizione
    location: {
      type: locationSchema,
      required: true,
    },

    // Media
    images: [String],
    coverImage: String,

    // Piantine
    floors: [floorSchema],

    // Sale del museo
    rooms: [roomSchema],

    // Servizi
    services: servicesSchema,

    // Stato
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

// Indici
museumSchema.index({ name: 'text', description: 'text' });
museumSchema.index({ 'location.city': 1 });

export const MuseumModel = mongoose.model<MuseumDocument>('Museum', museumSchema);
