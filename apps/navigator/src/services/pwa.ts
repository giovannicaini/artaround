import type { NavigatorConfig } from '@artaround/shared';

/**
 * Aggiorna manifest e tag Apple in base alla config Navigator attiva — il manifest è
 * generato lato server, qui si aggiorna solo l'href del <link>. iOS Safari ignora il
 * Web App Manifest, quindi apple-touch-icon/apple-mobile-web-app-title vanno a parte.
 */
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

  const appleTitleMeta = document.querySelector<HTMLMetaElement>(
    'meta[name="apple-mobile-web-app-title"]',
  );
  if (appleTitleMeta) {
    appleTitleMeta.content = config.pwa.shortName || config.name;
  } else {
    const meta = document.createElement('meta');
    meta.name = 'apple-mobile-web-app-title';
    meta.content = config.pwa.shortName || config.name;
    document.head.appendChild(meta);
  }

  const appleTouchIcon = config.pwa.appleTouchIcon;
  if (appleTouchIcon) {
    let link = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'apple-touch-icon';
      document.head.appendChild(link);
    }
    link.href = appleTouchIcon;
  }

  document.title = config.pwa.shortName || config.name;
}

/** Service worker minimale — solo per soddisfare i criteri di installabilità PWA. */
export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/navigator/sw.js').catch(() => {
      // Installabilità PWA degradata, non blocca l'uso dell'app.
    });
  });
}
