/*
 * File: /src/context/navigatorConfigStore.ts                                            *
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
import { api } from '../services/apiClient';

// Cuore delle configurazioni personalizzate del navigator

// Navigator raggiunto esempio con navigator?ncfg=KidGallery
const SLUG_KEY = 'ncfg';
const KIOSK_MUSEUM_KEY = 'kioskMuseumId';

interface NavigatorConfigState {
  // Museo su cui l'app resta "agganciata", anche dopo la riapertura
  kioskMuseumId: string | null;
  // Slug della config attiva su questo dispositivo  se presente.
  rememberedSlug: string | null;
  ready: boolean;
  init: () => Promise<void>;
}

// Capisce che slug usare e ottiene il navigatorConfig corrispondente
export const useNavigatorConfigStore = create<NavigatorConfigState>((set) => ({
  kioskMuseumId: localStorage.getItem(KIOSK_MUSEUM_KEY),
  rememberedSlug: localStorage.getItem(SLUG_KEY),
  ready: false,

  init: async () => {
    const urlSlug = new URLSearchParams(window.location.search).get('ncfg');
    const slug = urlSlug || localStorage.getItem(SLUG_KEY); //prende slug da url oppure da localStorage

    if (!slug) {
      set({ ready: true });
      return;
    }

    try {
      const config = await api.resolveNavigatorConfig({ slug });

      if (config.slug !== slug) {
        // Lo slug ricordato non esiste più
        localStorage.removeItem(SLUG_KEY);
        localStorage.removeItem(KIOSK_MUSEUM_KEY);
        set({ kioskMuseumId: null, rememberedSlug: null, ready: true });
        return;
      }

      localStorage.setItem(SLUG_KEY, slug);
      if (config.applicability === 'museum' && config.museumId) {
        localStorage.setItem(KIOSK_MUSEUM_KEY, config.museumId);
        set({ kioskMuseumId: config.museumId, rememberedSlug: slug, ready: true });
      } else {
        localStorage.removeItem(KIOSK_MUSEUM_KEY);
        set({ kioskMuseumId: null, rememberedSlug: slug, ready: true });
      }
    } catch {
      // Altri errori al boot: resta con lo stato già in localStorage
      set({ ready: true });
    }
  },
}));
