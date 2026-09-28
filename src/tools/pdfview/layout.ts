/* pdfview layout — pure layout math for the PDF side-by-side viewer.
   Ported from prodtools' static/pdfview.js; the only changes are ES exports
   and types.

   Since step 7 the viewer shows one pair of pages at a time instead of a
   scrolling stack, so the stack's layout and virtualization window
   (computeLayout, rowAt, windowRange) were replaced by pairLayout.

   No DOM, no storage, no network, no PDF.js: every function takes plain
   numbers/arrays and returns plain data, so the viewer's row pairing, zoom
   and layout are unit-testable in isolation.

   Units: page sizes are PDF points (1/72 in); `scale` is CSS px per point, so
   scale 4/3 is "100 %" (96 CSS px per inch). */

/** Page size in points: [width, height]. */
export type Size = [number, number];

export interface Row {
  a: number | null;
  b: number | null;
}

export interface RowSet {
  /** The A page number of the first row (may be 0 or less with an offset). */
  start: number;
  rows: Row[];
}

export interface LayoutOptions {
  /** Outer padding. */
  pad: number;
  /** Width of the middle column. */
  gutter: number;
}

export interface Box {
  w: number;
  h: number;
}

export interface PairLayout {
  a: Box;
  b: Box;
  slotW: number;
  totalW: number;
  totalH: number;
}

export type FitMode = "width" | "page" | "actual";

export var ACTUAL_SIZE = 96 / 72; // CSS px per point at 100 %
export var MIN_SCALE = 0.1;
export var MAX_SCALE = 8;
var ZOOM_STEP = 1.25;

// Starred pages -> "1, 5, 7" (numeric order, no duplicates).
export function formatPageList(pages: Iterable<number | string>): string {
  var seen: Record<number, boolean> = {};
  var out: number[] = [];
  Array.from(pages).forEach(function (p) {
    var n = Number(p);
    if (Number.isInteger(n) && !seen[n]) {
      seen[n] = true;
      out.push(n);
    }
  });
  out.sort(function (x, y) {
    return x - y;
  });
  return out.join(", ");
}

// Keep the B offset inside the range where the two files still overlap by
// at least one page.
export function clampOffset(offset: number | string, numA: number, numB: number): number {
  var n = Math.round(Number(offset)) || 0;
  var lo = -(Math.max(1, numA) - 1);
  var hi = Math.max(1, numB) - 1;
  return Math.max(lo, Math.min(hi, n));
}

// Pair up the pages: row r shows A page r next to B page r + offset. Rows
// run from the first page that exists on either side to the last one; a
// side with no page there is null (drawn as a "saknas" placeholder).
export function buildRows(numA: number, numB: number, offset: number): RowSet {
  var off = offset || 0;
  var start = Math.min(1, 1 - off);
  var end = Math.max(numA, numB - off);
  var rows: Row[] = [];
  for (var r = start; r <= end; r++) {
    var b = r + off;
    rows.push({
      a: r >= 1 && r <= numA ? r : null,
      b: b >= 1 && b <= numB ? b : null,
    });
  }
  return { start: start, rows: rows };
}

// Row index showing A page n (clamped to the rows that exist).
export function rowIndexForA(rowSet: RowSet, n: number): number {
  var i = Math.round(n) - rowSet.start;
  return Math.max(0, Math.min(rowSet.rows.length - 1, i));
}

export function clampScale(s: number): number {
  return Math.max(MIN_SCALE, Math.min(MAX_SCALE, s));
}

// One zoom step in or out (dir > 0 = in).
export function stepScale(scale: number, dir: number): number {
  return clampScale(dir > 0 ? scale * ZOOM_STEP : scale / ZOOM_STEP);
}

export function percent(scale: number): number {
  return Math.round((scale / ACTUAL_SIZE) * 100);
}

// Scale for a fit mode. `maxW`/`maxH` are the largest page size (points)
// of the pair shown; `view` is the scroll viewport in CSS px; `opts` holds
// the fixed chrome (outer padding, middle gutter).
export function fitScale(
  mode: FitMode,
  maxW: number,
  maxH: number,
  view: { width: number; height: number },
  opts: LayoutOptions,
): number {
  var slotW = (view.width - 2 * opts.pad - opts.gutter) / 2;
  var byWidth = slotW / maxW;
  if (mode === "page") {
    var byHeight = (view.height - 2 * opts.pad) / maxH;
    return clampScale(Math.min(byWidth, byHeight));
  }
  if (mode === "actual") return ACTUAL_SIZE;
  return clampScale(byWidth);
}

// Geometry of one pair in CSS px: A's page, the gutter, B's page. Both
// slots are as wide as the wider page, so the gutter sits in the middle;
// a missing side borrows the other side's size for its placeholder. Sizes
// round down so a fitted pair never overflows the view by a pixel.
export function pairLayout(sizeA: Size | null, sizeB: Size | null, scale: number, opts: LayoutOptions): PairLayout {
  var sa = sizeA || sizeB!;
  var sb = sizeB || sizeA!;
  var box = function (s: Size): Box {
    return { w: Math.max(1, Math.floor(s[0] * scale)), h: Math.max(1, Math.floor(s[1] * scale)) };
  };
  var a = box(sa);
  var b = box(sb);
  var slotW = Math.max(a.w, b.w);
  return {
    a: a,
    b: b,
    slotW: slotW,
    totalW: 2 * opts.pad + 2 * slotW + opts.gutter,
    totalH: 2 * opts.pad + Math.max(a.h, b.h),
  };
}
