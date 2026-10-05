// SVG-viewer engine: parse an SVG, weigh its elements, find them on the
// canvas, and write new versions of it (cut out, delete, rotate, recolor,
// swap embedded images, heat render).
//
// Two copies of the drawing exist while a document is open:
// - the parsed Document, which every edit clones and serializes, and
// - a geometry copy, sanitized and mounted invisibly in a shadow root, which
//   answers "where is this element" (getBBox, isPointInFill). The page CSP
//   blocks inline styles, so the SVG's <style> goes in as a constructed
//   stylesheet and its style="" attributes through the CSSOM; both are
//   allowed. What the user sees is the SVG as <img src=blob:>, which renders
//   it faithfully and never runs or loads anything.
//
// Everything stays in memory (INTENT.md).
import { fromOklch, parseColor, toHex } from "@/tools/color/engine";

export const SVG_NS = "http://www.w3.org/2000/svg";
const XLINK_NS = "http://www.w3.org/1999/xlink";

/** The CMS's hard limit, raw bytes. */
export const BUDGET = 500_000;
/** Refused before parsing: parsing more can freeze the tab. */
export const MAX_BYTES = 25_000_000;
/** Works, but optimizing takes a while; the page says so. */
export const SLOW_BYTES = 10_000_000;
/** Above this many drawn elements the heat render is off. */
export const HEAT_MAX = 20_000;

// ---------------------------------------------------------------------------
// Bytes

/** UTF-8 length of a string, without encoding it. */
export function utf8Length(s: string): number {
  let n = s.length;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x80) continue;
    if (c < 0x800) n += 1;
    else if (c >= 0xd800 && c <= 0xdbff) {
      n += 2;
      i++;
    } else n += 2;
  }
  return n;
}

const nf0 = new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 2 });

/** "840 byte", "12,4 kB", "412 kB", "1,82 MB" (SI units, as the CMS counts). */
export function formatBytes(n: number): string {
  const a = Math.abs(n);
  if (a < 1000) return `${nf0.format(n)} byte`;
  if (a < 100_000) return `${nf1.format(n / 1000)} kB`;
  if (a < 999_500) return `${nf0.format(n / 1000)} kB`;
  return `${nf2.format(n / 1e6)} MB`;
}

// ---------------------------------------------------------------------------
// Geometry types

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const union = (a: Box | null, b: Box | null): Box | null => {
  if (!a) return b;
  if (!b) return a;
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
};

const contains = (outer: Box, inner: Box) =>
  inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.w <= outer.x + outer.w && inner.y + inner.h <= outer.y + outer.h;

// ---------------------------------------------------------------------------
// The element tree

/** Elements whose content is never drawn where it stands. */
const NOT_RENDERED = new Set([
  "defs", "clipPath", "mask", "pattern", "marker", "symbol", "linearGradient", "radialGradient",
  "filter", "xstyl", "script", "title", "desc", "metadata", "font", "font-face", "cursor", "view",
]);
const GROUPS = new Set(["g", "a", "svg", "switch"]);
const SHAPES = new Set(["path", "rect", "circle", "ellipse", "line", "polyline", "polygon", "text", "image", "use", "foreignObject"]);

export interface SvgNode {
  /** Index in document order; nodes[0] is the root. */
  i: number;
  el: Element;
  tag: string;
  /** id, inkscape:label, data-name or class, whichever comes first. */
  label: string;
  parent: number;
  children: number[];
  depth: number;
  /** Serialized size, children included (an estimate within a few bytes). */
  bytes: number;
  /** Drawn where it stands: a group or shape outside defs and the like. */
  rendered: boolean;
  /** A drawn shape (no element children that are drawn). */
  leaf: boolean;
  /** Bounds in root user space, stroke included; null when not drawn or empty. */
  box: Box | null;
  /** For the hit test and the heat render. */
  fillNone: boolean;
  strokeNone: boolean;
}

function labelOf(el: Element): string {
  return (
    el.getAttribute("id") ??
    el.getAttributeNS("http://www.inkscape.org/namespaces/inkscape", "label") ??
    el.getAttribute("data-name") ??
    el.getAttribute("class") ??
    ""
  );
}

/** An element serialized without the namespace declarations the serializer adds for it. */
function serializeOwn(ser: XMLSerializer, el: Element): string {
  const s = ser.serializeToString(el);
  return s.replace(/ xmlns(:[\w-]+)?="[^"]*"/g, (decl, prefix: string | undefined) =>
    el.hasAttribute(prefix ? `xmlns${prefix}` : "xmlns") ? decl : "",
  );
}

