/* ================================================================
   SAMTALEKORT — Service Worker
   ----------------------------------------------------------------
   SÅDAN UDGIVER DU EN NY VERSION:
   1. Ret indhold/kode i index.html (fx nye kort).
   2. Hæv tallet i CACHE herunder, fx 'samtalekort-v2'.
      (Det er nok at ændre dette tal — så opdager alle
       installerede apps den nye version automatisk.)
   3. Læg filerne op igen på samme adresse.
   Installerede apps viser så et "Ny version klar"-banner.
   ================================================================ */

const CACHE = "samtalekort-v1";

const ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/icon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon-180.png"
];

// Installér: gem app-skallet i cache
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
});

// Aktivér: ryd gamle cacher (gamle versioner)
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Tillad siden at bede os om at skifte til den nye version med det samme
self.addEventListener("message", (e) => {
  if (e.data && e.data.type === "SKIP_WAITING") self.skipWaiting();
});

// Hent: cache-first for vores egne filer, netværk-med-fallback for resten
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  e.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          // gem også fx Google Fonts til offline-brug efter første online besøg
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => cached);
    })
  );
});
