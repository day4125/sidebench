import { describe, expect, it } from "vitest";
import { allGlyphs, CHARS, describe as describeChar, lookalikes } from "@/tools/chars/data";
import { search } from "@/tools/chars/search";

const top = (q: string) => search(q)[0]?.ch;

describe("chars search", () => {
  it("returns everything for an empty query", () => {
    expect(search("  ")).toBe(CHARS);
  });

  it("finds by Swedish and English name", () => {
    expect(top("långt tankstreck")).toBe("—");
    expect(top("em dash")).toBe("—");
    expect(top("grader")).toBe("°");
    expect(top("degree")).toBe("°");
    expect(top("pil höger")).toBe("→");
  });

  it("ranks name matches first", () => {
    expect(search("pil").slice(0, 4).every((c) => c.name.startsWith("Pil"))).toBe(true);
  });

  it("ignores case and accents", () => {
    expect(top("GRADER")).toBe("°");
    expect(top("hart mellanslag")).toBe(" ");
  });

  it("finds by code point and entity", () => {
    expect(top("U+2192")).toBe("→");
    expect(top("2014")).toBe("—");
    expect(top("mdash")).toBe("—");
    expect(top("&hellip;")).toBe("…");
  });

  it("finds a pasted character", () => {
    expect(top("–")).toBe("–");
    expect(top("π")).toBe("π");
  });

  it("finds every quotation mark from a typed quote", () => {
    const quotes = ["”", "“", "„", "’", "‘", "‚", "»", "«", "›", "‹"];
    expect(search('"').map((c) => c.ch)).toEqual(quotes);
    expect(search("'").map((c) => c.ch)).toEqual(quotes);
  });

  it("finds super- and subscripts", () => {
    expect(top("upphöjd 2")).toBe("²");
    expect(top("subscript two")).toBe("₂");
  });

  it("finds the degree sign by celsius", () => {
    expect(search("celsius").map((c) => c.ch)).toEqual(expect.arrayContaining(["°", "℃"]));
  });

  it("finds letters by language and by accent", () => {
    const french = search("franska").map((c) => c.ch);
    expect(french).toEqual(expect.arrayContaining(["ç", "Ç", "œ", "è", "«"]));
    expect(french).not.toContain("ñ");
    expect(top("n med tilde")).toBe("ñ");
    expect(top("eszett")).toBe("ß");
    expect(top("Ccedil")).toBe("Ç");
  });

  it("finds fractions as written", () => {
    expect(top("1/4")).toBe("¼");
    expect(top("3/8")).toBe("⅜");
    expect(search("1/").length).toBe(9);
    expect(top("frac58")).toBe("⅝");
  });

  it("finds by the official Unicode name", () => {
    expect(top("latin small letter e with acute")).toBe("é");
    expect(top("ohm sign")).toBe("\u2126");
    expect(top("no-break space")).toBe("\u00A0");
  });

  it("has a Unicode name for every character it can show", () => {
    // If this fails, run: python3 scripts/gen-char-names.py
    const missing = allGlyphs().filter((ch) => !describeChar(ch).en);
    expect(missing).toEqual([]);
    expect(describeChar("—").en).toBe("EM DASH");
  });

  it("returns nothing for nonsense", () => {
    expect(search("qqzz")).toEqual([]);
  });

  it("keeps codes unique within a category and lookalikes symmetric", () => {
    const seen = new Set<string>();
    for (const c of CHARS) {
      const key = `${c.cat}:${c.code}`;
      expect(seen.has(key), key).toBe(false);
      seen.add(key);
    }
    expect(lookalikes("–")).toContain("—");
    expect(lookalikes("—")).toContain("–");
  });
});
