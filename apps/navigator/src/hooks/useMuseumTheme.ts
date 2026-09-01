import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import type { NavigatorAppConfig } from '@artaround/shared';
import { api } from '../lib/apiClient';
import { buildBrandRamp } from '../lib/color';

/**
 * Risolve quale NavigatorAppConfig applicare, in ordine di specificità:
 * 1. Config specifico DI QUESTO NAVIGATOR — richiesto esplicitamente via
 *    ?ncfg=slug nell'URL (es. un link/QR pensato per un pubblico preciso:
 *    "borghese-bambini" invece di "borghese-default"), cercato per slug
 *    tra i navigatorConfigs del museo.
 * 2. Config specifico DEL MUSEO — se il museo ne ha almeno uno ma nessuno
 *    corrisponde allo slug richiesto (o non ne è stato richiesto uno), si
 *    usa il primo configurato dal curatore per quel museo.
 * 3. Config GENERICO di piattaforma — AppConfig.navigatorDefaultConfigs,
 *    quando il museo non ha ancora nessun navigatorConfig proprio.
 * Se nessuno dei tre esiste, restano i token di default hardcoded
 * (l'identità "aurora" definita in main.css/tailwind.config.js).
 */
function resolveConfig(
  requestedSlug: string | null,
  museumConfigs: NavigatorAppConfig[] | undefined,
  defaultConfigs: NavigatorAppConfig[] | undefined,
): NavigatorAppConfig | undefined {
  if (requestedSlug) {
    const bySlug = museumConfigs?.find((c) => c.slug === requestedSlug);
    if (bySlug) return bySlug;
  }

  if (museumConfigs && museumConfigs.length > 0) {
    return museumConfigs[0];
  }

  if (requestedSlug) {
    const bySlug = defaultConfigs?.find((c) => c.slug === requestedSlug);
    if (bySlug) return bySlug;
  }

  return defaultConfigs?.[0];
}

export function useMuseumTheme(museumId: string | undefined) {
  const [searchParams] = useSearchParams();
  const requestedSlug = searchParams.get('ncfg');

  const { data: museumConfig } = useQuery({
    queryKey: ['museum-config', museumId],
    queryFn: () => api.getMuseumConfig(museumId!),
    enabled: !!museumId,
    staleTime: 5 * 60 * 1000,
  });

  // I default di piattaforma cambiano raramente: cache lunga, e non serve
  // aspettare che ci sia un museo selezionato per averli pronti.
  const { data: defaultConfigs } = useQuery({
    queryKey: ['navigator-default-configs'],
    queryFn: () => api.getNavigatorDefaultConfigs(),
    staleTime: 30 * 60 * 1000,
  });

  const activeConfig = resolveConfig(requestedSlug, museumConfig?.navigatorConfigs, defaultConfigs);

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
      // Il museo/config attivo è cambiato o la schermata è stata lasciata:
      // torna ai token di default invece di lasciare l'accento precedente
      // "incollato" altrove nell'app.
      for (const stop of Object.keys(ramp)) {
        root.style.removeProperty(`--color-brand-${stop}`);
      }
    };
  }, [activeConfig]);

  return { config: activeConfig, museumName: museumConfig?.name };
}
