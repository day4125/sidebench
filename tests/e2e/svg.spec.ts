// SVG-viewer: open by file, paste and code; the budget strip; selecting
// from the tree and the canvas; cutting out and downloading; the levers and
// "Nå budget"; undo; the heat view; errors; phone width. Every test also
// holds the page to INTENT.md: no request after load, no console errors (CSP
// reports included), nothing stored outside sidebench:site:*.
import { readFileSync } from "node:fs";
import { expect, test as base, type Page } from "@playwright/test";
import { storedOutsideUi, watchConsole, watchNetwork } from "./helpers";

const test = base.extend<{ app: Page }>({
  app: async ({ page, context, baseURL }, use) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const offending = watchNetwork(page, new URL(baseURL!).origin);
    const errors = watchConsole(page);
    await page.goto("svg.html");
    await page.waitForLoadState("networkidle");

    await use(page);

    expect(offending).toEqual([]);
    expect(errors).toEqual([]);
    expect(await storedOutsideUi(page)).toEqual([]);
  },
});

const NS = 'xmlns="http://www.w3.org/2000/svg"';

/** Two figures, one with a style="" and a <style>, plus editor metadata. */
const SMALL = `<?xml version="1.0"?>
<!-- Created with Inkscape -->
<svg ${NS} xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" viewBox="0 0 200 100" inkscape:version="1.3">
<metadata>junk</metadata>
<style>.ink{fill:#1e293b}</style>
<g id="figur-1"><rect x="10" y="10" width="80" height="80" fill="#2dd4bf"/><circle cx="50" cy="50" r="20" class="ink"/></g>
<g id="figur-2"><rect x="110" y="10" width="80" height="80" style="fill:#f59e0b"/></g>
</svg>`;

/** Over 500 kB of six-decimal paths: SVGO's precision gets it under. */
function heavy(paths = 2600) {
  let seed = 3;
  const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 1000;
  const out = [`<svg ${NS} viewBox="0 0 1000 1000">`];
  for (let g = 0; g < paths / 100; g++) {
    out.push(`<g id="grupp-${g}">`);
    for (let p = 0; p < 100; p++) {
      let d = `M${r().toFixed(6)} ${r().toFixed(6)}`;
      for (let s = 0; s < 3; s++) d += ` C${r().toFixed(6)} ${r().toFixed(6)} ${r().toFixed(6)} ${r().toFixed(6)} ${r().toFixed(6)} ${r().toFixed(6)}`;
      out.push(`<path fill="none" stroke="#334155" d="${d}"/>`);
    }
    out.push("</g>");
  }
  out.push("</svg>");
  return out.join("\n");
}

const svgFile = (name: string, text: string) => ({ name, mimeType: "image/svg+xml", buffer: Buffer.from(text) });

async function openFile(page: Page, name: string, text: string) {
  await page.locator('input[type="file"]').setInputFiles(svgFile(name, text));
  await expect(page.getByTestId("svg-stage")).toBeVisible();
}

const size = (page: Page) => page.getByTestId("svg-size");
const strip = (page: Page) => page.getByRole("region", { name: "Storlek mot gränsen 500 kB" });

test("opens a dropped file and shows its size against the limit", async ({ app }) => {
  await openFile(app, "figurer.svg", SMALL);
  await expect(strip(app)).toContainText("figurer.svg");
  await expect(size(app)).toHaveText(/byte|kB/);
  await expect(strip(app)).toContainText("under gränsen");
  await expect(app.getByRole("button", { name: "Minska…" })).toHaveCount(0);
});

test("opens pasted code", async ({ app }) => {
  await app.getByLabel("Eller klistra in koden").fill(SMALL);
  await app.getByRole("button", { name: "Öppna koden" }).click();
  await expect(app.getByTestId("svg-stage")).toBeVisible();
  await expect(strip(app)).toContainText("inklistrad.svg");
});

