import type { AppLanguage } from './i18n.types';

export interface Museum {
  _id: string;
  wikidataId: string; // Q number, chiave primaria, es. Q180916 per Galleria Borghese

  name: string;
  description: string;
  nameTranslations?: Partial<Record<AppLanguage, string>>;
  descriptionTranslations?: Partial<Record<AppLanguage, string>>;
  activeLanguages: AppLanguage[];

  location: MuseumLocation;

  images: string[];
  coverImage?: string;

  floors: MuseumFloor[];

  // create con solo il nome in "Modifica Museo", contornate (poligono) piano
  // per piano in "Piantina e mappa". ogni opera appartiene a una sala tramite
  // Artwork.roomId
  rooms?: MuseumRoom[];

  services: MuseumServices;
  navigatorConfigs?: NavigatorAppConfig[];

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
  closedDays?: string;
  website?: string;
  phone?: string;
  email?: string;
  services: string[]; // ["Bar", "Guardaroba", "WiFi", "Shop"]
  accessibility?: string;
  wheelchairAccessible?: boolean;
}

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
  rooms?: MuseumRoom[]; // tutte, il Navigator filtra per piano corrente
}

export interface MuseumFloor {
  id: string;
  name: string; // "Piano Terra", "Primo Piano"
  level: number; // -1, 0, 1, 2... (0 = piano terra)
  svgContent: string;
  svgUrl?: string;
  dimensions: {
    width: number;
    height: number;
  };
  markers: MapMarker[];
  connections: FloorConnection[]; // ascensori e scale tra i piani
}

// sala del museo, gestita separatamente dai MapMarker. creata in "Modifica
// Museo" con solo id/title; floorId e polygon si valorizzano quando viene
// contornata in "Piantina e mappa" (click sui vertici, si chiude quando
// l'ultimo punto coincide col primo)
export interface MuseumRoom {
  id: string;
  title: string; // es. "Sala I"
  subtitle?: string; // es. "Sala del Gladiatore"
  floorId?: string;
  polygon?: MapPoint[]; // vertici del poligono chiuso, primo === ultimo
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
  targetFloorId: string;
  targetX?: number;
  targetY?: number;
  label?: string;
  isAccessible: boolean;
}

export enum ConnectionType {
  ELEVATOR = 'elevator',
  STAIRS = 'stairs',
  ESCALATOR = 'escalator',
  RAMP = 'ramp',
}

export enum MarkerType {
  ARTWORK = 'artwork',
  SCULPTURE = 'sculpture',
  PAINTING = 'painting',

  ENTRANCE = 'entrance',
  EXIT = 'exit',
  EMERGENCY_EXIT = 'emergency_exit',
  INFO_POINT = 'info_point',

  ELEVATOR = 'elevator',
  STAIRS = 'stairs',
  ESCALATOR = 'escalator',
  RAMP = 'ramp',

  TOILETTE = 'toilette',
  ACCESSIBLE_TOILETTE = 'accessible_toilette',
  BAR = 'bar',
  RESTAURANT = 'restaurant',
  SHOP = 'shop',
  CLOAKROOM = 'cloakroom',
  LOCKER = 'locker',

  ROOM = 'room',
  GALLERY = 'gallery',

  ACCESSIBILITY = 'accessibility',
  OBSTACLE = 'obstacle',
  BENCH = 'bench',
  AUDIO_GUIDE = 'audio_guide',
  WIFI = 'wifi',

  // punto muto usato solo per piegare il percorso di una visita attorno a
  // muri/corridoi, mai mostrato come tappa cliccabile (MapMarker.isVisible)
  WAYPOINT = 'waypoint',
}

export interface MapMarker {
  id: string;
  floorId?: string;
  x: number;
  y: number;
  type: MarkerType;
  label?: string;
  description?: string;
  artworkId?: string; // id wikidata, per marker ARTWORK/PAINTING/SCULPTURE
  icon?: string;
  isVisible?: boolean; // default true
  focalPoint?: { x: number; y: number }; // punto focale immagine opera, 0-100%
  focalZoom?: number; // 1 = niente zoom, 2 = 2x...
  accessibilityInfo?: AccessibilityInfo;
}

export interface AccessibilityInfo {
  wheelchairAccessible: boolean;
  hasSteps: boolean;
  stepCount?: number;
  hasRamp: boolean;
  visualAids: boolean; // percorsi tattili, braille
  audioAids: boolean;
  notes?: string;
}
