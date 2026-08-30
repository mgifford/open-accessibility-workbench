const CACHE_NAME = 'oaw-cache-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './src/styles/tokens.css',
  './src/styles/main.css',
  './src/app.js',
  './src/router.js',
  './public/data/rules/normalized-rules.json',
  './public/data/rules/wcag-map.json',
  './public/data/rules/remediation-patterns.json',
  './public/data/arrm/roles.json',
  './public/data/arrm/tasks.json',
  './public/data/arrm/wcag-role-map.json',
  './public/data/arrm/metadata.json',
  './public/data/technology/guidance.json',
  './public/data/rag/manifest.json',
  './public/data/rag/guidance.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch(() => {
        // Continue even if some individual static assets are dynamically bundled
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request).then((response) => {
        return caches.open(CACHE_NAME).then((cache) => {
          // Cache successful responses for offline use
          if (response.status === 200) {
            cache.put(event.request, response.clone());
          }
          return response;
        });
      }).catch(() => {
        return cached;
      });
    })
  );
});
