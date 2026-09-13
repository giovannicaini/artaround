/*
 * File: useNavigatorTheme.ts                                                            *
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

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { NAVIGATOR_FONT_OPTIONS, type NavigatorConfig } from '@artaround/shared';
import { api } from './apiClient';
import { buildBrandRamp, buildSurfaceRamp } from './color';
import { useNavigatorConfigStore } from '../context/navigatorConfigStore';

function resolveFontFamily(fontId: string | undefined): string | null {
  return NAVIGATOR_FONT_OPTIONS.find((f) => f.id === fontId)?.family ?? null;
}

// Config Navigator attiva per tutta la sessione
export function useActiveNavigatorConfig() {
  // kioskMuseumId e rememberedSlug viengono salvati in localStorage per far funzionare il navigator
  // anche dopo riavvio senza ?ncfg
  const kioskMuseumId = useNavigatorConfigStore((state) => state.kioskMuseumId);
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

// Applica branding/colori al documento — va chiamato una sola volta in App.tsx.
export function useApplyNavigatorTheme(config: NavigatorConfig | undefined) {
  useEffect(() => {
    const root = document.documentElement;
    const vars: Record<string, string> = {};

    const brandRamp = config?.branding.primaryColor
      ? buildBrandRamp(config.branding.primaryColor)
      : null;
    if (brandRamp) {
      // tutti gli stop vengono aggiunti a vars
      for (const [stop, rgb] of Object.entries(brandRamp)) vars[`--color-brand-${stop}`] = rgb;
    }

    const emberRamp = config?.branding.secondaryColor
      ? buildBrandRamp(config.branding.secondaryColor)
      : null;
    if (emberRamp) {
      //si usano solo gli stop 500 e 600 per il secondario
      vars['--color-ember-500'] = `rgb(${emberRamp['500']})`;
      vars['--color-ember-600'] = `rgb(${emberRamp['600']})`;
    }

    // Sfondo, card, bordi e testo usano tutti la scala Tailwind "surface":
    // sovrascrive l'intera scala partendo dai colori della config
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

    // Status bar stesso colore del tema.
    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    const themeColor = config?.branding.backgroundColor || config?.pwa?.themeColor;
    if (themeColorMeta && themeColor) {
      themeColorMeta.setAttribute('content', themeColor);
    }

    return () => {
      for (const name of Object.keys(vars)) root.style.removeProperty(name);
    };
  }, [config]);
}
