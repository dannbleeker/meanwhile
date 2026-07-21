# Meanwhile — Samtalekort

En lille, installerbar web-app (PWA) med samtalekort til par. Man vælger et
tema og bladrer gennem kortene ét ad gangen. Appen husker, hvilke kort der er
brugt, virker offline og kan opdateres til nye versioner.

Alt ligger i mappen [`app/`](app/) og er ren HTML/CSS/JS uden build-trin.

## Kør lokalt

En service worker kræver `http(s)` (ikke `file://`). Start en simpel server:

```bash
cd app
python3 -m http.server 8000
# åbn http://localhost:8000
```

## Struktur

```
app/
├─ index.html            # hele appen (UI + kortdata i DATA-objektet nederst)
├─ sw.js                 # service worker (offline + versionsopdatering)
├─ manifest.webmanifest  # app-navn, farver og ikon
└─ icons/
   └─ icon.svg           # app-ikon
```

## Rediger kortene

Kortene ligger i `DATA`-objektet nederst i `app/index.html`. Modellen er fri:
et vilkårligt antal `sets`, hvert med `title`, `description`, `emoji`/`image`,
`accent` og et vilkårligt antal `cards` (`id`, `title`, valgfri `text`/`image`).
Behold `id`'erne stabile over versioner — de bruges til at huske "brugt"-status.

## Hukommelse

Brugte kort gemmes lokalt i `localStorage` på enheden og nulstilles inde i
appen (pr. tema eller for alle).

## Udgiv en ny version

1. Ret indhold/kode i `app/index.html` (og evt. `APP_VERSION`).
2. Hæv cache-tallet i `app/sw.js`, fx `samtalekort-v1` → `samtalekort-v2`.
3. Commit/push. Installerede apps viser "Ny version klar — genindlæs".

## Deploy (senere)

Repoet er sat op til udvikling, ikke publicering. Skal den hostes, kan `app/`
serveres statisk fra fx GitHub Pages, Netlify eller Cloudflare Pages.

## Note om ikoner

Ikonet er SVG, hvilket dækker Android/desktop-installation. Vil du have det
skarpeste hjemmeskærms-ikon på iOS, kan der tilføjes PNG-ikoner
(`icon-192.png`, `icon-512.png`, `apple-touch-icon-180.png`) i `app/icons/` og
tilsvarende linjer i `manifest.webmanifest` og `index.html`.
