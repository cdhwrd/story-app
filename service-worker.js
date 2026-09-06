const CACHE_NAME = "story-app-v3";
const APP_SHELL = ["./index.html", "./manifest.json", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // Only ever handle our own origin. Google's auth script and the Drive API
  // must go straight to the network: caching them could serve a stale or
  // opaque response in place of a live API call.
  if (new URL(event.request.url).origin !== self.location.origin) return;

  // Network-first for the HTML shell (this is a single-file app, so this is
  // effectively "the app"): a stale cache-first response here means a
  // deployed fix can be invisible to an installed PWA indefinitely. Fall
  // back to cache only when there's no network, so offline still works.
  const isAppShell = event.request.mode === "navigate" || event.request.destination === "document";
  if (isAppShell) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Cache-first for everything else (icons, manifest).
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return (
        cached ||
        fetch(event.request).then((response) => {
          if (event.request.method === "GET" && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        }).catch(() => cached)
      );
    })
  );
});
