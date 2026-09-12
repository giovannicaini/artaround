/*
 * File: visitSessionStore.ts                                                            *
 * Project: @artaround/navigator                                                         *
 * Last Modified: 11/09/2026                                                             *
 * Author: Giovanni Caini (giovanni.caini@studio.unibo.it)                               *
 * -----                                                                                 *
 * MIT License                                                                           *
 *                                                                                       *
 * Copyright (c) 2026 Giovanni Caini                                                     *
 *                                                                                       *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of       *
 * this software and associated documentation files (the "Software"), to deal in         *
 * the Software without restriction, including without limitation the rights to          *
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies         *
 * of the Software, and to permit persons to whom the Software is furnished to do        *
 * so, subject to the following conditions:                                              *
 *                                                                                       *
 * The above copyright notice and this permission notice shall be included in all        *
 * copies or substantial portions of the Software.                                       *
 *                                                                                       *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR            *
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,              *
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE           *
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER                *
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,         *
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE         *
 * SOFTWARE.                                                                             *
 * ************************************************************************************* *
 */

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

// Una tappa del player: opera, approfondimento, info logistiche o indicazioni.
export type PlayerStep =
  | {
      kind: 'artwork';
      id: string;
      artwork: Artwork;
      items: Item[];
      // Contenuti su autore/movimento, se presenti
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
      // Audio già generato da OpenAI: se assente, si usa api del browser
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

// Stato di una visita in corso

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