/** Byte weights bottom-up: leaves serialized once, groups summed. */
function weigh(nodes: SvgNode[]) {
  const ser = new XMLSerializer();
  for (let k = nodes.length - 1; k >= 0; k--) {
    const n = nodes[k];
    if (!n.children.length) {
      n.bytes = utf8Length(serializeOwn(ser, n.el));
      continue;
    }
    // Own tags plus text between children plus the children.
    const shallow = serializeOwn(ser, n.el.cloneNode(false) as Element);
    let bytes = utf8Length(shallow) + n.el.tagName.length + 2; // "<g …/>" → "<g …></g>"
    for (const c of n.el.childNodes) if (c.nodeType !== 1) bytes += utf8Length(c.textContent ?? "");
    for (const c of n.children) bytes += nodes[c].bytes;
    n.bytes = bytes;
  }
}

function buildNodes(root: Element): SvgNode[] {
  const nodes: SvgNode[] = [];
  const walk = (el: Element, parent: number, depth: number, hidden: boolean) => {
    const tag = el.localName;
    const i = nodes.length;
    const inSvg = el.namespaceURI === SVG_NS;
    const rendered = !hidden && inSvg && (GROUPS.has(tag) || SHAPES.has(tag));
    nodes.push({
      // The <style> placeholder never reaches the screen.
      i, el, tag: tag === STYLE_EL ? "style" : tag, label: labelOf(el), parent, children: [], depth, bytes: 0,
      rendered, leaf: false, box: null, fillNone: false, strokeNone: true,
    });
    if (parent >= 0) nodes[parent].children.push(i);
    // A shape's children (tspan, title, animate) belong to it.
    const below = hidden || !inSvg || NOT_RENDERED.has(tag) || SHAPES.has(tag);
    for (const c of el.children) walk(c, i, depth + 1, below);
  };
  walk(root, -1, 0, false);
  for (const n of nodes) {
    n.leaf = n.rendered && SHAPES.has(n.tag);
    if (n.i === 0) n.rendered = true;
  }
  return nodes;
}

// ---------------------------------------------------------------------------
// The geometry copy

