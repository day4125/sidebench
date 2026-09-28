// Port of prodtools' tests/text/text.test.html. Same cases, same
// expectations; only the harness changed.
import { expect, test } from "vitest";
import { apply, clean, extract, stripSvg } from "@/tools/text/engine";

test("clean strips soft hyphens, normalizes quotes, collapses whitespace", () => {
  expect(clean('  rä&shy;ksmör­gås   med   "citat"  ')).toBe("räksmörgås med ”citat”");
});

test("clean trims and collapses newlines/tabs to single spaces", () => {
  expect(clean("a\n\t  b\r\nc")).toBe("a b c");
});

test("upper / lower change case", () => {
  expect(apply("upper", "Hej Då")).toBe("HEJ DÅ");
  expect(apply("lower", "Hej Då")).toBe("hej då");
});

test("supNum / subNum map every digit", () => {
  expect(apply("supNum", "0123456789")).toBe("⁰¹²³⁴⁵⁶⁷⁸⁹");
  expect(apply("subNum", "0123456789")).toBe("₀₁₂₃₄₅₆₇₈₉");
});

test("supNum leaves non-digits untouched", () => {
  expect(apply("supNum", "H2O i 3 steg")).toBe("H²O i ³ steg");
});

test("supAlpha maps mapped letters and keeps unmapped chars", () => {
  // 'q' has no superscript glyph in the table, so it passes through; the
  // space and uppercase 'A' (regex is a-z only) are also untouched.
  expect(apply("supAlpha", "abq A")).toBe("ᵃᵇq A");
});

test("subAlpha keeps letters that have no subscript glyph", () => {
  // 'b' has no subscript form; 'a' and 'e' do.
  expect(apply("subAlpha", "abe")).toBe("ₐbₑ");
});

test("stripSvg removes paired and self-closing svg elements", () => {
  expect(stripSvg('x<svg viewBox="0 0 1 1"><path d="M0 0"/></svg>y')).toBe("xy");
  expect(stripSvg('a<svg width="10"/>b')).toBe("ab");
});

test("extract email returns matches one per line", () => {
  expect(extract("email", "Mejla a@b.com eller c.d@e-f.io tack")).toBe("a@b.com\nc.d@e-f.io");
});

test("extract email returns empty string when none found", () => {
  expect(extract("email", "ingen adress här")).toBe("");
});

test("extract url prefixes bare www. links with http://", () => {
  expect(extract("url", "se https://x.com/a och www.y.se/b")).toBe("https://x.com/a\nhttp://www.y.se/b");
});

test("apply returns text unchanged for an unknown op", () => {
  expect(apply("nope", "oförändrad")).toBe("oförändrad");
});

test("apply coerces nullish input to an empty string", () => {
  expect(apply("upper", null)).toBe("");
  expect(apply("clean", undefined)).toBe("");
});
