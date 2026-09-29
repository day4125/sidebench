// PDF sida vid sida (port-plan steps 3, 6 and 7): picking the two files, the
// workspace (one pair of pages at a time: offset, paging, zoom, stars, drop
// to replace) and
// PDF.js under the CSP. Every test also fails on requests off the origin,
// console errors (CSP violations included), PDF.js warnings, non-UI
// localStorage keys and cookies.
//
// Same-origin requests after load are allowed here, unlike the other tools:
// PDF.js loads its worker, and the bundled font, CMap and decoder chunks a
// document needs, on demand (see port-plan.md, step 6).
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test as base, type Locator, type Page } from "@playwright/test";
import { watchConsole, watchNetwork } from "./helpers";
import { A4, A4_LANDSCAPE, pages, pdfFile, type PageSize } from "./make-pdf";

// Large real-world PDFs, not committed (gitignored). Used when present.
const localDir = "tests/local/pdf";
const localPdfs = existsSync(localDir)
  ? readdirSync(localDir)
      .filter((f) => f.endsWith(".pdf"))
      .slice(0, 2)
      .map((f) => join(localDir, f))
  : [];

const test = base.extend<{ app: Page; loaded: string[]; allowed: RegExp[] }>({
  loaded: async ({}, use) => use([]),
  // Console messages a test expects (e.g. from a broken PDF).
  allowed: async ({}, use) => use([]),
  app: async ({ page, context, baseURL, loaded, allowed }, use) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const offending = watchNetwork(page, new URL(baseURL!).origin);
    const problems = watchConsole(page);
    page.on("request", (r) => loaded.push(r.url()));
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto("pdfview.html");
    await page.waitForLoadState("networkidle");

    await use(page);

    expect(offending).toEqual([]);
    expect(problems.filter((p) => !allowed.some((re) => re.test(p)))).toEqual([]);
    expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => !k.startsWith("sidebench:site:")))).toEqual([]);
    expect(await context.cookies()).toEqual([]);
  },
});

type Payload = ReturnType<typeof pdfFile> | string;

const input = (page: Page, side: "a" | "b") => page.getByTestId(`drop-${side}`).locator('input[type="file"]');
const status = (page: Page, side: "a" | "b") => page.getByTestId(`status-${side}`);
const pageInput = (page: Page) => page.getByLabel("Sidnummer i originalet");
const offsetInput = (page: Page) => page.getByLabel("Sidförskjutning för den komprimerade filen");
const zoomButton = (page: Page) => page.getByRole("button", { name: /^Zoom:/ });
const cell = (page: Page, side: "a" | "b", n: number) =>
  page.locator(`[data-testid="pdf-page"][data-side="${side}"][data-page="${n}"]`);

async function pick(page: Page, side: "a" | "b", file: Payload) {
  await input(page, side).setInputFiles(file);
  await expect(status(page, side)).toContainText(/sidor|Inte en PDF|Kunde inte/, { timeout: 60_000 });
}

async function openBoth(page: Page, a: Payload, b: Payload) {
  await pick(page, "a", a);
  await pick(page, "b", b);
  await page.getByRole("button", { name: "Öppna sida vid sida" }).click();
  await expect(page.getByRole("region", { name: "Granska sida vid sida" })).toBeVisible();
}

const docs = (a: PageSize[], b: PageSize[]) => [pdfFile("a.pdf", "A", a), pdfFile("b.pdf", "B", b)] as const;

/** The gutter's page number on the pair shown. */
const currentNumber = (page: Page) => page.locator('[data-testid="pdf-row"] [data-testid="page-number"]');