/** CSS from the file, without anything it could load. */
function safeCss(css: string): string {
  return css.replace(/@import[^;]*;?/gi, "").replace(/url\(\s*(['"]?)(?!#)[^)]*\)/gi, "none");
}

const isLocalRef = (v: string | null) => !v || v.startsWith("#") || v.startsWith("data:");

/**
 * Clones the document into a hidden shadow root and returns the clone's
 * elements in the same order as `nodes`. Scripts, handlers and anything
 * that points off the page are removed from the clone.
 */
function mountGeometry(doc: Document, count: number) {
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  // Off screen and transparent, not visibility:hidden: that would be
  // inherited and read as "hidden by the file" on every shape.
  host.style.cssText = "position:fixed;left:-100000px;top:0;opacity:0;pointer-events:none;contain:strict;width:1px;height:1px";
  const shadow = host.attachShadow({ mode: "open" });
  // Cleaned while still inert: an imported style="" would be refused by the
  // CSP (and reported) before it could be moved to the CSSOM.
  const inert = doc.documentElement.cloneNode(true) as Element;
  const styleAttrs: (string | null)[] = [];
  const css: string[] = [];
  const walkInert = (el: Element) => {
    styleAttrs.push(el.getAttribute(STYLE_ATTR));
    el.removeAttribute(STYLE_ATTR);
    // Emptied, not removed, so the clone stays in step with the nodes.
    if (el.localName === STYLE_EL) {
      css.push(el.textContent ?? "");
      el.textContent = "";
    } else if (el.localName === "script") el.textContent = "";
    for (const c of el.children) walkInert(c);
  };
  walkInert(inert);
  const clone = document.importNode(inert, true);
  const els: Element[] = [];
  const collect = (el: Element) => {
    els.push(el);
    for (const c of el.children) collect(c);
  };
  collect(clone);
  if (els.length !== count) throw new Error("geometry copy out of step");

  for (const el of els) {
    const tag = el.localName;
    for (const a of [...el.attributes]) {
      if (/^on/i.test(a.name)) el.removeAttribute(a.name);
      else if (a.localName === "href" && !isLocalRef(a.value)) el.removeAttributeNode(a);
      // An image's box comes from its attributes; decoding it would only cost memory.
      else if (a.localName === "href" && tag === "image" && el.hasAttribute("width") && el.hasAttribute("height")) el.removeAttributeNode(a);
    }
  }
  clone.querySelectorAll(`script, ${STYLE_EL}`).forEach((n) => n.remove());
  if (css.length) {
    const sheet = new CSSStyleSheet();
    try {
      sheet.replaceSync(safeCss(css.join("\n")));
      shadow.adoptedStyleSheets = [sheet];
    } catch {
      // Unparseable CSS: geometry without it.
    }
  }
  shadow.append(clone);
  // style="" can't be set as an attribute under the CSP; the CSSOM can.
  els.forEach((el, k) => {
    const s = styleAttrs[k];
    if (s != null && (el instanceof SVGElement || el instanceof HTMLElement)) el.style.cssText = safeCss(s);
  });
  document.body.append(host);
  return { host, els };
}

function transformBox(m: DOMMatrix, b: { x: number; y: number; width: number; height: number }): Box {
  const pts = [
    new DOMPoint(b.x, b.y).matrixTransform(m),
    new DOMPoint(b.x + b.width, b.y).matrixTransform(m),
    new DOMPoint(b.x, b.y + b.height).matrixTransform(m),
    new DOMPoint(b.x + b.width, b.y + b.height).matrixTransform(m),
  ];
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

// ---------------------------------------------------------------------------
// Hit grid: boxes bucketed so a point or marquee checks a few elements.

const GRID = 64;

class HitGrid {
  private cells: number[][] = Array.from({ length: GRID * GRID }, () => []);
  private big: number[] = [];
  constructor(private view: Box, boxes: { i: number; box: Box }[]) {
    for (const { i, box } of boxes) {
      const [c0, r0] = this.cell(box.x, box.y);
      const [c1, r1] = this.cell(box.x + box.w, box.y + box.h);
      if ((c1 - c0 + 1) * (r1 - r0 + 1) > 64) {
        this.big.push(i);
        continue;
      }
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) this.cells[r * GRID + c].push(i);
    }
  }
  private cell(x: number, y: number): [number, number] {
    const c = Math.floor(((x - this.view.x) / (this.view.w || 1)) * GRID);
    const r = Math.floor(((y - this.view.y) / (this.view.h || 1)) * GRID);
    return [Math.min(GRID - 1, Math.max(0, c)), Math.min(GRID - 1, Math.max(0, r))];
  }
  at(x: number, y: number): number[] {
    const [c, r] = this.cell(x, y);
    return [...this.cells[r * GRID + c], ...this.big];
  }
}

// ---------------------------------------------------------------------------
// Opening a document

export interface EmbeddedImage {
  node: number;
  mime: string;
  /** Bytes of the href value (the base64 text). */
  bytes: number;
  href: string;
}

export interface Swatch {
  /** Normalized #rrggbb(aa), the key colors are grouped by. */
  key: string;
  count: number;
}

export interface SvgDoc {
  text: string;
  bytes: number;
  doc: Document;
  nodes: SvgNode[];
  /** The drawing's user-space window: viewBox, else width/height, else content. */
  view: Box;
  /** The text the canvas shows: the document with its root sized to the view. */
  displayText: string;
  images: EmbeddedImage[];
  palette: Swatch[];
  /** Number of drawn shapes. */
  shapes: number;
  /** Point → topmost shape index, or -1. */
  hit(x: number, y: number): number;
  dispose(): void;
}

export class SvgError extends Error {}

// The page CSP checks style="" and <style> even in a parsed document that
// is never shown, and reports each one as an error. While parsed, both go
// by a placeholder of the same length (so byte counts hold), and every
// serialization puts the real name back.
export const STYLE_ATTR = "xstyl";
/** The <style> element's name while parsed. */
export const STYLE_EL = "xstyl";

export function hideStyles(text: string): string {
  return text
    .replace(/(\s)style(\s*=\s*["'])/g, `$1${STYLE_ATTR}$2`)
    .replace(/<(\/?)style([\s>/])/g, `<$1${STYLE_EL}$2`);
}

export function showStyles(text: string): string {
  return text
    .replace(new RegExp(`(\\s)${STYLE_ATTR}(\\s*=\\s*["'])`, "g"), "$1style$2")
    .replace(new RegExp(`<(/?)${STYLE_EL}([\\s>/])`, "g"), "<$1style$2");
}

/** Parses SVG text with its styles under their placeholders. */
export function parseXml(text: string): Document {
  return new DOMParser().parseFromString(hideStyles(text), "image/svg+xml");
}

export function serialize(node: Node): string {
  return showStyles(new XMLSerializer().serializeToString(node));
}

/** Parses SVG text; throws SvgError with a Swedish message when it can't. */
export function parseSvg(text: string): Document {
  if (text.length > MAX_BYTES * 1.1 || utf8Length(text) > MAX_BYTES) {
    throw new SvgError(`Filen är större än ${formatBytes(MAX_BYTES)} och läses inte in, så att fliken inte fryser.`);
  }
  const doc = parseXml(text);
  const err = doc.querySelector("parsererror");
  if (err) {
    const msg = (err.textContent ?? "").replace(/\s+/g, " ").trim();
    const line = /line (\d+)/i.exec(msg)?.[1];
    throw new SvgError(`Koden är inte giltig SVG${line ? ` (fel på rad ${line})` : ""}. ${msg.replace(/^.*?error on line \d+ at column \d+:\s*/i, "").slice(0, 160)}`);
  }
  const root = doc.documentElement;
  if (root.namespaceURI !== SVG_NS || root.localName !== "svg") {
    throw new SvgError(`Det här är inte en SVG: rotelementet är <${root.localName}>${root.localName === "svg" ? " utan SVG-namnrymden (xmlns)" : ""}.`);
  }
  return doc;
}

function parseViewBox(root: Element): Box | null {
  const v = root.getAttribute("viewBox")?.trim().split(/[\s,]+/).map(Number);
  if (!v || v.length !== 4 || v.some((n) => !Number.isFinite(n)) || v[2] <= 0 || v[3] <= 0) return null;
  return { x: v[0], y: v[1], w: v[2], h: v[3] };
}

export function openSvg(text: string): SvgDoc {
  const doc = parseSvg(text);
  const root = doc.documentElement;
  const nodes = buildNodes(root);
  weigh(nodes);

  const { host, els } = mountGeometry(doc, nodes.length);
  const gRoot = els[0] as SVGSVGElement;

  // The view, in the root's user space.
  let view = parseViewBox(root);
  if (!view) {
    const w = gRoot.width?.baseVal?.value;
    const h = gRoot.height?.baseVal?.value;
    if (root.hasAttribute("width") && root.hasAttribute("height") && w > 0 && h > 0) view = { x: 0, y: 0, w, h };
  }
  // Size the copy to the view so screen and user space line up 1:1.
  const provisional = view ?? { x: 0, y: 0, w: 1000, h: 1000 };
  gRoot.setAttribute("viewBox", `${provisional.x} ${provisional.y} ${provisional.w} ${provisional.h}`);
  gRoot.setAttribute("width", String(provisional.w));
  gRoot.setAttribute("height", String(provisional.h));
  gRoot.setAttribute("preserveAspectRatio", "none");

  const rootInv = gRoot.getScreenCTM()?.inverse() ?? new DOMMatrix();
  const local = new Map<number, DOMMatrix>();
  for (const n of nodes) {
    if (!n.leaf) continue;
    const g = els[n.i];
    if (!(g instanceof SVGGraphicsElement)) continue;
    let bb: DOMRect;
    try {
      bb = g.getBBox();
    } catch {
      continue;
    }
    const cs = getComputedStyle(g);
    if (cs.display === "none" || cs.visibility === "hidden") continue;
    const ctm = g.getScreenCTM();
    if (!ctm) continue;
    const m = rootInv.multiply(ctm);
    local.set(n.i, m);
    n.fillNone = cs.fill === "none";
    n.strokeNone = cs.stroke === "none" || parseFloat(cs.strokeWidth) === 0;
    if (bb.width === 0 && bb.height === 0 && n.tag !== "use") continue;
    let box = transformBox(m, bb);
    if (!n.strokeNone) {
      const pad = (parseFloat(cs.strokeWidth) / 2) * Math.sqrt(Math.abs(m.a * m.d - m.b * m.c));
      box = { x: box.x - pad, y: box.y - pad, w: box.w + 2 * pad, h: box.h + 2 * pad };
    }
    n.box = box;
  }
  for (let k = nodes.length - 1; k > 0; k--) {
    const n = nodes[k];
    if (n.box && n.parent >= 0) nodes[n.parent].box = union(nodes[n.parent].box, n.box);
  }
  // Groups of nothing drawn don't count as drawn.
  for (const n of nodes) if (n.rendered && !n.leaf && !n.box && n.i !== 0) n.rendered = false;
  if (!view) view = nodes[0].box ?? { x: 0, y: 0, w: 300, h: 150 };

  const shapes = nodes.filter((n) => n.leaf && n.box);
  const grid = new HitGrid(view, shapes.map((n) => ({ i: n.i, box: n.box! })));

  const hit = (x: number, y: number): number => {
    const candidates = grid.at(x, y).sort((a, b) => b - a); // topmost (last drawn) first
    for (const i of candidates) {
      const n = nodes[i];
      const b = n.box!;
      if (x < b.x || y < b.y || x > b.x + b.w || y > b.y + b.h) continue;
      const g = els[i];
      if (!(g instanceof SVGGeometryElement)) return i;
      const m = local.get(i);
      if (!m) continue;
      const p = new DOMPoint(x, y).matrixTransform(m.inverse());
      if ((!n.fillNone && g.isPointInFill(p)) || (!n.strokeNone && g.isPointInStroke(p))) return i;
    }
    return -1;
  };

  return {
    text,
    bytes: utf8Length(text),
    doc,
    nodes,
    view,
    displayText: sizedToView(doc, view),
    images: findImages(nodes),
    palette: collectPalette(doc),
    shapes: shapes.length,
    hit,
    dispose: () => host.remove(),
  };
}

/** The document with its root sized to the view, for <img> and the overlay to line up. */
function sizedToView(doc: Document, view: Box): string {
  const root = doc.documentElement.cloneNode(true) as Element;
  root.setAttribute("viewBox", `${view.x} ${view.y} ${view.w} ${view.h}`);
  root.setAttribute("width", String(view.w));
  root.setAttribute("height", String(view.h));
  root.setAttribute("preserveAspectRatio", "none");
  return serialize(root);
}

// ---------------------------------------------------------------------------
// Selection

/** The element a click on a shape picks: its highest ancestor smaller than most of the drawing. */
export function pickLevel(d: SvgDoc, leaf: number): number {
  const area = d.view.w * d.view.h;
  let pick = leaf;
  for (let p = d.nodes[leaf].parent; p > 0; p = d.nodes[p].parent) {
    const b = d.nodes[p].box;
    if (b && b.w * b.h < area * 0.6) pick = p;
  }
  return pick;
}

/** One step from `from` toward `leaf` (for a double-click into a group). */
export function stepToward(d: SvgDoc, from: number, leaf: number): number {
  let i = leaf;
  while (i > 0 && d.nodes[i].parent !== from) i = d.nodes[i].parent;
  return i > 0 ? i : leaf;
}

/**
 * Shapes wholly inside the marquee, collapsed upward: a group whose every
 * drawn child is caught counts as one.
 */
export function marquee(d: SvgDoc, area: Box): number[] {
  const all = new Uint8Array(d.nodes.length);
  for (let k = d.nodes.length - 1; k > 0; k--) {
    const n = d.nodes[k];
    if (!n.rendered || !n.box) continue;
    if (n.leaf) {
      all[k] = contains(area, n.box) ? 1 : 0;
      continue;
    }
    const drawn = n.children.filter((c) => d.nodes[c].rendered && d.nodes[c].box);
    all[k] = drawn.length > 0 && drawn.every((c) => all[c]) ? 1 : 0;
  }
  const out: number[] = [];
  for (let k = 1; k < d.nodes.length; k++) if (all[k] && (d.nodes[k].parent === 0 || !all[d.nodes[k].parent])) out.push(k);
  return out;
}

/** Drops nodes whose ancestor is also selected; document order. */
export function normalize(d: SvgDoc, sel: Iterable<number>): number[] {
  const set = new Set(sel);
  return [...set]
    .filter((i) => {
      for (let p = d.nodes[i].parent; p > 0; p = d.nodes[p].parent) if (set.has(p)) return false;
      return i > 0;
    })
    .sort((a, b) => a - b);
}

export const selectionBox = (d: SvgDoc, sel: number[]) => sel.reduce<Box | null>((b, i) => union(b, d.nodes[i].box), null);

/** Shapes under a selection, for the heat render and outlines. */
export function shapesIn(d: SvgDoc, sel: number[]): number[] {
  const out: number[] = [];
  const visit = (i: number) => {
    const n = d.nodes[i];
    if (n.leaf) {
      if (n.box) out.push(i);
      return;
    }
    for (const c of n.children) visit(c);
  };
  sel.forEach(visit);
  return out;
}

// ---------------------------------------------------------------------------
// Writing new versions


/** Ids an element and its subtree point at (url(#x), href="#x", in CSS too). */
function refsOf(el: Element, out: Set<string>) {
  const scan = (s: string) => {
    for (const m of s.matchAll(/url\(\s*['"]?#([^'")\s]+)/g)) out.add(m[1]);
  };
  const visit = (e: Element) => {
    for (const a of e.attributes) {
      if (a.localName === "href" && a.value.startsWith("#")) out.add(a.value.slice(1));
      else if (a.value.includes("url(")) scan(a.value);
    }
    if (e.localName === STYLE_EL) scan(e.textContent ?? "");
    for (const c of e.children) visit(c);
  };
  visit(el);
}

const fmt = (n: number) => String(Math.round(n * 100) / 100);

/** A box widened to two decimals, never cutting into it. */
function outward(b: Box): Box {
  const x = Math.floor(b.x * 100) / 100;
  const y = Math.floor(b.y * 100) / 100;
  return { x, y, w: Math.ceil((b.x + b.w - x) * 100) / 100, h: Math.ceil((b.y + b.h - y) * 100) / 100 };
}

/**
 * The selection as its own SVG: its ancestors (for their transforms and
 * inherited styles), every <style>, the defs it uses, and a viewBox
 * cropped to it.
 */
export function extract(d: SvgDoc, sel: number[]): string {
  const sorted = normalize(d, sel);
  const src = d.doc.documentElement;
  const root = src.cloneNode(false) as Element;
  for (const a of ["viewBox", "width", "height", "x", "y"]) root.removeAttribute(a);
  const doc = d.doc;

  const styles: Element[] = [...src.querySelectorAll(STYLE_EL)].filter((s) => s.namespaceURI === SVG_NS);
  for (const s of styles) root.append(s.cloneNode(true));
  const defs = doc.createElementNS(SVG_NS, "defs");
  root.append(defs);

  const clones = new Map<Element, Element>([[src, root]]);
  const inside = new Set<Element>();
  for (const i of sorted) {
    const el = d.nodes[i].el;
    const chain: Element[] = [];
    for (let p = el.parentElement; p && p !== src; p = p.parentElement) chain.unshift(p);
    let parent = root;
    for (const a of chain) {
      let c = clones.get(a);
      if (!c) {
        c = a.cloneNode(false) as Element;
        clones.get(a.parentElement!)!.append(c);
        clones.set(a, c);
      }
      parent = c;
    }
    parent.append(el.cloneNode(true));
    inside.add(el);
  }

  // Defs the selection uses, and what those use in turn.
  const isInside = (e: Element) => {
    for (let p: Element | null = e; p; p = p.parentElement) if (inside.has(p)) return true;
    return false;
  };
  const wanted = new Set<string>();
  refsOf(root, wanted);
  const done = new Set<string>();
  const queue = [...wanted];
  while (queue.length) {
    const id = queue.pop()!;
    if (done.has(id)) continue;
    done.add(id);
    const target = doc.getElementById(id);
    if (!target || isInside(target) || styles.includes(target)) continue;
    const copy = target.cloneNode(true) as Element;
    defs.append(copy);
    const more = new Set<string>();
    refsOf(copy, more);
    for (const m of more) if (!done.has(m)) queue.push(m);
  }
  if (!defs.children.length) defs.remove();

  const b = outward(selectionBox(d, sorted) ?? d.view);
  root.setAttribute("viewBox", `${fmt(b.x)} ${fmt(b.y)} ${fmt(b.w)} ${fmt(b.h)}`);
  root.setAttribute("width", fmt(b.w));
  root.setAttribute("height", fmt(b.h));
  return serialize(root);
}

/** The document without the selected elements. */
export function remove(d: SvgDoc, sel: number[]): string {
  const doc = d.doc.cloneNode(true) as Document;
  const els = allElements(doc.documentElement);
  for (const i of normalize(d, sel)) els[i].remove();
  return serialize(doc);
}

function allElements(root: Element): Element[] {
  const out: Element[] = [];
  const walk = (e: Element) => {
    out.push(e);
    for (const c of e.children) walk(c);
  };
  walk(root);
  return out;
}

/** Content children that turn with the drawing (not defs, styles, metadata). */
const STAYS = new Set(["defs", STYLE_EL, "script", "title", "desc", "metadata"]);

/**
 * Turns the drawing by quarter turns clockwise, written into the file: the
 * content is wrapped in a rotated group and the viewBox and size swap.
 */
export function rotate(d: SvgDoc, quarters: number): string {
  const q = ((quarters % 4) + 4) % 4;
  if (q === 0) return d.text;
  const doc = d.doc.cloneNode(true) as Document;
  const root = doc.documentElement;
  const { x, y, w, h } = d.view;
  const g = doc.createElementNS(SVG_NS, "g");
  g.setAttribute("transform", `rotate(${q * 90})`);
  for (const c of [...root.childNodes]) {
    if (c.nodeType === 1 && STAYS.has((c as Element).localName)) continue;
    g.append(c);
  }
  root.append(g);
  // rotate(90): (x,y) → (-y,x); 180: (-x,-y); 270: (y,-x)
  const vb =
    q === 1 ? [-(y + h), x, h, w] :
    q === 2 ? [-(x + w), -(y + h), w, h] :
    [y, -(x + w), h, w];
  root.setAttribute("viewBox", vb.map(fmt).join(" "));
  if (q !== 2) {
    const wa = root.getAttribute("width");
    const ha = root.getAttribute("height");
    if (ha != null) root.setAttribute("width", ha);
    else root.removeAttribute("width");
    if (wa != null) root.setAttribute("height", wa);
    else root.removeAttribute("height");
  }
  return serialize(doc);
}

// ---------------------------------------------------------------------------
// Colors

const COLOR_PROPS = new Set(["fill", "stroke", "stop-color", "flood-color", "lighting-color", "color", "solid-color"]);
const NOT_COLORS = new Set(["none", "currentcolor", "inherit", "initial", "unset", "revert", "transparent", "url", "context", "fill", "stroke"]);

const keyCache = new Map<string, string | null>();
/** A color token's group key, or null when it isn't a color. */
export function colorKey(token: string): string | null {
  const t = token.toLowerCase();
  if (NOT_COLORS.has(t)) return null;
  let k = keyCache.get(t);
  if (k === undefined) {
    const c = parseColor(t);
    k = c ? toHex(c) : null;
    keyCache.set(t, k);
  }
  return k;
}

/** Replaces each color token in a value; `fn` returns the new token or null to keep it. */
function mapValue(value: string, fn: (token: string, key: string) => string | null): string {
  // Skip what's inside url(...) so ids aren't read as names.
  return value.replace(/url\([^)]*\)|#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})\b|(?:rgba?|hsla?|oklch|oklab|lab|lch|hwb)\([^)]*\)|\b[a-z]+\b/gi, (tok) => {
    if (/^url\(/i.test(tok)) return tok;
    const key = colorKey(tok);
    return key ? (fn(tok, key) ?? tok) : tok;
  });
}

function mapDeclarations(css: string, fn: (token: string, key: string) => string | null): string {
  return css.replace(/([\w-]+)(\s*:\s*)([^;}]+)/g, (all, prop: string, colon: string, value: string) =>
    COLOR_PROPS.has(prop.toLowerCase()) ? prop + colon + mapValue(value, fn) : all,
  );
}

/** Walks every color in a document (attributes, style="", <style>), replacing in place. */
function mapColors(root: Element, fn: (token: string, key: string) => string | null) {
  for (const el of allElements(root)) {
    for (const a of [...el.attributes]) {
      if (COLOR_PROPS.has(a.name)) {
        const v = mapValue(a.value, fn);
        if (v !== a.value) a.value = v;
      } else if (a.name === STYLE_ATTR) {
        const v = mapDeclarations(a.value, fn);
        if (v !== a.value) a.value = v;
      }
    }
    if (el.localName === STYLE_EL && el.textContent) {
      const v = mapDeclarations(el.textContent, fn);
      if (v !== el.textContent) el.textContent = v;
    }
  }
}

function collectPalette(doc: Document): Swatch[] {
  const counts = new Map<string, number>();
  mapColors(doc.documentElement, (_t, key) => {
    counts.set(key, (counts.get(key) ?? 0) + 1);
    return null;
  });
  return [...counts].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count);
}

/** Every use of the color `key` becomes `to` (a CSS color or "currentColor"). */
export function recolor(d: SvgDoc, key: string, to: string): string {
  const doc = d.doc.cloneNode(true) as Document;
  mapColors(doc.documentElement, (_t, k) => (k === key ? to : null));
  return serialize(doc);
}

// ---------------------------------------------------------------------------
// Embedded images

function hrefOf(el: Element): string | null {
  return el.getAttribute("href") ?? el.getAttributeNS(XLINK_NS, "href");
}

function findImages(nodes: SvgNode[]): EmbeddedImage[] {
  const out: EmbeddedImage[] = [];
  for (const n of nodes) {
    if (n.tag !== "image") continue;
    const href = hrefOf(n.el);
    const m = href && /^data:(image\/[\w.+-]+)[;,]/i.exec(href);
    if (!m) continue;
    out.push({ node: n.i, mime: m[1].toLowerCase(), bytes: utf8Length(href), href });
  }
  return out;
}

/** The document with embedded images swapped: node index → new data URI. */
export function replaceImages(d: SvgDoc, hrefs: Map<number, string>): string {
  const doc = d.doc.cloneNode(true) as Document;
  const els = allElements(doc.documentElement);
  for (const [i, href] of hrefs) {
    const el = els[i];
    if (el.hasAttributeNS(XLINK_NS, "href")) el.setAttributeNS(XLINK_NS, "xlink:href", href);
    if (el.hasAttribute("href") || !el.hasAttributeNS(XLINK_NS, "href")) el.setAttribute("href", href);
  }
  return serialize(doc);
}

// ---------------------------------------------------------------------------
// Heat render

/** Light to heavy: one warm hue, kept off the blue accent. */
export function heatColor(t: number): string {
  const u = Math.min(1, Math.max(0, t));
  return toHex(fromOklch({ l: 0.93 - 0.35 * u, c: 0.05 + 0.15 * u, h: 60 }));
}

export interface Heat {
  text: string;
  /** "area": bytes per unit of drawn area (whole file); "shape": bytes per shape (a selection). */
  mode: "area" | "shape";
  /** The scale's ends, in the mode's unit; min is the floor actually used. */
  min: number;
  max: number;
}

/** The scale spans at least this factor, so near-equal weights look equal. */
const HEAT_MIN_SPAN = 32;

const HEAT_STEPS = 12;

/** One stylesheet for the heat render: a class per step, !important so the file's own CSS loses. */
const HEAT_CSS = (() => {
  const rules: string[] = [];
  for (let k = 0; k < HEAT_STEPS; k++) {
    const c = heatColor(k / (HEAT_STEPS - 1));
    rules.push(`.sbh${k}{fill:${c}!important;stroke:${c}!important}`, `.sbh${k}s{fill:none!important;stroke:${c}!important}`);
  }
  rules.push(
    ".sbx{fill:#94a3b8!important;stroke:#94a3b8!important;opacity:.18!important}",
    ".sbxs{fill:none!important;stroke:#94a3b8!important;opacity:.18!important}",
    "[class*=sb]{fill-opacity:1!important;stroke-opacity:1!important;filter:none!important;mask:none!important}",
    "[class*=sbh]{opacity:1!important}",
  );
  return rules.join("");
})();

/**
 * The drawing with each shape painted by its weight (log scale between the
 * lightest and heaviest shape in scope, in steps), everything else faded.
 * Classes and one <style>, not style="": the CSP reports every style
 * attribute, even in a parsed document that is never shown.
 */
export function heatRender(d: SvgDoc, scope: number[] | null): Heat {
  const inScope = new Set(scope ? shapesIn(d, normalize(d, scope)) : d.nodes.filter((n) => n.leaf && n.box).map((n) => n.i));
  // The whole file weighs by density, so a figure of many small paths reads
  // as heavy as it is and a big cheap background as light. A selection
  // weighs its shapes against each other.
  const mode: Heat["mode"] = scope ? "shape" : "area";
  const minArea = d.view.w * d.view.h * 1e-5 || 1;
  const weight = (n: SvgNode) => (mode === "shape" ? n.bytes : n.bytes / Math.max(n.box!.w * n.box!.h, minArea));
  let min = Infinity;
  let max = 0;
  for (const i of inScope) {
    const w = weight(d.nodes[i]);
    min = Math.min(min, w);
    max = Math.max(max, w);
  }
  const lmax = Math.log(Math.max(1e-9, max));
  const lmin = Math.min(Math.log(Math.max(1e-9, min)), lmax - Math.log(HEAT_MIN_SPAN));
  const span = lmax - lmin;

  const root = d.doc.documentElement.cloneNode(true) as Element;
  const els = allElements(root);
  const v = d.view;
  root.setAttribute("viewBox", `${v.x} ${v.y} ${v.w} ${v.h}`);
  root.setAttribute("width", String(v.w));
  root.setAttribute("height", String(v.h));
  root.setAttribute("preserveAspectRatio", "none");
  for (const n of d.nodes) {
    if (!n.leaf || !n.box) continue;
    let el = els[n.i];
    let fillNone = n.fillNone;
    if (n.tag === "image") {
      // An image can't be recolored; a rect of its size can.
      const r = el.ownerDocument.createElementNS(SVG_NS, "rect");
      for (const a of ["x", "y", "width", "height", "transform"]) {
        const val = el.getAttribute(a);
        if (val != null) r.setAttribute(a, val);
      }
      el.replaceWith(r);
      el = r;
      fillNone = false;
    }
    const cls = inScope.has(n.i)
      ? `sbh${Math.round(((Math.log(Math.max(1e-9, weight(n))) - lmin) / span) * (HEAT_STEPS - 1))}`
      : "sbx";
    const own = el.getAttribute("class");
    el.setAttribute("class", `${own ? own + " " : ""}${cls}${fillNone ? "s" : ""}`);
  }
  const style = root.ownerDocument.createElementNS(SVG_NS, STYLE_EL);
  style.textContent = HEAT_CSS;
  root.append(style);
  return { text: serialize(root), mode, min: Number.isFinite(min) ? Math.exp(lmin) : 0, max };
}
