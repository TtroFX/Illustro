const CACHE_NAME = 'illustro-foundation-v2';
const APP_SHELL = [
  './',
  './index.html',
  './app-shell.css',
  './manifest.webmanifest',
  './build-info.json',
  './app/main.js',
  './app/shell.js',
  './app/workers.js',
  './gpu/webgpu-bootstrap.js',
  './generated/bootstrap-shader.js',
  './shared/runtime-config.js',
  './workers/render.worker.js',
  './workers/storage.worker.js',
  './diagnostics/',
  './diagnostics/runtime.js',
  './legal/open-source-licenses.json',
  './legal/LICENSE',
  './legal/NOTICE',
  './legal/THIRD_PARTY_NOTICES.md',
  './legal/bom.cdx.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (!response || response.status !== 200) return response;
        const copy = response.clone();
        void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return response;
      });
    }),
  );
});
