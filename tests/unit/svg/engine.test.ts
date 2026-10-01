// SVG-viewer engine: sizes, the element tree and its weights, selection,
// the cut-out file (with the defs it uses), rotation, colors, removal and
// parse errors. Runs in Chromium, which the geometry copy needs.
import { afterEach, describe, expect, it } from "vitest";
import {
  BUDGET, SvgError, colorKey, extract, formatBytes, marquee, normalize, openSvg, pickLevel, recolor, remove, rotate, utf8Length, type SvgDoc,
} from "@/tools/svg/engine";

const NS = 'xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"';

const FIXTURE = `<svg ${NS} viewBox="0 0 200 100" width="400" height="200">
<style>.ink{fill:#ff0000}</style>
<defs>
  <linearGradient id="grad"><stop offset="0" stop-color="#00ff00"/><stop offset="1" stop-color="blue"/></linearGradient>
  <linearGradient id="unused"><stop offset="0" stop-color="#123456"/></linearGradient>
  <clipPath id="clip"><rect x="110" y="10" width="80" height="80"/></clipPath>
</defs>
<g id="left" transform="translate(10 10)">
  <rect id="a" x="0" y="0" width="40" height="30" fill="url(#grad)"/>
  <circle id="b" cx="60" cy="50" r="10" class="ink"/>
</g>
<g id="right" clip-path="url(#clip)">
  <rect id="c" x="120" y="20" width="60" height="60" style="fill:#0000ff;stroke:#000"/>
</g>
</svg>`;

let open: SvgDoc[] = [];
const load = (text: string) => {
  const d = openSvg(text);
  open.push(d);
  return d;
};
afterEach(() => {
  open.forEach((d) => d.dispose());
  open = [];
});
const byId = (d: SvgDoc, id: string) => d.nodes.findIndex((n) => n.el.getAttribute("id") === id);

describe("sizes", () => {
  it("counts UTF-8 bytes", () => {
    expect(utf8Length("abc")).toBe(3);
    expect(utf8Length("åäö")).toBe(6);
    expect(utf8Length("😀")).toBe(4);
  });

  it("formats bytes the CMS way (SI, Swedish)", () => {
    expect(formatBytes(840)).toBe("840 byte");
    expect(formatBytes(12_400)).toBe("12,4 kB");
    expect(formatBytes(412_000)).toBe("412 kB");
    expect(formatBytes(1_820_000)).toBe("1,82 MB");
    expect(formatBytes(25_000_000)).toBe("25 MB");
    expect(BUDGET).toBe(500_000);
  });
});

describe("opening", () => {
  it("builds the tree with weights that add up to the file", () => {
    const d = load(FIXTURE);
    expect(d.nodes[0].tag).toBe("svg");
    expect(d.view).toEqual({ x: 0, y: 0, w: 200, h: 100 });
    // Within a few bytes per element of the real size.
    expect(Math.abs(d.nodes[0].bytes - d.bytes)).toBeLessThan(d.nodes.length * 4);
    const left = byId(d, "left");
    expect(d.nodes[left].bytes).toBeGreaterThan(d.nodes[byId(d, "a")].bytes + d.nodes[byId(d, "b")].bytes);
  });

  it("finds boxes in root user space, transforms and CSS included", () => {
    const d = load(FIXTURE);
    const a = d.nodes[byId(d, "a")].box!;
    expect(a.x).toBeCloseTo(10);
    expect(a.y).toBeCloseTo(10);
    expect(a.w).toBeCloseTo(40);
    // Stroke from style="" widens the box by half the stroke width.
    const c = d.nodes[byId(d, "c")].box!;
    expect(c.x).toBeCloseTo(119.5);
    expect(c.w).toBeCloseTo(61);
    expect(d.nodes[byId(d, "grad")].box).toBeNull();
  });

  it("hit-tests the topmost shape and picks its figure", () => {
    const d = load(FIXTURE);
    const leaf = d.hit(70, 60);
    expect(d.nodes[leaf].el.id).toBe("b");
    expect(d.nodes[pickLevel(d, leaf)].el.id).toBe("left");
    expect(d.hit(100, 95)).toBe(-1);
  });

  it("uses width/height when there is no viewBox", () => {
    const d = load(`<svg ${NS} width="120" height="60"><rect width="10" height="10"/></svg>`);
    expect(d.view).toEqual({ x: 0, y: 0, w: 120, h: 60 });
  });

  it("refuses what isn't SVG", () => {
    expect(() => openSvg("<svg")).toThrow(SvgError);
    expect(() => openSvg('<html xmlns="http://www.w3.org/1999/xhtml"/>')).toThrow(/rotelementet är <html>/);
  });
});

