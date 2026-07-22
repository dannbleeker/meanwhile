# Meanwhile — Samtalekort

En lille, installerbar web-app (PWA) med samtalekort til par. Man vælger et
tema og bladrer gennem kortene ét ad gangen. Appen husker, hvilke kort der er
brugt, virker offline og opdaterer sig selv, uden at nogen mister noget.

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
├─ index.html            # hele appen (UI + kortdata i DATA-objektet)
├─ sw.js                 # service worker (offline + stille opdatering)
├─ manifest.webmanifest  # app-navn, farver og ikoner
├─ icons/                # icon.svg, favicon-32, icon-192/512,
│                        # icon-maskable-512, apple-touch-icon-180
└─ splash/               # 9 iOS-splash-billeder (én pr. skærmstørrelse)
```

## Rediger kortene

Kortene ligger i `DATA`-objektet i `app/index.html` (søg efter `const DATA`).
Modellen er fri:
et vilkårligt antal `sets`, hvert med `title`, `description`, `emoji`/`image`,
`accent` og et vilkårligt antal `cards` (`id`, `title`, valgfri `text`/`image`).
Behold `id`'erne stabile over versioner — de bruges til at huske "brugt"-status.

## Hukommelse

Brugte kort gemmes lokalt i `localStorage` på enheden og nulstilles inde i
appen (pr. tema eller for alle).

### Færdige kort forbliver færdige — også efter en opdatering

"Brugt/færdig"-status huskes pr. kort-`id`. Så længe et kort beholder sit `id`,
overlever dets status enhver opdatering (en opdatering rører kun appens
filcacher, aldrig `localStorage`). Det hele står og falder derfor med, at
`id`'erne er stabile — og det overlades ikke til hukommelsen:

- `scripts/check-ids.mjs` fejler, hvis to kort deler `id` (så ville status smitte
  mellem dem), eller hvis et `id`, der er sendt ud før, forsvinder eller bliver
  omdøbt (så ville kortet miste sin historik).
- Tjekket kører i CI på hver PR og hvert push til `main`
  ([`check-ids.yml`](.github/workflows/check-ids.yml)) og igen som en spærre
  lige før udgivelsen ([`pages.yml`](.github/workflows/pages.yml)) — en id-fejl
  når aldrig ud til nogen.
- `scripts/known-card-ids.json` er hovedbogen over id'er, vi har sendt ud.

Nye kort må du tilføje frit — nye `id`'er fejler aldrig. Retter du kun teksten
på et kort, så behold `id`'et. **Pensionerer** du bevidst et kort (fjerner
`id`'et helt), så bekræft det med:

```bash
node scripts/check-ids.mjs --write   # opdaterer hovedbogen og committer den
```

Lokalt advarer appen dig også i konsollen, hvis to kort deler `id`.

## Udgiv en ny version

**Ret og push — resten sker af sig selv.**

1. Ret indhold/kode i `app/index.html` (nye kort, nye temaer, rettelser).
2. Commit og push til `main`.

GitHub Actions stempler et build-id ind i `app/sw.js` og `app/index.html` og
lægger appen op. Der er **ingen cache-tal at hæve** — en ændring i `app/` er i
sig selv den nye version. Hæv kun `APP_VERSION` i `index.html`, når du synes,
ændringen er værd at nævne; det er kun en etiket.

Build-id'et er **tree-hashen for `app/`** (`git rev-parse HEAD:app`), ikke
commit-sha'en. Det er med vilje: retter du kun README eller workflowet, er
id'et uændret, og ingen får en "ny version" ned og henter appen igen uden
grund. Ændrer du derimod bare ét tegn i `app/`, er id'et nyt, og alle får den.

Konsekvensen er, at **den deployede `app/sw.js` og `app/index.html` ikke er
byte-identiske med kilden i repoet** — pladsholderen `__BUILD__` er erstattet.
Sammenligner du en fil fra <https://meanwhile.retailforever.com/> med repoet,
er den ene linje altså forskellig med vilje. Workflowet fejler, hvis
pladsholderen mangler, så stemplingen ikke kan forsvinde ubemærket.

### Tjek at en udgivelse er landet

```bash
git rev-parse HEAD:app | cut -c1-12                     # forventet build-id
curl -s https://meanwhile.retailforever.com/sw.js | grep 'const BUILD'
```

De to skal stemme. Gør de det, har alle installerede apps den nye version
næste gang, de er på forsiden. Er build-id'et uændret efter et push, ændrede
du ikke noget i `app/` — og så skal ingen heller have en opdatering.

## Sådan opdaterer installerede apps sig selv

Opdateringen sker stille, uden at spørge:

1. Appen tjekker efter nye filer, hver gang den åbnes, hver gang den hentes
   frem igen — og hvert 30. minut, mens den er åben.
2. Den nye version hentes i baggrunden og bliver aktiv med det samme.
3. Selve skiftet sker først, når I er på **forsiden** uden åben dialog. Ingen
   bliver afbrudt midt i et kort, og der kommer ikke noget "vil du opdatere?".
   Er I midt i et tema, kommer den nye version, næste gang I lukker tilbage til
   forsiden eller åbner appen igen.
4. Er der kommet nye kort, siger appen kort til bagefter ("Opdateret ✓ 12 nye
   kort er kommet til").

Linket "Søg efter opdatering" nederst på forsiden gør det samme med det samme.

### Hvad sker der med brugtes kort og indstillinger?

Ingenting — de overlever. Brugte kort, favoritter, tema og "fortsæt her"
ligger i `localStorage` og bliver aldrig rørt af en opdatering; kun appens egne
filcacher ryddes. To ting holder det i live over tid:

- **Behold `id`'erne stabile.** `used`/`favorit` huskes pr. kort-`id` og pr.
  sæt-`id`. Ændrer du teksten på et kort, beholder det sin historik; giver du
  det et nyt `id`, tæller det som et nyt kort (som det skal, hvis spørgsmålet
  reelt er nyt).
- **Tilføj frit.** Nye kort og nye temaer dukker bare op som ubrugte. Du må
  gerne indsætte et nyt tema midt i rækken — "fortsæt her" gemmes på sæt-`id`,
  ikke på pladsen i rækken (gamle installationer flyttes automatisk over ved
  første start på den nye version).

## Deploy

`app/` publiceres til GitHub Pages af
[`.github/workflows/pages.yml`](.github/workflows/pages.yml) ved hvert push til
`main` (og kan køres manuelt via *Actions → Run workflow*). Der er intet
build-trin — mappen uploades, som den er, bortset fra at build-id'et stemples
ind undervejs.

Opsætningen: *Settings → Pages → Source* er sat til **GitHub Actions**, og
custom domain er `meanwhile.retailforever.com` med *Enforce HTTPS* slået til.
DNS er en `CNAME`-record `meanwhile` → `dannbleeker.github.io` hos Simply.com.
Der skal ikke ligge en `CNAME`-fil i repoet; ved Actions-deploy ignorerer
GitHub den. `dannbleeker.github.io/meanwhile/` redirecter til domænet.
