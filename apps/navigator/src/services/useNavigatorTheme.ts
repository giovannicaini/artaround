import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { NAVIGATOR_FONT_OPTIONS, type NavigatorConfig } from '@artaround/shared';
import { api } from './apiClient';
import { buildBrandRamp, buildSurfaceRamp } from './color';
import { useNavigatorConfigStore } from '../context/navigatorConfigStore';

function resolveFontFamily(fontId: string | undefined): string | null {
  return NAVIGATOR_FONT_OPTIONS.find((f) => f.id === fontId)?.family ?? null;
}

/** Config Navigator attiva per tutta la sessione — quella del museo agganciato via kiosk, o quella generale. */
export function useActiveNavigatorConfig() {
  const kioskMuseumId = useNavigatorConfigStore((state) => state.kioskMuseumId);
  // Se il dispositivo è agganciato a una config precisa (link/QR ?ncfg=slug),
  // va risolta di nuovo per QUELLO slug — risolvere solo per museumId, quando
  // un museo ha più configurazioni, ne sceglie una qualunque (la più vecchia,
  // vedi resolveConfig lato server) invece di quella scelta.
  const rememberedSlug = useNavigatorConfigStore((state) => state.rememberedSlug);
  const ready = useNavigatorConfigStore((state) => state.ready);

  return useQuery({
    queryKey: ['navigator-config', 'active', rememberedSlug, kioskMuseumId],
    queryFn: () =>
      api.resolveNavigatorConfig(
        rememberedSlug
          ? { slug: rememberedSlug }
          : kioskMuseumId
            ? { museumId: kioskMuseumId }
            : {},
      ),
    enabled: ready,
    staleTime: 30 * 60 * 1000,
  });
}

/** Applica branding/colori al documento — va chiamato una sola volta in App.tsx, non per pagina. */
export function useApplyNavigatorTheme(config: NavigatorConfig | undefined) {
  useEffect(() => {
    const root = document.documentElement;
    // Tutte le CSS var da applicare, raccolte prima e poi impostate/rimosse
    // in un solo punto invece che ramo per ramo.
    const vars: Record<string, string> = {};

    const brandRamp = config?.branding.primaryColor
      ? buildBrandRamp(config.branding.primaryColor)
      : null;
    if (brandRamp) {
      for (const [stop, rgb] of Object.entries(brandRamp)) vars[`--color-brand-${stop}`] = rgb;
    }

    const emberRamp = config?.branding.secondaryColor
      ? buildBrandRamp(config.branding.secondaryColor)
      : null;
    if (emberRamp) {
      vars['--color-ember-500'] = `rgb(${emberRamp['500']})`;
      vars['--color-ember-600'] = `rgb(${emberRamp['600']})`;
    }

    // Sfondo, card, bordi e testo usano tutti la scala Tailwind "surface":
    // sovrascrivere l'intera rampa (non un solo colore) cambia davvero l'aspetto dell'app.
    const surfaceRamp = config?.branding.backgroundColor
      ? buildSurfaceRamp(config.branding.backgroundColor)
      : null;
    if (surfaceRamp) {
      for (const [stop, rgb] of Object.entries(surfaceRamp)) vars[`--color-surface-${stop}`] = rgb;
    }

    const displayFont = resolveFontFamily(config?.branding.displayFont);
    if (displayFont) vars['--font-display'] = displayFont;
    const bodyFont = resolveFontFamily(config?.branding.bodyFont);
    if (bodyFont) vars['--font-body'] = bodyFont;

    for (const [name, value] of Object.entries(vars)) root.style.setProperty(name, value);

    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    if (themeColorMeta && config?.pwa?.themeColor) {
      themeColorMeta.setAttribute('content', config.pwa.themeColor);
    }

    return () => {
      for (const name of Object.keys(vars)) root.style.removeProperty(name);
    };
  }, [config]);
}
