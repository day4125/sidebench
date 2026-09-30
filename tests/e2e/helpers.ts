import type { ConsoleMessage, Page } from "@playwright/test";

/**
 * Records every request that isn't same-origin, blob: or data:, and aborts
 * it so nothing actually leaves.
 */
export function watchNetwork(page: Page, origin: string) {
  const offending: string[] = [];
  page.on("request", (req) => {
    const url = req.url();
    if (url.startsWith("blob:") || url.startsWith("data:")) return;
    if (new URL(url).origin !== origin) offending.push(url);
  });
  void page.route(
    (url) => url.origin !== origin,
    (route) => route.abort("blockedbyclient"),
  );
  return offending;
}

/**
 * Collects uncaught errors, console errors (CSP violations are logged as
 * errors) and PDF.js warnings ("Warning: …" via console.log), from the page
 * and its workers.
 */
export function watchConsole(page: Page) {
  const problems: string[] = [];
  const onMessage = (m: ConsoleMessage) => {
    if (m.type() === "error" || m.type() === "warning") {
      problems.push(`${m.type()}: ${m.text()}`);
    } else if (m.text().startsWith("Warning:")) {
      problems.push(m.text());
    }
  };
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  page.on("console", onMessage);
  page.on("worker", (worker) => worker.on("console", onMessage));
  return problems;
}

/**
 * Everything the page has stored that isn't UI state (INTENT.md): keys in
 * localStorage or sessionStorage outside sidebench:site:*, any IndexedDB
 * database, any Cache Storage cache, any cookie. Empty when all is well.
 */
export async function storedOutsideUi(page: Page): Promise<string[]> {
  const found = await page.evaluate(async () => {
    const out: string[] = [];
    for (const [name, store] of [
      ["localStorage", localStorage],
      ["sessionStorage", sessionStorage],
    ] as const) {
      for (const key of Object.keys(store)) {
        if (!key.startsWith("sidebench:site:")) out.push(`${name}: ${key}`);
      }
    }
    for (const db of await indexedDB.databases()) out.push(`IndexedDB: ${db.name}`);
    for (const cache of await caches.keys()) out.push(`Cache Storage: ${cache}`);
    return out;
  });
  const cookies = await page.context().cookies();
  return [...found, ...cookies.map((c) => `cookie: ${c.name}`)];
}
