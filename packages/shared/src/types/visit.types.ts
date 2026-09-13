import { LanguageLevel, ItemReferenceType, type GeneratedAudio } from './item.types';
import type { AppLanguage } from './i18n.types';

/**
 * Tipi Visita
 *
 * Una Visita è una sequenza ordinata di tappe attraverso un museo.
 * Ogni tappa può essere:
 * - Un'opera (con più opzioni di item per livelli/durate diverse)
 * - Una nota logistica (info generali sul museo)
 * - Un'indicazione di navigazione (come spostarsi da un punto all'altro)
 */

// ========================================
// VISITA (Percorso di visita)
// ========================================

export interface Visit {
  _id: string;
  museumId: string; // ID Wikidata del museo

  // Autore
  authorId: string; // Utente che ha creato questa visita
  authorName?: string;

  // Info di base
  title: string;
  description: string;
  titleTranslations?: Partial<Record<AppLanguage, string>>;
  descriptionTranslations?: Partial<Record<AppLanguage, string>>;
  coverImage?: string;

  // Sequenza ordinata di tappe
  steps: VisitStep[];

  // Info generali sulla visita
  generalInfo: VisitGeneralInfo;

  // Pubblico di riferimento
  targetAudience: TargetAudience;

  // Metadati
  metadata: VisitMetadata;

  // Pubblicazione
  isPublished: boolean;
  publishedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

// ========================================
// TAPPE DELLA VISITA
// ========================================

export interface VisitStep {
  id: string; // ID univoco all'interno della visita
  order: number;
  type: VisitStepType;

  // ===== PER TAPPE OPERA =====
  artworkId?: string; // ID Wikidata dell'opera

  // Item disponibili per questa tappa (livelli/durate diverse) — per tappe
  // ARTWORK, item con referenceType ARTWORK legati ad artworkId; per tappe
  // CONTENT, item con referenceType === contentReferenceType (sotto),
  // non legati a una singola opera.
  itemIds?: string[]; // ID MongoDB degli item

  // ===== PER TAPPE CONTENT =====
  // Approfondimento su autore/movimento/periodo/museo, non legato a una
  // singola opera — itemIds (sopra) elenca gli item di questo tipo scelti
  // per il museo della visita.
  contentReferenceType?: ItemReferenceType; // AUTHOR | MOVEMENT | PERIOD | MUSEUM

  // ===== PER TAPPE LOGISTIC =====
  // Contenuto specifico di questa visita
  logisticTitle?: string; // "Informazioni utili", "Biglietteria"
  logisticTitleTranslations?: Partial<Record<AppLanguage, string>>;
  logisticText?: string; // Il testo informativo vero e proprio
  logisticTextTranslations?: Partial<Record<AppLanguage, string>>;
  // Audio generato con OpenAI, per lingua — vedi MuseumController.generateVisitStepAudioForMuseum.
  // Invalidato quando logisticText/logisticTextTranslations cambiano (VisitController.update).
  logisticTextAudio?: Partial<Record<AppLanguage, GeneratedAudio>>;
  logisticIcon?: string; // Nome icona: "ticket", "info", "clock", "accessibility"

  // ===== PER TAPPE NAVIGATION =====
  // Contenuto specifico di questa visita
  navigationText?: string; // "Prosegui dritto e gira a sinistra..."
  navigationTextTranslations?: Partial<Record<AppLanguage, string>>;
  navigationTextAudio?: Partial<Record<AppLanguage, GeneratedAudio>>;
  navigationImage?: string; // Immagine opzionale che mostra il percorso (vedi sotto)
  navigationVisual?: 'image' | 'map'; //mostra mappa o immagine
  fromRoom?: string; // Sala/area di partenza
  toRoom?: string; // Sala/area di destinazione

  // ===== PUNTO SULLA MAPPA =====
  // WAYPOINT: deve puntare a un MapMarker di tipo WAYPOINT
  // LOGISTIC/NAVIGATION/CONTENT: può puntare a un MapMarker qualsiasi (facoltativo)
  mapMarkerId?: string;

  // ===== COMUNI =====
  isOptional: boolean; // Può essere saltata se il tempo è poco
  estimatedDuration?: number; // in secondi
}

export enum VisitStepType {
  ARTWORK = 'artwork', // Sosta su un'opera
  LOGISTIC = 'logistic', // Info logistica generale
  NAVIGATION = 'navigation', // Indicazioni tra un'opera e l'altra
  WAYPOINT = 'waypoint', // Punto di svolta muto per il disegno del percorso sulla mappa
  CONTENT = 'content', // Approfondimento su autore/movimento/periodo/museo, non legato a un'opera
}

// ========================================
// INFO GENERALI
// ========================================

export interface VisitGeneralInfo {
  // Info pratiche
  costs?: string; // "Ingresso: €15, ridotto €8"
  ticketInfo?: string; // "Prenotazione obbligatoria online"
  openingHours?: string; // "Mar-Dom 9:00-19:00"

  // Servizi
  services?: string[]; // ["Bar", "Guardaroba", "WiFi", "Audioguida"]

  // Consigli
  tips?: string[]; // ["Arrivare con 15 minuti di anticipo", "Deposito borse obbligatorio"]

  // Accessibilità
  accessibility?: string; // "Accessibile ai disabili, ascensore disponibile"
  wheelchairAccessible?: boolean;
}

// ========================================
// PUBBLICO DI RIFERIMENTO
// ========================================

export interface TargetAudience {
  minAge?: number;
  maxAge?: number;
  languageLevels: LanguageLevel[]; // Quali livelli supporta questa visita
  interests?: string[]; // ["Arte barocca", "Scultura", "Caravaggio"]
  estimatedDuration: number; // in minuti
}

// ========================================
// METADATI
// ========================================

export interface VisitMetadata {
  language: AppLanguage; // Lingua principale (it, en, ecc.)
  supportedLanguages?: AppLanguage[]; // Tutte le traduzioni disponibili

  // Statistiche calcolate
  artworksCount: number;
  totalItemsCount: number;
  estimatedDuration: number; // in minuti

  // Prezzo
  price: number; // 0 per gratis
  isFree: boolean;
  license: string;

  // Statistiche
  downloadsCount: number;
  purchasesCount: number;
}

// ========================================
// FILTRI E RICHIESTE SULLA VISITA
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
// ACQUISTO
// ========================================

export interface VisitPurchase {
  _id: string;
  visitId: string;
  userId: string;
  price: number;
  purchasedAt: Date;
}

// GET /marketplace/my-purchases restituisce visitId popolato (la visita
// intera, non il suo id) — i chiamanti la mostrano senza un'altra richiesta.
export interface VisitPurchaseWithVisit extends Omit<VisitPurchase, 'visitId'> {
  visitId: Visit;
}

// ========================================
// RIEPILOGO VISITA (per le liste)
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
  languageLevels: LanguageLevel[];
}
