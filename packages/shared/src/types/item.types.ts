/**
 * Item Types
 *
 * Items are REUSABLE content pieces (text/audio) that can reference:
 * - Artworks (descriptions of physical artworks)
 * - Authors/Artists (biographies, styles)
 * - Artistic movements (Baroque, Renaissance, etc.)
 * - Historical periods (context)
 * - Museums (general info about the museum)
 *
 * NOTE: Logistic info and Navigation directions are NOT Items.
 * They are specific to each Visit and managed as VisitStep properties.
 */

// ========================================
// ITEM (Contenuto testuale/audio)
// ========================================

export interface Item {
  _id: string; // MongoDB ObjectId

  // Museum context
  museumId: string;

  // Reference - what this item is about
  referenceType: ItemReferenceType;
  referenceId?: string; // Wikidata ID of the referenced entity (artwork, author, movement, etc.)
  referenceTitle?: string; // Title/name for display (cached from reference)

  // Content
  title: string;
  text: string;
  translatedTexts?: Record<string, string>; // locale code -> translated text

  // Content characteristics
  duration: ContentDuration; // 3s, 15s, 1min, 4min
  languageLevel: LanguageLevel; // infantile, elementare, medio, specialistico

  // Authorship
  authorId: string; // User ID who created this content
  authorName?: string; // Cached author name

  // Licensing & Pricing
  license: LicenseType;
  price: number; // 0 for free
  isFree: boolean;

  // Media
  image?: string; // Optional image (if absent, uses artwork image when applicable)

  // Statistics
  usageCount: number; // How many times used in visits
  rating?: number; // Average rating

  // Metadata
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
}

// ========================================
// REFERENCE TYPES
// ========================================

export enum ItemReferenceType {
  ARTWORK = 'artwork', // Refers to a specific artwork
  AUTHOR = 'author', // About an artist/author
  MOVEMENT = 'movement', // About an artistic movement (Baroque, Renaissance, etc.)
  PERIOD = 'period', // About a historical period
  MUSEUM = 'museum', // About the museum itself
}

// ========================================
// CONTENT CHARACTERISTICS
// ========================================

export enum ContentDuration {
  FLASH = '3s', // Ultra-brief mention
  SHORT = '15s', // Quick overview
  MEDIUM = '1min', // Standard explanation
  LONG = '4min', // Detailed analysis
  EXTENDED = '10min', // In-depth study
}

export enum LanguageLevel {
  CHILDREN = 'infantile', // For children (5-10 years)
  ELEMENTARY = 'elementare', // Simple language (10-14 years / casual visitors)
  MEDIUM = 'medio', // Standard (adults with general culture)
  SPECIALIST = 'specialistico', // Expert/academic level
}

// ========================================
// LICENSING
// ========================================

export enum LicenseType {
  CC0 = 'CC0', // Public domain
  CC_BY = 'CC-BY', // Attribution
  CC_BY_SA = 'CC-BY-SA', // Attribution-ShareAlike
  CC_BY_NC = 'CC-BY-NC', // Attribution-NonCommercial
  CC_BY_NC_SA = 'CC-BY-NC-SA', // Attribution-NonCommercial-ShareAlike
  PROPRIETARY = 'proprietary', // All rights reserved
}

// ========================================
// WIKIDATA INTEGRATION
// ========================================

export interface WikidataEntity {
  id: string; // Q number (e.g., Q42207)
  label: string;
  description?: string;
  imageUrl?: string;

  // Common properties
  instanceOf?: string[]; // P31 - what type of thing
  author?: string; // P170 - creator name
  authorId?: string; // P170 - creator Wikidata ID
  movement?: string; // P135 - movement/style name
  movementId?: string; // P135 - movement Wikidata ID
  style?: string;
  styleId?: string;
  inception?: string; // P571 - date created
  epoch?: string;
  location?: string; // P276 - location
  locationId?: string; // P276 - location Wikidata ID
  year?: string;
  period?: string;
  periodId?: string;
  technique?: string;
  materials?: string[];
  room?: string;
  floor?: string;
  dimensionHeight?: number;
  dimensionWidth?: number;
  dimensionDepth?: number;
  dimensionUnit?: 'cm' | 'm';

  // Raw properties for extensibility
  properties?: Record<string, unknown>;
}

// ========================================
// ITEM FILTERS & QUERIES
// ========================================

export interface ItemFilters {
  museumId?: string;
  referenceType?: ItemReferenceType;
  referenceId?: string;
  authorId?: string;
  duration?: ContentDuration;
  languageLevel?: LanguageLevel;
  isFree?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

// ========================================
// ITEM REQUESTS
// ========================================

export interface CreateItemData {
  museumId: string;
  referenceType: ItemReferenceType;
  referenceId?: string; // Wikidata ID for artwork/author/movement/museum
  referenceTitle?: string;
  title: string;
  text: string;
  duration: ContentDuration;
  languageLevel: LanguageLevel;
  license: LicenseType;
  price?: number;
  tags?: string[];
  image?: string;
}

export type UpdateItemData = Partial<CreateItemData>;

// ========================================
// ITEM SUMMARY (for lists)
// ========================================

export interface ItemSummary {
  _id: string;
  title: string;
  referenceType: ItemReferenceType;
  referenceTitle?: string;
  duration: ContentDuration;
  languageLevel: LanguageLevel;
  isFree: boolean;
  price: number;
  authorName?: string;
  image?: string;
}
