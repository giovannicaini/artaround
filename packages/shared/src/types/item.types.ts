import type { AppLanguage } from './i18n.types';

// un item è un contenuto testuale/audio riusabile (opera, autore, movimento,
// periodo o museo). le info logistiche e le indicazioni NON sono item, sono
// specifiche di ogni visita e vivono dentro VisitStep

export interface Item {
  _id: string;

  museumId: string;

  referenceType: ItemReferenceType;
  referenceId?: string; // id wikidata dell'entità a cui si riferisce
  referenceTitle?: string; // titolo per la visualizzazione, cache della reference

  sourceLanguage: AppLanguage;
  title: string;
  text: string;
  translatedTitles?: Partial<Record<AppLanguage, string>>;
  translatedTexts?: Record<string, string>;

  duration: ContentDuration;
  languageLevel: LanguageLevel;

  authorId: string;
  authorName?: string;

  license: LicenseType;
  price: number; // 0 = gratis
  isFree: boolean;

  image?: string; // se assente usa l'immagine dell'opera, quando applicabile

  usageCount: number;
  rating?: number;

  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export enum ItemReferenceType {
  ARTWORK = 'artwork',
  AUTHOR = 'author',
  MOVEMENT = 'movement',
  PERIOD = 'period',
  MUSEUM = 'museum',
}

export enum ContentDuration {
  FLASH = '3s',
  SHORT = '15s',
  MEDIUM = '1min',
  LONG = '4min',
  EXTENDED = '10min',
}

export enum LanguageLevel {
  CHILDREN = 'infantile', // 5-10 anni
  ELEMENTARY = 'elementare', // 10-14 anni / visitatori occasionali
  MEDIUM = 'medio', // adulti, cultura generale
  SPECIALIST = 'specialistico', // livello esperto/accademico
}

export enum LicenseType {
  CC0 = 'CC0',
  CC_BY = 'CC-BY',
  CC_BY_SA = 'CC-BY-SA',
  CC_BY_NC = 'CC-BY-NC',
  CC_BY_NC_SA = 'CC-BY-NC-SA',
  PROPRIETARY = 'proprietary',
}

export interface WikidataEntity {
  id: string; // Q number, es. Q42207
  label: string;
  description?: string;
  imageUrl?: string;

  instanceOf?: string[]; // P31
  author?: string; // P170
  authorId?: string;
  movement?: string; // P135
  movementId?: string;
  style?: string;
  styleId?: string;
  inception?: string; // P571
  epoch?: string;
  location?: string; // P276
  locationId?: string;
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

  properties?: Record<string, unknown>; // proprietà raw non mappate sopra
}

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

export interface CreateItemData {
  museumId: string;
  sourceLanguage?: AppLanguage;
  referenceType: ItemReferenceType;
  referenceId?: string;
  referenceTitle?: string;
  title: string;
  text: string;
  translatedTitles?: Partial<Record<AppLanguage, string>>;
  translatedTexts?: Partial<Record<AppLanguage, string>>;
  duration: ContentDuration;
  languageLevel: LanguageLevel;
  license: LicenseType;
  price?: number;
  tags?: string[];
  image?: string;
}

export type UpdateItemData = Partial<CreateItemData>;

// versione ridotta per le liste
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
