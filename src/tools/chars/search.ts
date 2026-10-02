/* Search over the character catalogue. Pure: no DOM, no storage.

   A query matches when every word in it starts a word of the character's
   Swedish or Unicode name, search words, entity or code point. Results rank by how well the
   name matches, so "pil" puts the arrows before "Kapital". A code point
   (U+2192, 2192, 0x2192) or a pasted character finds that character
   first. */
import { CHARS, type Char } from "./data";

/** Lowercase, accents off (so "grader" and "gräder" both work). */
function fold(s: string): string {
  return s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");
}

interface Indexed {
  char: Char;
  name: string;
  en: string;
  nameWords: string[];
  words: string[];
}

const INDEX: Indexed[] = CHARS.map((char) => {
  const name = fold(char.name);
  const en = fold(char.en);
  // The English name ranks like the Swedish one.
  const nameWords = [...name.split(/[\s-]+/), ...en.split(/[\s-]+/)];
  const words = [
    ...nameWords,
    ...fold(char.keys).split(/[\s-]+/),
    ...(char.entity ? [fold(char.entity), `&${fold(char.entity)};`] : []),
    fold(char.code),
  ].filter(Boolean);
  return { char, name, en, nameWords, words };
});

// A typed " or ' stands for every quotation mark, since the keyboard's
// straight ones aren't in the catalogue.
const QUOTES = CHARS.filter((c) => /QUOTATION MARK|APOSTROPHE/.test(c.en));

const HEX = /^(?:u\+|0x|&#x)?([0-9a-f]{4,5});?$/;

/** Lower is better; null means no match. */
function score(item: Indexed, q: string, terms: string[]): number | null {
  if (item.name === q || item.en === q) return 0;
  let total = item.name.startsWith(q) || item.en.startsWith(q) ? 1 : 2;
  for (const t of terms) {
    if (item.nameWords.includes(t)) continue;
    if (item.nameWords.some((w) => w.startsWith(t))) total += 1;
    else if (item.words.includes(t)) total += 2;
    else if (item.words.some((w) => w.startsWith(t))) total += 3;
    else return null;
  }
  return total;
}

export function search(query: string): Char[] {
  const raw = query.trim();
  if (!raw) return CHARS;
  if (raw === '"' || raw === "'") return QUOTES;

  // A pasted character, a code point or an entity in its exact case
  // (Ccedil is Ç, ccedil is ç) finds that character first.
  const q = fold(raw);
  const hex = HEX.exec(q.replace(/\s/g, ""));
  const code = hex && "U+" + hex[1].toUpperCase().padStart(4, "0");
  const entity = raw.replace(/^&|;$/g, "");
  const first = CHARS.filter((c) => c.ch === raw || c.code === code || c.entity === entity);

  const terms = q.split(/\s+/).filter(Boolean);
  const ranked = INDEX.map((item, order) => ({ item, order, s: score(item, q, terms) }))
    .filter((r) => r.s !== null && !first.includes(r.item.char))
    .sort((a, b) => a.s! - b.s! || a.order - b.order)
    .map((r) => r.item.char);

  return [...first, ...ranked];
}
