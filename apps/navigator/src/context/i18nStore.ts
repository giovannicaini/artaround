import { create } from 'zustand';
import type { AppLanguage } from '@artaround/shared';
import { loadStoredLanguage, storeLanguage } from '../services/i18n';

interface I18nState {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
}

/**
 * Lingua dell'interfaccia — un solo store, letto/scritto ovunque serva
 * tradurre. Stessa chiave di localStorage del marketplace: la scelta
 * dell'utente vale per entrambe le app (stesso dominio).
 */
export const useI18nStore = create<I18nState>((set) => ({
  language: loadStoredLanguage(),
  setLanguage: (language) => {
    storeLanguage(language);
    if (typeof document !== 'undefined') {
      document.documentElement.lang = language;
    }
    set({ language });
  },
}));
