// The diff checker UI. Every test also holds the page to INTENT.md: no
// request after load, no console errors, no content in storage.
import { expect, test as base, type Page } from "@playwright/test";
import { storedOutsideUi, watchConsole, watchNetwork } from "./helpers";

const test = base.extend<{ app: Page }>({
  app: async ({ page, baseURL }, use) => {
    const origin = new URL(baseURL!).origin;
    const offending = watchNetwork(page, origin);
    const errors = watchConsole(page);
    await page.goto("diff.html");
    await page.waitForLoadState("networkidle");

    const requests: string[] = [];
    page.on("request", (r) => {
      if (!/^(blob|data):/.test(r.url())) requests.push(r.url());
    });

    await use(page);

    expect(offending).toEqual([]);
    expect(requests).toEqual([]);
    expect(errors).toEqual([]);
    expect(await storedOutsideUi(page)).toEqual([]);
  },
});

const a = (page: Page) => page.getByRole("textbox", { name: "Text 1" });
const b = (page: Page) => page.getByRole("textbox", { name: "Text 2" });
const status = (page: Page) => page.getByRole("status");
const rows = (page: Page) => page.locator("[data-kind]");
const button = (page: Page, name: string) => page.getByRole("button", { name, exact: true });

/** An article of `n` numbered paragraphs, with some replaced. */
function article(n: number, edits: Record<number, string> = {}) {
  return Array.from({ length: n }, (_, i) => edits[i + 1] ?? `Stycke ${i + 1} står kvar som det var.`).join("\n");
}

test("compares as you type, with no button", async ({ app }) => {
  await expect(app.getByRole("button", { name: /Visa diff|Jämför/ })).toHaveCount(0);
  await a(app).fill("ett\ntvå\ntre");
  await expect(app.getByText("Klistra in text 2 för att jämföra.")).toBeVisible();
  await b(app).fill("ett\ntvå ändrad\ntre\nfyra");
  await expect(status(app)).toContainText("2 skillnader");
  await expect(status(app)).toContainText("Rader: 1 ändrad, 1 tillagd");

  // An edit updates the result by itself.
  await b(app).fill("ett\ntvå\ntre");
  await expect(status(app)).toHaveText("Texterna är identiska3 rader jämförda, tecken för tecken");
  await expect(rows(app)).toHaveCount(0);

  await a(app).fill("");
  await expect(status(app)).toHaveCount(0);
  await expect(app.getByText("Klistra in text 1 för att jämföra.")).toBeVisible();
});

test("inline view marks the words inside a changed line", async ({ app }) => {
  await a(app).fill("Den snabba bruna räven.\nBorta.");
  await b(app).fill("Den långsamma bruna räven.");
  const changed = rows(app).first();
  await expect(changed).toHaveAttribute("data-kind", "change");
  await expect(changed.locator("del")).toHaveText("(borttaget: snabba)");
  await expect(changed.locator("ins")).toHaveText("(tillagt: långsamma)");
  const removed = rows(app).nth(1);
  await expect(removed).toHaveAttribute("data-kind", "delete");
  await expect(removed.locator("del")).toHaveText("Borta.");
});

test("hidden characters inside a difference are drawn and named", async ({ app }) => {
  await a(app).fill("Pris: 12 000 kr");
  await b(app).fill("Pris: 12\u00a0000 kr");
  const mark = rows(app).first().locator("ins");
  const nbsp = mark.getByText("°[hårt mellanslag]");
  await expect(nbsp).toBeVisible();
  await nbsp.hover();
  await expect(app.getByRole("tooltip")).toHaveText("hårt mellanslag");
  // A whitespace-only difference shows its plain space too.
  await expect(rows(app).first().locator("del")).toHaveText("(borttaget: ·[mellanslag])");
});

test("unchanged runs fold around each difference and open in place", async ({ app }) => {
  await a(app).fill(article(40));
  await b(app).fill(article(40, { 10: "Stycke tio har skrivits om.", 30: "Stycke trettio har skrivits om." }));
  await expect(status(app)).toContainText("2 skillnader");
  // 8 lines before the first change, 18 between, 9 after, each less one
  // line of context per side.
  await expect(button(app, "8 oförändrade rader")).toBeVisible();
  await expect(button(app, "17 oförändrade rader")).toBeVisible();
  await expect(button(app, "9 oförändrade rader")).toBeVisible();
  await expect(rows(app)).toHaveCount(6);

  await button(app, "17 oförändrade rader").click();
  await expect(rows(app)).toHaveCount(23);
  await expect(button(app, "17 oförändrade rader")).toHaveCount(0);
});

