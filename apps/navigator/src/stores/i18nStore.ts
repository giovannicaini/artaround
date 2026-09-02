import { create } from 'zustand';
import type { AppLanguage } from '@artaround/shared';
import { loadStoredLanguage, storeLanguage } from '../lib/i18n';

interface I18nState {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
}

// stessa chiave di localStorage del marketplace, la scelta vale per entrambe le app
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
