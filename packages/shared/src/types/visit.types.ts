import { LanguageLevel } from './item.types';
import type { AppLanguage } from './i18n.types';

// una visita è una sequenza ordinata di tappe: opere, note logistiche,
// indicazioni per spostarsi, o waypoint muti solo per disegnare il percorso

export interface Visit {
  _id: string;
  museumId: string; // id wikidata del museo

  authorId: string;
  authorName?: string;

  title: string;
  description: string;
  titleTranslations?: Partial<Record<AppLanguage, string>>;
  descriptionTranslations?: Partial<Record<AppLanguage, string>>;
  coverImage?: string;

  steps: VisitStep[];
  generalInfo: VisitGeneralInfo;
  targetAudience: TargetAudience;
  metadata: VisitMetadata;

  isPublished: boolean;
  publishedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

export interface VisitStep {
  id: string;
  order: number;
  type: VisitStepType;

  // campi opera
  artworkId?: string; // id wikidata
  itemIds?: string[]; // item riusabili collegati (livelli/durate diverse)
  selectedItemId?: string; // scelto dall'utente durante la visita

  // campi logistici, testo scritto apposta per questa visita
  logisticTitle?: string;
  logisticText?: string;
  logisticIcon?: string; // "ticket", "info", "clock", "accessibility"

  // campi indicazioni
  navigationText?: string;
  navigationImage?: string;
  // 'image' (default) mostra navigationImage, 'map' mostra la mappa
  // integrata al posto di un'immagine caricata
  navigationVisual?: 'image' | 'map';
  fromRoom?: string;
  toRoom?: string;

  // punto sulla mappa collegato alla tappa. Per i WAYPOINT è sempre un
  // marker di tipo WAYPOINT (svolta muta, serve solo a far girare il
  // percorso attorno ai muri). Per LOGISTIC/NAVIGATION è facoltativo e può
  // essere un marker qualsiasi (ingresso, bar, opera...): il Navigator lo
  // usa per evidenziarlo sulla mappa e, se navigationVisual è 'map', per
  // centrarla
  mapMarkerId?: string;

  isOptional: boolean;
  estimatedDuration?: number; // secondi
}

export enum VisitStepType {
  ARTWORK = 'artwork',
  LOGISTIC = 'logistic',
  NAVIGATION = 'navigation',
  WAYPOINT = 'waypoint', // svolta muta per disegnare il percorso sulla mappa
}

export interface VisitGeneralInfo {
  costs?: string;
  ticketInfo?: string;
  openingHours?: string;
  services?: string[]; // ["Bar", "Guardaroba", "WiFi"...]
  tips?: string[];
  accessibility?: string;
  wheelchairAccessible?: boolean;
}

export interface TargetAudience {
  minAge?: number;
  maxAge?: number;
  languageLevels: LanguageLevel[];
  interests?: string[];
  estimatedDuration: number; // minuti
}

export interface VisitMetadata {
  language: AppLanguage;
  supportedLanguages?: AppLanguage[];

  artworksCount: number;
  totalItemsCount: number;
  estimatedDuration: number; // minuti

  price: number; // 0 = gratis
  isFree: boolean;
  license: string;

  rating?: number; // media 1-5
  ratingsCount?: number;
  downloadsCount: number;
  purchasesCount: number;
}

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

export interface VisitPurchase {
  _id: string;
  visitId: string;
  userId: string;
  price: number;
  purchasedAt: Date;
}

// versione ridotta per le liste
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
