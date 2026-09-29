// The Textmanipulator UI: operations, the copy flow, the "Fler verktyg"
// menu and the legend tooltip. Every test also holds the page to INTENT.md: no
// request after load, no console errors, no content in storage.
import { expect, test as base, type Page } from "@playwright/test";
import { watchConsole, watchNetwork } from "./helpers";

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
    expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => !k.startsWith("sidebench:site:")))).toEqual([]);
    expect(await context.cookies()).toEqual([]);
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
