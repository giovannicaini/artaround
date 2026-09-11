import { create } from 'zustand';
import { api } from '../services/apiClient';

const SLUG_KEY = 'ncfg';
const KIOSK_MUSEUM_KEY = 'kioskMuseumId';

interface NavigatorConfigState {
  /** Museo su cui l'app resta "agganciata" (nessuna scelta museo) — null se libera. */
  kioskMuseumId: string | null;
  /** Slug della config attiva su questo dispositivo (link/QR ricordato), se presente. */
  rememberedSlug: string | null;
  ready: boolean;
  init: () => Promise<void>;
  exitKiosk: () => void;
}

/** Risolve all'avvio se questo dispositivo è "agganciato" a un museo via link/QR (?ncfg=slug, poi ricordato). */
export const useNavigatorConfigStore = create<NavigatorConfigState>((set) => ({
  kioskMuseumId: localStorage.getItem(KIOSK_MUSEUM_KEY),
  rememberedSlug: localStorage.getItem(SLUG_KEY),
  ready: false,

  init: async () => {
    const urlSlug = new URLSearchParams(window.location.search).get('ncfg');
    const slug = urlSlug || localStorage.getItem(SLUG_KEY);

    if (!slug) {
      set({ ready: true });
      return;
    }

    try {
      const config = await api.resolveNavigatorConfig({ slug });

      if (config.slug !== slug) {
        // Lo slug ricordato non esiste più (config cancellata altrove): non
        // resta nulla a cui restare agganciati.
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
      // Offline/errore di rete al boot: non blocca l'app, resta con lo stato già in localStorage.
      set({ ready: true });
    }
  },

  exitKiosk: () => {
    localStorage.removeItem(SLUG_KEY);
    localStorage.removeItem(KIOSK_MUSEUM_KEY);
    set({ kioskMuseumId: null, rememberedSlug: null });
  },
}));
