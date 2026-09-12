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

/** Service worker minimale — solo per soddisfare i criteri di installabilità PWA. */
export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/navigator/sw.js').catch(() => {});
  });
}