// Outside the fixture: Chromium builds its own <parsererror> element with
// style attributes for broken XML, and the CSP reports those. That one
// report is allowed here; anything else still fails.
base("refuses code that isn't SVG", async ({ page, baseURL }) => {
  const offending = watchNetwork(page, new URL(baseURL!).origin);
  const errors = watchConsole(page);
  await page.goto("svg.html");
  await page.getByLabel("Eller klistra in koden").fill("<svg><rect></svg>");
  await page.getByRole("button", { name: "Öppna koden" }).click();
  await expect(page.getByText(/Koden är inte giltig SVG \(fel på rad 1\)/)).toBeVisible();
  expect(offending).toEqual([]);
  expect(errors.filter((e) => !/Applying inline style violates/.test(e))).toEqual([]);
});

test("refuses a file that isn't SVG", async ({ app }) => {
  await app.locator('input[type="file"]').setInputFiles({ name: "bild.png", mimeType: "image/png", buffer: Buffer.from("x") });
  await expect(app.getByText("bild.png är inte en SVG-fil.")).toBeVisible();
});

test("selects a figure in the tree and cuts it out into its own file", async ({ app }) => {
  await openFile(app, "figurer.svg", SMALL);
  const before = await size(app).textContent();
  await app.getByRole("button", { name: /^g\s*figur-1/ }).click();
  await expect(strip(app)).toContainText("Markeringen som egen fil · 1 element");
  await expect(strip(app)).toContainText(/optimerad/);

  await strip(app).getByRole("button", { name: "Klipp ut" }).click();
  await expect(strip(app)).not.toContainText("Markering");
  await expect(size(app)).not.toHaveText(before!);

  const [download] = await Promise.all([app.waitForEvent("download"), strip(app).getByRole("button", { name: "Ladda ner" }).click()]);
  expect(download.suggestedFilename()).toBe("figurer-urklipp.svg");
  const text = readFileSync((await download.path())!, "utf8");
  expect(text).toContain('id="figur-1"');
  expect(text).not.toContain('id="figur-2"');
  expect(text).toContain(".ink{fill:#1e293b}");
  expect(text).toMatch(/viewBox="10 10 80 80"/);

  // Undo brings the whole file back.
  await app.getByRole("button", { name: /^Ångra: Urklipp/ }).click();
  await expect(size(app)).toHaveText(before!);
});

test("clicks a shape on the canvas to select its figure, Delete removes it", async ({ app }) => {
  await openFile(app, "figurer.svg", SMALL);
  const img = app.getByTestId("svg-stage").locator("img");
  const box = (await img.boundingBox())!;
  // The amber square, figure 2, at (150, 50) of 200 × 100.
  await app.mouse.click(box.x + box.width * 0.75, box.y + box.height * 0.5);
  await expect(strip(app)).toContainText("Markeringen som egen fil · 1 element");
  await expect(app.getByRole("button", { name: /^g\s*figur-2/ })).toHaveAttribute("aria-pressed", "true");

  await app.keyboard.press("Delete");
  await expect(app.getByRole("button", { name: /^g\s*figur-2/ })).toHaveCount(0);
  await app.keyboard.press("Control+z");
  await expect(app.getByRole("button", { name: /^g\s*figur-2/ })).toHaveCount(1);
});

test("a marquee around a figure selects it", async ({ app }) => {
  await openFile(app, "figurer.svg", SMALL);
  const box = (await app.getByTestId("svg-stage").locator("img").boundingBox())!;
  const at = (x: number, y: number) => [box.x + (x / 200) * box.width, box.y + (y / 100) * box.height] as const;
  await app.mouse.move(...at(5, 5));
  await app.mouse.down();
  await app.mouse.move(...at(60, 60), { steps: 4 });
  await app.mouse.move(...at(95, 95), { steps: 4 });
  await app.mouse.up();
  await expect(app.getByRole("button", { name: /^g\s*figur-1/ })).toHaveAttribute("aria-pressed", "true");
});

