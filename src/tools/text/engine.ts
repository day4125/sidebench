/* text engine — pure text-transform logic for the Textmanipulator tool.
   Ported from prodtools' static/text.js; the only changes are ES exports
   and types, plus slugify/deslugify (new in sidebench). No DOM, no storage, no network: every function takes a string
   and returns a string. */

const superscriptDigits: Record<string, string> = {
  "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴",
  "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹",
};
const subscriptDigits: Record<string, string> = {
  "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄",
  "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉",
};
const superscriptLetters: Record<string, string> = {
  a: "ᵃ", b: "ᵇ", c: "ᶜ", d: "ᵈ", e: "ᵉ", f: "ᶠ",
  g: "ᵍ", h: "ʰ", i: "ⁱ", j: "ʲ", k: "ᵏ", l: "ˡ",
  m: "ᵐ", n: "ⁿ", o: "ᵒ", p: "ᵖ", r: "ʳ", s: "ˢ",
  t: "ᵗ", u: "ᵘ", v: "ᵛ", w: "ʷ", x: "ˣ", y: "ʸ",
  z: "ᶻ",
};
const subscriptLetters: Record<string, string> = {
  a: "ₐ", e: "ₑ", h: "ₕ", i: "ᵢ", j: "ⱼ", k: "ₖ",
  l: "ₗ", m: "ₘ", n: "ₙ", o: "ₒ", p: "ₚ", r: "ᵣ",
  s: "ₛ", t: "ₜ", u: "ᵤ", v: "ᵥ", x: "ₓ",
};

// Tidy up Word/CMS-style text: drop soft hyphens (literal &shy; and the
// U+00AD character), normalise straight double quotes to the Swedish closing
// quote, collapse runs of whitespace, and trim the ends.
export function clean(text: string): string {
  return text
    .replace(/&shy;/gi, "")
    .replace(/\u00AD/g, "")
    .replace(/"/g, "”")
    .replace(/\s+/g, " ")
    .trim();
}

function mapChars(text: string, regex: RegExp, table: Record<string, string>, keepUnmapped: boolean): string {
  return text.replace(regex, function (ch) {
    var mapped = table[ch];
    return mapped !== undefined ? mapped : keepUnmapped ? ch : "";
  });
}

export function stripSvg(text: string): string {
  return text
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, "")
    .replace(/<svg\b[^>]*\/>/gi, "");
}

// Extract email addresses / URLs, one match per line. www-only URLs get an
// http:// prefix so the output is a usable link list.
export function extract(type: string, text: string): string {
  if (type === "email") {
    var emails = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
    return emails.join("\n");
  }
  if (type === "url") {
    var urls = text.match(
      /(?:https?:\/\/|www\.)[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+(?:[/?#][^\s]*)?/g
    ) || [];
    return urls
      .map(function (url) {
        return url.indexOf("www.") === 0 ? "http://" + url : url;
      })
      .join("\n");
  }
  return text;
}

// Letters NFKD doesn't split into a base letter plus a mark.
const FOLD: Record<string, string> = { æ: "ae", ø: "o", ß: "ss", ł: "l", đ: "d", þ: "th" };

// URL slug per line: "Ny rapport, del 2" -> "ny-rapport-del-2". Lowercase,
// accents dropped (å/ä/ö -> a/a/o), any other run of characters -> "-".
export function slugify(text: string): string {
  return text
    .split("\n")
    .map(function (line) {
      return line
        .toLowerCase()
        .replace(/[æøßłđþ]/g, function (ch) { return FOLD[ch]; })
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    })
    .join("\n");
}

// Back from a slug per line: "ny-rapport" -> "Ny rapport". Hyphens and
// underscores become spaces, the first letter is capitalized. Accents
// dropped by slugify can't come back.
export function deslugify(text: string): string {
  return text
    .split("\n")
    .map(function (line) {
      var words = line.replace(/[-_]+/g, " ").replace(/ {2,}/g, " ").trim();
      return words.charAt(0).toUpperCase() + words.slice(1);
    })
    .join("\n");
}

export const OPS = {
  clean: clean,
  upper: function (t: string) { return t.toUpperCase(); },
  lower: function (t: string) { return t.toLowerCase(); },
  supNum: function (t: string) { return mapChars(t, /[0-9]/g, superscriptDigits, true); },
  subNum: function (t: string) { return mapChars(t, /[0-9]/g, subscriptDigits, true); },
  supAlpha: function (t: string) { return mapChars(t, /[a-z]/g, superscriptLetters, true); },
  subAlpha: function (t: string) { return mapChars(t, /[a-z]/g, subscriptLetters, true); },
  stripSvg: stripSvg,
  extractEmail: function (t: string) { return extract("email", t); },
  extractUrl: function (t: string) { return extract("url", t); },
  slug: slugify,
  deslug: deslugify,
};

export type Op = keyof typeof OPS;

// Single entry point for the app layer: apply a named operation to text.
// Unknown ops return the text unchanged.
export function apply(op: string, text: string | null | undefined): string | null | undefined {
  var fn = (OPS as Record<string, (t: string) => string>)[op];
  return fn ? fn(text == null ? "" : String(text)) : text;
}
