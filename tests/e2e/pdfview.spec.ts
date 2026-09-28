// PDF.js under the CSP (port-plan.md, step 3): PDFs render with no requests
// off the origin, no CSP violations and no PDF.js warnings.
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { watchConsole, watchNetwork } from "./helpers";

// Large real-world PDFs, not committed (gitignored). Used when present.
const localDir = "tests/local/pdf";
const localPdfs = existsSync(localDir)
  ? readdirSync(localDir)
      .filter((f) => f.endsWith(".pdf"))
      .slice(0, 2)
      .map((f) => join(localDir, f))
  : [];

async function open(page: Page, files: string[]) {
  await page.goto("pdfview.html");
  await page.getByLabel("Öppna PDF:er").setInputFiles(files);
  const docs = page.getByTestId("pdf-document");
  await expect(docs).toHaveCount(files.length);
  for (const doc of await docs.all()) await expect(doc).toHaveAttribute("data-pages", /\d+/);
}

/** Scrolls to every page of every open document; each must render. */
async function renderAll(page: Page) {
  const pages = await page.getByTestId("pdf-page").all();
  for (const p of pages) {
    await p.scrollIntoViewIfNeeded();
    await expect(p).toHaveAttribute("data-state", /rendered|error/, { timeout: 30_000 });
    expect(await p.getAttribute("data-state"), `page ${await p.getAttribute("data-page")}`).toBe("rendered");
  }
  return pages.length;
}

/** Counts dark (text) and strongly colored (image) pixels on a page's canvas. */
function ink(page: Locator) {
  return page.locator("canvas").evaluate((canvas: HTMLCanvasElement) => {
    const { data } = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height);
    let dark = 0;
    let colored = 0;
    for (let i = 0; i < data.length; i += 4) {
      const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
      if (r + g + b < 200) dark++;
      if (Math.max(r, g, b) - Math.min(r, g, b) > 100) colored++;
    }
    return { dark, colored };
  });
}

test("renders standard fonts, CMaps and JPEG 2000 under the CSP", async ({ page, baseURL }, testInfo) => {
  const offending = watchNetwork(page, new URL(baseURL!).origin);
  const problems = watchConsole(page);
  const loaded: string[] = [];
  page.on("request", (req) => loaded.push(req.url()));

  await open(page, ["tests/e2e/fixtures/features.pdf"]);
  expect(await renderAll(page)).toBe(3);

  // Measured one at a time: a page scrolled far away frees its canvas.
  const stats = [];
  for (const n of [1, 2, 3]) {
    const p = page.locator(`[data-page="${n}"]`);
    await p.scrollIntoViewIfNeeded();
    await expect(p).toHaveAttribute("data-state", "rendered");
    stats.push(await ink(p));
    await p.screenshot({ path: testInfo.outputPath(`features-${n}.png`) });
  }
  const [fonts, cjk, jpx] = stats;
  expect(fonts.dark, "standard font text").toBeGreaterThan(1000);
  expect(cjk.dark, "CMap-encoded text").toBeGreaterThan(fonts.dark / 20);
  expect(jpx.colored, "JPEG 2000 image").toBeGreaterThan(10_000);

  // Rendered from the bundled support files, not system fonts.
  expect(loaded.some((u) => /\/assets\/FoxitSerifBold-[\w-]+\.js$/.test(u)), "standard font chunk").toBe(true);
  expect(loaded.some((u) => /\/assets\/UniJIS-UCS2-H-[\w-]+\.js$/.test(u)), "CMap chunk").toBe(true);
  expect(loaded.some((u) => u.endsWith("/pdfjs/wasm/openjpeg_nowasm_fallback.js")), "JPEG 2000 decoder").toBe(true);

  expect(offending).toEqual([]);
  expect(problems).toEqual([]);
});

test("renders the local test PDFs side by side", async ({ page, baseURL }, testInfo) => {
  test.skip(localPdfs.length === 0, `no PDFs in ${localDir}/`);
  test.setTimeout(15 * 60_000);
  const offending = watchNetwork(page, new URL(baseURL!).origin);
  const problems = watchConsole(page);

  await open(page, localPdfs);
  const started = Date.now();
  const count = await renderAll(page);
  testInfo.annotations.push({
    type: "rendered",
    description: `${count} pages in ${((Date.now() - started) / 1000).toFixed(1)} s`,
  });

  // Pages far from the viewport give their canvas back.
  await expect(page.locator('[data-page="1"]').first()).toHaveAttribute("data-state", "idle");
  const last = page.getByTestId("pdf-page").last();
  await last.screenshot({ path: testInfo.outputPath("last-page.png") });

  expect(offending).toEqual([]);
  expect(problems).toEqual([]);
});
