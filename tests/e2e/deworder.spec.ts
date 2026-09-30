// The deworder UI (port-plan step 5): upload → map → preview → copy and
// download, config.json in and out, and the sandboxed previews. Every test
// also holds the page to INTENT.md: no request after load (not even to our
// own origin), no console errors, no content in storage.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test as base, type Download, type Page } from "@playwright/test";
import { DEFAULT_CONFIG } from "../../src/tools/deworder/engine/defaults";
import { storedOutsideUi, watchConsole, watchNetwork } from "./helpers";

const fixtures = "tests/unit/deworder/fixtures";
const fixture = readFileSync(`${fixtures}/verify-fixture.html`, "utf8");
const golden = readFileSync(`${fixtures}/verify-fixture.cleaned.html`, "utf8");
const wordBranches = readFileSync(`${fixtures}/word-branches.html`, "utf8");
const legacyConfig = readFileSync("tests/e2e/fixtures/legacy-config.json");

/** Encodes text as windows-1252, the charset Word declares in its exports. */
function windows1252(text: string) {
  const high = "€\u0081‚ƒ„…†‡ˆ‰Š‹Œ\u008DŽ\u008F\u0090‘’“”•–—˜™š›œ\u009DžŸ";
  const bytes = [...text].map((char) => {
    const index = high.indexOf(char);
    if (index >= 0) return 0x80 + index;
    const code = char.charCodeAt(0);
    if (code > 0xff) throw new Error(`not in windows-1252: ${char}`);
    return code;
  });
  return Buffer.from(bytes);
}

const htmlFile = (name: string, text: string) => ({ name, mimeType: "text/html", buffer: windows1252(text) });

// The engine parses with DOMParser, and Chromium checks the page's CSP
// while parsing: every inline style in the document (a <style> block or a
// style="" attribute) logs a violation, though nothing is rendered and the
// output is unaffected. Those, and only those, are allowed: the console
// check matches them by the hash the browser reports. The engine strips
// comments before parsing, so Word's <style><!-- … --></style> arrives
// empty: the empty stylesheet is always allowed.
const sha256 = (css: string) => `sha256-${createHash("sha256").update(css).digest("base64")}`;
let allowedStyles = new Set<string>();

function allowStylesOf(html: string) {
  const sources = [
    ...[...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]),
    ...[...html.matchAll(/\sstyle\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)].map((m) => m[1] ?? m[2] ?? m[3]),
  ];
  for (const css of ["", ...sources]) allowedStyles.add(sha256(css));
}

function isAllowed(problem: string) {
  const hash = problem.match(/^error: Applying inline style violates .*?'(sha256-[^']+)'/)?.[1];
  return hash !== undefined && allowedStyles.has(hash);
}

const test = base.extend<{ app: Page }>({
  app: async ({ page, context, baseURL }, use) => {
    allowedStyles = new Set();
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const origin = new URL(baseURL!).origin;
    const offending = watchNetwork(page, origin);
    const errors = watchConsole(page);
    await page.goto("deworder.html");
    await page.waitForLoadState("networkidle");

    // After load, the tool itself requests nothing: previews included.
    const requests: string[] = [];
    page.on("request", (r) => {
      if (!/^(blob|data):/.test(r.url())) requests.push(r.url());
    });

    await use(page);

    expect(offending).toEqual([]);
    expect(requests).toEqual([]);
    expect(errors.filter((e) => !isAllowed(e))).toEqual([]);
    expect(await storedOutsideUi(page)).toEqual([]);
  },
});

const step = (page: Page) => page.locator('[aria-current="step"]');
const meta = (page: Page) => page.getByTestId("step-meta");
const target = (page: Page, cls: string) => page.getByRole("combobox", { name: `Mål för .${cls}` });
const frame = (page: Page, which: "före" | "efter") => page.frameLocator(`iframe[title="Förhandsvisning ${which}"]`);

async function upload(page: Page, name: string, text: string) {
  allowStylesOf(text);
  await page.locator('input[type="file"][accept^=".html"]').setInputFiles(htmlFile(name, text));
  await page.getByRole("button", { name: "Fortsätt" }).click();
  await expect(step(page)).toHaveText(/Mappa/);
}

async function pasteHtml(page: Page, text: string) {
  allowStylesOf(text);
  await page.getByRole("tab", { name: "Klistra in" }).click();
  await page.getByRole("textbox", { name: "HTML-kod" }).fill(text);
  await page.getByRole("button", { name: "Fortsätt" }).click();
  await expect(step(page)).toHaveText(/Mappa/);
}

