// Specialtecken: search, choose by click, copy by button and by Enter, the
// category menu.
// Every test also holds the page to INTENT.md: no request after load, no
// console errors, nothing stored outside sidebench:site:*.
import { expect, test as base, type Page } from "@playwright/test";
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
const clipboard = (page: Page) => page.evaluate(() => navigator.clipboard.readText());

test("the search field has focus, and Enter copies the top match", async ({ app }) => {
  await expect(searchBox(app)).toBeFocused();
  await app.keyboard.type("em dash");
  await expect(app.getByRole("heading", { name: "Långt tankstreck" })).toBeVisible();
  await app.keyboard.press("Enter");
  expect(await clipboard(app)).toBe("—");
  await expect(app.getByRole("status")).toHaveText("Kopierat: Långt tankstreck");
});

test("a click chooses a character, the button copies it", async ({ app }) => {
  await app.evaluate(() => navigator.clipboard.writeText("x"));
  await tile(app, "Grader").click();
  await expect(app.getByRole("heading", { name: "Grader" })).toBeVisible();
  expect(await clipboard(app)).toBe("x");
  await app.getByRole("button", { name: "Kopiera tecken" }).click();
  expect(await clipboard(app)).toBe("°");
  await expect(app.getByRole("button", { name: "Kopierat!" })).toBeVisible();
});

test("Enter on a tile copies it, a lookalike is chosen by click", async ({ app }) => {
  await app.keyboard.press("ArrowDown");
  await app.keyboard.press("Enter");
  expect(await clipboard(app)).toBe("–");
  await app.getByRole("button", { name: "Minus, U+2212" }).click();
  await expect(app.getByRole("heading", { name: "Minus", exact: true })).toBeVisible();
});

test("the category menu narrows the grid", async ({ app }) => {
  await app.getByRole("button", { name: "Kategori: Alla" }).click();
  await app.getByRole("button", { name: "Pilar", exact: true }).click();
  await expect(app.getByRole("button", { name: "Kategori: Pilar och former" })).toBeVisible();
  await expect(app.getByRole("heading", { name: "Pilar och former" })).toBeVisible();
  await expect(app.getByRole("heading", { name: "Typografi" })).toHaveCount(0);
});

test("an unknown search says so", async ({ app }) => {
  await searchBox(app).fill("qqzz");
  await expect(app.getByText("Inga tecken matchar ”qqzz”.")).toBeVisible();
});

test("a single pasted character shows its code point in the search bar", async ({ app }) => {
  const code = app.getByTitle("Kodpunkt", { exact: true });
  await searchBox(app).fill("-");
  await expect(code).toHaveText("U+002D");
  await searchBox(app).fill("\u00a0");
  await expect(code).toHaveText("U+00A0");
  await searchBox(app).fill("p");
  await expect(code).toHaveCount(0);
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
