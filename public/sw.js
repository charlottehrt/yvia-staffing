// Service worker Yvia : installabilité PWA + secours hors ligne.
// Stratégie volontairement prudente pour un dashboard authentifié :
// - navigations : réseau d'abord, page hors-ligne en secours (jamais de cache) ;
// - assets immuables (/_next/static, icônes) : cache d'abord ;
// - tout le reste (Server Actions, données) : non intercepté.
const VERSION = "yvia-v1";
const OFFLINE_URL = "/offline.html";
const PRECACHE = [OFFLINE_URL, "/icons/icon-192.png", "/logo-yvia.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cles) => Promise.all(cles.filter((cle) => cle !== VERSION).map((cle) => caches.delete(cle))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navigation (chargement de page) : réseau d'abord, secours hors ligne.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(OFFLINE_URL).then((reponse) => reponse ?? Response.error())
      )
    );
    return;
  }

  // Assets fingerprintés par Next (immuables) et icônes : cache d'abord.
  const estImmuable =
    url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/");
  if (estImmuable) {
    event.respondWith(
      caches.match(request).then(
        (enCache) =>
          enCache ??
          fetch(request).then((reponse) => {
            if (reponse.ok) {
              const copie = reponse.clone();
              caches.open(VERSION).then((cache) => cache.put(request, copie));
            }
            return reponse;
          })
      )
    );
  }
});
