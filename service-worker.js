// Tofík — Service Worker
// Strategy: cache-first for app shell, network fallback for everything else

const CACHE_NAME = 'tofik-v1';
const APP_SHELL = [
  './',
  './tofik-matematika.html',
  './manifest.json',
  './icon.svg',
  'https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Caveat:wght@700&display=swap',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL).catch(() => {
        // Network error on initial install — caching what we can
      }))
      .then(() => self.skipWaiting())
  );
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
  // Only handle GET
  if (req.method !== 'GET') return;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((resp) => {
        // Cache successful responses (basic + cors) for next time
        if (resp && resp.status === 200 && (resp.type === 'basic' || resp.type === 'cors')) {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
        }
        return resp;
      }).catch(() => {
        // Offline & not in cache — let the browser show its default offline UI
        return new Response('Offline', { status: 503, statusText: 'Offline' });
      });
    })
  );
});
