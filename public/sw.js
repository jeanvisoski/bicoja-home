const CACHE = "bicoja-static-v6";
const ASSETS = [
  "/",
  "/manifest.webmanifest",
  "/bicoja-mark.svg",
  "/bicoja-app-icon.svg?v=1",
  "/bicoja-app-icon-512.png?v=1",
];
self.addEventListener("install", (event) =>
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS))),
);
self.addEventListener("activate", (event) =>
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  ),
);
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || event.request.mode === "navigate") return;
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});
self.addEventListener("push", (event) => {
  const payload = event.data?.json?.() || {};
  event.waitUntil(
    self.registration.showNotification(payload.title || "BICOJA", {
      body: payload.body || "Voce recebeu uma atualizacao.",
      icon: "/bicoja-app-icon-512.png?v=1",
      badge: "/bicoja-mark.svg",
      data: { link: payload.link || "/notifications" },
    }),
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.link || "/notifications"));
});
