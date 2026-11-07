const CACHE_NAME = 'rmrdc-cas-mobile-v24';
const STATIC_ASSETS = [
  './css/styles.css',
  './css/layout-uniformity.css',
  './css/scroll-reveal.css',
  './js/config.js',
  './js/supabase-client.js',
  './js/platform-auth.js',
  './js/subscribe.js',
  './js/subscription-ui.js',
  './js/site-menu.js',
  './js/pwa.js',
  './assets/rmrdc-logo.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS).catch(() => null))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || event.request.mode === 'navigate') return;

  const isStaticAsset = /\.(css|js|png|jpg|jpeg|svg|webp|ico|json|woff2?|ttf|map)$/i.test(url.pathname);
  if (!isStaticAsset) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(event.request);
      const fetchAndCache = async () => {
        const response = await fetch(event.request, { cache: 'no-cache' });
        if (response.ok) await cache.put(event.request, response.clone());
        return response;
      };

      if (url.pathname.endsWith('.js')) {
        try {
          return await fetchAndCache();
        } catch (error) {
          if (cached) return cached;
          throw error;
        }
      }

      return cached || fetchAndCache();
    })
  );
});
