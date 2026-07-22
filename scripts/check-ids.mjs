#!/usr/bin/env node
/* ================================================================
   check-ids.mjs — vogter over kort-id'ernes stabilitet og temaerne
   ----------------------------------------------------------------
   HVORFOR: "Brugt/færdig"-status huskes lokalt pr. kort-`id` i
   localStorage (nøglen samtalekort:used:v1). Så længe et kort
   beholder sit id, overlever dets status enhver opdatering — det
   er hele forudsætningen for, at færdige kort BLIVER færdige efter
   en opdatering.

   To ting kan bryde det stille, uden at nogen opdager det før
   brugerne har mistet deres status:

     1. To kort får SAMME id (fx en copy-paste). Så deler de status:
        markér det ene brugt, og det andet ser også brugt ud.
     2. Et id, der allerede er sendt ud, FORSVINDER eller bliver
        omdøbt. Så mister det kort sin historik ved næste opdatering.

   Dertil vogter scriptet forsidens TEMAER: hvert sæt skal have et
   'group', der findes i GROUPS, ellers ville kategorien forsvinde
   fra den grupperede forside.

   BRUG:
     node scripts/check-ids.mjs          # tjek (bruges i CI)
     node scripts/check-ids.mjs --write   # opdatér hovedbogen bevidst
                                          # (fx når et kort er pensioneret)

   Tilføj kort og kategorier frit — nye id'er må gerne dukke op og
   fejler aldrig. Kun DUBLETTER, FORSVUNDNE id'er og kategorier uden
   et gyldigt tema stopper bygningen.
   ================================================================ */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const INDEX = join(HERE, "..", "app", "index.html");
const LEDGER = join(HERE, "known-card-ids.json");
const WRITE = process.argv.includes("--write");

/* ---- Træk et rent litteral (DATA, GROUPS) ud af index.html
   Det er rene objekt-/array-litteraler (kun strenge og tal), så vi kan
   klippe dem ud med en klammematchning, der springer strenge over, og
   evaluere dem i en sandkasse uden bivirkninger. */
function sliceLiteral(html, fromIndex, open, close) {
  const start = html.indexOf(open, fromIndex);
  if (start === -1) throw new Error("fandt ikke '" + open + "' efter position " + fromIndex);
  let depth = 0, quote = null, escaped = false;
  for (let i = start; i < html.length; i++) {
    const ch = html[i];
    if (quote) {
      if (escaped) { escaped = false; continue; }
      if (ch === "\\") { escaped = true; continue; }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") { quote = ch; continue; }
    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return html.slice(start, i + 1);
    }
  }
  throw new Error("fandt ikke slutningen på litteralet for '" + open + close + "'");
}
function evalConst(html, name, open, close) {
  const at = html.indexOf("const " + name + " =");
  if (at === -1) throw new Error("kunne ikke finde 'const " + name + "' i app/index.html");
  const text = sliceLiteral(html, at, open, close);
  // eslint-disable-next-line no-new-func
  return Function('"use strict"; return (' + text + ");")();
}

/* ---- Saml id'er og find dubletter ------------------------------ */
function collect(data) {
  const cards = [];
  const sets = [];
  const dupCards = new Set();
  const dupSets = new Set();
  const seenCards = new Set();
  const seenSets = new Set();

  for (const set of data.sets || []) {
    if (set.id == null) throw new Error("et sæt mangler id: " + JSON.stringify(set.title));
    if (seenSets.has(set.id)) dupSets.add(set.id); else seenSets.add(set.id);
    sets.push(set.id);
    for (const card of set.cards || []) {
      if (card.id == null) throw new Error("et kort mangler id i sæt '" + set.id + "'");
      if (seenCards.has(card.id)) dupCards.add(card.id); else seenCards.add(card.id);
      cards.push(card.id);
    }
  }
  return {
    cards: [...new Set(cards)].sort(),
    sets: [...new Set(sets)].sort(),
    dupCards: [...dupCards].sort(),
    dupSets: [...dupSets].sort(),
  };
}

