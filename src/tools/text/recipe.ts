/* "Rensa text" as a recipe: the main button's steps, each one optional
   except the invisible junk, run in a fixed order so no step undoes
   another (clean()'s whitespace collapse would otherwise wipe the
   non-breaking spaces nbspNumbers puts in). Pure, like engine.ts.

   On text without blank lines, the defaults give clean()'s result, except
   that zero-width characters go and words split at a line end are put back
   together. cleanWith() also reports what it did, for the line under the
   button. */
import { nbspNumbers } from "./engine";

export interface Recipe {
  /** A blank line stays as a paragraph break; off, it becomes a space
   * too. Single line breaks become spaces either way. */
  keepParagraphs: boolean;
  /** Words split at a line end ("kom-\nmunen") put back together. */
  joinHyphens: boolean;
  /** Straight " -> ”. */
  quotes: boolean;
  /** Non-breaking and narrow non-breaking spaces become plain spaces. */
  plainSpaces: boolean;
  /** Last: non-breaking spaces inside numbers like 10 000. */
  nbspNumbers: boolean;
}

export const DEFAULT_RECIPE: Recipe = {
  keepParagraphs: true,
  joinHyphens: true,
  quotes: true,
  plainSpaces: true,
  nbspNumbers: false,
};

export interface Report {
  /** Soft hyphens and zero-width characters removed. */
  invisible: number;
  /** Line-end splits joined, as the word they became. */
  joined: string[];
  /** Line-end splits that kept their hyphen, as written now. */
  kept: string[];
  quotes: number;
  plainSpaces: number;
  /** Numbers given non-breaking spaces. */
  numbers: number;
}

// Whitespace, except the non-breaking spaces plainSpaces decides about.
const WS = /[^\S\u00A0\u202F]+/g;
const PARA = /\n[^\S\n\u00A0\u202F]*\n[^\S\u00A0\u202F]*/;
const INVISIBLE = /&shy;|[\u00AD\u200B-\u200D\u2060\uFEFF]/gi;
const NBSP = /[\u00A0\u202F]/g;

const count = (t: string, re: RegExp) => t.match(re)?.length ?? 0;

/** Words split at a line end, without a dictionary. The hyphen stays
 * before och/eller/samt/till ("barn- och"), and when the split looks like
 * a real hyphenated word: the part before it is a number, ends in a
 * capital or is one or two letters (18-åring, EU-kommissionen, e-post), the
 * part after starts with a capital, or the same word appears hyphenated
 * elsewhere in the text, mid-line. Otherwise the parts are joined. */
function joinSplits(t: string, report: Report): string {
  const hyphenated = new Set((t.match(/[\p{L}\p{N}]+-[\p{L}\p{N}]+/gu) ?? []).map((w) => w.toLowerCase()));
  return t
    .replace(/(\p{L})-[ \t]*\n[ \t]*(och|eller|samt|till)\b/gu, "$1- $2")
    .replace(/([\p{L}\p{N}]+)-[ \t]*\n[ \t]*(\p{L}+)/gu, (_, a: string, b: string) => {
      const keep =
        /[\p{N}\p{Lu}]$/u.test(a) ||
        /^\p{L}{1,2}$/u.test(a) ||
        /^\p{Lu}/u.test(b) ||
        hyphenated.has(`${a}-${b}`.toLowerCase());
      const word = keep ? `${a}-${b}` : a + b;
      (keep ? report.kept : report.joined).push(word);
      return word;
    });
}

export function cleanWith(r: Recipe, text: string): { text: string; report: Report } {
  const report: Report = { invisible: 0, joined: [], kept: [], quotes: 0, plainSpaces: 0, numbers: 0 };
  report.invisible = count(text, INVISIBLE);
  let t = text.replace(INVISIBLE, "").replace(/\r\n?/g, "\n");
  if (r.joinHyphens) t = joinSplits(t, report);
  if (r.quotes) {
    report.quotes = count(t, /"/g);
    t = t.replace(/"/g, "”");
  }
  if (r.plainSpaces) {
    report.plainSpaces = count(t, NBSP);
    t = t.replace(NBSP, " ");
  }
  t = r.keepParagraphs
    ? t
        .split(PARA)
        .map((para) => para.replace(WS, " ").trim())
        .filter(Boolean)
        .join("\n\n")
    : t.replace(WS, " ").trim();
  if (r.nbspNumbers) {
    const before = t;
    t = nbspNumbers(t);
    report.numbers = t.split("").filter((ch, i) => ch === "\u00A0" && before[i] !== "\u00A0").length;
  }
  return { text: t, report };
}

/** What the recipe does, for the legend. */
export function describe(r: Recipe): string {
  const parts = [
    "Tar bort mjuka bindestreck, osynliga tecken och dubbla mellanrum",
    r.keepParagraphs ? "gör radbrytningar till mellanslag men behåller stycken" : "gör alla radbrytningar till mellanslag",
  ];
  if (r.joinHyphens) parts.push("sätter ihop ord avstavade vid radslut");
  if (r.quotes) parts.push("byter raka citattecken till typografiska");
  if (r.plainSpaces) parts.push("gör hårda mellanslag till vanliga");
  if (r.nbspNumbers) parts.push("sätter hårt mellanslag i tal som 10 000");
  return parts.slice(0, -1).join(", ") + " och " + parts.at(-1) + ".";
}
