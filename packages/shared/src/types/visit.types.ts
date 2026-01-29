import { CompetenceLevel, TimePreference } from './user.types';

// Visit types
export interface Visit {
  _id: string;
  museumId: string;
  authorId: string;
  title: string;
  description: string;
  items: VisitItem[];
  logisticNotes: LogisticNote[];
  navigationNotes: NavigationNote[];
  targetAudience: TargetAudience;
  metadata: VisitMetadata;
  isPublished: boolean;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface VisitItem {
  itemId: string;
  order: number;
  isOptional: boolean; // Optional items (if time permits)
  alternatives?: string[]; // Alternative items for same artwork (different levels)
}

export interface LogisticNote {
  order: number;
  text: string;
  type: 'info' | 'warning' | 'direction';
}

export interface NavigationNote {
  fromItemId: string;
  toItemId: string;
  text: string;
  estimatedTime?: number; // in seconds
}

export interface TargetAudience {
  minAge?: number;
  maxAge?: number;
  competenceLevel: CompetenceLevel[];
  interests: string[];
  timeRequired: TimePreference;
}

export interface VisitMetadata {
  language: string;
  duration: number; // estimated in minutes
  itemsCount: number;
  price: number;
  isFree: boolean;
  license: string;
  rating?: number; // average rating
  downloadsCount: number;
  purchasesCount: number;
}

// Purchase/Adoption
export interface VisitPurchase {
  _id: string;
  visitId: string;
  userId: string;
  price: number;
  purchasedAt: Date;
}
