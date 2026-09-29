// Line diff with word-level highlights, for the inline and side-by-side
// views. Written here rather than taken from a package: every runtime
// dependency handles the content (INTENT.md), and a Myers diff is small.
//
// The lines are diffed with Myers' O(ND) algorithm. Each block of removed
// and added lines is then paired row by row (the first removed line beside
// the first added one, and so on, as GitHub's split view does), and each
// pair is diffed again by word to mark what changed inside the line. A pair
// with too little in common is shown as a whole line out, a whole line in.

export type RowKind = "equal" | "change" | "delete" | "insert";
export type Op = "equal" | "delete" | "insert";

/** A run of a line's text, marked if it differs from the other side. */
export interface Part {
  text: string;
  changed: boolean;
}

/** A run of the inline view: text both sides share, or only one has. */
export interface Seg {
  text: string;
  op: Op;
}

/** One side of a row: its 1-based line number and the line in parts. */
export interface Cell {
  no: number;
  parts: Part[];
}

/** One row of the view. A side is null where the other side has a line the
 * first doesn't (a pure delete or insert). */
export interface Row {
  kind: RowKind;
  a: Cell | null;
  b: Cell | null;
  /** The row as one line, for the inline view. */
  inline: Seg[];
  /** Which difference (0-based block of changed rows) this row is in. */
  block: number | null;
}

export interface DiffResult {
  rows: Row[];
  /** Blocks of adjacent changed rows: what the user steps through. */
  blocks: number;
  /** Rows by kind. */
  changed: number;
  removed: number;
  added: number;
  /** The texts were too far apart to search; everything between the common
   * start and end is shown as removed, then added. */
  truncated: boolean;
}


/** Past this many line edits the diff stops searching and shows the rest as
 * removed and re-added; the search's memory grows with the square of it. */
const MAX_LINE_EDITS = 2000;
/** Word highlights are skipped for a pair of lines further apart than this. */
const MAX_WORD_EDITS = 400;

/**
 * The shortest edit script from a to b, as one op per step, or null when it
 * needs more than maxD inserts and deletes. Myers (1986), keeping each
 * step's frontier for the walk back.
 */
export function myers<T>(a: readonly T[], b: readonly T[], maxD = Infinity): Op[] | null {
  // Common ends are cheap to strip and keep the search small.
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }
  const n = endA - start;
  const m = endB - start;
  const limit = Math.min(n + m, maxD);
  const off = limit + 1;
  const v = new Int32Array(2 * limit + 3);
  const trace: Int32Array[] = [];
  let found = false;

  search: for (let d = 0; d <= limit; d++) {
    for (let k = -d; k <= d; k += 2) {
      let x = k === -d || (k !== d && v[off + k - 1] < v[off + k + 1]) ? v[off + k + 1] : v[off + k - 1] + 1;
      let y = x - k;
      while (x < n && y < m && a[start + x] === b[start + y]) {
        x++;
        y++;
      }
      v[off + k] = x;
      if (x >= n && y >= m) {
        trace.push(v.slice(off - d, off + d + 1));
        found = true;
        break search;
      }
    }
    trace.push(v.slice(off - d, off + d + 1));
  }
  if (!found) return null;

  // Walk back from the end; trace[d] holds k = -d..d at index k + d.
  const middle: Op[] = [];
  let x = n;
  let y = m;
  for (let d = trace.length - 1; d > 0; d--) {
    const prev = trace[d - 1];
    const at = (k: number) => prev[k + d - 1];
    const k = x - y;
    const down = k === -d || (k !== d && at(k - 1) < at(k + 1));
    const pk = down ? k + 1 : k - 1;
    const px = at(pk);
    const py = px - pk;
    while (x > px && y > py) {
      middle.push("equal");
      x--;
      y--;
    }
    middle.push(down ? "insert" : "delete");
    if (down) y--;
    else x--;
  }
  while (x > 0 && y > 0) {
    middle.push("equal");
    x--;
    y--;
  }
  middle.reverse();

  const ops: Op[] = new Array<Op>(start).fill("equal");
  ops.push(...middle);
  for (let i = endA; i < a.length; i++) ops.push("equal");
  return ops;
}

/** Splits text into lines. CRLF and CR count as LF, and one trailing line
 * break doesn't make an extra empty line. */
export function splitLines(text: string): string[] {
  if (text === "") return [];
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  if (lines[lines.length - 1] === "") lines.pop();
  return lines;
}

/** Words, runs of whitespace, and single other characters. */
function tokenize(line: string): string[] {
  return line.match(/[\p{L}\p{N}_]+|\s+|./gu) ?? [];
}

/** Adjacent tokens with the same mark merge into one part. */
function push(parts: Part[], text: string, changed: boolean) {
  const last = parts[parts.length - 1];
  if (last && last.changed === changed) last.text += text;
  else parts.push({ text, changed });
}

/** Below this share of shared text, a pair reads better as a whole line
 * out and a whole line in than as a scatter of marks. */
const MIN_SIMILARITY = 0.4;

