/*
 * File: /src/services/preferences.service.ts                                            *
 * Project: @artaround/marketplace                                                       *
 * Last Modified: 14/09/2026                                                             *
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

import type { AppLanguage } from '@artaround/shared';

export type Theme = 'light' | 'dark' | 'auto';

export interface SelectedMuseumPreference {
  _id: string;
  wikidataId?: string;
  name: string;
  nameTranslations?: Partial<Record<AppLanguage, string>>;
}

export interface AccessibilitySettings {
  reduceMotion: boolean;
  highContrast: boolean;
  fontSize: 'normal' | 'large' | 'xlarge';
  letterSpacing: 'normal' | 'wide';
  dyslexicFont: boolean;
  underlineLinks: boolean;
  focusVisible: boolean;
}

// Un tour per area (benvenuto, autore, gestione museo, ecc.): si mostra da solo
// la prima volta che diventa rilevante, poi resta rivedibile dalla Dashboard.
export type TourId = 'welcome' | 'author' | 'museum' | 'floorplan' | 'navigatorConfig' | 'admin';

/**
 * Preferenze di dispositivo: museo attivo, tema e tour già visti.
 */
class PreferencesService {
  private static readonly STORAGE_KEYS = {
    theme: 'theme',
    accessibility: 'accessibility',
    selectedMuseum: 'selectedMuseum',
    seenTours: 'seenTours',
  } as const;

  private theme: Theme = 'auto';
  private accessibility: AccessibilitySettings = {
    reduceMotion: false,
    highContrast: false,
    fontSize: 'normal',
    letterSpacing: 'normal',
    dyslexicFont: false,
    underlineLinks: false,
    focusVisible: false,
  };

  constructor() {
    this.loadPreferences();
    this.applyTheme();
    this.applyAccessibility();
    this.watchSystemTheme();
  }

  private loadPreferences() {
    const savedTheme = this.safeGetItem(PreferencesService.STORAGE_KEYS.theme) as Theme | null;
    if (savedTheme) {
      this.theme = savedTheme;
    }

    const savedAccessibility = this.safeGetItem(PreferencesService.STORAGE_KEYS.accessibility);
    if (savedAccessibility) {
      // Merge coi default così i campi nuovi sono sempre presenti
      try {
        this.accessibility = { ...this.accessibility, ...JSON.parse(savedAccessibility) };
      } catch {
        // Ignora valore corrotto in localStorage
      }
    }
  }

  private safeGetItem(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  private safeSetItem(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Ignora i fallimenti di scrittura storage (quota/modalità privata)
    }
  }

  private safeRemoveItem(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      // Ignora i fallimenti di rimozione storage
    }
  }

  private watchSystemTheme() {
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (this.theme === 'auto') {
          this.applyTheme();
        }
      });
    }
  }

  getTheme(): Theme {
    return this.theme;
  }

  setTheme(theme: Theme) {
    this.theme = theme;
    this.safeSetItem(PreferencesService.STORAGE_KEYS.theme, theme);
    this.applyTheme();
    this.notifyThemeChange();
  }

  private applyTheme() {
    const root = document.documentElement;
    let effectiveTheme = this.theme;

    if (effectiveTheme === 'auto') {
      effectiveTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    root.setAttribute('data-theme', effectiveTheme);
    // Sincronizza la classe 'dark' di Tailwind
    if (effectiveTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }

  getAccessibility(): AccessibilitySettings {
    return { ...this.accessibility };
  }

  setAccessibility(settings: Partial<AccessibilitySettings>) {
    this.accessibility = { ...this.accessibility, ...settings };
    this.safeSetItem(
      PreferencesService.STORAGE_KEYS.accessibility,
      JSON.stringify(this.accessibility),
    );
    this.applyAccessibility();
    this.notifyAccessibilityChange();
  }

  private applyAccessibility() {
    const root = document.documentElement;

    // Riduci le animazioni
    root.style.setProperty(
      '--animation-duration',
      this.accessibility.reduceMotion ? '0.01ms' : '300ms',
    );

    // Alto contrasto
    if (this.accessibility.highContrast) {
      root.setAttribute('data-contrast', 'high');
    } else {
      root.removeAttribute('data-contrast');
    }

    // Dimensione font
    root.setAttribute('data-font-size', this.accessibility.fontSize);

    // Spaziatura lettere
    if (this.accessibility.letterSpacing === 'wide') {
      root.setAttribute('data-letter-spacing', 'wide');
    } else {
      root.removeAttribute('data-letter-spacing');
    }

    // Font per dislessia
    if (this.accessibility.dyslexicFont) {
      root.setAttribute('data-font', 'dyslexic');
    } else {
      root.removeAttribute('data-font');
    }

    // Sottolinea i link
    if (this.accessibility.underlineLinks) {
      root.setAttribute('data-underline-links', 'true');
    } else {
      root.removeAttribute('data-underline-links');
    }

    // Focus visibile
    if (this.accessibility.focusVisible) {
      root.setAttribute('data-focus-visible', 'true');
    } else {
      root.removeAttribute('data-focus-visible');
    }
  }

  private notifyThemeChange() {
    window.dispatchEvent(new CustomEvent('theme-changed', { detail: this.theme }));
  }

  private notifyAccessibilityChange() {
    window.dispatchEvent(new CustomEvent('accessibility-changed', { detail: this.accessibility }));
  }

  // Selezione museo
  private readSelectedMuseumFromStorage(): SelectedMuseumPreference | null {
    const saved = this.safeGetItem(PreferencesService.STORAGE_KEYS.selectedMuseum);
    if (!saved) return null;
    try {
      return JSON.parse(saved);
    } catch {
      return null;
    }
  }

  getSelectedMuseumId(): string | null {
    const museum = this.readSelectedMuseumFromStorage();
    return museum?._id || null;
  }

  getSelectedMuseum(): SelectedMuseumPreference | null {
    return this.readSelectedMuseumFromStorage();
  }

  setSelectedMuseum(museum: SelectedMuseumPreference) {
    this.safeSetItem(PreferencesService.STORAGE_KEYS.selectedMuseum, JSON.stringify(museum));
    window.dispatchEvent(new CustomEvent('museum-changed', { detail: museum }));
  }

  clearSelectedMuseum() {
    this.safeRemoveItem(PreferencesService.STORAGE_KEYS.selectedMuseum);
    window.dispatchEvent(new CustomEvent('museum-changed', { detail: null }));
  }

  // Tour per area: per dispositivo, non per sessione — deve sopravvivere a logout/login.
  private readSeenTours(): TourId[] {
    const saved = this.safeGetItem(PreferencesService.STORAGE_KEYS.seenTours);
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  hasSeenTour(id: TourId): boolean {
    return this.readSeenTours().includes(id);
  }

  markTourSeen(id: TourId) {
    const seen = this.readSeenTours();
    if (!seen.includes(id)) {
      this.safeSetItem(PreferencesService.STORAGE_KEYS.seenTours, JSON.stringify([...seen, id]));
    }
  }
}

export const preferencesService = new PreferencesService();