async function choose(page: Page, cls: string, value: string) {
  await target(page, cls).selectOption(value);
  await expect(target(page, cls)).toHaveValue(value);
}

// Loading a config or resetting collapses the table, as legacy did.
async function showAll(page: Page) {
  await page.getByRole("button", { name: /^Visa alla/ }).click();
}

async function preview(page: Page) {
  await page.getByRole("button", { name: "Förhandsgranska" }).click();
  await expect(step(page)).toHaveText(/Förhandsgranska/);
}

async function downloaded(page: Page, click: () => Promise<void>): Promise<[Download, string]> {
  const [download] = await Promise.all([page.waitForEvent("download"), click()]);
  return [download, readFileSync((await download.path())!, "utf8")];
}

test("file upload: output matches the golden file, as download, copy and source", async ({ app }) => {
  await expect(app.getByRole("button", { name: "Fortsätt" })).toBeDisabled();
  await upload(app, "verify-fixture.html", fixture);
  await expect(meta(app)).toContainText("källa: verify-fixture.html");

  await preview(app);
  await expect(meta(app)).toContainText(`→ ${golden.length} tecken`);
  await expect(app.getByTestId("source")).toHaveText(golden, { useInnerText: false });

  const [download, text] = await downloaded(app, () => app.getByRole("button", { name: "Ladda ned HTML-fil" }).click());
  expect(download.suggestedFilename()).toBe("verify-fixture.cleaned.html");
  expect(text).toBe(golden);
  await expect(app.getByRole("button", { name: "Nedladdad" })).toBeVisible();

  await app.getByRole("button", { name: "Kopiera" }).click();
  await expect(app.getByRole("button", { name: "Kopierat" })).toBeVisible();
  expect(await app.evaluate(() => navigator.clipboard.readText())).toBe(golden);
});

test("paste: output matches the golden file", async ({ app }) => {
  await app.getByRole("tab", { name: "Klistra in" }).click();
  await expect(app.getByRole("button", { name: "Fortsätt" })).toBeDisabled();
  await app.getByRole("textbox", { name: "HTML-kod" }).fill("   ");
  await expect(app.getByRole("button", { name: "Fortsätt" })).toBeDisabled();

  await pasteHtml(app, fixture);
  await expect(meta(app)).toContainText("källa: pasted.html");
  await preview(app);
  const [download, text] = await downloaded(app, () => app.getByRole("button", { name: "Ladda ned HTML-fil" }).click());
  expect(download.suggestedFilename()).toBe("pasted.cleaned.html");
  expect(text).toBe(golden);
});

test("drag and drop picks the HTML file among those dropped", async ({ app }) => {
  allowStylesOf(fixture);
  const bytes = [...windows1252(fixture)];
  await app.getByTestId("drop-zone").evaluate((zone, bytes) => {
    const dt = new DataTransfer();
    dt.items.add(new File(["x"], "notes.txt", { type: "text/plain" }));
    dt.items.add(new File([new Uint8Array(bytes)], "dropped.htm", { type: "" }));
    for (const type of ["dragenter", "dragover", "drop"]) {
      zone.dispatchEvent(new DragEvent(type, { dataTransfer: dt, bubbles: true, cancelable: true }));
    }
  }, bytes);
  await expect(app.getByTestId("drop-zone")).toContainText("dropped.htm");
  await app.getByRole("button", { name: "Fortsätt" }).click();
  await expect(meta(app)).toContainText("källa: dropped.htm");
  await preview(app);
  await expect(app.getByTestId("source")).toHaveText(golden, { useInnerText: false });
});