/** Dispatches a file drag and drop at (x, y) on whatever element is there. */
async function dropAt(page: Page, x: number, y: number, file: ReturnType<typeof pdfFile>, events = ["dragenter", "dragover", "drop"]) {
  await page.evaluate(
    ({ x, y, name, type, bytes, events }) => {
      const dt = new DataTransfer();
      dt.items.add(new File([new Uint8Array(bytes)], name, { type }));
      const target = document.elementFromPoint(x, y)!;
      for (const type of events) {
        target.dispatchEvent(new DragEvent(type, { dataTransfer: dt, bubbles: true, cancelable: true, clientX: x, clientY: y }));
      }
    },
    { x, y, name: file.name, type: file.mimeType, bytes: [...file.buffer], events },
  );
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

test("picks the two files, refuses a non-PDF and opens the workspace", async ({ app, allowed }) => {
  // The broken PDF below: PDF.js's warning while it tries to repair it, and
  // the app's own log of the error.
  allowed.push(/^warning: Warning: Indexing all PDF objects$/, /^warning: \w+$/);
  const open = app.getByRole("button", { name: "Öppna sida vid sida" });
  await expect(open).toBeDisabled();
  await pick(app, "a", pdfFile("orig.pdf", "A", pages(3)));
  await expect(status(app, "a")).toHaveText("orig.pdf – 3 sidor");
  await expect(open).toBeDisabled();

  // A non-PDF is refused and the file already picked is kept.
  await pick(app, "a", { name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hej") });
  await expect(status(app, "a")).toHaveText("Inte en PDF-fil: notes.txt (behåller orig.pdf)");

  // A broken PDF is refused too.
  await pick(app, "b", { name: "broken.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.7 nope") });
  await expect(status(app, "b")).toHaveText("Kunde inte läsa PDF: broken.pdf");
  await expect(open).toBeDisabled();

  await pick(app, "b", pdfFile("komp.pdf", "B", pages(4)));
  await expect(status(app, "b")).toHaveText("komp.pdf – 4 sidor");
  await open.click();

  await expect(app.getByTestId("name-a")).toHaveText("orig.pdf");
  await expect(app.getByTestId("name-b")).toHaveText("komp.pdf");
  await expect(app.getByText("av 3")).toBeVisible();
  await expect(pageInput(app)).toHaveValue("1");
  await expect(cell(app, "a", 1)).toHaveAttribute("data-state", "rendered");
  await expect(cell(app, "b", 1)).toHaveAttribute("data-state", "rendered");
  await expect(app.getByTestId("scroller")).toBeFocused();
  // The shell is gone: the workspace fills the window.
  await expect(app.getByRole("navigation")).toHaveCount(0);

  // Back in step 1, both files are still loaded.
  await app.getByRole("button", { name: "Tillbaka" }).click();
  await expect(open).toBeEnabled();
  await expect(status(app, "b")).toHaveText("komp.pdf – 4 sidor");
});

test("drop zones take a dropped PDF, and a stray drop doesn't open it in the tab", async ({ app }) => {
  const file = pdfFile("dropped.pdf", "A", pages(2));
  const box = (await app.getByTestId("drop-a").boundingBox())!;
  await dropAt(app, box.x + box.width / 2, box.y + box.height / 2, file);
  await expect(status(app, "a")).toHaveText("dropped.pdf – 2 sidor");

  const stray = await app.evaluate(() => {
    const e = new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: new DataTransfer() });
    document.body.dispatchEvent(e);
    return e.defaultPrevented;
  });
  expect(stray).toBe(true);
});

test("rows pair the pages, mark missing ones and follow the offset", async ({ app }) => {
  await openBoth(app, ...docs(pages(3), [...pages(3), A4_LANDSCAPE]));

  await app.keyboard.press("End");
  await expect(pageInput(app)).toHaveValue("–");
  await expect(currentNumber(app)).toHaveText("4");
  await expect(currentNumber(app)).toHaveAttribute("title", "Bara i den komprimerade (sida 4)");
  const missing = app.getByTestId("pdf-missing");
  await expect(missing).toHaveAttribute("data-side", "a");
  // A missing page borrows the other side's size.
  const [m, b4] = [await missing.boundingBox(), await cell(app, "b", 4).boundingBox()];
  expect(m!.width).toBeCloseTo(b4!.width, 0);

  // B has an extra first page: offset +1 pairs A 1 with B 2, and B 1 gets
  // its own row. The current A page stays in view.
  await app.keyboard.press("Home");
  await app.keyboard.press("ArrowRight");
  await expect(pageInput(app)).toHaveValue("2");
  await offsetInput(app).fill("1");
  await offsetInput(app).press("Enter");
  await expect(pageInput(app)).toHaveValue("2");
  await expect(currentNumber(app)).toHaveText("2\n↕\n3");
  await app.keyboard.press("Home");
  await expect(currentNumber(app)).toHaveText("1");
  await expect(app.getByTestId("pdf-missing")).toHaveAttribute("data-side", "a");
  await expect(app.locator('[data-testid="pdf-row"] [data-side="b"]')).toHaveAttribute("data-page", "1");

  // Clamped so the files still overlap by a page.
  await offsetInput(app).fill("99");
  await offsetInput(app).press("Enter");
  await expect(offsetInput(app)).toHaveValue("3");
  await offsetInput(app).fill("-99");
  await offsetInput(app).press("Enter");
  await expect(offsetInput(app)).toHaveValue("-2");
});

