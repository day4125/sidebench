// Enforces INTENT.md: no page may make a request anywhere but its own
// origin, and every page ships the CSP that blocks outgoing connections.
import { readdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

// The page entries at the repo root, which the build turns into dist/*.html.
const pages = readdirSync(".").filter((f) => f.endsWith(".html"));

/** Records every request that isn't same-origin, blob: or data:. */
function watchNetwork(page: Page, origin: string) {
  const offending: string[] = [];
  page.on("request", (req) => {
    const url = req.url();
    if (url.startsWith("blob:") || url.startsWith("data:")) return;
    if (new URL(url).origin !== origin) offending.push(url);
  });
  // Belt and braces: never let a stray request actually leave.
  page.route(
    (url) => url.origin !== origin,
    (route) => route.abort("blockedbyclient"),
  );
  return offending;
}

test("every page is built", async ({ request }) => {
  expect(pages).toContain("index.html");
  for (const file of pages) expect((await request.get(file)).ok(), file).toBe(true);
});

for (const file of pages) {
  test.describe(file, () => {
    test("makes no requests off the local origin", async ({ page, baseURL }) => {
      const origin = new URL(baseURL!).origin;
      const offending = watchNetwork(page, origin);
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

      await page.goto(file === "index.html" ? "./" : file);
      await page.waitForLoadState("networkidle");
      await expect(page.locator("#root")).not.toBeEmpty();

      expect(offending).toEqual([]);
      expect(errors).toEqual([]);
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
