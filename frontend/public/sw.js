/* FleetOS PWA service worker — app-shell precache + runtime strategies.
   Live fleet data is always network-first (never serve stale positions from
   cache silently); static assets are cache-first; navigations fall back to the
   cached shell when offline so the app still boots. */
const VERSION = 'fleetos-v1';
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icon.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // never cache cross-origin (tiles, fonts, API)

  // API + websocket handshakes: network-only, no fallback cache
  if (url.pathname.startsWith('/api')) return;

  // Navigations: network-first, fall back to cached shell offline
  if (request.mode === 'navigate') {
    e.respondWith(fetch(request).catch(() => caches.match('/index.html')));
    return;
  }

  // Static assets: cache-first, populate on miss
  e.respondWith(
    caches.match(request).then((hit) => hit || fetch(request).then((res) => {
      if (res.ok && (url.pathname.startsWith('/assets') || SHELL.includes(url.pathname))) {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(request, copy));
      }
      return res;
    }).catch(() => hit))
  );
});
