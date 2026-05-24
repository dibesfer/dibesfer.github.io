const CACHE_NAME = "v3";

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
  const url = new URL(req.url);

  if (req.method !== "GET") return;

  // Only handle this same site.
  if (url.origin !== self.location.origin) return;

  // HTML pages: network first.
  if (req.mode === "navigate" || req.destination === "document") {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();

          caches.open(CACHE_NAME).then(cache => {
            cache.put(req, copy);
          });

          return res;
        })
        .catch(async () => {
          return (
            (await caches.match(req)) ||
            (await caches.match("/index.html")) ||
            new Response("Offline", {
              status: 503,
              headers: {
                "Content-Type": "text/plain"
              }
            })
          );
        })
    );

    return;
  }

  // Assets: network first, cache fallback.
  event.respondWith(
    fetch(req)
      .then(res => {
        // solo cachear respuestas válidas
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
        }
        return res;
      })
      .catch(async () => {
        const cached = await caches.match(req);
        if (cached) return cached;
        // no hay caché → dejar fallar limpiamente
        return Response.error();
      })
  );
}); // ← esta faltaba