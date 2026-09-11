/**
 * Tipi Museo
 *
 * Usa l'ID Wikidata come identificatore primario per i musei.
 * Per le traduzioni, ogni museo può avere attivo un sottoinsieme
 * ristretto di lingue attive rispetto a quelle dell'App.
 * In tutto ciò che riguarda quel museo, verrà chiesto di tradurre solo nelle lingue attive.
 */

import type { AppLanguage } from './i18n.types';

// ========================================
// MUSEO
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

  // Piantine (piani del museo, ma in realtà anche semplicemente parti diverse del museo)
  floors: MuseumFloor[];

  // Sale del museo (ogni opera deve essere associata ad una sala)
  rooms?: MuseumRoom[];

  // Servizi e info
  services: MuseumServices;

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
  services: MuseumService[];
  accessibility?: string;
  wheelchairAccessible?: boolean;
}

// Servizio del museo attivabile dal curatore (bar, bagni, uscita...) — tipo
// fisso (vedi MUSEUM_SERVICE_TYPES), collegabile a un marker già sulla mappa.
export interface MuseumService {
  type: MarkerType;
  active: boolean;
  description?: string;
  descriptionTranslations?: Partial<Record<AppLanguage, string>>;
  mapMarkerId?: string;
}

// ========================================
// RICHIESTE/RISPOSTE API MUSEO
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
}

/**
 * Font selezionabili per titoli/corpo del testo del Navigator — set fisso,
 * non testo libero: ogni id è una famiglia Google Fonts già caricata
 * dall'app (vedi apps/navigator/index.html). Fonte unica per il menu a
 * tendina lato marketplace e per l'enum di validazione lato server.
 */
export const NAVIGATOR_FONT_OPTIONS = [
  { id: 'unbounded', label: 'Unbounded', family: '"Unbounded"' },
  { id: 'plus-jakarta-sans', label: 'Plus Jakarta Sans', family: '"Plus Jakarta Sans"' },
  { id: 'playfair-display', label: 'Playfair Display', family: '"Playfair Display"' },
  { id: 'cormorant-garamond', label: 'Cormorant Garamond', family: '"Cormorant Garamond"' },
  { id: 'montserrat', label: 'Montserrat', family: '"Montserrat"' },
  { id: 'poppins', label: 'Poppins', family: '"Poppins"' },
  { id: 'inter', label: 'Inter', family: '"Inter"' },
  { id: 'space-grotesk', label: 'Space Grotesk', family: '"Space Grotesk"' },
  { id: 'merriweather', label: 'Merriweather', family: '"Merriweather"' },
  { id: 'work-sans', label: 'Work Sans', family: '"Work Sans"' },
] as const;

export type NavigatorFontId = (typeof NAVIGATOR_FONT_OPTIONS)[number]['id'];

export const isNavigatorFontId = (value: unknown): value is NavigatorFontId =>
  typeof value === 'string' && NAVIGATOR_FONT_OPTIONS.some((f) => f.id === value);

/**
 * Configurazione di aspetto/branding dell'app Navigator: o vale per tutto
 * l'ecosistema (applicability 'global', ce n'è al massimo una), o è propria
 * di UN museo specifico (applicability 'museum' + museumId — un museo può
 * averne più di una, raggiungibili via link/QR per slug, es.
 * "borghese-bambini" vs "borghese-default"). Vedi NavigatorConfigController.resolve.
 */
export interface NavigatorConfig {
  _id: string;
  name: string;
  slug: string; // univoco globalmente — è quello che finisce nel link/QR (?ncfg=slug)
  applicability: 'global' | 'museum';
  museumId?: string; // richiesto quando applicability === 'museum', immutabile dopo la creazione
  branding: {
    logo?: string;
    splashImage?: string;
    primaryColor: string;
    secondaryColor?: string;
    backgroundColor?: string;
    displayFont?: NavigatorFontId;
    bodyFont?: NavigatorFontId;
  };
  content?: {
    homeTitle?: string;
    homeTitleTranslations?: Partial<Record<AppLanguage, string>>;
    homeSubtitle?: string;
    homeSubtitleTranslations?: Partial<Record<AppLanguage, string>>;
    welcomeText?: string;
    welcomeTextTranslations?: Partial<Record<AppLanguage, string>>;
    openingImage?: string; // legacy — l'editor scrive solo branding.splashImage, letto qui come fallback (vedi Navigator WelcomePage)
    featuredMuseumId?: string; // museo mostrato come "in evidenza" in Home — solo su config globale
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
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateNavigatorConfigData {
  name: string;
  slug: string;
  applicability: 'global' | 'museum';
  museumId?: string;
  branding: NavigatorConfig['branding'];
  content?: NavigatorConfig['content'];
  pwa: NavigatorConfig['pwa'];
}

export type UpdateNavigatorConfigData = Partial<
  Omit<CreateNavigatorConfigData, 'applicability' | 'museumId'>
>;

/**
 * Estetica attuale del Navigator (main.css/tailwind.config.js), usata dal
 * server come fallback quando non esiste ancora nessuna NavigatorConfig con
 * applicability 'global' — così il comportamento resta identico a oggi
 * finché un admin non salva davvero una configurazione.
 */
export const DEFAULT_NAVIGATOR_CONFIG: Omit<
  NavigatorConfig,
  '_id' | 'createdAt' | 'updatedAt'
> = {
  name: 'ArtAround Navigator',
  slug: 'default',
  applicability: 'global',
  branding: {
    primaryColor: '#8b3ffc',
    secondaryColor: '#f59e0b',
    backgroundColor: '#0b0813',
  },
  content: {
    homeTitle: 'ArtAround',
  },
  pwa: {
    manifestName: 'ArtAround Navigator',
    shortName: 'ArtAround',
    themeColor: '#0b0a12',
    backgroundColor: '#0b0813',
    display: 'standalone',
    orientation: 'portrait',
    startUrl: '/navigator/',
    scope: '/navigator/',
    icon192: '/navigator/icons/icon-192.png',
    icon512: '/navigator/icons/icon-512.png',
    iconMaskable: '/navigator/icons/icon-512-maskable.png',
    appleTouchIcon: '/navigator/icons/apple-touch-icon.png',
  },
};

export interface MuseumCurator {
  _id: string;
  username: string;
  email: string;
}

export interface MuseumConfigResponse {
  wikidataId: string;
  name: string;
  services: MuseumServices;
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
// SISTEMA PIANI E MAPPA
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

// Sala del museo: inserita nell'editor del museo, poi contornata sulla mappa
export interface MuseumRoom {
  id: string;
  title: string; // Es. "Sala I"
  subtitle?: string; // Es. "Sala del Gladiatore"
  floorId?: string; // pianta su cui è collocata la stanza
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
// MARKER SULLA MAPPA (POI)
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

  // Percorso: punto fittizio dove far passare il percorso senza attraversare muri
  WAYPOINT = 'waypoint',
}

export interface MapMarker {
  id: string;
  floorId?: string; // Mappa su cui è il marker
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
