const CACHE_NAME = "v2";

const FILES = [
  "/",
  "/index.html",
  "/style.css",
  "/gallery/index.html",
  "/games/index.html",
  "/web/index.html"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(FILES))
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  const req = event.request;

  if (req.method !== "GET") return;
  if (!req.url.startsWith("http")) return;

  event.respondWith(
    caches.match(req).then(cached => {
      return cached || fetch(req).catch(() => {
        if (req.mode === "navigate") {
          return caches.match("/index.html");
        }
      });
    })
  );
});