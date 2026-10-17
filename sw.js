// Service Worker for Sri Govinda Sales & Field Representative Portal PWAs
const CACHE_NAME = 'sg-sales-cache-v21';
const ASSETS_TO_CACHE = [
  '/config.js',
  '/icon-192.png',
  '/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch(() => {});
    })
  );
  // Force new service worker to activate immediately without waiting for tabs/apps to close
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('Purging outdated PWA cache:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  // Claim all active client tabs/windows immediately
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  // Only handle same-origin requests
  if (url.origin !== self.location.origin) return;

  // Detect navigation and HTML requests
  const isHtmlNavigation = event.request.mode === 'navigate' || 
                           event.request.destination === 'document' ||
                           url.pathname.endsWith('.html') || 
                           url.pathname.endsWith('/');

  if (isHtmlNavigation) {
    // NETWORK-FIRST FOR HTML: Always fetch latest updates from server when online.
    // If user is offline or network fails, fallback to cached offline copy.
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Offline fallback
          return caches.match(event.request);
        })
    );
    return;
  }

  // STALE-WHILE-REVALIDATE for static assets (icons, js, css):
  // Return cached asset immediately for speed, while fetching fresh copy in background.
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
