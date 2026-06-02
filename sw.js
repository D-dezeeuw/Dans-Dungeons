// sw.js — Service Worker for Dan's Dungeons
// Cache key is the git short hash baked in by build.js.
// To bust the cache: run `npm run build` and commit/push.

const VERSION  = 'app-c1c759f';
const BASE     = '/Dans-Dungeons';
const PRECACHE = [
  `${BASE}/`,
  `${BASE}/index.html`,
  `${BASE}/favicon.svg`,
  `${BASE}/vendor/app.bundle.js`,
  // CSS is inlined into index.html — no separate request needed
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  // Only handle GET requests for our own origin
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(response => {
        // Cache successful responses for our assets
        if (response.ok && url.pathname.startsWith(BASE)) {
          const clone = response.clone();
          caches.open(VERSION).then(cache => cache.put(e.request, clone));
        }
        return response;
      });
    })
  );
});
