// Färgväljare: paste and copy formats, the contrast verdict, the fixes on
// the ruler, swapping, and the vision simulation. Every test also holds the
// page to INTENT.md: no request after load, no console errors, nothing
// stored outside sidebench:site:*.
import { expect, test as base, type Page } from "@playwright/test";
import { storedOutsideUi, watchConsole, watchNetwork } from "./helpers";

const test = base.extend<{ app: Page }>({
  app: async ({ page, context, baseURL }, use) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const offending = watchNetwork(page, new URL(baseURL!).origin);
    const errors = watchConsole(page);
    await page.goto("color.html");
    await page.waitForLoadState("networkidle");

    await use(page);

    expect(offending).toEqual([]);
    expect(errors).toEqual([]);
    expect(await storedOutsideUi(page)).toEqual([]);
  },
});

const field = (page: Page, side: "Text" | "Bakgrund") => page.getByRole("textbox", { name: new RegExp(`^${side}, klistra in`) });
const well = (page: Page, side: "Textfärg" | "Bakgrund") => page.getByRole("region", { name: side, exact: true });
const ratio = (page: Page) => page.getByRole("region", { name: "Kontrast" }).locator("p").first();
const clipboard = (page: Page) => page.evaluate(() => navigator.clipboard.readText());

test("starts on a failing pair with the text field focused", async ({ app }) => {
  await expect(field(app, "Text")).toBeFocused();
  await expect(ratio(app)).toHaveText("2,48:1");
  await expect(app.getByText("Underkänd")).toBeVisible();
});

test("a pasted color shows in every format, and a click copies one", async ({ app }) => {
  await field(app, "Text").fill("rgb(15 118 110)");
  const text = well(app, "Textfärg");
  await expect(text.getByRole("button", { name: "Kopiera HEX: #0f766e" })).toBeVisible();
  await expect(text.getByRole("button", { name: /^Kopiera OKLCH: oklch\(0\.511 0\.086 186\.4\)$/ })).toBeVisible();
  await text.getByRole("button", { name: /^Kopiera RGB/ }).click();
  expect(await clipboard(app)).toBe("rgb(15, 118, 110)");
  await expect(text.getByRole("button", { name: /^Kopiera RGB/ })).toContainText("Kopierat");
});

test("an unknown color says so, keeps the last one and restores the field on blur", async ({ app }) => {
  await field(app, "Bakgrund").fill("blå");
  await expect(field(app, "Bakgrund")).toHaveAttribute("aria-invalid", "true");
  await expect(well(app, "Bakgrund").getByText("Okänd färg")).toBeVisible();
  await expect(ratio(app)).toHaveText("2,48:1");
  await field(app, "Text").focus();
  await expect(field(app, "Bakgrund")).toHaveValue("#14b8a6");
});

test("a fix on the ruler previews on hover and applies on click", async ({ app }) => {
  const fix = app.getByRole("button", { name: /^Byt bakgrund till #[0-9a-f]{6}: .*klarar AA$/ });
  await fix.hover();
  await expect(app.getByText("Klarar AA", { exact: true })).toBeVisible();
  // Only a preview: the field still holds the old color.
  await expect(field(app, "Bakgrund")).toHaveValue("#14b8a6");

  const hex = (await fix.getAttribute("aria-label"))!.match(/#[0-9a-f]{6}/)![0];
  await fix.click();
  await expect(field(app, "Bakgrund")).toHaveValue(hex);
  await expect(app.getByText("Klarar AA", { exact: true })).toBeVisible();
  // AA is passed, so only the AAA fixes are left.
  await expect(app.getByRole("button", { name: /klarar AA$/ })).toHaveCount(0);
  await expect(app.getByRole("button", { name: /klarar AAA$/ })).not.toHaveCount(0);
});

test("a pair that passes AAA has nothing to fix", async ({ app }) => {
  await field(app, "Text").fill("#000");
  await field(app, "Bakgrund").fill("#fff");
  await expect(ratio(app)).toHaveText("21:1");
  await expect(app.getByText("Klarar AAA, inget att justera.").first()).toBeVisible();
});

test("swap trades the two colors", async ({ app }) => {
  await app.getByRole("button", { name: "Byt plats" }).click();
  await expect(field(app, "Text")).toHaveValue("#14b8a6");
  await expect(field(app, "Bakgrund")).toHaveValue("#ffffff");
  await expect(ratio(app)).toHaveText("2,48:1");
});

test("vision simulation lists each ratio and switches the preview", async ({ app }) => {
  const group = app.getByRole("radiogroup", { name: "Synsimulering" });
  await expect(group.getByRole("radio")).toHaveCount(5);
  await expect(group.getByRole("radio", { name: /Normalt seende/ })).toHaveAttribute("aria-checked", "true");
  await group.getByRole("radio", { name: /Protanopi/ }).click();
  await expect(group.getByRole("radio", { name: /Protanopi/ })).toHaveAttribute("aria-checked", "true");
  await expect(group.getByRole("radio", { name: /Protanopi/ })).toContainText("2,24:1");
});
