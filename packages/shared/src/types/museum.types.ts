// Museum types
export interface Museum {
  _id: string;
  name: string;
  description: string;
  location: MuseumLocation;
  images: string[];
  configFile?: string; // JSON config file path or content (legacy)
  floors: MuseumFloor[]; // Multi-floor map support
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface MuseumLocation {
  address: string;
  city: string;
  country: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
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
}

export interface MapMarker {
  id: string;
  floorId?: string; // Which floor this marker belongs to (optional for legacy config)
  x: number;
  y: number;
  type: MarkerType;
  label?: string;
  description?: string;
  itemId?: string; // Link to Item for ARTWORK markers
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

// ========================================
// LEGACY CONFIG (for backwards compatibility)
// ========================================

export interface MuseumConfig {
  id: string;
  name: string;
  coverImage: string; // base64 or URL
  map: MuseumMap;
  locations: MuseumServices;
}

export interface MuseumMap {
  type: 'image' | '3d' | 'svg';
  imageUrl?: string; // base64 or URL
  svgContent?: string; // Inline SVG
  dimensions: {
    width: number;
    height: number;
  };
  markers: MapMarker[];
  floors?: MuseumFloor[]; // Multi-floor support
}

export interface MuseumServices {
  entrance: string;
  ticketPrice?: string;
  services: string[];
  openingHours?: string;
}
