/* ================================================================
   SAMTALEKORT — Service Worker
   ----------------------------------------------------------------
   OPDATERINGER SKER HELT AF SIG SELV.

   Du skal IKKE røre denne fil for at udgive nye kort eller
   rettelser. Build-id'et herunder bliver stemplet automatisk, når
   GitHub Actions lægger appen op (se .github/workflows/pages.yml).

     app/ ændret  ->  nyt build-id  ->  ny cache
                  ->  alle installerede apps henter den nye version
                      stille i baggrunden og skifter til den, næste
                      gang appen er på forsiden.

   Stemplet er tree-hashen for app/, ikke commit-nummeret. Retter du
   kun README, er build-id'et det samme, og ingen får en unødig
   "ny version" ned.

   Kører du lokalt, står pladsholderen uændret. Det virker fint,
   men så opdager appen kun en ændring, hvis du selv retter
   teksten herunder.

   Brugerens data (brugte kort, favoritter, indstillinger) ligger i
   localStorage og bliver ALDRIG rørt af en opdatering — vi rydder
   kun vores egne filcacher.
   ================================================================ */

const BUILD = "__BUILD__";              // stemples automatisk i CI
const CACHE = "samtalekort-" + BUILD;
const CACHE_PREFIX = "samtalekort-";

const ASSETS = [
  "./index.html",
  "./manifest.webmanifest",
  "./icons/icon.svg",
  "./icons/favicon-32.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon-180.png"
];

const HTML_KEY = "./index.html";        // fælles nøgle for forsiden

/* ---- Installér: hent app-skallet HELT frisk fra nettet ----------
   'cache: "reload"' er vigtigt: ellers kan browserens egen
   HTTP-cache (GitHub Pages sætter 10 minutter) finde på at give os
   den GAMLE index.html at gemme under det nye build-id. */
self.addEventListener("install", (e) => {
  e.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);

      // Selve appen SKAL i hus, før den nye version må tage over. Lykkes det
      // ikke (dårligt signal i toget, et halvt deploy), kaster vi — så bliver
      // installationen ikke færdig, activate kører aldrig, og den GAMLE
      // version bliver stående og virker. Uden det her kunne vi aktivere en
      // version uden app-skal og bagefter slette den eneste, der duede.
      let shell;
      try {
        shell = await fetch(new Request(HTML_KEY, { cache: "reload" }));
        if (!shell || !shell.ok) throw new Error("app-skallen svarede " + (shell && shell.status));
      } catch (err) {
        await caches.delete(CACHE);   // efterlad ikke en tom halv cache
        throw err;
      }
      await cache.put(HTML_KEY, shell);

      // Resten er pynt (ikoner, manifest). Mangler én, virker appen endda.
      await Promise.all(ASSETS.filter((u) => u !== HTML_KEY).map(async (url) => {
        try {
          const res = await fetch(new Request(url, { cache: "reload" }));
          if (res && res.ok) await cache.put(url, res);
        } catch (err) { /* en enkelt fil må gerne fejle — appen virker stadig */ }
      }));

      // Ingen ventetid: den nye version må gerne tage over med det samme.
      // Selve siden genindlæser først, når brugeren er på forsiden.
      await self.skipWaiting();
    })()
  );
});

/* ---- Aktivér: ryd gamle versioners cacher og sig til siden ---- */
self.addEventListener("activate", (e) => {
  e.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k.startsWith(CACHE_PREFIX) && k !== CACHE)
            .map((k) => caches.delete(k))
      );
      await self.clients.claim();
      const clients = await self.clients.matchAll({ type: "window" });
      clients.forEach((c) => c.postMessage({ type: "UPDATED", build: BUILD }));
    })()
  );
});

/* ---- Beskeder fra siden ---- */
self.addEventListener("message", (e) => {
  if (e.data && e.data.type === "SKIP_WAITING") self.skipWaiting();
});

/* ---- Hent ------------------------------------------------------
   index.html + manifest: cachen først (lynhurtig og virker offline),
   men vi henter ALTID en frisk kopi i baggrunden bagefter. Bemærk
   'cache: "no-store"' — uden den kan værtens egen 10-minutters
   HTTP-cache finde på at give os en GAMMEL index.html tilbage og
   overskrive den friske, vi lige har installeret.
   Alt andet (ikoner, splash, skrifttyper): cachen først — de ændrer
   sig sjældent og behøver ikke tjekkes hver gang. */
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  let url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (url.protocol !== "http:" && url.protocol !== "https:") return;

  const sameOrigin = url.origin === self.location.origin;
  const wantsHTML = req.mode === "navigate" ||
    (req.headers.get("accept") || "").includes("text/html");

  if (sameOrigin && (wantsHTML || url.pathname.endsWith(".webmanifest"))) {
    e.respondWith(freshenInBackground(e, req, wantsHTML));
  } else {
    e.respondWith(cacheFirst(req));
  }
});

async function freshenInBackground(event, req, isHTML) {
  const cache = await caches.open(CACHE);
  const key = isHTML ? HTML_KEY : req.url;
  const cached = (await cache.match(key)) || (await cache.match(req));

  const fromNetwork = (async () => {
    const res = await fetch(new Request(req.url, { cache: "no-store" }));
    if (res && res.ok) await cache.put(key, res.clone());
    return res;
  })();

  if (cached) {
    // Svar med det samme, og hent den friske kopi færdig bagefter
    event.waitUntil(fromNetwork.catch(() => {}));
    return cached;
  }
  // Intet i vores egen cache. Virker nettet heller ikke, så led i ALLE cacher
  // efter en app-skal, før vi lader browseren vise sin fejlside.
  try {
    return await fromNetwork;
  } catch (err) {
    const nødskal = isHTML ? await caches.match(HTML_KEY) : null;
    if (nødskal) return nødskal;
    throw err;
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(req);
  if (cached) return cached;
  const res = await fetch(req);
  try {
    if (res && (res.ok || res.type === "opaque")) cache.put(req, res.clone()).catch(() => {});
  } catch (err) { /* fx skrifttyper der ikke kan gemmes — ikke kritisk */ }
  return res;
}
