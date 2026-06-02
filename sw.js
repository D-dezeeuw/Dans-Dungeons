// sw.js — Service Worker for Dan's Dungeons
// Cache key is the git short hash baked in by build.js.
// Strategy: network-first — always fetch latest, cache as offline fallback.

const VERSION  = 'app-40a0631';
const BASE     = '/Dans-Dungeons';
const PRECACHE = [
  `${BASE}/`,
  `${BASE}/index.html`,
  `${BASE}/favicon.svg`,
  `${BASE}/vendor/app.bundle.js`,
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
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;

  // Network-first: try fresh fetch, update cache, fall back to cache offline.
  e.respondWith(
    fetch(e.request).then(response => {
      if (response.ok && url.pathname.startsWith(BASE)) {
        const clone = response.clone();
        caches.open(VERSION).then(cache => cache.put(e.request, clone));
      }
      return response;
    }).catch(() => caches.match(e.request))
  );
});
