import { CompetenceLevel } from './user.types';

// Item types
export interface Item {
  _id: string;
  museumId: string;
  objectId: string; // Wikidata ID (e.g., Q126599960)
  authorId: string; // User who created this item
  title: string;
  contents: ItemContent[];
  metadata: ItemMetadata;
  image?: string; // base64 or URL for recognition
  relatedItems?: string[]; // IDs of related items (style, artist, etc.)
  createdAt: Date;
  updatedAt: Date;
}

export interface ItemContent {
  duration: ContentDuration;
  language: CompetenceLevel;
  text: string;
  translatedTexts?: Record<string, string>; // locale -> translated text
}

export enum ContentDuration {
  SHORT = '3s',
  MEDIUM = '15s',
  LONG = '40s',
  EXTENDED = '2min'
}

export interface ItemMetadata {
  author?: string; // Artist name or Wikidata ID
  style?: string; // Wikidata ID (e.g., Q131808)
  epoch?: string;
  license: LicenseType;
  price: number; // 0 for free
  isFree: boolean;
  tags?: string[];
}

export enum LicenseType {
  CC0 = 'CC0',
  CC_BY = 'CC BY',
  CC_BY_SA = 'CC BY-SA',
  CC_BY_NC = 'CC BY-NC',
  PROPRIETARY = 'proprietary'
}

// Wikidata integration
export interface WikidataEntity {
  id: string; // Q number
  label: string;
  description?: string;
  imageUrl?: string;
  properties?: Record<string, any>;
}
