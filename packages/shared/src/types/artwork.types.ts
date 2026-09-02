export interface Artwork {
  _id: string;
  wikidataId: string; // chiave primaria per deduplicare, es. Q28798937

  title: string;
  description?: string;

  museumId: string; // id wikidata del museo

  author?: string;
  authorWikidataId?: string;

  year?: string; // "1605", "1598-1601", "XVI secolo", "c. 1510"
  startYear?: number; // per filtrare per intervallo numerico
  endYear?: number;

  artworkType: ArtworkType;
  movement?: string; // "Barocco", "Rinascimento"
  movementWikidataId?: string;
  style?: string; // "Caravaggismo", "Manierismo"
  styleWikidataId?: string;
  period?: string; // "Cinquecento", "Seicento"
  periodWikidataId?: string;

  dimensions?: ArtworkDimensions;
  materials?: string[]; // "Olio su tela", "Marmo di Carrara"
  technique?: string;

  historicalEvents?: string[];
  subjects?: string[]; // "Mitologia", "Ritratto", "Sacro"
  artworkCollection?: string; // rinominato da 'collection', andava in conflitto con Document

  image: string;
  images?: string[];

  roomId?: string; // punta a Museum.rooms[].id
  room?: string; // testo libero legacy, fallback per opere non ancora migrate a roomId
  floor?: string;

  mapPosition?: ArtworkMapPosition;

  createdAt: Date;
  updatedAt: Date;
}

export interface ArtworkDimensions {
  height?: number; // cm
  width?: number;
  depth?: number; // sculture
  diameter?: number; // opere circolari
  unit: 'cm' | 'm';
  displayText?: string; // "170 × 128 cm"
}

export interface ArtworkMapPosition {
  floorId: string;
  x: number;
  y: number;
  rotation?: number; // gradi 0-360
}

export enum ArtworkType {
  Painting = 'painting',
  Drawing = 'drawing',
  Sculpture = 'sculpture',
  Print = 'print',
  Photograph = 'photograph',
  Installation = 'installation',
  NewMedia = 'new_media',
  ManuscriptBook = 'manuscript_book',
  DecorativeObject = 'decorative_object',
  Other = 'other',
}

export interface ArtworkFilters {
  museumId?: string;
  author?: string;
  authorWikidataId?: string;
  artworkType?: ArtworkType;
  movement?: string;
  movementWikidataId?: string;
  roomId?: string;
  room?: string;
  floor?: string;
  yearFrom?: number;
  yearTo?: number;
  search?: string;
  page?: number;
  limit?: number;
}

export interface CreateArtworkData {
  wikidataId: string;
  museumId: string;
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
  roomId?: string;
  room?: string;
  floor?: string;
  mapPosition?: ArtworkMapPosition;
}

export type UpdateArtworkData = Partial<CreateArtworkData>;

// versione ridotta per le liste
export interface ArtworkSummary {
  _id: string;
  wikidataId: string;
  title: string;
  author?: string;
  authorWikidataId?: string;
  year?: string;
  artworkType: ArtworkType;
  image: string;
  roomId?: string;
  room?: string;
  hasMapPosition: boolean;
}
