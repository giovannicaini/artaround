import { create } from 'zustand';
import {
  LanguageLevel,
  ContentDuration,
  type Artwork,
  type Item,
  type Visit,
} from '@artaround/shared';

/**
 * Una tappa del player. Non solo opere: una visita ha anche step logistici
 * (info pratiche scritte dal curatore) e di navigazione (indicazioni tra
 * un'opera e l'altra) — prima scartati in fase di caricamento, ora tappe
 * a pieno titolo con una propria card nel player.
 */
export type PlayerStep =
  | { kind: 'artwork'; id: string; artwork: Artwork; items: Item[] }
  | { kind: 'logistic'; id: string; title: string; text: string; icon?: string }
  | { kind: 'navigation'; id: string; text: string; image?: string };

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
