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

// New in sidebench, not in the legacy suite.

test("slugify lowercases, drops accents and joins words with hyphens", () => {
  expect(apply("slug", "Ny rapport, del 2")).toBe("ny-rapport-del-2");
  expect(apply("slug", "Årets bästa – öl & mat!")).toBe("arets-basta-ol-mat");
  expect(apply("slug", "Smørrebrød på Straße")).toBe("smorrebrod-pa-strasse");
  expect(apply("slug", "  --Hej--  ")).toBe("hej");
});

test("slugify works line by line", () => {
  expect(apply("slug", "Första rubriken\nAndra rubriken\n\nTredje")).toBe("forsta-rubriken\nandra-rubriken\n\ntredje");
});

test("deslugify turns hyphens and underscores into spaces, first letter up", () => {
  expect(apply("deslug", "ny-rapport")).toBe("Ny rapport");
  expect(apply("deslug", "ny_rapport--del-2")).toBe("Ny rapport del 2");
  expect(apply("deslug", "-hej-\nnasta-rad")).toBe("Hej\nNasta rad");
});

test("deslugify undoes slugify for plain lowercase-safe text", () => {
  expect(apply("deslug", apply("slug", "Ny rapport"))).toBe("Ny rapport");
});

test("softClean keeps paragraphs and joins lines inside them", () => {
  expect(apply("softClean", "Första raden\nfortsätter här.\n\n  Nytt   stycke\n\n\n\nsista")).toBe(
    "Första raden fortsätter här.\n\nNytt stycke\n\nsista",
  );
  expect(apply("softClean", "a\r\nb\r\n\r\nc")).toBe("a b\n\nc");
});

test("softClean joins words split at a line end, not before och", () => {
  expect(apply("softClean", "i kom-\nmunen")).toBe("i kommunen");
  expect(apply("softClean", "barn-\noch ungdomar")).toBe("barn- och ungdomar");
  // A capital after the hyphen is a real compound, so the hyphen stays.
  expect(apply("softClean", "EU-\nKommissionen")).toBe("EU-Kommissionen");
});

test("softClean drops soft hyphens and zero-width characters, keeps nbsp", () => {
  expect(apply("softClean", 'rä&shy;k­smör​gås 10 000 "x"')).toBe("räksmörgås 10 000 ”x”");
});

test("nbspNumbers joins thousands groups with non-breaking spaces", () => {
  expect(apply("nbspNumbers", "10 000 kr och 1 250 000 invånare")).toBe("10 000 kr och 1 250 000 invånare");
  expect(apply("nbspNumbers", "12 345")).toBe("12 345");
});

test("nbspNumbers leaves years, short groups and decimals alone", () => {
  expect(apply("nbspNumbers", "år 2023 100 personer")).toBe("år 2023 100 personer");
  expect(apply("nbspNumbers", "sidan 12 34 och 5 6789")).toBe("sidan 12 34 och 5 6789");
  expect(apply("nbspNumbers", "10 000,50 kr")).toBe("10 000,50 kr");
});

test("sentenceCase lowers a shouting line and capitalizes sentence starts", () => {
  expect(apply("sentence", "NY RAPPORT OM KLIMATET. DEN VISAR MER!")).toBe("Ny rapport om klimatet. Den visar mer!");
});

test("sentenceCase keeps acronyms and mixed case in normal text", () => {
  expect(apply("sentence", "Ny Rapport Från EU Om iPhone")).toBe("Ny rapport från EU om iPhone");
});

test("sentenceCase does not start a sentence after an abbreviation", () => {
  expect(apply("sentence", "hon köpte t.ex. äpplen. sedan gick hon")).toBe("Hon köpte t.ex. äpplen. Sedan gick hon");
  expect(apply("sentence", "första\nandra rad")).toBe("Första\nAndra rad");
});

test("dedupeLines keeps the first of each line and every empty line", () => {
  expect(apply("dedupe", "a\nb\n a \n\nb\n\nc")).toBe("a\nb\n\n\nc");
});

test("bullets add, toggle off and replace other markers", () => {
  expect(apply("bullets", "ett\n\ntvå")).toBe("• ett\n\n• två");
  expect(apply("bullets", "• ett\n• två")).toBe("ett\ntvå");
  expect(apply("bullets", "1. ett\n- två")).toBe("• ett\n• två");
});

test("numbers count non-empty lines and toggle off", () => {
  expect(apply("numbers", "ett\n\ntvå\ntre")).toBe("1. ett\n\n2. två\n3. tre");
  expect(apply("numbers", "1) ett\n2) två")).toBe("ett\ntvå");
  expect(apply("numbers", "• ett\n• två")).toBe("1. ett\n2. två");
});

test("stripTags keeps text and line breaks, drops script, style and comments", () => {
  expect(
    apply("stripTags", '<h1 class="x">Rubrik</h1><p>Text med <b>fet</b><br>rad</p><!-- c --><script>alert(1)</script><style>p{}</style><p>Sist</p>'),
  ).toBe("Rubrik\nText med fet\nrad\nSist");
  expect(apply("stripTags", "a < b och c > d")).toBe("a < b och c > d");
});

test("decodeEntities handles names, decimal and hex, and leaves unknowns", () => {
  expect(apply("decodeEntities", "R&auml;k &amp; sm&#246;r &#xE5;&nbsp;x &okänd; &#0;")).toBe("Räk & smör å x &okänd; &#0;");
  expect(apply("decodeEntities", "&amp;lt;")).toBe("&lt;");
});
