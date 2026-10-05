/* text engine — pure text-transform logic for the Textmanipulator tool.
   Ported from prodtools' static/text.js; the only changes are ES exports
   and types, plus everything from slugify down (new in sidebench). No DOM,
   no storage, no network: every function takes a string and returns a
   string. */

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

// A gentler "Rensa text" that keeps paragraphs. A blank line
// ends a paragraph; single line breaks inside one become spaces. Words split
// at a line end ("kom-\nmunen") are joined, except before och/eller/samt/till
// ("barn-\noch" stays "barn- och"); before a capital the hyphen stays
// ("EU-\nKommissionen" -> "EU-Kommissionen"). Soft hyphens and zero-width
// characters go, non-breaking spaces stay. Quotes as in clean().
export function softClean(text: string): string {
  return text
    .replace(/&shy;/gi, "")
    .replace(/[\u00AD\u200B-\u200D\u2060\uFEFF]/g, "")
    .replace(/"/g, "”")
    .replace(/\r\n?/g, "\n")
    .replace(/(\p{L})-[ \t]*\n[ \t]*(och|eller|samt|till)\b/gu, "$1- $2")
    .replace(/(\p{Ll})-[ \t]*\n[ \t]*(\p{Ll})/gu, "$1$2")
    .replace(/(\p{L})-[ \t]*\n[ \t]*(\p{Lu})/gu, "$1-$2")
    .split(/\n[ \t]*\n\s*/)
    .map(function (para) {
      return para.replace(/[ \t\n]+/g, " ").trim();
    })
    .filter(Boolean)
    .join("\n\n");
}

// Non-breaking spaces inside numbers written with space-separated
// thousands: "10 000" and "1 250 000" keep together across a line break.
// Only a space followed by exactly three digits counts, so "2023 100"
// (a year, then a number) is left alone. Two numbers in a row that happen
// to fit the pattern ("klass 5 100 elever") can't be told apart.
export function nbspNumbers(text: string): string {
  return text.replace(/(?<![\d.,])\d{1,3}(?:[ \u2009\u202F]\d{3})+(?![\d])/g, function (num) {
    return num.replace(/[ \u2009\u202F]/g, "\u00A0");
  });
}

// Every character the hidden-character marks show, gone: non-breaking and
// narrow non-breaking spaces and tabs become plain spaces; soft hyphens and
// zero-width characters are deleted. Line breaks stay.
export function stripHidden(text: string): string {
  return text.replace(/[\u00A0\u202F\t]/g, " ").replace(/[\u00AD\u200B-\u200D\u2060\uFEFF]/g, "");
}

// Swedish abbreviations that end in a dot without ending the sentence.
const ABBREV = /(?:^|[\s(])(?:t\.ex|bl\.a|d\.v\.s|dvs|s\.k|m\.fl|m\.m|p\.g\.a|pga|ca|kl|nr|resp|jfr|fr\.o\.m|t\.o\.m|o\.s\.v|osv|e\.d|f\.d|dr|st|tel)\.$/i;

// "Som i en mening": the first letter of each sentence up, the rest down.
// A line written mostly in capitals is lowercased wholesale; otherwise only
// Capitalized words are lowered, so acronyms (EU, SVT) and mixed case
// (iPhone) survive. Names can't be told from ordinary words and end up
// lowercase. A sentence starts at the beginning of a line or after . ! ?
// unless the dot ends an abbreviation (t.ex., bl.a.).
export function sentenceCase(text: string): string {
  return text
    .split("\n")
    .map(function (line) {
      var letters = line.replace(/[^\p{L}]/gu, "");
      var caps = letters.replace(/[^\p{Lu}]/gu, "").length;
      var shouting = letters.length > 0 && caps / letters.length > 0.6;
      var lowered = shouting
        ? line.toLowerCase()
        : line.replace(/\p{L}+/gu, function (word) {
            return /^\p{Lu}\p{Ll}*$/u.test(word) ? word.toLowerCase() : word;
          });
      var start = true;
      var out = "";
      for (var i = 0; i < lowered.length; i++) {
        var ch = lowered[i];
        if (start && /\p{L}/u.test(ch)) {
          out += ch.toUpperCase();
          start = false;
          continue;
        }
        if (start && /\d/.test(ch)) start = false;
        out += ch;
        if (/[.!?]/.test(ch) && /\s/.test(lowered[i + 1] || "") && !(ch === "." && ABBREV.test(out))) {
          start = true;
        }
      }
      return out;
    })
    .join("\n");
}

// Remove repeated lines, keeping the first. Lines compare after trimming;
// empty lines are all kept.
export function dedupeLines(text: string): string {
  var seen = new Set<string>();
  return text
    .split("\n")
    .filter(function (line) {
      var key = line.trim();
      if (!key) return true;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join("\n");
}

// List items run together on one line, as "Rensa text" leaves them, each
// put back on a line of its own. Text already on separate lines is left
// alone.

// Bullet glyphs, Word's among them (· from Symbol, § from Wingdings).
// Dashes and asterisks aren't, since they also turn up mid-sentence.
const BULLET = /[^\S\n]+(?=[•◦▪▫‣⁃●○■□►▸➢➤✓✔·§]\s)/g;

export function breakBullets(text: string): string {
  return text.replace(BULLET, "\n");
}

// 1. 1) a. a) A. A) after a space and before one.
const ITEM = /(?<=^|\s)(\d{1,3}|[a-zA-Z])([.)])(?=\s)/g;

// A break before every numbered or lettered item. Only items that count
// up from 1 or a, two or more in a row, take part, so a sentence ending in
// a number ("sidan 12. Sedan") stays put. Each kind (1. 1) a. a) A. A))
// counts on its own, so a lettered list inside a numbered one works.
export function breakNumbers(text: string): string {
  var runs = new Map<string, { last: number; at: number[] }>();
  var marked: number[] = [];
  function close(key: string) {
    var run = runs.get(key);
    if (run && run.at.length > 1) marked.push(...run.at);
    runs.delete(key);
  }
  for (var m of text.matchAll(ITEM)) {
    var digits = /\d/.test(m[1]);
    var value = digits ? Number(m[1]) : m[1].toLowerCase().charCodeAt(0) - 96;
    var key = (digits ? "1" : m[1] === m[1].toLowerCase() ? "a" : "A") + m[2];
    var run = runs.get(key);
    if (value === 1) {
      close(key);
      runs.set(key, { last: 1, at: [m.index] });
    } else if (run && value === run.last + 1) {
      run.last = value;
      run.at.push(m.index);
    }
  }
  [...runs.keys()].forEach(close);
  marked.sort(function (a, b) { return b - a; });
  var out = text;
  for (var at of marked) {
    var before = out.slice(0, at);
    var space = before.match(/[^\S\n]*$/)![0];
    var lineStart = before.length === space.length || before[before.length - space.length - 1] === "\n";
    if (!lineStart) out = before.slice(0, before.length - space.length) + "\n" + out.slice(at);
  }
  return out;
}

const BLOCK_END = /<\/(?:p|div|li|h[1-6]|tr|blockquote|pre|ul|ol|table|section|article)\s*>|<br\s*\/?>/gi;

// Plain text out of HTML: comments, script and style go with their content,
// block ends and <br> become line breaks, every other tag is dropped.
// Entities are left for decodeEntities.
export function stripTags(text: string): string {
  return text
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "")
    .replace(BLOCK_END, "\n")
    .replace(/<\/?[a-zA-Z][^>]*>/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// The entities that turn up in CMS and Word HTML. Unknown names stay as
// they are. Numeric references (&#229; &#xE5;) all work.
const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: "\u00A0", shy: "\u00AD",
  ndash: "–", mdash: "—", hellip: "…", laquo: "«", raquo: "»",
  lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", bdquo: "„", sbquo: "‚",
  bull: "•", middot: "·", deg: "°", times: "×", divide: "÷", plusmn: "±",
  copy: "©", reg: "®", trade: "™", sect: "§", para: "¶", euro: "€", pound: "£",
  sup1: "¹", sup2: "²", sup3: "³", frac12: "½", frac14: "¼", frac34: "¾",
  thinsp: "\u2009", ensp: "\u2002", emsp: "\u2003", zwsp: "\u200B", zwj: "\u200D", zwnj: "\u200C",
  aring: "å", auml: "ä", ouml: "ö", Aring: "Å", Auml: "Ä", Ouml: "Ö",
  eacute: "é", Eacute: "É", egrave: "è", uuml: "ü", Uuml: "Ü", aelig: "æ", AElig: "Æ",
  oslash: "ø", Oslash: "Ø", szlig: "ß", ccedil: "ç", ntilde: "ñ", aacute: "á", oacute: "ó", iacute: "í",
};

export function decodeEntities(text: string): string {
  return text.replace(/&(#\d+|#[xX][0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, function (whole, name) {
    if (name[0] === "#") {
      var code = name[1] === "x" || name[1] === "X" ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
    }
    return ENTITIES[name] !== undefined ? ENTITIES[name] : whole;
  });
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
  softClean: softClean,
  nbspNumbers: nbspNumbers,
  stripHidden: stripHidden,
  sentence: sentenceCase,
  dedupe: dedupeLines,
  breakItems: function (t: string) { return breakNumbers(breakBullets(t)); },
  stripTags: stripTags,
  decodeEntities: decodeEntities,
};

export type Op = keyof typeof OPS;

// Single entry point for the app layer: apply a named operation to text.
// Unknown ops return the text unchanged.
export function apply(op: string, text: string | null | undefined): string | null | undefined {
  var fn = (OPS as Record<string, (t: string) => string>)[op];
  return fn ? fn(text == null ? "" : String(text)) : text;
}
