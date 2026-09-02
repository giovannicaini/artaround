import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import type { NavigatorAppConfig } from '@artaround/shared';
import { api } from '../lib/apiClient';
import { buildBrandRamp } from '../lib/color';

// priorità: config con lo slug richiesto via ?ncfg=, poi il primo config del
// museo, poi il default di piattaforma, altrimenti i token hardcoded
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

  // cambiano raramente: cache lunga
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
      // torna ai default, altrimenti l'accento resta "incollato" altrove
      for (const stop of Object.keys(ramp)) {
        root.style.removeProperty(`--color-brand-${stop}`);
      }
    };
  }, [activeConfig]);

  return { config: activeConfig, museumName: museumConfig?.name };
}