function loadLedger() {
  try {
    const raw = JSON.parse(readFileSync(LEDGER, "utf8"));
    return { cards: raw.cards || [], sets: raw.sets || [] };
  } catch {
    return { cards: [], sets: [] };
  }
}

function main() {
  const html = readFileSync(INDEX, "utf8");
  const data = evalConst(html, "DATA", "{", "}");
  const now = collect(data);

  // Strukturfejl — altid en fejl, uanset --write.
  const structural = [];
  if (now.dupCards.length) structural.push("Kort-id'er brugt mere end én gang: " + now.dupCards.join(", "));
  if (now.dupSets.length) structural.push("Sæt-id'er brugt mere end én gang: " + now.dupSets.join(", "));

  // Temaer: hver kategori (sæt) skal have et 'group', der findes i GROUPS.
  const groups = evalConst(html, "GROUPS", "[", "]");
  const groupIds = new Set(groups.map((g) => g.id));
  const missingGroup = data.sets.filter((s) => s.group == null).map((s) => s.id);
  const badGroup = data.sets.filter((s) => s.group != null && !groupIds.has(s.group)).map((s) => s.id + "→" + s.group);
  if (missingGroup.length) structural.push(
    "Kategorier uden tema (mangler feltet 'group'): " + missingGroup.join(", ") +
    "\n    -> Giv hver ny kategori et 'group' med et tema-id fra GROUPS."
  );
  if (badGroup.length) structural.push(
    "Kategorier med et 'group', der ikke findes i GROUPS: " + badGroup.join(", ")
  );

  // Forsvundne id'er — id'er, vi har sendt ud før, men som er væk nu.
  const ledger = loadLedger();
  const nowCards = new Set(now.cards);
  const nowSets = new Set(now.sets);
  const goneCards = ledger.cards.filter((id) => !nowCards.has(id));
  const goneSets = ledger.sets.filter((id) => !nowSets.has(id));

  if (WRITE) {
    writeFileSync(LEDGER, JSON.stringify({ cards: now.cards, sets: now.sets }, null, 2) + "\n");
    console.log(`Hovedbog opdateret: ${now.cards.length} kort-id'er, ${now.sets.length} kategori-id'er.`);
    if (structural.length) {
      console.error("\nADVARSEL: der er stadig strukturfejl, som du skal rette:");
      structural.forEach((p) => console.error("  - " + p));
      process.exit(1);
    }
    return;
  }

  // structural bruges ikke efter WRITE-grenen (som returnerer), så vi må gerne
  // bygge videre på selve arrayet her.
  const problems = structural;
  if (goneCards.length) {
    problems.push(
      "Kort-id'er, der er sendt ud før, men mangler nu: " + goneCards.join(", ") +
      "\n    -> Skift ALDRIG et korts id (så mister kortet sin brugt-status ved næste opdatering)." +
      "\n       Rettede du bare teksten? Sæt id'et tilbage." +
      "\n       Pensionerede du kortet med vilje? Kør: node scripts/check-ids.mjs --write"
    );
  }
  if (goneSets.length) {
    problems.push(
      "Kategori-id'er, der er sendt ud før, men mangler nu: " + goneSets.join(", ") +
      "\n    -> Sæt id'et tilbage, eller bekræft ændringen med: node scripts/check-ids.mjs --write"
    );
  }

  if (problems.length) {
    console.error("check-ids: kort-id'ernes stabilitet eller temaerne er brudt —\n");
    problems.forEach((p) => console.error("  - " + p + "\n"));
    process.exit(1);
  }

  const added = now.cards.filter((id) => !ledger.cards.includes(id)).length;
  console.log(
    `check-ids: OK — ${now.cards.length} kort-id'er, ${now.sets.length} kategorier i ${groups.length} temaer, ingen dubletter, ingen forsvundne.` +
    (added ? ` (${added} nye kort siden hovedbogen — helt fint.)` : "")
  );
}

main();