test("mapping: edit, collapse, options, reset, back and forth", async ({ app }) => {
  await upload(app, "verify-fixture.html", fixture);
  const rows = app.locator("tbody tr");
  const total = Number((await meta(app).textContent())!.match(/(\d+) klasser/)![1]);
  expect(total).toBeGreaterThan(5);

  // Collapsed to five rows until expanded.
  await expect(rows).toHaveCount(5);
  await app.getByRole("button", { name: `Visa alla (5/${total})` }).click();
  await expect(rows).toHaveCount(total);
  await expect(app.getByRole("button", { name: `Visa färre (${total}/${total})` })).toHaveAttribute("aria-expanded", "true");

  await expect(target(app, "NoKRubrik1")).toHaveValue("h1");
  await choose(app, "NoKRubrik1", "h2");
  await choose(app, "NoKText", "strip");
  await choose(app, "NoKRubrik3", "keep");
  await app.getByRole("checkbox", { name: /class-attribut/ }).click();
  await preview(app);
  const source = app.getByTestId("source");
  await expect(source).toContainText("<h2>Islam</h2>");
  await expect(source).not.toContainText("Vanlig text");
  await expect(source).toContainText('<p class="NoKRubrik3">Begrepp</p>');

  // Adjusting keeps the edits; the crumb goes back the same way.
  await app.getByRole("button", { name: "Justera mappning" }).click();
  await expect(target(app, "NoKRubrik1")).toHaveValue("h2");
  await preview(app);
  await app.getByRole("navigation", { name: "Steg" }).getByRole("button", { name: "Mappa" }).click();
  await expect(target(app, "NoKRubrik1")).toHaveValue("h2");

  // Reset goes back to the loaded config and collapses the table.
  await app.getByRole("button", { name: "Återställ standardvärden" }).click();
  await expect(target(app, "NoKRubrik1")).toHaveValue("h1");
  await expect(app.getByRole("checkbox", { name: /class-attribut/ })).toBeChecked();
  await expect(rows).toHaveCount(5);

  // Back to step 1 keeps the file; continuing re-reads it.
  await app.getByRole("navigation", { name: "Steg" }).getByRole("button", { name: "Ladda upp" }).click();
  await expect(app.getByTestId("drop-zone")).toContainText("verify-fixture.html");
  await app.getByRole("button", { name: "Fortsätt" }).click();
  await preview(app);
  await expect(source).toHaveText(golden, { useInnerText: false });

  // Starting over clears it.
  await app.getByRole("button", { name: "Ladda upp annan fil" }).click();
  await expect(step(app)).toHaveText(/Ladda upp/);
  await expect(app.getByRole("button", { name: "Fortsätt" })).toBeDisabled();
});

