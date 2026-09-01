/**
 * Museum Types
 *
 * Uses Wikidata ID as primary identifier for museums.
 */

import type { AppLanguage } from './i18n.types';

// ========================================
// MUSEUM
// ========================================

export interface Museum {
  _id: string; // MongoDB ObjectId
  wikidataId: string; // Wikidata Q number (e.g., Q180916 for Galleria Borghese) - PRIMARY KEY

  // Basic info
  name: string;
  description: string;
  nameTranslations?: Partial<Record<AppLanguage, string>>;
  descriptionTranslations?: Partial<Record<AppLanguage, string>>;
  activeLanguages: AppLanguage[];

  // Location
  location: MuseumLocation;

  // Media
  images: string[];
  coverImage?: string;

  // Floor maps
  floors: MuseumFloor[];

  // Services & Info
  services: MuseumServices;

  // Navigator app configurations for this museum
  navigatorConfigs?: NavigatorAppConfig[];

  // Status
  isActive: boolean;

  createdAt: Date;
  updatedAt: Date;
}

export interface MuseumLocation {
  address: string;
  city: string;
  nation: string;
  country?: string;
  postalCode?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
}

export interface MuseumServices {
  ticketInfo?: string; // "€15, ridotto €8"
  ticketInfoTranslations?: Partial<Record<AppLanguage, string>>;
  openingHours?: string; // "Mar-Dom 9:00-19:00"
  openingHoursTranslations?: Partial<Record<AppLanguage, string>>;
  closedDays?: string; // "Lunedì"
  website?: string;
  phone?: string;
  email?: string;
  services: string[]; // ["Bar", "Guardaroba", "WiFi", "Shop"]
  accessibility?: string;
  wheelchairAccessible?: boolean;
}

// ========================================
// MUSEUM API REQUESTS/RESPONSES
// ========================================

export interface CreateMuseumData {
  wikidataId: string;
  name: string;
  description: string;
  nameTranslations?: Partial<Record<AppLanguage, string>>;
  descriptionTranslations?: Partial<Record<AppLanguage, string>>;
  activeLanguages?: AppLanguage[];
  location: MuseumLocation;
  images?: string[];
  coverImage?: string;
  services?: Partial<MuseumServices>;
  navigatorConfigs?: NavigatorAppConfig[];
}

export interface NavigatorAppConfig {
  id: string;
  name: string;
  slug: string;
  branding: {
    logo?: string;
    splashImage?: string;
    primaryColor: string;
    secondaryColor?: string;
  };
  content?: {
    homeTitle?: string;
    homeTitleTranslations?: Partial<Record<AppLanguage, string>>;
    homeSubtitle?: string;
    homeSubtitleTranslations?: Partial<Record<AppLanguage, string>>;
    welcomeText?: string;
    welcomeTextTranslations?: Partial<Record<AppLanguage, string>>;
    openingImage?: string;
  };
  pwa: {
    manifestName: string;
    shortName: string;
    description?: string;
    descriptionTranslations?: Partial<Record<AppLanguage, string>>;
    themeColor: string;
    backgroundColor: string;
    display: 'standalone' | 'fullscreen' | 'minimal-ui' | 'browser';
    orientation: 'any' | 'natural' | 'landscape' | 'portrait';
    startUrl: string;
    scope: string;
    icon192?: string;
    icon512?: string;
    iconMaskable?: string;
    appleTouchIcon?: string;
  };
}

export interface MuseumCurator {
  _id: string;
  username: string;
  email: string;
}

export interface MuseumConfigResponse {
  wikidataId: string;
  name: string;
  services: MuseumServices;
  navigatorConfigs?: NavigatorAppConfig[];
  floors?: Array<{
    id: string;
    name: string;
    level: number;
    markersCount: number;
  }>;
}

export interface MuseumMap {
  type: 'svg' | 'image';
  imageUrl?: string;
  svgContent?: string;
  dimensions: {
    width: number;
    height: number;
  };
  markers?: MapMarker[];
  floors?: MuseumFloor[];
}

// ========================================
// FLOOR & MAP SYSTEM
// ========================================

export interface MuseumFloor {
  id: string;
  name: string; // "Piano Terra", "Primo Piano", "Basement"
  level: number; // -1, 0, 1, 2... (0 = ground floor)
  svgContent: string; // Raw SVG content (inline)
  svgUrl?: string; // Optional: URL to external SVG file
  dimensions: {
    width: number;
    height: number;
  };
  markers: MapMarker[]; // POIs on this floor
  connections: FloorConnection[]; // Elevators, stairs linking floors
}

export interface FloorConnection {
  id: string;
  type: ConnectionType;
  x: number;
  y: number;
  targetFloorId: string; // Which floor this connects to
  targetX?: number; // Position on target floor
  targetY?: number;
  label?: string;
  isAccessible: boolean; // Wheelchair accessible
}

export enum ConnectionType {
  ELEVATOR = 'elevator',
  STAIRS = 'stairs',
  ESCALATOR = 'escalator',
  RAMP = 'ramp',
}

// ========================================
// MAP MARKERS (POI)
// ========================================

export enum MarkerType {
  // Artworks
  ARTWORK = 'artwork',
  SCULPTURE = 'sculpture',
  PAINTING = 'painting',

  // Navigation
  ENTRANCE = 'entrance',
  EXIT = 'exit',
  EMERGENCY_EXIT = 'emergency_exit',
  INFO_POINT = 'info_point',

  // Accessibility
  ELEVATOR = 'elevator',
  STAIRS = 'stairs',
  ESCALATOR = 'escalator',
  RAMP = 'ramp',

  // Facilities
  TOILETTE = 'toilette',
  ACCESSIBLE_TOILETTE = 'accessible_toilette',
  BAR = 'bar',
  RESTAURANT = 'restaurant',
  SHOP = 'shop',
  CLOAKROOM = 'cloakroom',
  LOCKER = 'locker',

  // Rooms
  ROOM = 'room',
  GALLERY = 'gallery',

  // Other
  ACCESSIBILITY = 'accessibility',
  OBSTACLE = 'obstacle',
  BENCH = 'bench',
  AUDIO_GUIDE = 'audio_guide',
  WIFI = 'wifi',

  // Percorso (non è un punto di interesse: serve solo a far piegare la linea del
  // percorso di una visita attorno a muri/corridoi, es. una porta su un corridoio -
  // un waypoint appena dentro la stanza, uno a metà del corridoio fuori. Non va mai
  // mostrato al visitatore come tappa cliccabile: vedi MapMarker.isVisible).
  WAYPOINT = 'waypoint',
}

export interface MapMarker {
  id: string;
  floorId?: string; // Which floor this marker belongs to
  x: number;
  y: number;
  type: MarkerType;
  label?: string;
  description?: string;
  artworkId?: string; // Wikidata ID of the artwork for ARTWORK/PAINTING/SCULPTURE markers
  icon?: string; // Custom icon URL/SVG
  isVisible?: boolean; // Can be hidden/shown (defaults to true)
  focalPoint?: { x: number; y: number }; // Image focal point for artwork markers (0-100%)
  focalZoom?: number; // Zoom level for artwork image (1 = no zoom, 2 = 2x zoom, etc.)
  accessibilityInfo?: AccessibilityInfo;
}

export interface AccessibilityInfo {
  wheelchairAccessible: boolean;
  hasSteps: boolean;
  stepCount?: number;
  hasRamp: boolean;
  visualAids: boolean; // Tactile paths, braille
  audioAids: boolean;
  notes?: string;
}

// Note: ItemMapPosition is defined in item.types.ts
