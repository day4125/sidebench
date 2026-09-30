// Enforces INTENT.md: no page may make a request anywhere but its own
// origin, and every page ships the CSP that blocks outgoing connections.
import { readdirSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { storedOutsideUi, watchConsole, watchNetwork } from "./helpers";

// The page entries at the repo root, which the build turns into dist/*.html.
const pages = readdirSync(".").filter((f) => f.endsWith(".html"));

test("every page is built", async ({ request }) => {
  expect(pages).toContain("index.html");
  for (const file of pages) expect((await request.get(file)).ok(), file).toBe(true);
});

for (const file of pages) {
  test.describe(file, () => {
    test("makes no requests off the local origin", async ({ page, baseURL }) => {
      const origin = new URL(baseURL!).origin;
      const offending = watchNetwork(page, origin);
      const errors = watchConsole(page);

      await page.goto(file === "index.html" ? "./" : file);
      await page.waitForLoadState("networkidle");
      await expect(page.locator("#root")).not.toBeEmpty();

      expect(offending).toEqual([]);
      expect(errors).toEqual([]);
      expect(await storedOutsideUi(page)).toEqual([]);
    });

    test("ships a CSP that refuses connections", async ({ page }) => {
      await page.goto(file === "index.html" ? "./" : file);
      const csp = await page
        .locator('meta[http-equiv="Content-Security-Policy"]')
        .getAttribute("content");
      expect(csp).toContain("connect-src 'none'");

      // Even a same-origin fetch must be refused by the browser.
      const refused = await page.evaluate(() =>
        fetch(location.href).then(
          () => false,
          () => true,
        ),
      );
      expect(refused).toBe(true);
    });
  });
}

// The check every tool's tests end with has to see all of it, or it passes
// by missing things.
test("the storage check finds content in every kind of storage", async ({ page, context }) => {
  await page.goto("text.html");
  await page.evaluate(async () => {
    localStorage.setItem("sidebench:site:theme", "dark");
    localStorage.setItem("draft", "x");
    sessionStorage.setItem("pasted", "x");
    await new Promise((done) => {
      const open = indexedDB.open("stash");
      open.onsuccess = () => {
        open.result.close();
        done(null);
      };
    });
    await caches.open("pages");
  });
  await context.addCookies([{ name: "seen", value: "x", url: page.url() }]);

  expect((await storedOutsideUi(page)).sort()).toEqual([
    "Cache Storage: pages",
    "IndexedDB: stash",
    "cookie: seen",
    "localStorage: draft",
    "sessionStorage: pasted",
  ]);
});
