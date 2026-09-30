// The Textmanipulator UI: operations, the copy flow, the "Fler verktyg"
// menu and the legend tooltip. Every test also holds the page to INTENT.md: no
// request after load, no console errors, no content in storage.
import { expect, test as base, type Page } from "@playwright/test";
import { storedOutsideUi, watchConsole, watchNetwork } from "./helpers";

const test = base.extend<{ app: Page }>({
  app: async ({ page, context, baseURL }, use) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const origin = new URL(baseURL!).origin;
    const offending = watchNetwork(page, origin);
    const errors = watchConsole(page);
    await page.goto("text.html");
    await page.waitForLoadState("networkidle");

    const requests: string[] = [];
    page.on("request", (r) => {
      if (!/^(blob|data):/.test(r.url())) requests.push(r.url());
    });

    await use(page);

    expect(offending).toEqual([]);
    expect(requests).toEqual([]);
    expect(errors).toEqual([]);
    expect(await storedOutsideUi(page)).toEqual([]);
  },
});

const input = (page: Page) => page.getByRole("textbox", { name: "Text" });
const button = (page: Page, name: string) => page.getByRole("button", { name, exact: true });
const clipboard = (page: Page) => page.evaluate(() => navigator.clipboard.readText());

test("Rensa text cleans the text and turns into a copy button", async ({ app }) => {
  await input(app).fill('  rä&shy;ksmör­gås   med\n\n"citat"  ');
  await button(app, "Rensa text").click();
  await expect(input(app)).toHaveValue("räksmörgås med ”citat”");
  await expect(button(app, "Rensa text")).toHaveCount(0);

  await button(app, "Kopiera").click();
  await expect(button(app, "Kopierad!")).toBeVisible();
  expect(await clipboard(app)).toBe("räksmörgås med ”citat”");
  await expect(app.getByRole("status")).toHaveText("Texten är kopierad till urklipp");

  // After 1.6 s it offers to copy again.
  await expect(button(app, "Kopiera")).toBeVisible({ timeout: 3000 });
});

test("only one button is in copy state at a time", async ({ app }) => {
  await input(app).fill("H2O");
  await button(app, "Upphöjda siffror").click();
  await expect(input(app)).toHaveValue("H²O");
  await button(app, "Kopiera").click();
  await expect(button(app, "Kopierad!")).toBeVisible();

  // A second operation runs on the result and takes over the copy state,
  // without inheriting the first button's "Kopierad!".
  await button(app, "Rensa text").click();
  await expect(button(app, "Upphöjda siffror")).toBeVisible();
  await expect(app.getByRole("button", { name: /^Kopiera/ })).toHaveCount(1);
  await expect(button(app, "Kopiera")).toBeVisible();
});

test("editing the text resets every button", async ({ app }) => {
  await input(app).fill("abc");
  await button(app, "Nedsänkta bokstäver").click();
  await expect(input(app)).toHaveValue("ₐbc");
  await input(app).press("End");
  await input(app).pressSequentially("x");
  await expect(button(app, "Kopiera")).toHaveCount(0);
  await expect(button(app, "Nedsänkta bokstäver")).toBeVisible();
});

test("the toolbar runs each operation", async ({ app }) => {
  const cases: [string, string, string][] = [
    ["Nedsänkta siffror", "H2O", "H₂O"],
    ["Upphöjda bokstäver", "abq A", "ᵃᵇq A"],
    ["VERSALER", "Hej Då", "HEJ DÅ"],
    ["gemener", "Hej Då", "hej då"],
    ["Som i en mening", "NY RAPPORT. MER TEXT", "Ny rapport. Mer text"],
    ["Till slug", "Ny rapport, del 2\nÅrets bästa", "ny-rapport-del-2\narets-basta"],
    ["Från slug", "ny-rapport", "Ny rapport"],
  ];
  const bar = app.getByRole("group", { name: "Textverktyg" });
  for (const [name, before, after] of cases) {
    await input(app).fill(before);
    await bar.getByRole("button", { name, exact: true }).click();
    await expect(input(app), name).toHaveValue(after);
  }
});

test("Fler verktyg is a menu of the rarely used operations", async ({ app }) => {
  const cases: [string, string, string][] = [
    ["Ta bort <svg>-taggar", 'x<svg viewBox="0 0 1 1"><path d="M0 0"/></svg>y', "xy"],
    ["Extrahera e-postadresser", "Mejla a@b.com eller c.d@e-f.io tack", "a@b.com\nc.d@e-f.io"],
    ["Extrahera URL", "se https://x.com/a och www.y.se/b", "https://x.com/a\nhttp://www.y.se/b"],
    ["Rensa text, behåll stycken", "ett\ntvå\n\ntre", "ett två\n\ntre"],
    ["Ta bort dolda tecken", "rä\u00ADk 10\u00A0000\tkr", "räk 10 000 kr"],
    ["Hårt mellanslag i tal (10 000)", "10 000 kr", "10\u00A0000 kr"],
    ["Punktlista", "a\nb", "• a\n• b"],
    ["Numrerad lista", "a\nb", "1. a\n2. b"],
    ["Ta bort dubbletter", "a\nb\na", "a\nb"],
    ["Ta bort HTML-taggar", "<p>Hej <b>du</b></p>", "Hej du"],
    ["Avkoda entiteter (&amp;)", "R&auml;k &amp; sm&#246;r", "Räk & smör"],
  ];
  for (const [name, before, after] of cases) {
    await expect(button(app, name)).toHaveCount(0);
    await input(app).fill(before);
    await button(app, "Fler verktyg").click();
    await button(app, name).click();
    await expect(input(app), name).toHaveValue(after);
    // The copy flow works inside the menu too.
    await button(app, "Kopiera").click();
    expect(await clipboard(app)).toBe(after);
    await app.keyboard.press("Escape");
  }
  await expect(button(app, "Extrahera URL")).toHaveCount(0);
});

