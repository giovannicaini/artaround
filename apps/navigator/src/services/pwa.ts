/*
 * File: pwa.ts                                                                          *
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

/**
 * Helpers per rendere il navigatore una PWA installabile e impostare tutte le config
 * presenti nel NavigatorConfig
 */
import type { NavigatorConfig } from '@artaround/shared';

// Crea il tag <link rel="..."> se non esiste già e ne aggiorna l'href.
// Usato per apple-touch-icon e favicon
function upsertLink(rel: string, href: string): void {
  let link = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!link) {
    link = document.createElement('link');
    link.rel = rel;
    document.head.appendChild(link);
  }
  link.href = href;
}

// Uguale a upsertLink, per i <meta name="...">.
function upsertMeta(name: string, content: string): void {
  let meta = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = name;
    document.head.appendChild(meta);
  }
  meta.content = content;
}

//Applica tutte le opzioni PWA prese dalla NavigatorConfig del navigator attuale
export function applyManifestAndIcons(config: NavigatorConfig): void {
  const query = new URLSearchParams();
  if (config.applicability === 'museum' && config.museumId) {
    query.set('museumId', config.museumId);
  }
  if (config.slug) query.set('slug', config.slug);

  const manifestLink = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
  if (manifestLink) {
    manifestLink.href = `/api/navigator-configs/manifest?${query.toString()}`;
  }

  const themeColorMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (themeColorMeta && config.pwa.themeColor) {
    themeColorMeta.content = config.pwa.themeColor;
  }

  // Titolo mostrato sotto l'icona una volta aggiunta alla schermata Home (iOS).
  upsertMeta('apple-mobile-web-app-title', config.pwa.shortName || config.name);

  if (config.pwa.appleTouchIcon) {
    upsertLink('apple-touch-icon', config.pwa.appleTouchIcon);
  }

  // Favicon
  const favicon = config.pwa.icon192 || config.pwa.icon512;
  if (favicon) {
    upsertLink('icon', favicon);
  }

  document.title = config.pwa.shortName || config.name;
}

// Service worker minimale, per installabilità PWA
export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/navigator/sw.js').catch(() => {});
  });
}
