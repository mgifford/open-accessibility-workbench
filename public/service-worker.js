/**
 * Offline caching for the Workbench (spec §13.1/§13.2).
 *
 * Strategy:
 * - PRECACHE the versioned application shell at install, so the app can be
 *   relaunched offline after a single successful online visit. Vite fingerprints
 *   bundle filenames, so the exact list is injected at build time (see the
 *   precache-manifest plugin in vite.config.js) into __PRECACHE_MANIFEST__.
 * - Cache-first for the app's OWN assets (same-origin, under the SW scope), with
 *   a background refresh when online.
 * - NEVER cache anything outside the SW scope. Report contents are user data
 *   processed only in memory; a report fetched from this same origin (the app is
 *   hosted on the same host as some report sources) lives outside the app scope
 *   and is therefore never stored here (spec §13.2, §13.4).
 * - On activate, delete only THIS app's old caches (the `oaw-` prefix). Cache
 *   Storage is origin-wide and this origin may host unrelated projects, so we
 *   must not delete their caches.
 */

const CACHE_VERSION = 'v3';
const CACHE_NAME = `oaw-shell-${CACHE_VERSION}`;
const CACHE_PREFIX = 'oaw-';

// Injected at build time; falls back to an empty list in dev (where the shell is
// cached lazily on first fetch instead).
const PRECACHE_MANIFEST = (self.__PRECACHE_MANIFEST__ || []);

// The SW's scope path (directory it was registered from), e.g.
// "/open-accessibility-workbench/". Only requests under this path are app assets.
const SCOPE_PATH = new URL(self.registration ? self.registration.scope : self.location.href).pathname;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // Cache each entry independently so one missing asset cannot abort the
      // whole precache (addAll is all-or-nothing).
      Promise.allSettled(
        PRECACHE_MANIFEST.map((p) =>
          fetch(new Request(p, { cache: 'reload' }))
            .then((res) => (res && res.ok ? cache.put(p, res) : null))
        )
      )
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          // Only remove OUR old caches; never touch other projects on this origin.
          .filter((k) => k.startsWith(CACHE_PREFIX) && k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

function isAppAsset(url) {
  return url.origin === self.location.origin && url.pathname.startsWith(SCOPE_PATH);
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return; // never cache non-GET
  const url = new URL(req.url);

  // Only the app's own in-scope assets are handled/cached. Everything else
  // (reports from any origin, cross-origin resources, out-of-scope paths) passes
  // straight through to the network and is NEVER stored.
  if (!isAppAsset(url)) return;

  // Match by URL, ignoring Vary — a precached asset is fetched with different
  // request headers/mode than the page later uses to request it, and the default
  // Vary-aware match would miss it, wrongly falling through to the network.
  const matchOpts = { ignoreVary: true };

  event.respondWith(
    caches.match(req, matchOpts).then((cached) => {
      if (cached) {
        fetchAndCache(req).catch(() => {}); // refresh in the background when online
        return cached;
      }
      return fetchAndCache(req).catch(async () => {
        // Offline and uncached: for a navigation, serve the cached shell so the
        // hash-routed SPA can boot offline.
        if (req.mode === 'navigate') {
          return (await caches.match(SCOPE_PATH, matchOpts)) ||
            (await caches.match(SCOPE_PATH + 'index.html', matchOpts)) ||
            (await caches.match('./index.html', matchOpts)) ||
            new Response('Offline and not cached.', { status: 503, statusText: 'Offline' });
        }
        return new Response('Offline and not cached.', { status: 503, statusText: 'Offline' });
      });
    })
  );
});

async function fetchAndCache(req) {
  const res = await fetch(req);
  // Cache only successful, basic (same-origin) responses for app assets.
  if (res && res.status === 200 && res.type === 'basic') {
    const copy = res.clone();
    caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
  }
  return res;
}
