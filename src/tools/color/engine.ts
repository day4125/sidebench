// Color math for Färgväljare: parsing, format strings, WCAG 2 contrast, the
// nearest color that passes a target ratio, and vision simulation.
// Everything works on 8-bit sRGB, the space hex codes and CSS rgb() live in.

export interface Rgb {
  r: number; // 0–255
  g: number;
  b: number;
  a: number; // 0–1
}

export interface Oklch {
  l: number; // 0–1
  c: number;
  h: number; // degrees
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const round = (x: number, digits: number) => {
  const f = 10 ** digits;
  return Math.round(x * f) / f;
};

// ---------------------------------------------------------------------------
// sRGB, linear light, OKLab

const toLinear = (v: number) => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const fromLinear = (c: number) => 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

function linearToOklab(r: number, g: number, b: number) {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    A: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    B: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
}

function oklabToLinear(L: number, A: number, B: number) {
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

export function toOklch({ r, g, b }: Rgb): Oklch {
  const { L, A, B } = linearToOklab(toLinear(r), toLinear(g), toLinear(b));
  const c = Math.hypot(A, B);
  const h = c < 1e-4 ? 0 : ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360;
  return { l: L, c, h };
}

/** OKLCH to sRGB, or null when the color is outside the sRGB gamut. */
function oklchToRgbExact({ l, c, h }: Oklch): Rgb | null {
  const rad = (h * Math.PI) / 180;
  const lin = oklabToLinear(l, c * Math.cos(rad), c * Math.sin(rad));
  if (lin.some((v) => v < -1e-4 || v > 1 + 1e-4)) return null;
  const [r, g, b] = lin.map((v) => clamp(Math.round(fromLinear(clamp(v, 0, 1))), 0, 255));
  return { r, g, b, a: 1 };
}

/** OKLCH to sRGB, lowering chroma until it fits (hue and lightness kept). */
export function fromOklch(color: Oklch): Rgb {
  const exact = oklchToRgbExact(color);
  if (exact) return exact;
  let lo = 0;
  let hi = color.c;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (oklchToRgbExact({ ...color, c: mid })) lo = mid;
    else hi = mid;
  }
  return oklchToRgbExact({ ...color, c: lo }) ?? { r: 0, g: 0, b: 0, a: 1 };
}

// ---------------------------------------------------------------------------
// HSL

function toHsl({ r, g, b }: Rgb) {
  const [R, G, B] = [r / 255, g / 255, b / 255];
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = max === R ? ((G - B) / d) % 6 : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
  h = (h * 60 + 360) % 360;
  return { h, s, l };
}

function fromHsl(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

// ---------------------------------------------------------------------------
// Parsing

/** A CSS number with an optional unit: 50%, 0.5, 120deg, 1.2rad, 0.3turn. */
function num(token: string, percentOf = 1): number {
  const t = token.trim().toLowerCase();
  if (t === "none") return 0;
  if (t.endsWith("%")) return (parseFloat(t) / 100) * percentOf;
  if (t.endsWith("deg")) return parseFloat(t);
  if (t.endsWith("grad")) return parseFloat(t) * 0.9;
  if (t.endsWith("rad")) return (parseFloat(t) * 180) / Math.PI;
  if (t.endsWith("turn")) return parseFloat(t) * 360;
  return parseFloat(t);
}

function parseHex(s: string): Rgb | null {
  const m = /^#?([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(s);
  if (!m) return null;
  let hex = m[1];
  if (hex.length <= 4) hex = [...hex].map((c) => c + c).join("");
  const n = (i: number) => parseInt(hex.slice(i, i + 2), 16);
  return { r: n(0), g: n(2), b: n(4), a: hex.length === 8 ? round(n(6) / 255, 3) : 1 };
}

function parseFunc(s: string): Rgb | null {
  const m = /^(rgba?|hsla?|oklch)\(\s*([^)]*)\)$/i.exec(s);
  if (!m) return null;
  const fn = m[1].toLowerCase();
  // Both syntaxes: "1, 2, 3, 0.5" and "1 2 3 / 0.5".
  const [main, slash] = m[2].split("/");
  const parts = main.split(/[\s,]+/).filter(Boolean);
  let alphaToken: string | undefined = slash?.trim();
  if (parts.length === 4 && !alphaToken) alphaToken = parts.pop();
  if (parts.length !== 3 || parts.some((p) => Number.isNaN(num(p)))) return null;
  const a = alphaToken ? clamp(num(alphaToken), 0, 1) : 1;
  if (Number.isNaN(a)) return null;
  if (fn.startsWith("rgb")) {
    const [r, g, b] = parts.map((p) => clamp(Math.round(num(p, 255)), 0, 255));
    return { r, g, b, a };
  }
  if (fn.startsWith("hsl")) {
    const h = ((num(parts[0]) % 360) + 360) % 360;
    // Modern hsl() allows bare numbers for s and l, meaning percent.
    const pct = (p: string) => (p.trim().endsWith("%") ? num(p) : parseFloat(p) / 100);
    const [r, g, b] = fromHsl(h, clamp(pct(parts[1]), 0, 1), clamp(pct(parts[2]), 0, 1)).map((v) =>
      clamp(Math.round(v), 0, 255),
    );
    return { r, g, b, a };
  }
  const l = clamp(num(parts[0]), 0, 1);
  const c = Math.max(0, num(parts[1], 0.4));
  const h = num(parts[2]);
  return { ...fromOklch({ l, c, h }), a };
}

/**
 * Any CSS color string the user pastes. Hex (with or without #), rgb(),
 * hsl() and oklch() are read here; anything else the browser accepts (named
 * colors, lab(), color()) goes through a detached element's computed style.
 */
export function parseColor(input: string): Rgb | null {
  const s = input.trim().replace(/;$/, "").trim();
  if (!s) return null;
  const direct = parseHex(s) ?? parseFunc(s);
  if (direct) return direct;
  if (typeof document === "undefined" || !CSS.supports("color", s)) return null;
  const el = document.createElement("span");
  el.style.color = s;
  document.body.append(el);
  const computed = getComputedStyle(el).color;
  el.remove();
  return parseFunc(computed);
}

// ---------------------------------------------------------------------------
// Formats

const hex2 = (n: number) => n.toString(16).padStart(2, "0");

export function toHex(c: Rgb): string {
  return `#${hex2(c.r)}${hex2(c.g)}${hex2(c.b)}${c.a < 1 ? hex2(Math.round(c.a * 255)) : ""}`;
}

export interface Format {
  id: "hex" | "rgb" | "hsl" | "oklch";
  label: string;
  value: string;
}

export function formats(c: Rgb): Format[] {
  const alpha = c.a < 1 ? round(c.a, 3) : null;
  const { h, s, l } = toHsl(c);
  const ok = toOklch(c);
  const hsl = `${round(h, 1)}, ${round(s * 100, 1)}%, ${round(l * 100, 1)}%`;
  const oklch = `${round(ok.l, 3)} ${round(ok.c, 3)} ${round(ok.h, 1)}`;
  return [
    { id: "hex", label: "HEX", value: toHex(c) },
    { id: "rgb", label: "RGB", value: alpha === null ? `rgb(${c.r}, ${c.g}, ${c.b})` : `rgba(${c.r}, ${c.g}, ${c.b}, ${alpha})` },
    { id: "hsl", label: "HSL", value: alpha === null ? `hsl(${hsl})` : `hsla(${hsl}, ${alpha})` },
    { id: "oklch", label: "OKLCH", value: alpha === null ? `oklch(${oklch})` : `oklch(${oklch} / ${alpha})` },
  ];
}

export const same = (a: Rgb, b: Rgb) => a.r === b.r && a.g === b.g && a.b === b.b && a.a === b.a;

// ---------------------------------------------------------------------------
// WCAG 2 contrast

/** Lays a translucent color over an opaque one. */
export function over(top: Rgb, under: Rgb): Rgb {
  const mix = (t: number, u: number) => Math.round(t * top.a + u * (1 - top.a));
  return { r: mix(top.r, under.r), g: mix(top.g, under.g), b: mix(top.b, under.b), a: 1 };
}

const WHITE: Rgb = { r: 255, g: 255, b: 255, a: 1 };

export function luminance({ r, g, b }: Rgb): number {
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/**
 * The WCAG 2 ratio of text on a background. A translucent background is
 * laid over white first, translucent text over the background.
 */
export function contrast(text: Rgb, bg: Rgb): number {
  const base = bg.a < 1 ? over(bg, WHITE) : bg;
  const fg = text.a < 1 ? over(text, base) : text;
  const [hi, lo] = [luminance(fg), luminance(base)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Ratios are shown truncated, never rounded up: 4.496 must not read 4.5. */
export function formatRatio(ratio: number): string {
  const t = Math.floor(ratio * 100) / 100;
  return t.toFixed(2).replace(/\.?0+$/, "").replace(".", ",");
}

export const LEVELS = [
  { id: "ui", ratio: 3, label: "3", name: "Stor text, UI" },
  { id: "aa", ratio: 4.5, label: "4,5", name: "AA" },
  { id: "aaa", ratio: 7, label: "7", name: "AAA" },
] as const;

export type Side = "text" | "bg";

export interface Suggestion {
  side: Side;
  level: "aa" | "aaa";
  color: Rgb;
  ratio: number;
  /** How far it moved, in OKLCH lightness (0–1). */
  shift: number;
}

/**
 * The color closest to `color` (same hue and chroma where the gamut allows,
 * only lightness changed) that reaches `target` against `other`. Searches
 * lighter and darker and keeps the smaller move; null when neither reaches.
 */
export function nearestPassing(color: Rgb, other: Rgb, side: Side, target: number): { color: Rgb; ratio: number; shift: number } | null {
  const start = toOklch(color);
  const ratioOf = (c: Rgb) => (side === "text" ? contrast(c, other) : contrast(other, c));
  const at = (l: number): Rgb => ({ ...fromOklch({ ...start, l }), a: color.a });
  let best: { color: Rgb; ratio: number; shift: number } | null = null;
  for (const end of [0, 1]) {
    if (ratioOf(at(end)) < target) continue;
    // Contrast grows monotonically as lightness moves away from the other
    // color, so bisect for the first lightness that passes.
    let near = start.l;
    let far = end;
    for (let i = 0; i < 30; i++) {
      const mid = (near + far) / 2;
      if (ratioOf(at(mid)) >= target) far = mid;
      else near = mid;
    }
    // Rounding to 8 bits can land just under; step on until it passes.
    let l = far;
    let c = at(l);
    for (let i = 0; i < 50 && ratioOf(c) < target; i++) {
      l = clamp(l + (end === 1 ? 0.002 : -0.002), 0, 1);
      c = at(l);
    }
    if (ratioOf(c) < target) continue;
    const shift = Math.abs(l - start.l);
    if (!best || shift < best.shift) best = { color: c, ratio: ratioOf(c), shift };
  }
  return best;
}

export function suggestions(text: Rgb, bg: Rgb): Suggestion[] {
  const ratio = contrast(text, bg);
  const out: Suggestion[] = [];
  for (const level of ["aa", "aaa"] as const) {
    const target = level === "aa" ? 4.5 : 7;
    if (ratio >= target) continue;
    const t = nearestPassing(text, bg, "text", target);
    if (t) out.push({ side: "text", level, ...t });
    const b = nearestPassing(bg, text, "bg", target);
    if (b) out.push({ side: "bg", level, ...b });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Color vision simulation (Machado, Oliveira & Fernandes 2009, severity 1,
// applied in linear RGB). Grayscale uses relative luminance, so contrast is
// unchanged by it, which is the point it makes.

export type Vision = "normal" | "protan" | "deutan" | "tritan" | "gray";

const MATRICES: Record<"protan" | "deutan" | "tritan", number[]> = {
  protan: [0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882, -0.048116, 1.051998],
  deutan: [0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.01182, 0.04294, 0.968881],
  tritan: [1.255528, -0.076749, -0.178779, -0.078411, 0.930809, 0.147602, 0.004733, 0.691367, 0.3039],
};

export function simulate(c: Rgb, vision: Vision): Rgb {
  if (vision === "normal") return c;
  const lin = [toLinear(c.r), toLinear(c.g), toLinear(c.b)];
  let out: number[];
  if (vision === "gray") {
    const y = luminance(c);
    out = [y, y, y];
  } else {
    const m = MATRICES[vision];
    out = [0, 1, 2].map((row) => m[row * 3] * lin[0] + m[row * 3 + 1] * lin[1] + m[row * 3 + 2] * lin[2]);
  }
  const [r, g, b] = out.map((v) => clamp(Math.round(fromLinear(clamp(v, 0, 1))), 0, 255));
  return { r, g, b, a: c.a };
}
