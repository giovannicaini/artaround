import { create } from 'zustand';
import {
  LanguageLevel,
  ContentDuration,
  type Artwork,
  type Item,
  type ItemReferenceType,
  type Visit,
  type AppLanguage,
  type GeneratedAudio,
} from '@artaround/shared';

type Translations = Partial<Record<AppLanguage, string>>;

/** Una tappa del player: opera, approfondimento, info logistiche o indicazioni. */
export type PlayerStep =
  | {
      kind: 'artwork';
      id: string;
      artwork: Artwork;
      items: Item[];
      // Contenuto su autore/movimento, se generato — per le risposte vocali "chi è l'autore".
      authorItems?: Item[];
      movementItems?: Item[];
    }
  | {
      // Approfondimento su autore/movimento/periodo/museo, non legato a un'opera specifica.
      kind: 'content';
      id: string;
      referenceType: ItemReferenceType;
      items: Item[];
      mapMarkerId?: string;
    }
  | {
      kind: 'logistic';
      id: string;
      title: string;
      titleTranslations?: Translations;
      text: string;
      textTranslations?: Translations;
      // Audio già generato per lingua — assente finché il curatore non lo genera.
      textAudio?: Partial<Record<AppLanguage, GeneratedAudio>>;
      icon?: string;
      mapMarkerId?: string;
    }
  | {
      kind: 'navigation';
      id: string;
      text: string;
      textTranslations?: Translations;
      textAudio?: Partial<Record<AppLanguage, GeneratedAudio>>;
      image?: string;
      // 'map' mostra la mappa integrata al posto dell'immagine caricata.
      visual?: 'image' | 'map';
      mapMarkerId?: string;
    };

interface VisitSessionState {
  visit: Visit | null;
  steps: PlayerStep[];
  currentStepIndex: number;
  languageLevel: LanguageLevel;
  contentDuration: ContentDuration;
  isSpeaking: boolean;
  isListening: boolean;

  start: (
    visit: Visit,
    steps: PlayerStep[],
    defaults: { languageLevel: LanguageLevel; contentDuration: ContentDuration },
  ) => void;
  goToStep: (index: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  setLanguageLevel: (level: LanguageLevel) => void;
  setContentDuration: (duration: ContentDuration) => void;
  setSpeaking: (speaking: boolean) => void;
  setListening: (listening: boolean) => void;
  reset: () => void;
}

/**
 * Stato di una visita in corso — sostituisce NavigatorContext. Nessun
 * "supporto legacy": le pagine leggono direttamente questi campi.
 */
export const useVisitSessionStore = create<VisitSessionState>((set, get) => ({
  visit: null,
  steps: [],
  currentStepIndex: 0,
  languageLevel: LanguageLevel.MEDIUM,
  contentDuration: ContentDuration.MEDIUM,
  isSpeaking: false,
  isListening: false,

  start: (visit, steps, defaults) =>
    set({
      visit,
      steps,
      currentStepIndex: 0,
      languageLevel: defaults.languageLevel,
      contentDuration: defaults.contentDuration,
    }),

  goToStep: (index) => {
    const { steps } = get();
    if (index >= 0 && index < steps.length) set({ currentStepIndex: index });
  },

  nextStep: () => {
    const { currentStepIndex, steps } = get();
    if (currentStepIndex < steps.length - 1) set({ currentStepIndex: currentStepIndex + 1 });
  },

  prevStep: () => {
    const { currentStepIndex } = get();
    if (currentStepIndex > 0) set({ currentStepIndex: currentStepIndex - 1 });
  },

  setLanguageLevel: (languageLevel) => set({ languageLevel }),
  setContentDuration: (contentDuration) => set({ contentDuration }),
  setSpeaking: (isSpeaking) => set({ isSpeaking }),
  setListening: (isListening) => set({ isListening }),

  reset: () =>
    set({
      visit: null,
      steps: [],
      currentStepIndex: 0,
      isSpeaking: false,
      isListening: false,
    }),
}));