test("the workspace opens under the tool header and goes fullscreen and back", async ({ app }) => {
  await openBoth(app, ...docs(pages(3), pages(3)));
  const region = app.getByRole("region", { name: "Granska sida vid sida" });
  const header = app.getByRole("heading", { level: 1, name: "PDF sida vid sida" });
  const scroller = app.getByTestId("scroller");
  await expect(region).toHaveAttribute("data-fullscreen", "false");
  await expect(header).toBeInViewport();
  const normal = (await scroller.boundingBox())!;
  // The view fills the rest of the window, no page scroll.
  expect(await app.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight)).toBe(true);

  await app.getByRole("button", { name: "Helskärm" }).click();
  await expect(region).toHaveAttribute("data-fullscreen", "true");
  const full = (await scroller.boundingBox())!;
  expect(full.width).toBeGreaterThan(normal.width);
  expect(full.height).toBeGreaterThan(normal.height);
  expect(full.x).toBe(0);

  // The pair shown stays through the switch; Escape leaves fullscreen first.
  await app.keyboard.press("ArrowRight");
  await expect(currentNumber(app)).toHaveText("2");
  await app.keyboard.press("Escape");
  await expect(region).toHaveAttribute("data-fullscreen", "false");
  await expect(currentNumber(app)).toHaveText("2");
  await app.keyboard.press("f");
  await expect(region).toHaveAttribute("data-fullscreen", "true");
  await app.keyboard.press("F");
  await expect(region).toHaveAttribute("data-fullscreen", "false");
  await app.keyboard.press("Escape");
  await expect(app.getByRole("button", { name: "Öppna sida vid sida" })).toBeVisible();
});

