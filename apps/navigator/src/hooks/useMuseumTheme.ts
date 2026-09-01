import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { NavigatorAppConfig } from '@artaround/shared';
import { api } from '../lib/apiClient';
import { buildBrandRamp } from '../lib/color';

/**
 * Legge la configurazione Navigator del museo attivo (branding, copy, PWA)
 * e applica l'accento del curatore a runtime, senza ricompilare nulla.
 * Nessun museo configurato → restano i token di default (bronzo/inchiostro).
 *
 * Nota: i default globali di piattaforma (AppConfig.navigatorDefaultConfigs)
 * sono oggi leggibili solo da un admin (GET /api/utils/navigator-default-configs
 * richiede ruolo ADMIN) — non c'è ancora una via pubblica per un visitatore
 * anonimo. Finché non viene aperta, il fallback per un museo senza config
 * propria resta l'identità di default hardcoded, non i default di piattaforma.
 */
export function useMuseumTheme(museumId: string | undefined) {
  const { data: config } = useQuery({
    queryKey: ['museum-config', museumId],
    queryFn: () => api.getMuseumConfig(museumId!),
    enabled: !!museumId,
    staleTime: 5 * 60 * 1000,
  });

  const activeConfig: NavigatorAppConfig | undefined = config?.navigatorConfigs?.[0];

  useEffect(() => {
    const root = document.documentElement;
    const primary = activeConfig?.branding.primaryColor;
    const ramp = primary ? buildBrandRamp(primary) : null;

    if (ramp) {
      for (const [stop, rgb] of Object.entries(ramp)) {
        root.style.setProperty(`--color-brand-${stop}`, rgb);
      }
    }

    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    if (themeColorMeta && activeConfig?.pwa?.themeColor) {
      themeColorMeta.setAttribute('content', activeConfig.pwa.themeColor);
    }

    return () => {
      if (!ramp) return;
      // Il museo attivo è cambiato o la schermata è stata lasciata: torna
      // al bronzo di default invece di lasciare l'accento del museo
      // precedente "incollato" altrove nell'app.
      for (const stop of Object.keys(ramp)) {
        root.style.removeProperty(`--color-brand-${stop}`);
      }
    };
  }, [activeConfig]);

  return { config: activeConfig, museumName: config?.name };
}
