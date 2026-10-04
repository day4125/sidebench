import { expect, test } from "vitest";
import { clean } from "@/tools/text/engine";
import { cleanWith, DEFAULT_RECIPE, type Recipe } from "@/tools/text/recipe";

const r = (over: Partial<Recipe>): Recipe => ({ ...DEFAULT_RECIPE, ...over });
const run = (recipe: Recipe, s: string) => cleanWith(recipe, s).text;

test("without blank lines, the default recipe matches clean()", () => {
  for (const s of ['  rä&shy;ksmör\u00ADgås   med   "citat"  ', "a\n\t  b\r\nc", "10\u00A0000 kr"]) {
    expect(run(DEFAULT_RECIPE, s)).toBe(clean(s));
  }
});

test("zero-width characters always go", () => {
  expect(run(DEFAULT_RECIPE, "a\u200Bb\uFEFF")).toBe("ab");
});

test("paragraphs keep blank lines, join lines inside, unless turned off", () => {
  expect(run(DEFAULT_RECIPE, "ett\ntvå\n\n\ntre ")).toBe("ett två\n\ntre");
  expect(run(r({ keepParagraphs: false }), "ett\ntvå\n\n\ntre ")).toBe("ett två tre");
});

test("hyphens at a line end join, or stay where the word looks hyphenated", () => {
  expect(run(DEFAULT_RECIPE, "kom-\nmunen, barn-\noch EU-\nKommissionen")).toBe("kommunen, barn- och EU-Kommissionen");
  expect(run(DEFAULT_RECIPE, "e-\npost, tv-\nserie, 18-\nåring, EU-\nkommissionen")).toBe(
    "e-post, tv-serie, 18-åring, EU-kommissionen",
  );
  expect(run(r({ joinHyphens: false }), "kom-\nmunen")).toBe("kom- munen");
});

test("a word hyphenated elsewhere in the text keeps its hyphen", () => {
  expect(run(DEFAULT_RECIPE, "Vår lunch-meny. Ny lunch-\nmeny och lunch-\nrasten.")).toBe(
    "Vår lunch-meny. Ny lunch-meny och lunchrasten.",
  );
});

test("the report counts what was done", () => {
  const { report } = cleanWith(r({ nbspNumbers: true }), 'kom-\nmunen e-\npost "x"\u00A0\u00AD 1 250 000');
  expect(report).toEqual({ invisible: 1, joined: ["kommunen"], kept: ["e-post"], quotes: 2, plainSpaces: 1, numbers: 2 });
});

test("non-breaking spaces stay unless plainSpaces", () => {
  expect(run(r({ plainSpaces: false }), "a\u00A0 b")).toBe("a\u00A0 b");
  expect(run(DEFAULT_RECIPE, "a\u00A0 b")).toBe("a b");
});

test("nbspNumbers runs last, after spaces are made plain", () => {
  expect(run(r({ nbspNumbers: true }), "10\u00A0000  och 1 250 000")).toBe("10\u00A0000 och 1\u00A0250\u00A0000");
});

test("quotes can be left straight", () => {
  expect(run(r({ quotes: false }), '"x"')).toBe('"x"');
});