test("a failed copy selects the text instead", async ({ app, context }) => {
  await context.clearPermissions();
  await app.evaluate(() => {
    navigator.clipboard.writeText = () => Promise.reject(new Error("denied"));
  });
  await input(app).fill("hej");
  await button(app, "Rensa text").click();
  await button(app, "Kopiera").click();
  await expect(input(app)).toBeFocused();
  const selected = await input(app).evaluate((el: HTMLTextAreaElement) => el.value.slice(el.selectionStart, el.selectionEnd));
  expect(selected).toBe("hej");
  await expect(button(app, "Kopiera")).toBeVisible();
});

test("one legend tooltip explains every button, on hover and on keyboard focus", async ({ app }) => {
  // The buttons themselves have no tooltips.
  await button(app, "Upphöjda siffror").hover();
  await app.waitForTimeout(300);
  await expect(app.getByRole("tooltip")).toHaveCount(0);

  await button(app, "Om knapparna").hover();
  const tip = app.getByRole("tooltip");
  await expect(tip).toContainText("mjuka bindestreck");
  await expect(tip).toContainText("Alla bokstäver finns inte i unicode");
  await expect(tip).toContainText("Ny rapport blir ny-rapport");
  // A real pointer sends many moves; Radix needs more than one to see it
  // leave the trigger's grace area.
  const box = (await app.getByRole("heading", { name: "Textmanipulator" }).boundingBox())!;
  await app.mouse.move(box.x, box.y, { steps: 10 });
  await expect(tip).toHaveCount(0);

  await button(app, "Om knapparna").focus();
  await expect(tip).toContainText("Upphöjda / nedsänkta siffror");
  await app.keyboard.press("Escape");
  await expect(tip).toHaveCount(0);

  // "Fler verktyg" isn't in the legend and has its own.
  await button(app, "Fler verktyg").hover();
  await expect(tip).toHaveText("Fler verktyg");
});

/** Select characters `from`..`to` in the text box. */
const selectRange = (page: Page, from: number, to: number) =>
  input(page).evaluate((el: HTMLTextAreaElement, [a, b]) => el.setSelectionRange(a, b), [from, to]);

test("an operation on a selection changes only the selection", async ({ app }) => {
  await input(app).fill("Utsläppen 2023 var 40 ton CO2");
  await selectRange(app, 26, 29);
  await button(app, "Nedsänkta siffror").click();
  await expect(input(app)).toHaveValue("Utsläppen 2023 var 40 ton CO₂");
  // The changed part stays selected, and the copy button copies all of it.
  const selected = await input(app).evaluate((el: HTMLTextAreaElement) => el.value.slice(el.selectionStart, el.selectionEnd));
  expect(selected).toBe("CO₂");
  await button(app, "Kopiera").click();
  expect(await clipboard(app)).toBe("Utsläppen 2023 var 40 ton CO₂");
});

test("Ctrl+Z undoes an operation", async ({ app }) => {
  await input(app).fill("Hej Då");
  await button(app, "VERSALER").click();
  await expect(input(app)).toHaveValue("HEJ DÅ");
  await input(app).press("ControlOrMeta+z");
  await expect(input(app)).toHaveValue("Hej Då");
  // Undo is an edit, so the buttons reset.
  await expect(button(app, "VERSALER")).toBeVisible();
});

test("the toolbar counts characters, words and lines, or the selection", async ({ app }) => {
  const bar = app.getByRole("group", { name: "Textverktyg" });
  await expect(bar).not.toContainText("tecken");
  await input(app).fill("Två ord\noch en rad till");
  await expect(bar).toContainText("23 tecken · 6 ord · 2 rader");
  await selectRange(app, 0, 7);
  await input(app).press("Shift+ArrowLeft");
  await expect(bar).toContainText("Markerat: 6 tecken · 2 ord · 1 rad");
});

test("hidden characters are drawn in a layer that matches the text box", async ({ app }) => {
  const toggle = button(app, "Visa dolda tecken");
  const layer = app.locator("[data-marks]");
  const long = "Ett långt stycke med 10\u00A0000 kr och rä\u00ADk\u200Bsmörgås. ".repeat(40);
  await input(app).fill(`${long}\n\ttabb\n${long}`);
  await expect(layer).toHaveCount(0);

  // The tooltip tallies what's there.
  await toggle.hover();
  await expect(app.getByRole("tooltip")).toContainText("80 hårda mellanslag");
  await expect(app.getByRole("tooltip")).toContainText("1 tabb");

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(layer).toHaveAttribute("aria-hidden", "true");
  // Same text, same wrapping: the layer is exactly as tall as the text box's content.
  const heights = async () =>
    [await layer.evaluate((el) => el.scrollHeight), await input(app).evaluate((el) => el.scrollHeight)];
  const [layerH, boxH] = await heights();
  expect(Math.abs(layerH - boxH)).toBeLessThanOrEqual(1);
  // And it follows the text box's scroll.
  await input(app).evaluate((el) => (el.scrollTop = 300));
  await expect.poll(() => layer.evaluate((el) => el.scrollTop)).toBe(300);

  // Editing still works with the layer on. The setting is kept as UI state
  // (a reload would trip this fixture's no-requests check).
  await input(app).fill("a\u00A0b");
  await expect(layer).toContainText("°");
  const setting = () => app.evaluate(() => localStorage.getItem("sidebench:site:text:hidden"));
  expect(await setting()).toBe("1");
  await toggle.click();
  await expect(layer).toHaveCount(0);
  expect(await setting()).toBe("0");
});
