// Characters that don't show in text but matter to it: non-breaking and
// zero-width spaces, soft hyphens, tabs. Drawn with Word's symbols where it
// has one; the zero-width ones have none and get a hairline box instead.
// Shared by the Diff checker and the Textmanipulator.

export interface Hidden {
  glyph: string;
  name: string;
  plural: string;
}

export const HIDDEN: Record<string, Hidden> = {
  "\u00A0": { glyph: "°", name: "hårt mellanslag", plural: "hårda mellanslag" },
  "\u202F": { glyph: "°", name: "smalt hårt mellanslag", plural: "smala hårda mellanslag" },
  "\t": { glyph: "→", name: "tabb", plural: "tabbar" },
  "\u00AD": { glyph: "¬", name: "mjukt bindestreck", plural: "mjuka bindestreck" },
  "\u200B": { glyph: "", name: "nollbrett mellanslag", plural: "nollbreda mellanslag" },
  "\u200C": { glyph: "", name: "nollbredd icke-sammanfogare", plural: "nollbredda icke-sammanfogare" },
  "\u200D": { glyph: "", name: "nollbredd sammanfogare", plural: "nollbredda sammanfogare" },
  "\u2060": { glyph: "", name: "ordsammanfogare", plural: "ordsammanfogare" },
  "\uFEFF": { glyph: "", name: "BOM", plural: "BOM" },
};

/** Splits text around each hidden character (and plain space, for callers
 * that draw those too), keeping the separators. */
export const HIDDEN_SPLIT = /([\u00A0\u202F\t\u00AD\u200B-\u200D\u2060\uFEFF ])/;

/** How many of each hidden character the text holds, most common first,
 * e.g. ["3 hårda mellanslag", "1 mjukt bindestreck"]. */
export function tallyHidden(text: string): string[] {
  const counts = new Map<string, number>();
  for (const ch of text) {
    if (HIDDEN[ch]) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  }
  return [...counts]
    .sort((a, b) => b[1] - a[1])
    .map(([ch, n]) => `${n.toLocaleString("sv-SE")} ${n === 1 ? HIDDEN[ch].name : HIDDEN[ch].plural}`);
}
