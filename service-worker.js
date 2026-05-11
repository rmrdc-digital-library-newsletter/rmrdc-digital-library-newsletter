const CACHE_NAME = 'rmrdc-cas-mobile-v2';
const CORE_ASSETS = [
  './',
  './index.html',
  './css/styles.css',
  './js/config.js',
  './js/supabase-client.js',
  './manifest.webmanifest'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(CORE_ASSETS).catch(() => null)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          if (event.request.url.startsWith(self.location.origin)) cache.put(event.request, copy).catch(() => null);
        });
        return response;
      })
      .catch(() => caches.match(event.request).then(cached => cached || caches.match('./index.html')))
  );
});
