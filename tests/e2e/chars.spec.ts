// Specialtecken: search, copy by click and by Enter, the per-tab recents.
// Every test also holds the page to INTENT.md: no request after load, no
// console errors, nothing stored outside sidebench:site:*.
import { expect, test as base, type Locator, type Page } from "@playwright/test";
import { storedOutsideUi, watchConsole, watchNetwork } from "./helpers";

const test = base.extend<{ app: Page }>({
  app: async ({ page, context, baseURL }, use) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const offending = watchNetwork(page, new URL(baseURL!).origin);
    const errors = watchConsole(page);
    await page.goto("chars.html");
    await page.waitForLoadState("networkidle");

    await use(page);

    expect(offending).toEqual([]);
    expect(errors).toEqual([]);
    expect(await storedOutsideUi(page)).toEqual([]);
  },
});

const searchBox = (page: Page) => page.getByRole("searchbox", { name: "Sök tecken" });
const tile = (page: Page, name: string) => page.getByRole("button", { name, exact: true }).first();
/** Distance from the top of the document, unaffected by scrolling. */
const docTop = (l: Locator) => l.evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
const clipboard = (page: Page) => page.evaluate(() => navigator.clipboard.readText());

test("the search field has focus, and Enter copies the top match", async ({ app }) => {
  await expect(searchBox(app)).toBeFocused();
  await app.keyboard.type("em dash");
  await expect(app.getByRole("heading", { name: "Långt tankstreck" })).toBeVisible();
  await app.keyboard.press("Enter");
  expect(await clipboard(app)).toBe("—");
  await expect(app.getByRole("status")).toHaveText("Kopierat: Långt tankstreck");
});

test("a click copies the character, the HTML button its entity", async ({ app }) => {
  await tile(app, "Grader").click();
  expect(await clipboard(app)).toBe("°");
  await app.getByRole("button", { name: "HTML" }).click();
  expect(await clipboard(app)).toBe("&deg;");
});

test("an unknown search says so", async ({ app }) => {
  await searchBox(app).fill("qqzz");
  await expect(app.getByText("Inga tecken matchar ”qqzz”.")).toBeVisible();
});

test("arrow keys move through the grid and typing returns to the search", async ({ app }) => {
  await app.keyboard.press("ArrowDown");
  await expect(tile(app, "Kort tankstreck")).toBeFocused();
  await app.keyboard.press("ArrowRight");
  await expect(tile(app, "Långt tankstreck")).toBeFocused();
  await app.keyboard.type("p");
  await expect(searchBox(app)).toBeFocused();
  await expect(searchBox(app)).toHaveValue("p");
});

test("recently copied characters show at once and survive a reload", async ({ app }) => {
  const recent = app.getByRole("region", { name: "Senast kopierade" });
  await expect(recent).toContainText("Tecken du kopierar hamnar här.");
  const top = await docTop(tile(app, "Kort tankstreck"));

  await tile(app, "Pil höger").click();
  await expect(recent.getByRole("button", { name: "Pil höger" })).toBeVisible();
  // The grid below didn't move.
  expect(await docTop(tile(app, "Kort tankstreck"))).toBe(top);

  await tile(app, "Grader").click();
  await recent.getByRole("button", { name: "Pil höger" }).click();
  expect(await app.evaluate(() => sessionStorage.getItem("sidebench:site:chars:recent"))).toBe('["°","→"]');

  await app.reload();
  await expect(recent.getByRole("button", { name: "Grader" })).toBeVisible();
});
