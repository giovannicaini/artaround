/**
 * Tipi Museo
 *
 * Usa l'ID Wikidata come identificatore primario per i musei.
 */

import type { AppLanguage } from './i18n.types';

// ========================================
// MUSEUM
// ========================================

export interface Museum {
  _id: string; // ObjectId MongoDB
  wikidataId: string; // Q number Wikidata (es. Q180916 per Galleria Borghese) - CHIAVE PRIMARIA

  // Info di base
  name: string;
  description: string;
  nameTranslations?: Partial<Record<AppLanguage, string>>;
  descriptionTranslations?: Partial<Record<AppLanguage, string>>;
  activeLanguages: AppLanguage[];

  // Posizione
  location: MuseumLocation;

  // Media
  images: string[];
  coverImage?: string;

  // Piantine
  floors: MuseumFloor[];

  // Sale del museo: create con solo il nome in "Modifica Museo", poi
  // contornate (poligono) piano per piano in "Piantina e mappa". Ogni opera
  // deve appartenere a una di queste sale (Artwork.roomId).
  rooms?: MuseumRoom[];

  // Servizi e info
  services: MuseumServices;

  // Configurazioni dell'app Navigator per questo museo
  navigatorConfigs?: NavigatorAppConfig[];

  // Stato
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
  // Sale contornate del museo (tutti i piani): il Navigator le filtra per
  // piano corrente quando le mostra come riferimento sulla piantina.
  rooms?: MuseumRoom[];
}

// ========================================
// FLOOR & MAP SYSTEM
// ========================================

export interface MuseumFloor {
  id: string;
  name: string; // "Piano Terra", "Primo Piano", "Seminterrato"
  level: number; // -1, 0, 1, 2... (0 = piano terra)
  svgContent: string; // Contenuto SVG grezzo (inline)
  svgUrl?: string; // Opzionale: URL a un file SVG esterno
  dimensions: {
    width: number;
    height: number;
  };
  markers: MapMarker[]; // Punti di interesse su questo piano
  connections: FloorConnection[]; // Ascensori, scale che collegano i piani
}

/**
 * Sala del museo: gestione parallela e distinta dai MapMarker.
 * Creata in "Modifica Museo" con solo id/name (floorId e polygon assenti);
 * "contornata" in un secondo momento in "Piantina e mappa", scegliendo il
 * piano e disegnando il poligono (click sui vertici, chiuso quando l'ultimo
 * punto coincide col primo) — a quel punto floorId e polygon vengono
 * valorizzati. Il poligono permette a Navigator di fare zoom sulla sala,
 * evidenziarla, ecc.
 */
export interface MuseumRoom {
  id: string;
  title: string; // Es. "Sala I"
  subtitle?: string; // Es. "Sala del Gladiatore"
  floorId?: string; // valorizzato solo dopo il contorno sulla piantina
  polygon?: MapPoint[]; // vertici del poligono chiuso (primo punto === ultimo)
}

export interface MapPoint {
  x: number;
  y: number;
}

export interface FloorConnection {
  id: string;
  type: ConnectionType;
  x: number;
  y: number;
  targetFloorId: string; // A quale piano si collega
  targetX?: number; // Posizione sul piano di destinazione
  targetY?: number;
  label?: string;
  isAccessible: boolean; // Accessibile in sedia a rotelle
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
  // Opere
  ARTWORK = 'artwork',
  SCULPTURE = 'sculpture',
  PAINTING = 'painting',

  // Navigazione
  ENTRANCE = 'entrance',
  EXIT = 'exit',
  EMERGENCY_EXIT = 'emergency_exit',
  INFO_POINT = 'info_point',

  // Accessibilità
  ELEVATOR = 'elevator',
  STAIRS = 'stairs',
  ESCALATOR = 'escalator',
  RAMP = 'ramp',

  // Servizi
  TOILETTE = 'toilette',
  ACCESSIBLE_TOILETTE = 'accessible_toilette',
  BAR = 'bar',
  RESTAURANT = 'restaurant',
  SHOP = 'shop',
  CLOAKROOM = 'cloakroom',
  LOCKER = 'locker',

  // Sale
  ROOM = 'room',
  GALLERY = 'gallery',

  // Altro
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
  floorId?: string; // A quale piano appartiene questo marker
  x: number;
  y: number;
  type: MarkerType;
  label?: string;
  description?: string;
  artworkId?: string; // ID Wikidata dell'opera per marker ARTWORK/PAINTING/SCULPTURE
  icon?: string; // URL/SVG icona personalizzata
  isVisible?: boolean; // Può essere nascosto/mostrato (default true)
  focalPoint?: { x: number; y: number }; // Punto focale dell'immagine per i marker opera (0-100%)
  focalZoom?: number; // Livello di zoom dell'immagine dell'opera (1 = nessuno zoom, 2 = 2x, ecc.)
  accessibilityInfo?: AccessibilityInfo;
}

export interface AccessibilityInfo {
  wheelchairAccessible: boolean;
  hasSteps: boolean;
  stepCount?: number;
  hasRamp: boolean;
  visualAids: boolean; // Percorsi tattili, braille
  audioAids: boolean;
  notes?: string;
}

// Nota: ItemMapPosition è definito in item.types.ts