test("config.json: a legacy file loads unchanged, and the download keeps the format", async ({ app }) => {
  await upload(app, "verify-fixture.html", fixture);
  const input = app.getByTestId("config-input");

  // prodtools' own config.json.
  await input.setInputFiles({ name: "config.json", mimeType: "application/json", buffer: legacyConfig });
  await expect(app.getByRole("button", { name: "Laddad" })).toBeVisible();
  await expect(target(app, "NoKRubrik1")).toHaveValue("h1");

  // A partial one, as older files may be: merged over the defaults.
  const partial = { mapping: { NoKRubrik1: "h3", NoKText: "blockquote", Unused: "em" }, strip_all_classes: false, table_mode: "flatten" };
  await input.setInputFiles({ name: "mine.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(partial)) });
  await showAll(app);
  await expect(target(app, "NoKRubrik1")).toHaveValue("h3");
  await expect(target(app, "NoKText")).toHaveValue("blockquote");
  await expect(app.getByRole("checkbox", { name: /class-attribut/ })).not.toBeChecked();
  await expect(app.getByRole("combobox", { name: "Tabeller:" })).toHaveValue("flatten");

  await choose(app, "NoKPunktlista", "p");
  const [download, text] = await downloaded(app, () => app.getByRole("button", { name: "Ladda ned config.json" }).click());
  expect(download.suggestedFilename()).toBe("config.json");
  // Loaded mapping (defaults + file) with the table's choices on top, in
  // legacy's key order, indented by two.
  const expected = {
    mapping: { ...DEFAULT_CONFIG.mapping, ...partial.mapping, NoKPunktlista: "p" },
    strip_all_classes: false,
    table_mode: "flatten",
    disallowed_tags: DEFAULT_CONFIG.disallowed_tags,
  };
  expect(text).toBe(JSON.stringify(expected, null, 2));

  // Reset now goes back to the loaded file, not the defaults.
  await app.getByRole("button", { name: "Återställ standardvärden" }).click();
  await showAll(app);
  await expect(target(app, "NoKPunktlista")).toHaveValue("li");
  await expect(target(app, "NoKRubrik1")).toHaveValue("h3");

  // A downloaded file loads back to the same table.
  await input.setInputFiles({ name: "config.json", mimeType: "application/json", buffer: Buffer.from(text) });
  await showAll(app);
  await expect(target(app, "NoKPunktlista")).toHaveValue("p");
});

test("config.json: invalid JSON shows an error and changes nothing", async ({ app }) => {
  await upload(app, "verify-fixture.html", fixture);
  await choose(app, "NoKRubrik1", "h4");
  await app.getByTestId("config-input").setInputFiles({ name: "bad.json", mimeType: "application/json", buffer: Buffer.from("{ nope") });
  await expect(app.getByRole("alert")).toContainText("Kunde inte läsa config-filen");
  await expect(target(app, "NoKRubrik1")).toHaveValue("h4");
});

test("previews are sandboxed, keep Word's styles and load nothing", async ({ app }) => {
  await upload(app, "word-branches.html", wordBranches);
  await preview(app);

  for (const title of ["Förhandsvisning före", "Förhandsvisning efter"]) {
    await expect(app.locator(`iframe[title="${title}"]`)).toHaveAttribute("sandbox", "allow-same-origin");
  }

  // Word's <style> block and style="" attributes still apply, via CSSOM.
  const before = frame(app, "före");
  await expect(before.locator("p.MsoNormal").first()).toHaveCSS("margin-top", "0px");
  await expect(before.locator("span", { hasText: /^Rubrik/ })).toHaveCSS("font-size", /^26\.6/);
  await expect(before.locator("[data-sidebench-style]")).toHaveCount(0);
  // Images are there, but not loaded (the fixture's image001.png).
  await expect(before.locator("img").first()).not.toHaveAttribute("src");

  // Links don't navigate the preview.
  await before.getByRole("link", { name: "stor" }).click();
  await expect(before.getByRole("link", { name: "stor" })).toBeVisible();
  expect(app.frames().every((f) => !/example/i.test(f.url()))).toBe(true);
});

test("heading navigation scrolls both previews", async ({ app }) => {
  const filler = "<p class=NoKText>" + "Brödtext. ".repeat(80) + "</p>";
  const doc = Array.from({ length: 6 }, (_, i) => `<p class=NoKRubrik2>Rubrik ${i + 1}</p>${filler}`).join("");
  await pasteHtml(app, `<html><body>${doc}</body></html>`);
  await preview(app);

  const next = app.getByRole("button", { name: "Nästa rubrik" });
  await expect(next).toBeEnabled();
  const scrollTop = (title: string) =>
    app.locator(`iframe[title="${title}"]`).evaluate((f: HTMLIFrameElement) => f.contentDocument!.scrollingElement!.scrollTop);

  await next.click();
  await next.click();
  await expect.poll(() => scrollTop("Förhandsvisning efter")).toBeGreaterThan(100);
  await expect.poll(() => scrollTop("Förhandsvisning före")).toBeGreaterThan(100);

  // Wraps from the first heading back to the last.
  await app.getByRole("button", { name: "Föregående rubrik" }).click();
  await app.getByRole("button", { name: "Föregående rubrik" }).click();
  const top = await scrollTop("Förhandsvisning efter");
  await expect.poll(() => scrollTop("Förhandsvisning efter")).toBeGreaterThan(top);
});

test("no classes and no headings", async ({ app }) => {
  await pasteHtml(app, "<p>Bara text.</p>");
  await expect(app.getByText("Inga klasser hittades.")).toBeVisible();
  await preview(app);
  await expect(app.getByTestId("source")).toHaveText("<p>Bara text.</p>");
  await expect(app.getByRole("button", { name: "Nästa rubrik" })).toBeDisabled();
});

// The engine is parity-tested without a CSP (tests/unit). This runs a
// Word-style document through the UI, under the CSP, and compares the
// download with the legacy engine run on a page with no CSP at all.
test("output under the CSP matches the legacy engine", async ({ app, context }) => {
  await upload(app, "word-branches.html", wordBranches);
  await preview(app);
  const [, text] = await downloaded(app, () => app.getByRole("button", { name: "Ladda ned HTML-fil" }).click());

  const plain = await context.newPage();
  await plain.setContent("<!doctype html><title>legacy</title>");
  for (const file of ["defaults.js", "deworder.js"]) {
    await plain.addScriptTag({ content: readFileSync(`tests/unit/deworder/legacy/${file}`, "utf8") });
  }
  const bytes = [...windows1252(wordBranches)];
  const legacy = await plain.evaluate((bytes) => {
    const d = (window as any).Toolbox.deworder;
    return d.clean(d.decodeHtmlBytes(new Uint8Array(bytes)));
  }, bytes);
  expect(text).toBe(legacy);
});
