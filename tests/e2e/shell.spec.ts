// The shared shell: sidebar nav from the registry, theme and sidebar state,
// and INTENT.md's storage rule (UI state only, under sidebench:site:*, no
// cookies).
import { expect, test, type Page } from "@playwright/test";
import { tools } from "../../src/tools/registry";
import { watchConsole } from "./helpers";

const live = tools.filter((t) => t.href);
const planned = tools.filter((t) => !t.href);

const nav = (page: Page) => page.locator('[data-slot="sidebar"]');
const html = (page: Page) => page.locator("html");

async function storedKeys(page: Page) {
  return page.evaluate(() => Object.keys(localStorage));
}

test.describe("navigation", () => {
  for (const tool of live) {
    test(`${tool.slug}: sidebar lists every tool and marks this one`, async ({ page }) => {
      await page.goto(tool.href!);
      for (const t of live) {
        await expect(nav(page).getByRole("link", { name: t.name })).toHaveAttribute("href", t.href!);
      }
      for (const t of planned) {
        await expect(nav(page).getByRole("button", { name: t.name })).toBeDisabled();
      }
      await expect(nav(page).locator('[aria-current="page"]')).toHaveText(tool.name);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(tool.name);
    });
  }

  test("landing page lists every tool", async ({ page }) => {
    await page.goto("./");
    const main = page.locator("main");
    for (const t of live) {
      await expect(main.getByRole("link", { name: new RegExp(t.name) })).toHaveAttribute("href", t.href!);
    }
    for (const t of planned) {
      await expect(main.getByRole("heading", { name: t.name })).toBeVisible();
      await expect(main.getByRole("link", { name: new RegExp(t.name) })).toHaveCount(0);
    }
  });
});

test.describe("theme", () => {
  test("follows the system until chosen", async ({ browser }) => {
    for (const colorScheme of ["light", "dark"] as const) {
      const page = await browser.newPage({ colorScheme });
      await page.goto("./");
      await expect(html(page)).toHaveClass(colorScheme === "dark" ? /\bdark\b/ : /^(?!.*\bdark\b)/);
      await page.close();
    }
  });

  test("toggle is saved and applied before the app loads", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("text.html");
    await page.getByRole("button", { name: "Mörkt läge" }).click();
    await expect(html(page)).toHaveClass(/\bdark\b/);
    expect(await page.evaluate(() => localStorage.getItem("sidebench:site:theme"))).toBe("dark");

    // With the app's own scripts blocked, only public/theme-init.js runs:
    // the class must still be there, so there's no light flash.
    await page.route("**/assets/**", (route) => route.abort());
    await page.reload();
    await expect(html(page)).toHaveClass(/\bdark\b/);
    await expect(page.locator("#root")).toBeEmpty();
    await page.unroute("**/assets/**");

    await page.reload();
    await page.getByRole("button", { name: "Ljust läge" }).click();
    await expect(html(page)).not.toHaveClass(/\bdark\b/);
    expect(await page.evaluate(() => localStorage.getItem("sidebench:site:theme"))).toBe("light");
  });
});

test("sidebar collapse is saved", async ({ page }) => {
  await page.goto("deworder.html");
  await expect(nav(page).first()).toHaveAttribute("data-state", "expanded");
  await page.getByRole("button", { name: "Visa eller dölj sidopanelen" }).first().click();
  await expect(nav(page).first()).toHaveAttribute("data-state", "collapsed");
  expect(await page.evaluate(() => localStorage.getItem("sidebench:site:sidebar"))).toBe("collapsed");

  await page.goto("text.html");
  await expect(nav(page).first()).toHaveAttribute("data-state", "collapsed");
  // Collapsed to icons, the names show as tooltips.
  await nav(page).getByRole("link", { name: live[0].name }).hover();
  await expect(page.getByRole("tooltip")).toHaveText(live[0].name);
});

test("mobile menu opens and closes below the top strip without CSP violations", async ({ page }) => {
  const problems = watchConsole(page);
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto("./");
  const strip = page.getByRole("navigation", { name: "Verktyg" });
  await expect(strip.getByRole("link", { name: live[0].name })).toHaveCount(0);

  await strip.getByRole("button", { name: "Öppna menyn" }).click();
  const close = strip.getByRole("button", { name: "Stäng menyn" });
  await expect(close).toHaveAttribute("aria-expanded", "true");
  await expect(strip.getByRole("link", { name: live[0].name })).toBeVisible();
  await expect(strip.getByRole("button", { name: /läge$/ })).toBeVisible();

  await close.click();
  await expect(strip.getByRole("button", { name: "Öppna menyn" })).toHaveAttribute("aria-expanded", "false");
  await expect(strip.getByRole("link", { name: live[0].name })).toHaveCount(0);
  expect(problems).toEqual([]);
});

test("stores only UI state: sidebench:site:* keys, no cookies", async ({ page, context }) => {
  await page.goto("./");
  await page.getByRole("button", { name: /läge$/ }).click();
  await page.getByRole("button", { name: "Visa eller dölj sidopanelen" }).first().click();

  const keys = await storedKeys(page);
  expect(keys.length).toBeGreaterThan(0);
  for (const key of keys) expect(key).toMatch(/^sidebench:site:/);
  expect(await context.cookies()).toEqual([]);
  expect(await page.evaluate(() => document.cookie)).toBe("");
});
