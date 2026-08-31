/**
 * Offline caching for the Workbench (spec §13.1).
 *
 * Because Vite fingerprints bundle filenames, a hand-maintained asset list can't
 * stay correct. Instead we use a runtime "cache on fetch" strategy: the app
 * shell and same-origin GET responses (JS/CSS/JSON/HTML data) are cached as they
 * are first fetched, then served cache-first when offline. Report contents are
 * NEVER put here — they are user data processed only in memory (spec §13.2).
 */

const CACHE_NAME = 'oaw-runtime-v2';

self.addEventListener('install', () => {
  // Take over quickly; the app shell is cached on first navigation.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  // Only handle same-origin GETs; let everything else (models from other hosts,
  // POSTs, etc.) pass straight through — the model is not cached here.
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) {
        // Cache-first, but refresh in the background when online.
        fetchAndCache(req).catch(() => {});
        return cached;
      }
      return fetchAndCache(req).catch(() => {
        // Offline and uncached: for a navigation, fall back to the cached shell.
        if (req.mode === 'navigate') return caches.match('./index.html') || caches.match('./');
        return new Response('Offline and not cached.', { status: 503, statusText: 'Offline' });
      });
    })
  );
});

async function fetchAndCache(req) {
  const res = await fetch(req);
  // Only cache successful, basic (same-origin) responses.
  if (res && res.status === 200 && res.type === 'basic') {
    const copy = res.clone();
    caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
  }
  return res;
}
