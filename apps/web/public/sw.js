/**
 * Notesaner Service Worker
 *
 * Caching strategy:
 *   - Static assets (JS, CSS, fonts, images): Cache-first with network fallback
 *   - API calls (/api/*): Network-first with cache fallback (stale-while-revalidate)
 *   - Navigation requests: Network-first with offline fallback page
 *
 * Cache names are versioned so old caches are purged on activation.
 */

'use strict';

const CACHE_VERSION = 'v1';
const STATIC_CACHE = `notesaner-static-${CACHE_VERSION}`;
const API_CACHE = `notesaner-api-${CACHE_VERSION}`;
const NOTES_CACHE = `notesaner-notes-${CACHE_VERSION}`;

/** Paths to pre-cache on install (app shell). */
const APP_SHELL_URLS = ['/offline', '/'];

// ---------------------------------------------------------------------------
// Install — pre-cache app shell
// ---------------------------------------------------------------------------

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(APP_SHELL_URLS))
      .then(() => self.skipWaiting()),
  );
});

// ---------------------------------------------------------------------------
// Activate — purge old caches
// ---------------------------------------------------------------------------

self.addEventListener('activate', (event) => {
  const currentCaches = new Set([STATIC_CACHE, API_CACHE, NOTES_CACHE]);

  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames.filter((name) => !currentCaches.has(name)).map((name) => caches.delete(name)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// ---------------------------------------------------------------------------
// Fetch — routing logic
// ---------------------------------------------------------------------------

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) {
    return;
  }

  // API calls: network-first, fall back to cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstWithCache(request, API_CACHE));
    return;
  }

  // Note content endpoints: network-first, cached for offline reading
  if (url.pathname.startsWith('/workspaces/') && url.pathname.includes('/notes/')) {
    event.respondWith(networkFirstWithCache(request, NOTES_CACHE));
    return;
  }

  // Static assets: cache-first
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirstWithNetwork(request, STATIC_CACHE));
    return;
  }

  // Navigation requests (HTML pages): network-first with offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(navigationHandler(request));
    return;
  }
});

// ---------------------------------------------------------------------------
// Strategy implementations
// ---------------------------------------------------------------------------

/**
 * Network-first: try network, on failure serve cached response.
 * Successful network responses are stored in the specified cache.
 */
async function networkFirstWithCache(request, cacheName) {
  const cache = await caches.open(cacheName);

  try {
    const networkResponse = await fetch(request);

    // Only cache successful GET responses
    if (networkResponse.ok && request.method === 'GET') {
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch {
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }

    return new Response(JSON.stringify({ error: 'offline', message: 'No cached data available' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Cache-first: serve from cache when available, otherwise fetch from network
 * and store the response in cache.
 */
async function cacheFirstWithNetwork(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }

  try {
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch {
    return new Response('Asset unavailable offline', { status: 503 });
  }
}

/**
 * Navigation handler: network-first for HTML navigation with offline page fallback.
 */
async function navigationHandler(request) {
  try {
    const networkResponse = await fetch(request);
    return networkResponse;
  } catch {
    // Serve offline fallback page from cache
    const cache = await caches.open(STATIC_CACHE);
    const offlinePage = await cache.match('/offline');
    if (offlinePage) {
      return offlinePage;
    }

    // Last resort if offline page is not cached
    return new Response(
      `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Notesaner — Offline</title>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; align-items: center;
           justify-content: center; min-height: 100vh; margin: 0;
           background: #1e1e2e; color: #cdd6f4; }
    .card { text-align: center; padding: 2rem; max-width: 360px; }
    h1 { font-size: 1.25rem; margin-bottom: 0.5rem; }
    p { font-size: 0.875rem; color: #a6adc8; }
    button { margin-top: 1rem; padding: 0.5rem 1.25rem; background: #cba6f7;
             color: #1e1e2e; border: none; border-radius: 6px; cursor: pointer;
             font-weight: 600; }
  </style>
</head>
<body>
  <div class="card">
    <h1>You are offline</h1>
    <p>Notesaner requires a network connection to load. Check your connection and try again.</p>
    <button onclick="window.location.reload()">Retry</button>
  </div>
</body>
</html>`,
      {
        status: 503,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      },
    );
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns true if the pathname is a static asset that should be cache-first.
 */
function isStaticAsset(pathname) {
  return (
    pathname.startsWith('/_next/static/') ||
    pathname.startsWith('/fonts/') ||
    pathname.startsWith('/images/') ||
    pathname.startsWith('/icons/') ||
    /\.(css|js|woff2?|ttf|otf|eot|png|jpg|jpeg|gif|svg|ico|webp|avif)$/.test(pathname)
  );
}
