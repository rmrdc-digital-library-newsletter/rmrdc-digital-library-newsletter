const CACHE_NAME = 'rmrdc-cas-mobile-v3';
const APP_SHELL = [
  './',
  './index.html',
  './about.html',
  './ai-librarian.html',
  './contact.html',
  './help.html',
  './login.html',
  './subscribe.html',
  './technology-opportunity.html',
  './user-dashboard.html',
  './investor-portal.html',
  './researcher-portal.html',
  './fabricator-portal.html',
  './manifest.webmanifest',
  './css/styles.css',
  './css/layout-uniformity.css',
  './css/scroll-reveal.css',
  './js/config.js',
  './js/supabase-client.js',
  './js/platform-auth.js',
  './js/site-menu.js',
  './js/pwa.js',
  './assets/rmrdc-logo.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL).catch(() => null))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  const isSameOrigin = url.origin === self.location.origin;
  const isStaticAsset = /\.(css|js|png|jpg|jpeg|svg|webp|ico|json|woff2?|ttf|map)$/i.test(url.pathname);
  const isNavigation = event.request.mode === 'navigate';

  if (isNavigation || isSameOrigin || isStaticAsset) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        const fetchPromise = fetch(event.request)
          .then(response => {
            if (response && response.status === 200 && (isSameOrigin || isStaticAsset || isNavigation)) {
              const copy = response.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy)).catch(() => null);
            }
            return response;
          })
          .catch(() => cached || caches.match('./index.html'));

        return cached || fetchPromise;
      })
    );
  }
});