test("arrow keys and the hand tool move the view; a click with the hand still selects", async ({ app }) => {
  await openFile(app, "figurer.svg", SMALL);
  const img = app.getByTestId("svg-stage").locator("img");
  const start = (await img.boundingBox())!;

  // Right arrow shows more to the right, so the drawing moves left.
  await app.mouse.click(start.x - 20, start.y - 20);
  await app.keyboard.press("ArrowRight");
  await expect.poll(async () => (await img.boundingBox())!.x).toBeLessThan(start.x - 30);

  // With the hand, a drag pans instead of drawing a marquee.
  await app.getByRole("radio", { name: "Panorera" }).click();
  const before = (await img.boundingBox())!;
  await app.mouse.move(before.x + 10, before.y + 10);
  await app.mouse.down();
  await app.mouse.move(before.x + 60, before.y + 40, { steps: 4 });
  await app.mouse.up();
  const after = (await img.boundingBox())!;
  expect(after.x - before.x).toBeCloseTo(50, 0);
  expect(after.y - before.y).toBeCloseTo(30, 0);
  await expect(strip(app)).not.toContainText("Markering");

  await app.mouse.click(after.x + after.width * 0.75, after.y + after.height * 0.5);
  await expect(app.getByRole("button", { name: /^g\s*figur-2/ })).toHaveAttribute("aria-pressed", "true");
});

test("cleans metadata with a previewed saving", async ({ app }) => {
  await openFile(app, "figurer.svg", SMALL);
  await app.getByRole("tab", { name: "Minska" }).click();
  const lever = app.getByRole("region", { name: "Rensa metadata" });
  await expect(lever).toContainText(/−\d/);
  await lever.getByRole("button", { name: "Rensa" }).click();
  await app.getByRole("tab", { name: "Kod" }).click();
  const code = await app.getByLabel("SVG-kod").inputValue();
  expect(code).not.toContain("<metadata>");
  expect(code).not.toContain("inkscape:version");
  expect(code).toContain('style="fill:#f59e0b"');
});

test("reaches the budget automatically, and undo restores the original", async ({ app }) => {
  await openFile(app, "tung.svg", heavy());
  await expect(strip(app)).toContainText("över gränsen");
  const before = await size(app).textContent();
  await strip(app).getByRole("button", { name: "Minska…" }).click();
  await app.getByRole("button", { name: "Nå budget automatiskt" }).click();
  await expect(app.getByText(/^Klart: /)).toBeVisible({ timeout: 60_000 });
  await expect(strip(app)).toContainText("under gränsen");
  await app.getByRole("button", { name: /^Ångra: Nå budget/ }).click();
  await expect(size(app)).toHaveText(before!);
});

test("weight view paints shapes by bytes and shows its scale", async ({ app }) => {
  await openFile(app, "figurer.svg", SMALL);
  await app.getByRole("button", { name: "Vikt" }).click();
  await expect(app.getByText("Vikt per yta")).toBeVisible();
  await expect(app.getByRole("button", { name: "Vikt" })).toHaveAttribute("aria-pressed", "true");
});

test("recolors a color everywhere", async ({ app }) => {
  await openFile(app, "figurer.svg", SMALL);
  await app.getByRole("tab", { name: "Färger" }).click();
  await app.getByRole("button", { name: /#f59e0b/ }).click();
  await app.getByLabel("Ny färg", { exact: true }).fill("#ff00aa");
  await app.getByRole("button", { name: "Byt färg" }).click();
  await app.getByRole("tab", { name: "Kod" }).click();
  await expect(app.getByLabel("SVG-kod")).toHaveValue(/fill:#ff00aa/);
});

test("fits a phone without sideways scrolling", async ({ app }) => {
  await app.setViewportSize({ width: 390, height: 844 });
  await openFile(app, "figurer.svg", SMALL);
  const overflow = await app.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
