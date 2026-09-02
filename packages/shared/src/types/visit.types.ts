import { LanguageLevel } from './item.types';
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
// VISIT (Percorso di visita)
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
// VISIT STEPS
// ========================================

export interface VisitStep {
  id: string; // ID univoco all'interno della visita
  order: number;
  type: VisitStepType;

  // ===== PER TAPPE OPERA =====
  artworkId?: string; // ID Wikidata dell'opera

  // Item disponibili per questa tappa (livelli/durate diverse)
  // Usato solo per tappe ARTWORK - gli Item sono contenuto riusabile
  itemIds?: string[]; // ID MongoDB degli item

  // Item scelto dall'utente durante la visita (runtime)
  selectedItemId?: string;

  // ===== PER TAPPE LOGISTIC =====
  // Contenuto inline - non riusabile, specifico di questa visita
  logisticTitle?: string; // "Informazioni utili", "Biglietteria"
  logisticText?: string; // Il testo informativo vero e proprio
  logisticIcon?: string; // Nome icona: "ticket", "info", "clock", "accessibility"

  // ===== PER TAPPE NAVIGATION =====
  // Contenuto inline - indicazioni specifiche del percorso di questa visita
  navigationText?: string; // "Prosegui dritto e gira a sinistra..."
  navigationImage?: string; // Immagine opzionale che mostra il percorso
  // Cosa mostrare come immagine della tappa: 'image' (default, retrocompatibile
  // con le visite esistenti) usa navigationImage; 'map' mostra la mappa
  // integrata al posto di un'immagine caricata, centrata/evidenziata su
  // mapMarkerId se impostato.
  navigationVisual?: 'image' | 'map';
  fromRoom?: string; // Sala/area di partenza
  toRoom?: string; // Sala/area di destinazione

  // ===== PUNTO SULLA MAPPA =====
  // Per WAYPOINT: punto di svolta muto (nessun audio, nessuna sosta per il
  // visitatore), serve solo a disegnare correttamente il percorso tra due
  // tappe quando la linea diretta taglierebbe un muro (es. una porta su un
  // corridoio -> un waypoint appena dentro la stanza, uno a metà del
  // corridoio) — punta sempre a un MapMarker di tipo WAYPOINT.
  // Per LOGISTIC/NAVIGATION: associazione facoltativa a un punto di
  // interesse REALE già posizionato sulla piantina (un ingresso, un bar, un
  // info point, un'opera...), non necessariamente di tipo WAYPOINT — il
  // Navigator la usa per mostrare/evidenziare quel punto sulla mappa a
  // questa tappa (e, se navigationVisual è 'map', per centrare la mappa
  // integrata).
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
}

// ========================================
// GENERAL INFO
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
// TARGET AUDIENCE
// ========================================

export interface TargetAudience {
  minAge?: number;
  maxAge?: number;
  languageLevels: LanguageLevel[]; // Quali livelli supporta questa visita
  interests?: string[]; // ["Arte barocca", "Scultura", "Caravaggio"]
  estimatedDuration: number; // in minuti
}

// ========================================
// METADATA
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
  rating?: number; // Valutazione media (1-5)
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
// VISIT SUMMARY (per le liste)
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