test("paging: buttons, page field and keys, one pair at a time", async ({ app }) => {
  await openBoth(app, ...docs(pages(12), pages(12)));
  const prev = app.getByRole("button", { name: "Föregående sida" });
  const next = app.getByRole("button", { name: "Nästa sida" });
  await expect(prev).toBeDisabled();

  await next.click();
  await expect(pageInput(app)).toHaveValue("2");
  await prev.click();
  await expect(pageInput(app)).toHaveValue("1");

  // Typing a number isn't hijacked by the page keys; Enter jumps.
  await pageInput(app).click();
  await pageInput(app).pressSequentially("10");
  await expect(pageInput(app)).toHaveValue("10");
  await pageInput(app).press("Enter");
  await expect(pageInput(app)).toHaveValue("10");
  await expect(cell(app, "a", 10)).toBeInViewport();
  await expect(cell(app, "a", 10)).toHaveAttribute("data-state", "rendered");
  await expect(cell(app, "b", 10)).toHaveAttribute("data-state", "rendered");
  // Only the pair shown is on the page.
  await expect(app.getByTestId("pdf-page")).toHaveCount(2);

  for (const [key, expected] of [
    ["ArrowRight", "11"],
    ["PageDown", "12"],
    ["ArrowRight", "12"],
    ["ArrowLeft", "11"],
    ["PageUp", "10"],
    ["Home", "1"],
    ["End", "12"],
  ]) {
    await app.keyboard.press(key);
    await expect(pageInput(app), key).toHaveValue(expected);
    await expect(app.getByTestId("pdf-page")).toHaveCount(2);
  }
  await expect(next).toBeDisabled();

  // At fit-to-width an A4 pair is taller than the view: Up/Down scroll it
  // instead of turning the page, and the next page starts at its top.
  const scroller = app.getByTestId("scroller");
  await app.keyboard.press("Home");
  await expect(cell(app, "a", 1)).toHaveAttribute("data-state", "rendered");
  await app.keyboard.press("ArrowDown");
  await expect.poll(() => scroller.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  await expect(pageInput(app)).toHaveValue("1");
  await app.keyboard.press("ArrowRight");
  await expect(cell(app, "a", 2)).toBeVisible();
  expect(await scroller.evaluate((el) => el.scrollTop)).toBe(0);
});

test("stars: flag, list, jump, copy, clear, and kept until new files are picked", async ({ app }) => {
  await openBoth(app, ...docs(pages(5), pages(5)));
  const toggle = app.getByRole("button", { name: /^Flaggade sidor: / });
  const menu = app.getByRole("dialog", { name: "Flaggade sidor" });
  await expect(toggle).toHaveAccessibleName("Flaggade sidor: 0");
  // The star lives only in the toolbar, not between the pages.
  await expect(app.getByRole("button", { name: /^Flagga sida/ })).toHaveCount(1);

  await app.keyboard.press("s");
  await app.keyboard.press("End");
  await app.getByRole("button", { name: "Flagga sida 5" }).click();
  await expect(app.getByRole("button", { name: "Flagga sida 5" })).toHaveAttribute("aria-pressed", "true");
  await app.keyboard.press("ArrowLeft");
  await expect(app.getByRole("button", { name: "Flagga sida 4" })).toHaveAttribute("aria-pressed", "false");
  await app.keyboard.press("ArrowLeft");
  await app.keyboard.press("S");
  await expect(toggle).toHaveAccessibleName("Flaggade sidor: 3");

  await toggle.click();
  await expect(menu.getByLabel("Flaggade sidor som text")).toHaveValue("1, 3, 5");
  await menu.getByRole("button", { name: "Kopiera" }).click();
  await expect(menu.getByRole("button", { name: "Kopierad!" })).toBeVisible();
  expect(await app.evaluate(() => navigator.clipboard.readText())).toBe("1, 3, 5");
  await menu.getByRole("button", { name: "1", exact: true }).click();
  await expect(pageInput(app)).toHaveValue("1");

  // Escape closes the menu first, then the workspace.
  await app.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(app.getByRole("region", { name: "Granska sida vid sida" })).toBeVisible();
  await app.keyboard.press("Escape");
  await expect(app.getByRole("button", { name: "Öppna sida vid sida" })).toBeVisible();

  // Reopening keeps the flags; picking a new file starts over.
  await app.getByRole("button", { name: "Öppna sida vid sida" }).click();
  await expect(toggle).toHaveAccessibleName("Flaggade sidor: 3");
  await toggle.click();
  await menu.getByRole("button", { name: "Rensa alla" }).click();
  await expect(toggle).toHaveAccessibleName("Flaggade sidor: 0");
  await expect(menu).toContainText("Inga flaggade sidor");
  await app.keyboard.press("Escape");
  await app.keyboard.press("s");
  await expect(toggle).toHaveAccessibleName("Flaggade sidor: 1");
  await app.getByRole("button", { name: "Tillbaka" }).click();
  await pick(app, "b", pdfFile("b2.pdf", "B", pages(5)));
  await app.getByRole("button", { name: "Öppna sida vid sida" }).click();
  await expect(toggle).toHaveAccessibleName("Flaggade sidor: 0");
});

test("a failed copy leaves the list selected", async ({ app }) => {
  await openBoth(app, ...docs(pages(2), pages(2)));
  await app.evaluate(() => {
    navigator.clipboard.writeText = () => Promise.reject(new Error("denied"));
  });
  await app.keyboard.press("s");
  await app.getByRole("button", { name: /^Flaggade sidor: / }).click();
  const menu = app.getByRole("dialog", { name: "Flaggade sidor" });
  await menu.getByRole("button", { name: "Kopiera" }).click();
  const field = menu.getByLabel("Flaggade sidor som text");
  await expect(field).toBeFocused();
  expect(await field.evaluate((el: HTMLInputElement) => el.value.slice(el.selectionStart!, el.selectionEnd!))).toBe("1");
  await expect(app.getByRole("status")).toHaveText("Kunde inte kopiera automatiskt – tryck Ctrl+C.");
});

test("zoom: fit modes, steps and Ctrl+wheel keep the page, then re-render sharper", async ({ app }) => {
  await openBoth(app, ...docs(pages(6), pages(6)));
  await app.getByRole("button", { name: "Nästa sida" }).click();
  await app.getByRole("button", { name: "Nästa sida" }).click();
  await expect(pageInput(app)).toHaveValue("3");
  await expect(cell(app, "a", 3)).toHaveAttribute("data-state", "rendered");
  const widthBefore = (await cell(app, "a", 3).boundingBox())!.width;
  const pixelsBefore = await cell(app, "a", 3).locator("canvas").evaluate((c: HTMLCanvasElement) => c.width);

  await expect(zoomButton(app)).toHaveText("Bredd");
  await zoomButton(app).click();
  await expect(zoomButton(app)).toHaveText("Sida");
  // Page fit shows the whole page.
  const scroller = (await app.getByTestId("scroller").boundingBox())!;
  expect((await cell(app, "a", 3).boundingBox())!.height).toBeLessThanOrEqual(scroller.height);
  await zoomButton(app).click();
  await expect(zoomButton(app)).toHaveText("100 %");
  expect((await cell(app, "a", 3).boundingBox())!.width).toBeCloseTo(A4[0] * (96 / 72), -1);
  await zoomButton(app).click();
  await expect(zoomButton(app)).toHaveText("Bredd");
  await expect(pageInput(app)).toHaveValue("3");

  await app.getByRole("button", { name: "Zooma in" }).click();
  await expect(zoomButton(app)).toHaveText(/^\d+ %$/);
  await app.keyboard.press("+");
  await expect(pageInput(app)).toHaveValue("3");
  expect((await cell(app, "a", 3).boundingBox())!.width).toBeGreaterThan(widthBefore * 1.5);
  // Once the zoom settles the page is drawn again at the new size.
  await expect
    .poll(() => cell(app, "a", 3).locator("canvas").evaluate((c: HTMLCanvasElement) => c.width))
    .toBeGreaterThan(pixelsBefore * 1.5);

  await app.keyboard.press("Control+0");
  await expect(zoomButton(app)).toHaveText("Bredd");
  expect((await cell(app, "a", 3).boundingBox())!.width).toBeCloseTo(widthBefore, 0);

  // Ctrl+wheel zooms around the pointer instead of scrolling.
  const box = (await cell(app, "a", 3).boundingBox())!;
  await app.mouse.move(box.x + box.width / 2, box.y + 100);
  await app.keyboard.down("Control");
  await app.mouse.wheel(0, -200);
  await app.keyboard.up("Control");
  await expect(zoomButton(app)).toHaveText(/^\d+ %$/);
  await expect(pageInput(app)).toHaveValue("3");

  await app.getByRole("button", { name: "Zooma ut" }).click();
  await app.keyboard.press("-");
  await expect(pageInput(app)).toHaveValue("3");
});

test("a file dropped on the workspace replaces that side and keeps the place and flags", async ({ app }) => {
  await openBoth(app, ...docs(pages(4), pages(4)));
  await app.keyboard.press("s");
  await app.keyboard.press("ArrowRight");
  await app.keyboard.press("ArrowRight");
  await expect(pageInput(app)).toHaveValue("3");

  const view = (await app.getByTestId("scroller").boundingBox())!;
  const right = [view.x + view.width * 0.75, view.y + view.height / 2] as const;
  // Landscape pages change the fit-to-width scale.
  const replacement = pdfFile("b-ny.pdf", "C", pages(5, A4_LANDSCAPE));

  // Dragging over shows which half would be replaced.
  await dropAt(app, ...right, replacement, ["dragenter", "dragover"]);
  await expect(app.getByTestId("veil-b")).toHaveAttribute("data-over", "true");
  await expect(app.getByTestId("veil-a")).toHaveAttribute("data-over", "false");

  await dropAt(app, ...right, replacement, ["drop"]);
  await expect(app.getByTestId("veil-b")).toHaveCount(0);
  await expect(app.getByRole("status")).toHaveText("Komprimerad bytt: b-ny.pdf");
  await expect(app.getByTestId("name-b")).toHaveText("b-ny.pdf");
  await expect(pageInput(app)).toHaveValue("3");
  await expect(app.getByRole("button", { name: /^Flaggade sidor: / })).toHaveAccessibleName("Flaggade sidor: 1");
  // Page 3 of the new B is what's shown, next to A's page 3, and fits the width.
  await expect(cell(app, "b", 3)).toHaveAttribute("data-state", "rendered");
  await expect(cell(app, "a", 3)).toBeInViewport({ ratio: 1 });
  await expect(cell(app, "b", 3)).toBeInViewport({ ratio: 1 });
  // B now has a fifth page with no A page next to it.
  await app.keyboard.press("End");
  await expect(app.getByTestId("pdf-missing")).toHaveAttribute("data-side", "a");

  // A non-PDF dropped on the left is refused and A is kept.
  await dropAt(app, view.x + view.width * 0.25, view.y + view.height / 2, {
    name: "bild.png",
    mimeType: "image/png",
    buffer: Buffer.from("png"),
  });
  await expect(app.getByRole("status")).toHaveText("bild.png är inte en PDF.");
  await expect(app.getByTestId("name-a")).toHaveText("a.pdf");
});

test("only the pair shown is loaded; pages that leave give their canvases back", async ({ app }) => {
  await openBoth(app, ...docs(pages(60), pages(60)));
  await expect(cell(app, "a", 1)).toHaveAttribute("data-state", "rendered");
  const first = await cell(app, "a", 1).locator("canvas").elementHandle();

  await pageInput(app).fill("30");
  await pageInput(app).press("Enter");
  await expect(cell(app, "a", 30)).toHaveAttribute("data-state", "rendered");
  await app.keyboard.press("End");
  await expect(cell(app, "a", 60)).toHaveAttribute("data-state", "rendered");
  await expect(cell(app, "b", 60)).toHaveAttribute("data-state", "rendered");
  await expect(app.getByTestId("pdf-row")).toHaveCount(1);
  await expect(app.getByTestId("pdf-page")).toHaveCount(2);
  await expect(app.locator("canvas")).toHaveCount(2);
  // Page 1's canvas was emptied, not just detached.
  expect(await first!.evaluate((c: HTMLCanvasElement) => [c.isConnected, c.width, c.height])).toEqual([false, 0, 0]);
});

test("KB per page of the compressed file, against the 300 KB target", async ({ app }) => {
  await openBoth(app, ...docs(pages(2), pages(2)));
  const kbpp = app.getByTestId("kbpp");
  await expect(kbpp).toHaveText(/^\d+\.\d KB\/sida$/);
  await expect(kbpp).toHaveAttribute("data-over", "false");
  await kbpp.focus();
  await expect(app.getByRole("tooltip")).toContainText("2 sidor · mål 300 KB/sida");

  // A heavy B: 700 KB over one page.
  await app.getByRole("button", { name: "Tillbaka" }).click();
  const heavy = pdfFile("tung.pdf", "B", pages(1));
  heavy.buffer = Buffer.concat([heavy.buffer, Buffer.from(`%${" ".repeat(700 * 1024)}\n`)]);
  await pick(app, "b", heavy);
  await app.getByRole("button", { name: "Öppna sida vid sida" }).click();
  await expect(kbpp).toHaveText(/^7\d\d KB\/sida$/);
  await expect(kbpp).toHaveAttribute("data-over", "true");
});

test("renders standard fonts, CMaps and JPEG 2000 under the CSP", async ({ app, loaded }, testInfo) => {
  const features = readFileSync("tests/e2e/fixtures/features.pdf");
  const file = { name: "features.pdf", mimeType: "application/pdf", buffer: features };
  await openBoth(app, file, file);

  const stats = [];
  for (const n of [1, 2, 3]) {
    await pageInput(app).fill(String(n));
    await pageInput(app).press("Enter");
    const p = cell(app, "a", n);
    await expect(p).toHaveAttribute("data-state", "rendered");
    await expect(cell(app, "b", n)).toHaveAttribute("data-state", "rendered");
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
});

test("renders every page of the local test PDFs side by side", async ({ app }, testInfo) => {
  test.skip(localPdfs.length < 2, `needs two PDFs in ${localDir}/`);
  test.setTimeout(15 * 60_000);
  const [a, b] = localPdfs;
  await openBoth(app, a, b);
  expect(Number((await app.getByText(/^av \d+$/).textContent())!.slice(3))).toBeGreaterThan(100);

  const started = Date.now();
  let rendered = 0;
  for (let i = 0; ; i++) {
    const row = app.getByTestId("pdf-row");
    for (const p of await row.getByTestId("pdf-page").all()) {
      await expect(p).toHaveAttribute("data-state", /rendered|error/, { timeout: 30_000 });
      expect(await p.getAttribute("data-state"), `${await p.getAttribute("aria-label")}`).toBe("rendered");
      rendered++;
    }
    if (await app.getByRole("button", { name: "Nästa sida" }).isDisabled()) break;
    await app.keyboard.press("ArrowRight");
    await expect(row).toHaveAttribute("data-row", String(i + 1));
  }
  testInfo.annotations.push({
    type: "rendered",
    description: `${rendered} pages in ${((Date.now() - started) / 1000).toFixed(1)} s`,
  });
  await app.getByTestId("pdf-row").screenshot({ path: testInfo.outputPath("last-row.png") });
});
