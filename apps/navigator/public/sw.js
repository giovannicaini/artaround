// Service worker minimale (per installazione PWA)
// Nessuna cache dei contenuti (visite, audio, immagini museo)

const CACHE_NAME = 'artaround-navigator-v1';
const APP_SHELL = ['/navigator/', '/navigator/index.html'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch(() => {}),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      // Cache di un CACHE_NAME precedente (se mai cambiato): eliminarle evita
      // che si accumulino copie della shell ormai sostituite.
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  // Navigazione verso una pagina dell'app: rete, con la shell in cache come
  // unico fallback se offline.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/navigator/index.html')));
    return;
  }

  const url = new URL(request.url);
  const isAppAsset =
    url.pathname.startsWith('/navigator/assets/') || url.pathname.startsWith('/navigator/icons/');
  if (!isAppAsset) return;

  // JS/CSS con nome basato sul contenuto (Vite) e icone: cachati
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        }),
    ),
  );
});
