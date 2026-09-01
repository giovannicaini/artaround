import { LanguageLevel } from './item.types';
import type { AppLanguage } from './i18n.types';

/**
 * Visit Types
 *
 * A Visit is an ordered sequence of steps through a museum.
 * Each step can be:
 * - An artwork (with multiple item options for different levels/durations)
 * - A logistic note (general info about the museum)
 * - A navigation instruction (how to get from one place to another)
 */

// ========================================
// VISIT (Percorso di visita)
// ========================================

export interface Visit {
  _id: string;
  museumId: string; // Wikidata ID of the museum

  // Authorship
  authorId: string; // User who created this visit
  authorName?: string;

  // Basic info
  title: string;
  description: string;
  titleTranslations?: Partial<Record<AppLanguage, string>>;
  descriptionTranslations?: Partial<Record<AppLanguage, string>>;
  coverImage?: string;

  // Ordered sequence of steps
  steps: VisitStep[];

  // General info about the visit
  generalInfo: VisitGeneralInfo;

  // Target audience
  targetAudience: TargetAudience;

  // Metadata
  metadata: VisitMetadata;

  // Publishing
  isPublished: boolean;
  publishedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

// ========================================
// VISIT STEPS
// ========================================

export interface VisitStep {
  id: string; // Unique ID within the visit
  order: number;
  type: VisitStepType;

  // ===== FOR ARTWORK STEPS =====
  artworkId?: string; // Wikidata ID of the artwork

  // Available items for this step (different levels/durations)
  // Only used for ARTWORK steps - Items are reusable content
  itemIds?: string[]; // Item MongoDB IDs

  // Item selected by user during visit (runtime)
  selectedItemId?: string;

  // ===== FOR LOGISTIC STEPS =====
  // Inline content - not reusable, specific to this visit
  logisticTitle?: string; // "Informazioni utili", "Biglietteria"
  logisticText?: string; // The actual info text
  logisticIcon?: string; // Icon name: "ticket", "info", "clock", "accessibility"

  // ===== FOR NAVIGATION STEPS =====
  // Inline content - directions specific to this visit's path
  navigationText?: string; // "Prosegui dritto e gira a sinistra..."
  navigationImage?: string; // Optional image showing the path
  fromRoom?: string; // Starting room/area
  toRoom?: string; // Destination room/area

  // ===== FOR WAYPOINT STEPS =====
  // Punto di svolta muto sulla mappa (nessun audio, nessuna sosta per il visitatore):
  // serve solo a disegnare correttamente il percorso tra due tappe quando la linea
  // diretta taglierebbe un muro (es. una porta su un corridoio -> un waypoint appena
  // dentro la stanza, uno a metà del corridoio). Punta a un MapMarker di tipo WAYPOINT
  // già posizionato sulla piantina del piano.
  mapMarkerId?: string;

  // ===== COMMON =====
  isOptional: boolean; // Can be skipped if time is short
  estimatedDuration?: number; // in seconds
}

export enum VisitStepType {
  ARTWORK = 'artwork', // Stop at an artwork
  LOGISTIC = 'logistic', // General logistic info
  NAVIGATION = 'navigation', // Directions between artworks
  WAYPOINT = 'waypoint', // Punto di svolta muto per il disegno del percorso sulla mappa
}

// ========================================
// GENERAL INFO
// ========================================

export interface VisitGeneralInfo {
  // Practical info
  costs?: string; // "Ingresso: €15, ridotto €8"
  ticketInfo?: string; // "Prenotazione obbligatoria online"
  openingHours?: string; // "Mar-Dom 9:00-19:00"

  // Services
  services?: string[]; // ["Bar", "Guardaroba", "WiFi", "Audio guide"]

  // Tips
  tips?: string[]; // ["Arrivare con 15 minuti di anticipo", "Deposito borse obbligatorio"]

  // Accessibility
  accessibility?: string; // "Accessibile ai disabili, ascensore disponibile"
  wheelchairAccessible?: boolean;
}

// ========================================
// TARGET AUDIENCE
// ========================================

export interface TargetAudience {
  minAge?: number;
  maxAge?: number;
  languageLevels: LanguageLevel[]; // Which levels this visit supports
  interests?: string[]; // ["Arte barocca", "Scultura", "Caravaggio"]
  estimatedDuration: number; // in minutes
}

// ========================================
// METADATA
// ========================================

export interface VisitMetadata {
  language: AppLanguage; // Primary language (it, en, etc.)
  supportedLanguages?: AppLanguage[]; // All available translations

  // Calculated stats
  artworksCount: number;
  totalItemsCount: number;
  estimatedDuration: number; // in minutes

  // Pricing
  price: number; // 0 for free
  isFree: boolean;
  license: string;

  // Stats
  rating?: number; // Average rating (1-5)
  ratingsCount?: number;
  downloadsCount: number;
  purchasesCount: number;
}

// ========================================
// VISIT FILTERS & REQUESTS
// ========================================

export interface VisitFilters {
  museumId?: string;
  authorId?: string;
  isPublished?: boolean;
  isFree?: boolean;
  languageLevel?: LanguageLevel;
  page?: number;
  limit?: number;
}

export interface CreateVisitData {
  museumId: string;
  title: string;
  description: string;
  titleTranslations?: Partial<Record<AppLanguage, string>>;
  descriptionTranslations?: Partial<Record<AppLanguage, string>>;
  coverImage?: string;
  steps: Omit<VisitStep, 'id'>[];
  generalInfo?: VisitGeneralInfo;
  targetAudience: TargetAudience;
  metadata?: Partial<VisitMetadata>;
}

export type UpdateVisitData = Partial<CreateVisitData>;

// ========================================
// PURCHASE
// ========================================

export interface VisitPurchase {
  _id: string;
  visitId: string;
  userId: string;
  price: number;
  purchasedAt: Date;
}

// ========================================
// VISIT SUMMARY (for lists)
// ========================================

export interface VisitSummary {
  _id: string;
  title: string;
  description: string;
  coverImage?: string;
  museumId: string;
  authorName?: string;
  artworksCount: number;
  estimatedDuration: number;
  price: number;
  isFree: boolean;
  rating?: number;
  languageLevels: LanguageLevel[];
}