/** Marks the words that differ between two lines: parts for each side and
 * the merged run for the inline view. Lines too far apart for that to help
 * are marked as a whole. */
export function wordDiff(a: string, b: string): { a: Part[]; b: Part[]; inline: Seg[] } {
  const ta = tokenize(a);
  const tb = tokenize(b);
  const ops = myers(ta, tb, MAX_WORD_EDITS);
  const apart = { a: whole(a, true), b: whole(b, true), inline: [seg(a, "delete"), seg(b, "insert")].filter((s) => s.text) };
  if (!ops) return apart;
  const pa: Part[] = [];
  const pb: Part[] = [];
  const inline: Seg[] = [];
  let shared = 0;
  let i = 0;
  let j = 0;
  let k = 0;
  while (k < ops.length) {
    if (ops[k] === "equal" && !bridges(ops, ta, i, k)) {
      if (ta[i].trim()) shared += ta[i].length;
      push(pa, ta[i], false);
      push(pb, tb[j], false);
      pushSeg(inline, ta[i], "equal");
      i++;
      j++;
      k++;
      continue;
    }
    // A run of changes, with the spaces between its words: all of it out,
    // then all of it in, rather than word by word in turn.
    let out = "";
    let into = "";
    for (; k < ops.length && (ops[k] !== "equal" || bridges(ops, ta, i, k)); k++) {
      if (ops[k] !== "insert") out += ta[i++];
      if (ops[k] !== "delete") into += tb[j++];
    }
    if (out) push(pa, out, true);
    if (into) push(pb, into, true);
    if (out) pushSeg(inline, out, "delete");
    if (into) pushSeg(inline, into, "insert");
  }
  const letters = (a + b).replace(/\s/g, "").length;
  if (letters > 0 && (2 * shared) / letters < MIN_SIMILARITY) return apart;
  return { a: pa, b: pb, inline };
}

/** Whether the shared token at ops[k] is only whitespace between two
 * changes, which then join into one. */
function bridges(ops: Op[], ta: string[], i: number, k: number) {
  return ops[k] === "equal" && k > 0 && ops[k - 1] !== "equal" && k + 1 < ops.length && ops[k + 1] !== "equal" && !ta[i].trim();
}

const seg = (text: string, op: Op): Seg => ({ text, op });

function pushSeg(segs: Seg[], text: string, op: Op) {
  const last = segs[segs.length - 1];
  if (last && last.op === op) last.text += text;
  else segs.push({ text, op });
}

const whole = (text: string, changed: boolean): Part[] => [{ text, changed }];

export function diff(textA: string, textB: string): DiffResult {
  const a = splitLines(textA);
  const b = splitLines(textB);
  const searched = myers(a, b, MAX_LINE_EDITS);
  const ops = searched ?? fallback(a, b);

  const rows: Row[] = [];
  const count = { change: 0, delete: 0, insert: 0 };
  let blocks = 0;
  let i = 0;
  let j = 0;
  let k = 0;
  while (k < ops.length) {
    if (ops[k] === "equal") {
      const parts = whole(a[i], false);
      rows.push({ kind: "equal", a: { no: i + 1, parts }, b: { no: j + 1, parts }, inline: [seg(a[i], "equal")], block: null });
      i++;
      j++;
      k++;
      continue;
    }
    // A block of changes: its removed lines, then its added ones.
    const dels: number[] = [];
    const ins: number[] = [];
    for (; k < ops.length && ops[k] !== "equal"; k++) {
      if (ops[k] === "delete") dels.push(i++);
      else ins.push(j++);
    }
    const block = blocks++;
    for (let r = 0; r < Math.max(dels.length, ins.length); r++) {
      const da = dels[r];
      const db = ins[r];
      let row: Row;
      if (da !== undefined && db !== undefined) {
        const w = wordDiff(a[da], b[db]);
        row = { kind: "change", a: { no: da + 1, parts: w.a }, b: { no: db + 1, parts: w.b }, inline: w.inline, block };
      } else if (da !== undefined) {
        row = { kind: "delete", a: { no: da + 1, parts: whole(a[da], true) }, b: null, inline: [seg(a[da], "delete")], block };
      } else {
        row = { kind: "insert", a: null, b: { no: db + 1, parts: whole(b[db], true) }, inline: [seg(b[db], "insert")], block };
      }
      count[row.kind as keyof typeof count]++;
      rows.push(row);
    }
  }
  return {
    rows,
    blocks,
    changed: count.change,
    removed: count.delete,
    added: count.insert,
    truncated: !searched,
  };
}

/** For texts too far apart to search: keep the common start and end, and
 * show everything between as removed and then added. */
function fallback(a: string[], b: string[]): Op[] {
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let end = 0;
  while (end < a.length - start && end < b.length - start && a[a.length - 1 - end] === b[b.length - 1 - end]) end++;
  return [
    ...new Array<Op>(start).fill("equal"),
    ...new Array<Op>(a.length - start - end).fill("delete"),
    ...new Array<Op>(b.length - start - end).fill("insert"),
    ...new Array<Op>(end).fill("equal"),
  ];
}
