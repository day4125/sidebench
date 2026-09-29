import { expect, test } from "vitest";
import { diff, myers, splitLines, wordDiff, type Row } from "@/tools/diff/engine";

/** Rows as compact strings: kind, then each side's number and text, with
 * changed words in [brackets]. */
function show(rows: Row[]) {
  return rows.map((r) => {
    const side = (c: Row["a"]) =>
      c ? `${c.no}:${c.parts.map((p) => (p.changed && c.parts.length > 1 ? `[${p.text}]` : p.text)).join("")}` : "-";
    return `${r.kind} ${side(r.a)} | ${side(r.b)}`;
  });
}

/** Applies an edit script to a, to check it really turns a into b. */
function applyOps<T>(a: T[], b: T[], ops: ReturnType<typeof myers<T>>) {
  const out: T[] = [];
  let i = 0;
  let j = 0;
  for (const op of ops!) {
    if (op === "equal") {
      expect(a[i]).toBe(b[j]);
      out.push(a[i++]);
      j++;
    } else if (op === "delete") i++;
    else out.push(b[j++]);
  }
  expect(i).toBe(a.length);
  return out;
}

test("myers finds the shortest edit script", () => {
  const a = [..."ABCABBA"];
  const b = [..."CBABAC"];
  const ops = myers(a, b)!;
  expect(applyOps(a, b, ops)).toEqual(b);
  expect(ops.filter((o) => o !== "equal")).toHaveLength(5);
});

test("myers handles empty inputs and gives up past maxD", () => {
  expect(myers([], [])).toEqual([]);
  expect(myers([], ["x"])).toEqual(["insert"]);
  expect(myers(["x"], [])).toEqual(["delete"]);
  expect(myers([..."abcd"], [..."wxyz"], 3)).toBeNull();
});

test("myers turns random sequences into each other", () => {
  let seed = 1;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let n = 0; n < 200; n++) {
    const a = Array.from({ length: Math.floor(rand() * 30) }, () => "abc"[Math.floor(rand() * 3)]);
    const b = Array.from({ length: Math.floor(rand() * 30) }, () => "abc"[Math.floor(rand() * 3)]);
    expect(applyOps(a, b, myers(a, b))).toEqual(b);
  }
});

test("splitLines normalizes line breaks and ignores one trailing break", () => {
  expect(splitLines("")).toEqual([]);
  expect(splitLines("a\r\nb\rc\n")).toEqual(["a", "b", "c"]);
  expect(splitLines("a\n\n")).toEqual(["a", ""]);
});

test("identical texts give only equal rows", () => {
  const r = diff("ett\ntvå", "ett\r\ntvå\n");
  expect(r.blocks).toBe(0);
  expect(show(r.rows)).toEqual(["equal 1:ett | 1:ett", "equal 2:två | 2:två"]);
});

test("removed, added and changed lines line up side by side", () => {
  const r = diff("ett\ntvå\ntre\nfyra", "ett\nTVÅ\ntre\nfyra\nfem");
  expect(show(r.rows)).toEqual([
    "equal 1:ett | 1:ett",
    "change 2:två | 2:TVÅ",
    "equal 3:tre | 3:tre",
    "equal 4:fyra | 4:fyra",
    "insert - | 5:fem",
  ]);
  // Rows are counted by kind, and each run of changed rows is one block.
  expect([r.changed, r.removed, r.added, r.blocks]).toEqual([1, 0, 1, 2]);
  expect(r.rows.map((row) => row.block)).toEqual([null, 0, null, null, 1]);
});

test("a block pairs its lines in order and leaves the rest unpaired", () => {
  const r = diff("a\nb1\nb2\nb3\nc", "a\nx1\nc");
  expect(show(r.rows)).toEqual([
    "equal 1:a | 1:a",
    "change 2:b1 | 2:x1",
    "delete 3:b2 | -",
    "delete 4:b3 | -",
    "equal 5:c | 3:c",
  ]);
  expect([r.changed, r.removed, r.added, r.blocks]).toEqual([1, 2, 0, 1]);
});

test("changed lines mark the words that differ, on each side and inline", () => {
  const r = diff("Den snabba bruna räven.", "Den långsamma bruna räven!");
  expect(show(r.rows)).toEqual(["change 1:Den [snabba] bruna räven[.] | 1:Den [långsamma] bruna räven[!]"]);
  expect(r.rows[0].inline).toEqual([
    { text: "Den ", op: "equal" },
    { text: "snabba", op: "delete" },
    { text: "långsamma", op: "insert" },
    { text: " bruna räven", op: "equal" },
    { text: ".", op: "delete" },
    { text: "!", op: "insert" },
  ]);
});

test("changes separated only by spaces join into one run out and one in", () => {
  const w = wordDiff("Det gamla magasinet vid kajen rivs för att ge plats.", "Det gamla magasinet vid kajen bevaras och blir kulturhus.");
  expect(w.inline).toEqual([
    { text: "Det gamla magasinet vid kajen ", op: "equal" },
    { text: "rivs för att ge plats", op: "delete" },
    { text: "bevaras och blir kulturhus", op: "insert" },
    { text: ".", op: "equal" },
  ]);
});

test("whole-line rows carry their text inline", () => {
  const r = diff("a\nb", "a\nc\nd");
  expect(r.rows.map((row) => row.inline)).toEqual([
    [{ text: "a", op: "equal" }],
    [
      { text: "b", op: "delete" },
      { text: "c", op: "insert" },
    ],
    [{ text: "d", op: "insert" }],
  ]);
});

test("a pair with little in common is shown as a whole line out and in", () => {
  const w = wordDiff("Rubriken är helt ny i dag", "Något annat står här i dag");
  expect(w.a).toEqual([{ text: "Rubriken är helt ny i dag", changed: true }]);
  expect(w.inline.map((s) => s.op)).toEqual(["delete", "insert"]);
  expect(wordDiff("abc", "xyz").b).toEqual([{ text: "xyz", changed: true }]);
});

test("hidden characters are differences of their own", () => {
  // A non-breaking space and a soft hyphen, the usual round-trip slips.
  const w = wordDiff("12 000 kr och räksmörgås", "12\u00a0000 kr och rä\u00adksmörgås");
  expect(w.b.filter((p) => p.changed).map((p) => p.text)).toEqual(["\u00a0", "rä\u00adksmörgås"]);
});

test("texts too far apart fall back to remove-then-add", () => {
  const a = Array.from({ length: 3000 }, (_, i) => `a${i}`);
  const b = Array.from({ length: 3000 }, (_, i) => `b${i}`);
  const r = diff(["same", ...a, "end"].join("\n"), ["same", ...b, "end"].join("\n"));
  expect(r.truncated).toBe(true);
  expect([r.changed, r.removed, r.added, r.blocks]).toEqual([3000, 0, 0, 1]);
  expect(r.rows[0].kind).toBe("equal");
  expect(r.rows.at(-1)!.kind).toBe("equal");
  expect(r.rows).toHaveLength(3002);
  expect(diff("a", "b").truncated).toBe(false);
});
