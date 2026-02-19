/**
 * Artwork Types
 *
 * Represents physical artworks in museums.
 * Uses Wikidata IDs as primary identifiers where possible.
 */

// ========================================
// ARTWORK (Opera fisica nel museo)
// ========================================

export interface Artwork {
  _id: string; // MongoDB ObjectId (internal)
  wikidataId: string; // Wikidata Q number (e.g., Q28798937) - PRIMARY KEY for deduplication

  // Basic info
  title: string;
  description?: string;

  // Museum
  museumId: string; // Wikidata ID of the museum (e.g., Q180916 for Galleria Borghese)

  // Author/Artist
  author?: string; // Artist name
  authorWikidataId?: string; // Wikidata Q number (e.g., Q42207 for Caravaggio)

  // Dating
  year?: string; // "1605", "1598-1601", "XVI secolo", "c. 1510"
  startYear?: number; // Technical field for numeric range filtering
  endYear?: number; // Technical field for numeric range filtering

  // Classification
  artworkType: ArtworkType;
  movement?: string; // "Barocco", "Rinascimento"
  movementWikidataId?: string; // Q number
  style?: string; // "Caravaggismo", "Manierismo"
  styleWikidataId?: string;
  period?: string; // "Cinquecento", "Seicento"
  periodWikidataId?: string;

  // Physical properties
  dimensions?: ArtworkDimensions;
  materials?: string[]; // "Olio su tela", "Marmo di Carrara"
  technique?: string;

  // Context
  historicalEvents?: string[]; // Related historical events
  subjects?: string[]; // "Mitologia", "Ritratto", "Sacro"
  artworkCollection?: string; // "Collezione Borghese" (renamed from 'collection' to avoid Document conflict)

  // Media
  image: string; // Primary image URL
  images?: string[]; // Additional images

  // Location in museum
  room?: string; // "Sala VIII", "Pinacoteca - Sala XIV"
  floor?: string; // "Piano Terra", "Primo Piano"

  // Map position (linked to museum floor plan)
  mapPosition?: ArtworkMapPosition;

  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

export interface ArtworkDimensions {
  height?: number; // in cm
  width?: number;
  depth?: number; // for sculptures
  diameter?: number; // for circular works
  unit: 'cm' | 'm';
  displayText?: string; // "170 × 128 cm"
}

export interface ArtworkMapPosition {
  floorId: string;
  x: number;
  y: number;
  rotation?: number; // 0-360 degrees
}

export enum ArtworkType {
  PAINTING = 'painting',
  SCULPTURE = 'sculpture',
  FRESCO = 'fresco',
  MOSAIC = 'mosaic',
  DRAWING = 'drawing',
  PRINT = 'print',
  RELIEF = 'relief',
  INSTALLATION = 'installation',
  DECORATIVE = 'decorative',
  TAPESTRY = 'tapestry',
  OTHER = 'other',
}

// ========================================
// ARTWORK FILTERS & QUERIES
// ========================================

export interface ArtworkFilters {
  museumId?: string;
  author?: string;
  authorWikidataId?: string;
  artworkType?: ArtworkType;
  movement?: string;
  movementWikidataId?: string;
  room?: string;
  floor?: string;
  yearFrom?: number;
  yearTo?: number;
  search?: string;
  page?: number;
  limit?: number;
}

// ========================================
// ARTWORK REQUESTS
// ========================================

export interface CreateArtworkData {
  wikidataId: string;
  museumId: string; // Museum's Wikidata ID
  title: string;
  description?: string;
  author?: string;
  authorWikidataId?: string;
  year?: string;
  startYear?: number;
  endYear?: number;
  artworkType: ArtworkType;
  movement?: string;
  movementWikidataId?: string;
  dimensions?: ArtworkDimensions;
  materials?: string[];
  image: string;
  images?: string[];
  room?: string;
  floor?: string;
  mapPosition?: ArtworkMapPosition;
}

export type UpdateArtworkData = Partial<CreateArtworkData>;

// ========================================
// ARTWORK SUMMARY (for lists)
// ========================================

export interface ArtworkSummary {
  _id: string;
  wikidataId: string;
  title: string;
  author?: string;
  authorWikidataId?: string;
  year?: string;
  artworkType: ArtworkType;
  image: string;
  room?: string;
  hasMapPosition: boolean;
}
