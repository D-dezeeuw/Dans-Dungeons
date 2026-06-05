// sw.js — Service Worker for Dan's Dungeons
//
// Cache-first for speed; self-invalidates via VERSION_CHECK message.
// The page fetches vendor/app.version on every load and posts the hash
// to the SW. On mismatch: purge caches, unregister, reload all tabs.

const VERSION  = 'app-942f16d';
const BASE     = '/Dans-Dungeons';
const PRECACHE = [
  `${BASE}/`,
  `${BASE}/index.html`,
  `${BASE}/favicon.svg`,
  `${BASE}/vendor/app.bundle.js`,
];

// ─── Install: precache shell ─────────────────────────────────────────────────

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

// ─── Activate: purge old caches, claim clients ───────────────────────────────

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ─── Fetch: cache-first for own assets ───────────────────────────────────────

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(response => {
        if (response.ok && url.pathname.startsWith(BASE)) {
          const clone = response.clone();
          caches.open(VERSION).then(cache => cache.put(e.request, clone));
        }
        return response;
      });
    })
  );
});

// ─── Version check: page posts the remote hash, SW compares ──────────────────

self.addEventListener('message', (e) => {
  if (e.data?.type !== 'VERSION_CHECK') return;
  const remote = e.data.version;
  const local  = VERSION.replace('app-', '');
  if (!remote || remote === local) return;

  // New version deployed — purge caches, unregister, reload all tabs.
  caches.keys()
    .then(keys => Promise.all(keys.map(k => caches.delete(k))))
    .then(() => self.registration.unregister())
    .then(() => self.clients.matchAll({ type: 'window' }))
    .then(clients => { for (const c of clients) c.navigate(c.url); });
});
