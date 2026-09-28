// Port of prodtools' tests/deworder/deworder.test.html. Same cases, same
// expectations; only the harness changed.
import { describe, expect, test } from "vitest";
import { clean, decodeHtmlBytes, detectClasses } from "@/tools/deworder/engine/deworder";
import fixture from "./fixtures/verify-fixture.html?raw";
import fixtureCleaned from "./fixtures/verify-fixture.cleaned.html?raw";
import * as input from "./inputs";

describe("detectClasses", () => {
  test("matches the Python verifier fixture", () => {
    expect(detectClasses(fixture)).toEqual([
      { tag_name: "p", class_name: "MsoNormal", count: 1 },
      { tag_name: "p", class_name: "NoKPunktlista", count: 2 },
      { tag_name: "p", class_name: "NoKRubrik1", count: 1 },
      { tag_name: "p", class_name: "NoKRubrik2", count: 1 },
      { tag_name: "p", class_name: "NoKRubrik3", count: 1 },
      { tag_name: "p", class_name: "NoKText", count: 1 },
      { tag_name: "span", class_name: "NoKBetoningKursiv", count: 1 },
    ]);
  });

  test("normalizes CxSp Word class suffixes", () => {
    expect(detectClasses(input.cxspClasses)).toEqual([
      { tag_name: "p", class_name: "NoKText", count: 3 },
    ]);
  });

  test("removes Word comment elements before counting", () => {
    expect(detectClasses(input.commentElements)).toEqual([
      { tag_name: "p", class_name: "NoKText", count: 1 },
    ]);
  });
});

describe("decodeHtmlBytes", () => {
  test("honors windows-1252 meta charsets", () => {
    const bytes = windows1252Bytes('<meta charset="windows-1252"><p>r', [0xe4], "ksm", [0xf6], "rg", [0xe5], "s ", [0x80], "</p>");
    expect(decodeHtmlBytes(bytes.buffer)).toBe('<meta charset="windows-1252"><p>räksmörgås €</p>');
  });

  test("falls back to utf-8 for unsupported labels", () => {
    const bytes = new TextEncoder().encode('<meta charset="made-up"><p>åäö</p>');
    expect(decodeHtmlBytes(bytes.buffer)).toBe('<meta charset="made-up"><p>åäö</p>');
  });
});

describe("clean", () => {
  test("converts the verifier fixture into useful semantic body HTML", () => {
    const cleaned = clean(fixture);
    expect(cleaned).toBe(`<h1>Islam</h1>
<h2>Historik</h2>
<h3>Begrepp</h3>
<p>Vanlig text med <em>betoning</em>.</p>
<ul><li>Första punkten</li><li>Andra punkten</li></ul>
<p>stavning</p>
`);
    for (const needle of ["MsoNormal", "class=", "<o:", "<w:", "<style", "<meta", "mso-", "SpellE", "WordSection1", "<!--"]) {
      expect(cleaned).not.toContain(needle);
    }
  });

  // The golden test: must hold byte for byte under the default config.
  test("matches the checked-in Python output for the verifier fixture", () => {
    expect(clean(fixture)).toBe(fixtureCleaned);
  });

  test("applies strip and keep mappings", () => {
    const cleaned = clean(input.stripAndKeep, input.stripKeepConfig);
    expect(cleaned).toContain("<p>Keep text</p>");
    expect(cleaned).toContain('<span class="NoKBetoningKursiv">Keep class</span>');
    expect(cleaned).not.toContain("Drop heading");
  });

  test("maps normalized CxSp class variants", () => {
    expect(clean(input.cxspSingle)).toBe("<p>A</p>\n");
  });

  test("preserves visible http links before unwrapping anchors", () => {
    expect(clean(input.linkWithText)).toBe("<p>Go to example (https://example.com/page).</p>\n");
    expect(clean(input.linkSelfLabelled)).toBe("<p>https://example.com</p>\n");
  });

  test("removes unsafe tags and noisy attributes", () => {
    expect(clean(input.unsafe)).toBe("<p>Safe</p>\n");
  });

  test("wraps separate list item runs without swallowing surrounding blocks", () => {
    expect(clean(input.listRuns)).toBe("<ul><li>A</li><li>B</li></ul>\n<p>Break</p>\n<ul><li>C</li></ul>\n");
  });

  test("wraps ol-mapped items in <ol> and ul-mapped items in <ul>, splitting on type change", () => {
    expect(clean(input.olThenUl, input.numListConfig)).toBe(
      "<ol><li>First</li><li>Second</li></ol>\n<ul><li>Bullet</li></ul>\n",
    );
    expect(clean(input.olUlOl, input.numListConfig)).toBe(
      "<ol><li>A</li></ol>\n<ul><li>B</li></ul>\n<ol><li>C</li></ol>\n",
    );
  });

  test("detects ol vs ul from Word list markers regardless of class", () => {
    expect(clean(input.wordListMarkers)).toBe(
      "<ol><li>Numbered one</li><li>Numbered two</li></ol>\n<ul><li>Bullet one</li></ul>\n",
    );
  });

  test("keeps !supportLists inner content but drops other conditional blocks", () => {
    const cleaned = clean(input.conditionalBlocks);
    expect(cleaned).toBe("<p>Body text</p>\n<p>More text</p>\n");
    expect(cleaned).not.toContain("[JH1]");
  });

  test("does not leak list detection data attributes", () => {
    expect(clean(input.singleListItem)).not.toContain("data-deworder");
  });

  test("collapses nested emphasis and prunes empty elements", () => {
    expect(clean(input.nestedEmphasis)).toBe("<p>A <strong>B</strong> <em>C</em></p>\n");
  });

  test("removes elements with mso-element:comment style", () => {
    const cleaned = clean(input.msoCommentStyle);
    expect(cleaned).toContain("<p>Keep</p>");
    expect(cleaned).not.toContain("Drop");
  });

  test("converts <b> and <i> inside a class-mapped heading", () => {
    expect(clean(input.headingWithInline)).toBe("<h2>Intro <strong>bold</strong> and <em>italic</em></h2>\n");
  });

  test("uses first matching class when multiple mapped classes appear", () => {
    // NoKRubrik2 sorts before NoKText alphabetically (R < T), so if the
    // lookup were alphabetical NoKRubrik2 (h2) would always win.
    // These two cases prove it is attribute-order-dependent instead.
    expect(clean(input.classOrderTextFirst)).toBe("<p>text</p>\n");
    expect(clean(input.classOrderHeadingFirst)).toBe("<h2>text</h2>\n");
  });

  test("table_mode=flatten extracts cell content as paragraphs", () => {
    expect(clean(input.tableCells, { table_mode: "flatten" })).toBe("<p>A</p>\n<p>B</p>\n");
  });

  test("table_mode=keep preserves table structure and strips colgroup/col/caption", () => {
    const cleaned = clean(input.tableExtras, { table_mode: "keep" });
    expect(cleaned).toContain("<table>");
    expect(cleaned).toContain("<td>");
    expect(cleaned).toContain("<p>Cell</p>");
    expect(cleaned).not.toContain("<colgroup>");
    expect(cleaned).not.toContain("<col>");
    expect(cleaned).not.toContain("<caption>");
  });
});

function windows1252Bytes(...parts: (string | number[])[]): Uint8Array<ArrayBuffer> {
  const bytes: number[] = [];
  for (const part of parts) {
    if (typeof part === "string") {
      bytes.push(...[...part].map((char) => char.charCodeAt(0)));
    } else {
      bytes.push(...part);
    }
  }
  return new Uint8Array(bytes);
}
