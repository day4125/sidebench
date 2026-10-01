import { describe, expect, test } from "vitest";
import { contrast, formatRatio, formats, parseColor, simulate, suggestions, toHex, type Rgb } from "@/tools/color/engine";

const hex = (s: string) => {
  const c = parseColor(s);
  return c ? toHex(c) : null;
};
const rgb = (s: string) => parseColor(s)!;

describe("parseColor", () => {
  test("reads hex, rgb, hsl and oklch in their common spellings", () => {
    for (const s of ["#0f766e", "0f766e", "#0F766E", " #0f766e; ", "rgb(15, 118, 110)", "rgb(15 118 110)", "rgba(15,118,110,1)"]) {
      expect(hex(s), s).toBe("#0f766e");
    }
    expect(hex("#fff")).toBe("#ffffff");
    expect(hex("#0008")).toBe("#00000088");
    expect(hex("rgb(0 0 0 / 50%)")).toBe("#00000080");
    expect(hex("hsl(0, 100%, 50%)")).toBe("#ff0000");
    expect(hex("hsl(120deg 100% 25%)")).toBe("#008000");
    expect(hex("oklch(1 0 0)")).toBe("#ffffff");
    expect(hex("oklch(0% 0 0)")).toBe("#000000");
  });

  test("hands anything else to the browser", () => {
    expect(hex("rebeccapurple")).toBe("#663399");
    expect(hex("transparent")).toBe("#00000000");
  });

  test("refuses what isn't a color", () => {
    for (const s of ["", "#12", "#ggg", "rgb(1, 2)", "blå", "hsl(a, b, c)"]) expect(parseColor(s), s).toBeNull();
  });

  test("every format it writes reads back as the same color", () => {
    for (const s of ["#0f766e", "#14b8a6", "#ff0000", "#663399", "#fafafa", "#010203", "#12345680"]) {
      for (const f of formats(rgb(s))) {
        const back = rgb(f.value);
        const d = Math.max(Math.abs(back.r - rgb(s).r), Math.abs(back.g - rgb(s).g), Math.abs(back.b - rgb(s).b));
        expect(d, `${s} via ${f.value}`).toBeLessThanOrEqual(1);
        expect(back.a, f.value).toBeCloseTo(rgb(s).a, 2);
      }
    }
  });

  test("formats use the legacy comma syntax and drop alpha when opaque", () => {
    expect(formats(rgb("#0f766e")).map((f) => f.value)).toEqual([
      "#0f766e",
      "rgb(15, 118, 110)",
      "hsl(175.3, 77.4%, 26.1%)",
      "oklch(0.511 0.086 186.4)",
    ]);
    expect(formats(rgb("rgb(255 0 0 / 0.5)"))[1].value).toBe("rgba(255, 0, 0, 0.5)");
  });
});

describe("contrast", () => {
  test("matches WCAG 2", () => {
    expect(contrast(rgb("#fff"), rgb("#000"))).toBeCloseTo(21, 5);
    expect(contrast(rgb("#000"), rgb("#fff"))).toBeCloseTo(21, 5);
    expect(contrast(rgb("#777"), rgb("#777"))).toBe(1);
    expect(contrast(rgb("#777"), rgb("#fff"))).toBeCloseTo(4.48, 2);
  });

  test("lays translucent text over the background", () => {
    expect(contrast(rgb("rgb(0 0 0 / 0)"), rgb("#fff"))).toBe(1);
    expect(contrast(rgb("rgb(0 0 0 / 0.5)"), rgb("#fff"))).toBeCloseTo(contrast(rgb("#808080"), rgb("#fff")), 1);
  });

  test("ratios are cut, never rounded up past a line", () => {
    expect(formatRatio(4.4999)).toBe("4,49");
    expect(formatRatio(4.5)).toBe("4,5");
    expect(formatRatio(21)).toBe("21");
    expect(formatRatio(2.479)).toBe("2,47");
  });
});

describe("suggestions", () => {
  const check = (text: Rgb, bg: Rgb) => {
    const out = suggestions(text, bg);
    for (const s of out) {
      const target = s.level === "aa" ? 4.5 : 7;
      const ratio = s.side === "text" ? contrast(s.color, bg) : contrast(text, s.color);
      expect(ratio, `${s.side} ${s.level}`).toBeGreaterThanOrEqual(target);
      // The nearest: only just past the line.
      expect(ratio, `${s.side} ${s.level}`).toBeLessThan(target + 0.2);
    }
    return out;
  };

  test("offer both sides at both levels for a failing pair", () => {
    const out = check(rgb("#fff"), rgb("#14b8a6"));
    expect(out.map((s) => `${s.side}:${s.level}`).sort()).toEqual(["bg:aa", "bg:aaa", "text:aa", "text:aaa"]);
  });

  test("leave out the levels already passed", () => {
    expect(check(rgb("#000"), rgb("#fff"))).toEqual([]);
    // #666 on white is 5.74: passes AA, not AAA. Only the text can move;
    // white can't get lighter, and #666 on black is just 3.66.
    expect(check(rgb("#666"), rgb("#fff")).map((s) => `${s.side}:${s.level}`)).toEqual(["text:aaa"]);
  });

  test("leave out a side that can't get there", () => {
    // White gives 4.48 on #777 and black 4.69: no text color reaches 7.
    const out = check(rgb("#fff"), rgb("#777"));
    expect(out.some((s) => s.side === "text" && s.level === "aaa")).toBe(false);
    expect(out.some((s) => s.side === "bg" && s.level === "aaa")).toBe(true);
  });

  test("keep the hue", () => {
    const [bg] = suggestions(rgb("#fff"), rgb("#14b8a6")).filter((s) => s.side === "bg");
    const { g, b, r } = bg.color;
    expect(g).toBeGreaterThan(r);
    expect(b).toBeGreaterThan(r);
  });
});

describe("simulate", () => {
  test("leaves normal vision and grays alone", () => {
    expect(simulate(rgb("#14b8a6"), "normal")).toEqual(rgb("#14b8a6"));
    for (const v of ["protan", "deutan", "tritan", "gray"] as const) {
      expect(toHex(simulate(rgb("#808080"), v)), v).toBe("#808080");
    }
  });

  test("grayscale keeps the contrast", () => {
    const [t, b] = [rgb("#e11d48"), rgb("#14b8a6")];
    expect(contrast(simulate(t, "gray"), simulate(b, "gray"))).toBeCloseTo(contrast(t, b), 1);
  });

  test("protanopia and deuteranopia see red as a dark yellow", () => {
    // Red and green fold onto one yellow-blue axis: no blue, red ≈ green.
    for (const v of ["protan", "deutan"] as const) {
      const { r, g, b } = simulate(rgb("#f00"), v);
      expect(Math.abs(r - g), v).toBeLessThan(25);
      expect(b, v).toBeLessThan(10);
      expect(r, v).toBeLessThan(200);
    }
  });
});
