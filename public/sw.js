const CACHE = "bicoja-static-v1";
const ASSETS = ["/", "/manifest.webmanifest", "/bicaja-logo.png"];
self.addEventListener("install", (event) => event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS))));
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || event.request.mode === "navigate") return;
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});
