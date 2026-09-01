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

// The cache name is build-unique (a build id is injected at build time) so each
// deploy installs a fresh precache and activate purges the previous build's —
// a static name would serve a stale shell cache-first across deploys.
const BUILD_ID = self.__BUILD_ID__ || 'dev';
const CACHE_NAME = `oaw-shell-${BUILD_ID}`;
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

  const cachedShell = async () =>
    (await caches.match(SCOPE_PATH, matchOpts)) ||
    (await caches.match(SCOPE_PATH + 'index.html', matchOpts)) ||
    (await caches.match('./index.html', matchOpts));

  // Navigations are NETWORK-FIRST: always try the network so a new deploy's
  // index.html (which references the new hashed assets) is picked up promptly,
  // falling back to the cached shell only when offline. Hashed assets are
  // immutable, so they stay CACHE-FIRST below.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetchAndCache(req).catch(async () =>
        (await cachedShell()) || new Response('Offline and not cached.', { status: 503, statusText: 'Offline' })
      )
    );
    return;
  }

  event.respondWith(
    caches.match(req, matchOpts).then((cached) => {
      if (cached) {
        fetchAndCache(req).catch(() => {}); // refresh in the background when online
        return cached;
      }
      return fetchAndCache(req).catch(async () =>
        new Response('Offline and not cached.', { status: 503, statusText: 'Offline' })
      );
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
