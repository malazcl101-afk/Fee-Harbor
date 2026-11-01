/* Fee Harbor service worker: caches the app shell so the hosted copy
   installs as an app and opens offline after the first online visit.
   Data lives in IndexedDB in the browser; this worker only caches files.
   Bump CACHE when shipping a new build so old caches are replaced. */
var CACHE = 'fee-harbor-v1';
var ASSETS = [
  './',
  './index.html',
  './guide.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) { return cache.addAll(ASSETS); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) {
        return key === CACHE ? null : caches.delete(key);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var request = event.request;
  if (request.method !== 'GET') return;
  var url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Pages: network first so a new build arrives when online, cache when offline.
  if (request.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('/')) {
    event.respondWith(
      fetch(request).then(function (response) {
        var copy = response.clone();
        caches.open(CACHE).then(function (cache) { cache.put(request, copy); });
        return response;
      }).catch(function () {
        return caches.match(request, { ignoreSearch: true })
          .then(function (cached) { return cached || caches.match('./index.html'); });
      })
    );
    return;
  }

  // Static assets: cache first, then network (and remember what was fetched).
  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then(function (cached) {
      if (cached) return cached;
      return fetch(request).then(function (response) {
        var copy = response.clone();
        caches.open(CACHE).then(function (cache) { cache.put(request, copy); });
        return response;
      });
    })
  );
});