test("steps through the differences with the buttons and Alt+arrows", async ({ app }) => {
  await a(app).fill(article(60));
  await b(app).fill(article(60, { 5: "Fem.", 30: "Trettio.", 55: "Femtiofem." }));
  await expect(status(app)).toContainText("3 skillnader");
  const nav = app.getByRole("group", { name: "Skillnader" });
  await expect(nav).toContainText("Gå till skillnad");
  await button(app, "Nästa skillnad").hover();
  await expect(app.getByRole("tooltip")).toHaveText("Nästa skillnadAlt↓");

  await button(app, "Nästa skillnad").click();
  await expect(nav).toContainText("Skillnad 1 av 3");
  const first = app.locator('[data-block-start="0"]');
  await expect(first).toBeFocused();
  await expect(first).toBeInViewport();

  await app.keyboard.press("Alt+ArrowDown");
  await app.keyboard.press("Alt+ArrowDown");
  await expect(nav).toContainText("Skillnad 3 av 3");
  await expect(app.locator('[data-block-start="2"]')).toBeInViewport();
  // It wraps around.
  await app.keyboard.press("Alt+ArrowDown");
  await expect(nav).toContainText("Skillnad 1 av 3");
  await button(app, "Föregående skillnad").click();
  await expect(nav).toContainText("Skillnad 3 av 3");
  await expect(app.getByText("Skillnad 3 av 3", { exact: true }).last()).toBeAttached();

  // Stepping from a text field leaves the focus there.
  await a(app).focus();
  await app.keyboard.press("Alt+ArrowUp");
  await expect(nav).toContainText("Skillnad 2 av 3");
  await expect(a(app)).toBeFocused();
});

test("one difference gets no stepping controls", async ({ app }) => {
  await a(app).fill(article(60));
  await b(app).fill(article(60, { 30: "Trettio." }));
  await expect(status(app)).toContainText("1 skillnad");
  await expect(app.getByRole("group", { name: "Skillnader" })).toHaveCount(0);
  await expect(app.getByText("Gå till skillnad")).toHaveCount(0);
});

test("switches to side by side and back", async ({ app }) => {
  await a(app).fill("ett\ntvå\ntre");
  await b(app).fill("ett\nTVÅ\ntre\nfyra");
  await expect(button(app, "Inline")).toHaveAttribute("aria-pressed", "true");
  await expect(app.locator("table")).toHaveCount(0);

  await button(app, "Sida vid sida").click();
  await expect(button(app, "Sida vid sida")).toHaveAttribute("aria-pressed", "true");
  const table = app.locator("table");
  await expect(table.locator("tbody tr")).toHaveCount(4);
  const inserted = table.locator('tr[data-kind="insert"] td');
  // The empty side is one hatched cell, then the line number and text.
  await expect(inserted).toHaveCount(3);
  await expect(inserted.nth(2)).toHaveText("Tillagd rad: fyra");

  // The choice holds across new results.
  await b(app).fill("ett\nTVÅ\ntre");
  await expect(status(app)).toContainText("1 skillnad");
  await expect(table.locator("tbody tr")).toHaveCount(3);
});

test("phones get the inline view with no switch", async ({ app }) => {
  await app.setViewportSize({ width: 390, height: 844 });
  await a(app).fill("ett\ntvå");
  await b(app).fill("ett\nTVÅ");
  await expect(status(app)).toContainText("1 skillnad");
  await expect(app.getByRole("group", { name: "Visning" })).toHaveCount(0);
  await expect(app.locator("table")).toHaveCount(0);
  const width = await app.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(390);
});

test("a slow comparison hands over to Ctrl+Enter and dims the old result", async ({ app }) => {
  // Make every comparison look slow.
  await app.evaluate(() => {
    const now = performance.now.bind(performance);
    let t = 0;
    performance.now = () => (t += 500) + now() * 0;
  });
  await a(app).fill("ett");
  await b(app).fill("två");
  await expect(status(app)).toContainText("1 skillnad");

  await b(app).fill("tre");
  await expect(status(app)).toContainText("Texten har ändrats");
  await expect(status(app)).toContainText("Ctrl Enter");
  await expect(rows(app).first().locator("ins")).toHaveText("(tillagt: två)");

  await app.keyboard.press("Control+Enter");
  await expect(status(app)).toContainText("1 skillnad");
  await expect(rows(app).first()).toContainText("tre");
});
