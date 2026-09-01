const BUILD_SHA = __ILLUSTRO_BUILD_SHA__;
const CACHE_PREFIX = 'illustro-build-';
const LEGACY_CACHE_PREFIX = 'illustro-foundation-';
const CACHE_NAME = `${CACHE_PREFIX}${BUILD_SHA}`;
const PRECACHE_MANIFEST = __ILLUSTRO_PRECACHE_MANIFEST__;

function scopeUrl(relativePath) {
  return new URL(relativePath, self.registration.scope).toString();
}

function isVersionSensitiveRequest(request, url) {
  if (request.mode === 'navigate') return true;
  if (
    request.destination === 'document' ||
    request.destination === 'script' ||
    request.destination === 'worker' ||
    request.destination === 'sharedworker' ||
    request.destination === 'style' ||
    request.destination === 'manifest'
  ) {
    return true;
  }
  return /\.(?:html|js|css|json|webmanifest|wasm)$/i.test(url.pathname);
}

async function precacheCurrentBuild() {
  const cache = await caches.open(CACHE_NAME);
  const requests = PRECACHE_MANIFEST.map(
    (relativePath) => new Request(scopeUrl(relativePath), { cache: 'reload' }),
  );
  await cache.addAll(requests);
}

async function cacheSuccessfulResponse(cache, request, response) {
  if (response.ok && response.type === 'basic') {
    await cache.put(request, response.clone());
  }
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request, { cache: 'no-cache' });
    await cacheSuccessfulResponse(cache, request, response);
    return response;
  } catch (error) {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    if (request.mode === 'navigate') {
      const shell = await cache.match(scopeUrl('./index.html'));
      if (shell) return shell;
    }
    throw error;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request, { ignoreSearch: true });
  if (cached) return cached;
  const response = await fetch(request);
  await cacheSuccessfulResponse(cache, request, response);
  return response;
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const existingCacheNames = await caches.keys();
      await precacheCurrentBuild();
      if (existingCacheNames.some((name) => name.startsWith(LEGACY_CACHE_PREFIX))) {
        await self.skipWaiting();
      }
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter(
            (name) =>
              name !== CACHE_NAME &&
              (name.startsWith(CACHE_PREFIX) || name.startsWith(LEGACY_CACHE_PREFIX)),
          )
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    isVersionSensitiveRequest(request, url) ? networkFirst(request) : cacheFirst(request),
  );
});
