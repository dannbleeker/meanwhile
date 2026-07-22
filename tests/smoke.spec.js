// Smoke tests for the Meanwhile front page. These cover rendered behaviour —
// the class of bug (a view that doesn't actually switch) that plain unit checks
// and the id-guard can't catch. Each test runs in an isolated browser context,
// so localStorage starts clean unless the test seeds it.
const { test, expect } = require("@playwright/test");

const HOME = "/index.html";
const display = (locator) => locator.evaluate((el) => getComputedStyle(el).display);

// Seed settings BEFORE the page loads. Defaults to seenIntro:true so opening a
// kategori doesn't raise the first-run intro dialog over the card we click.
async function seedOpt(page, extra = {}) {
  await page.addInitScript((o) => {
    try { localStorage.setItem("samtalekort:opt:v1", JSON.stringify(o)); } catch (e) {}
  }, Object.assign({ schema: 3, seenIntro: true, homeView: "temaer", groupState: {} }, extra));
}

test("home shows the 5 temaer with kategori counts", async ({ page }) => {
  await page.goto(HOME);
  await expect(page.locator("#temaSections .tema-head h2")).toHaveText([
    "For jer to",
    "Dig selv & eftertanke",
    "Til børn",
    "Venner & sjov",
    "Anledninger & hverdag",
  ]);
  await expect(page.locator("#temaSections .tema-count").first()).toContainText("9 kategorier");
});

test("the view toggle actually switches the visible view", async ({ page }) => {
  await page.goto(HOME);
  const sections = page.locator("#temaSections");
  const grid = page.locator("#setGrid");

  expect(await display(sections)).not.toBe("none");
  expect(await display(grid)).toBe("none");
  await expect(page.locator("#viewTemaerBtn")).toHaveAttribute("aria-selected", "true");

  await page.locator("#viewAlleBtn").click();
  expect(await display(grid)).not.toBe("none");
  expect(await display(sections)).toBe("none");
  await expect(page.locator("#setGrid .set-card")).toHaveCount(27);
  await expect(page.locator("#viewAlleBtn")).toHaveAttribute("aria-selected", "true");

  await page.locator("#viewTemaerBtn").click();
  expect(await display(sections)).not.toBe("none");
  expect(await display(grid)).toBe("none");
});

test("arrow keys move between the toggle tabs", async ({ page }) => {
  await page.goto(HOME);
  await page.locator("#viewTemaerBtn").focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("#viewAlleBtn")).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#setGrid")).toBeVisible();
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator("#viewTemaerBtn")).toHaveAttribute("aria-selected", "true");
});

test("a deep link opens the right kategori", async ({ page }) => {
  await seedOpt(page);
  await page.goto(HOME + "#/k/os-to");
  await expect(page.locator("#deckScreen")).toHaveClass(/active/);
  await expect(page.locator("#setLabel")).toHaveText("Os to — gode stunder");
});

test("browser back from a kategori returns to the front page", async ({ page }) => {
  await seedOpt(page);
  await page.goto(HOME);
  await page.locator("#temaSections .tema").first().locator(".tema-head").click();
  await page.locator("#temaSections .tema").first().locator(".set-open").first().click();
  await expect(page.locator("#deckScreen")).toHaveClass(/active/);
  await page.goBack();
  await expect(page.locator("#homeScreen")).toBeVisible();
  await expect(page.locator("#deckScreen")).not.toHaveClass(/active/);
});

test("marking a card as used survives a reload (completed stays completed)", async ({ page }) => {
  await seedOpt(page);
  await page.goto(HOME + "#/k/os-to");
  const usedBtn = page.locator("#stage .card-used-btn").first();
  await usedBtn.click();
  await expect(usedBtn).toHaveText(/Brugt/);
  await page.reload();
  await expect(page.locator("#stage .card-used-btn").first()).toHaveText(/Brugt/);
});

test("the resume tema auto-expands on load", async ({ page }) => {
  await seedOpt(page, { last: { setId: "god-ven", cardId: "c390" } });
  await page.goto(HOME);
  await expect(page.locator("#temaSections .tema.open .tema-head h2")).toHaveText(["Venner & sjov"]);
});

test("a tema header shows aggregate brugt progress", async ({ page }) => {
  await seedOpt(page);
  await page.goto(HOME + "#/k/fremtid");
  await page.locator("#stage .card-used-btn").first().click();
  await page.locator("#backBtn").click();
  await expect(page.locator("#temaSections .tema").first().locator(".tema-count")).toContainText("brugt");
});