describe("selection", () => {
  it("collapses a marquee that catches a whole group into the group", () => {
    const d = load(FIXTURE);
    const sel = marquee(d, { x: 0, y: 0, w: 100, h: 100 });
    expect(sel.map((i) => d.nodes[i].el.id)).toEqual(["left"]);
    const part = marquee(d, { x: 0, y: 0, w: 55, h: 45 });
    expect(part.map((i) => d.nodes[i].el.id)).toEqual(["a"]);
  });

  it("drops nodes whose ancestor is selected", () => {
    const d = load(FIXTURE);
    expect(normalize(d, [byId(d, "a"), byId(d, "left")]).map((i) => d.nodes[i].el.id)).toEqual(["left"]);
  });
});

describe("writing", () => {
  it("cuts a selection out with its ancestors, styles and the defs it uses", () => {
    const d = load(FIXTURE);
    const out = extract(d, [byId(d, "a")]);
    const doc = new DOMParser().parseFromString(out, "image/svg+xml");
    const root = doc.documentElement;
    expect(root.getAttribute("viewBox")).toBe("10 10 40 30");
    expect(root.querySelector("#a")).not.toBeNull();
    expect(root.querySelector("#left")?.getAttribute("transform")).toBe("translate(10 10)");
    expect(root.querySelector("#grad")).not.toBeNull();
    expect(root.querySelector("#unused")).toBeNull();
    expect(root.querySelector("#b")).toBeNull();
    expect(root.querySelector("style")?.textContent).toContain(".ink");
    expect(utf8Length(out)).toBeLessThan(d.bytes);
  });

  it("brings a clip path along and keeps style attributes", () => {
    const d = load(FIXTURE);
    const out = extract(d, [byId(d, "right")]);
    expect(out).toContain('id="clip"');
    expect(out).toContain('style="fill:#0000ff;stroke:#000"');
    expect(out).not.toContain("xstyl");
  });

  it("removes the selection", () => {
    const d = load(FIXTURE);
    const out = remove(d, [byId(d, "left")]);
    expect(out).not.toContain('id="left"');
    expect(out).toContain('id="right"');
  });

  it("rotates a quarter turn into the file", () => {
    const d = load(FIXTURE);
    const turned = load(rotate(d, 1));
    expect(turned.view).toEqual({ x: -100, y: 0, w: 100, h: 200 });
    expect(turned.doc.documentElement.getAttribute("width")).toBe("200");
    expect(turned.doc.documentElement.getAttribute("height")).toBe("400");
    const back = load(rotate(load(rotate(turned, 2)), 1));
    expect(back.view).toEqual(d.view);
  });

  it("lists colors from attributes, style and <style>, and recolors them all", () => {
    const d = load(FIXTURE);
    const keys = d.palette.map((s) => s.key);
    expect(keys).toEqual(expect.arrayContaining(["#00ff00", "#0000ff", "#ff0000", "#000000"]));
    expect(colorKey("BLUE")).toBe("#0000ff");
    expect(colorKey("none")).toBeNull();

    const out = recolor(d, "#0000ff", "#abcdef");
    expect(out).toContain('stop-color="#abcdef"');
    expect(out).toContain("fill:#abcdef");
    expect(out).not.toMatch(/blue|#0000ff/);
    // Ids and class names that look like color words stay.
    const named = load(`<svg ${NS} viewBox="0 0 10 10"><style>.red{fill:red}</style><rect class="red" fill="url(#red)" width="5" height="5"/></svg>`);
    const swapped = recolor(named, "#ff0000", "currentColor");
    expect(swapped).toContain(".red{fill:currentColor}");
    expect(swapped).toContain('fill="url(#red)"');
  });
});
