# Meanwhile — Samtalekort

En lille, installerbar web-app (PWA) med samtalekort til par. Man vælger et
tema og bladrer gennem kortene ét ad gangen. Appen husker, hvilke kort der er
brugt, virker offline og kan opdateres til nye versioner.

Live: **https://meanwhile.retailforever.com/**

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
├─ manifest.webmanifest  # app-navn, farver og ikoner
├─ icons/                # icon.svg, favicon-32, icon-192/512,
│                        # icon-maskable-512, apple-touch-icon-180
└─ splash/               # 9 iOS-splash-billeder (én pr. skærmstørrelse)
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
3. Commit/push til `main`. Deploy kører automatisk, og installerede apps
   viser "Ny version klar — genindlæs".

Trin 2 er ikke valgfrit. Browseren opdager kun en ny version, hvis selve
`sw.js` er ændret — og service workeren serverer cache-first. Pusher du
en ændring i `index.html` uden at røre `sw.js`, bliver den udgivet, men
installerede apps bliver ved med at vise den gamle udgave.

## Deploy

`app/` publiceres til GitHub Pages af
[`.github/workflows/pages.yml`](.github/workflows/pages.yml) ved hvert push til
`main` (og kan køres manuelt via *Actions → Run workflow*). Der er intet
build-trin — mappen uploades som den er.

Opsætningen: *Settings → Pages → Source* er sat til **GitHub Actions**, og
custom domain er `meanwhile.retailforever.com` med *Enforce HTTPS* slået til.
DNS er en `CNAME`-record `meanwhile` → `dannbleeker.github.io` hos Simply.com.
Der skal ikke ligge en `CNAME`-fil i repoet; ved Actions-deploy ignorerer
GitHub den. `dannbleeker.github.io/meanwhile/` redirecter til domænet.
