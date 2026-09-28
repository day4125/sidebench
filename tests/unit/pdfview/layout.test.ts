// Port of prodtools' tests/pdf-view/pdf-view.test.html. Same cases, same
// expectations; only the harness changed. The stack layout's cases were
// replaced by pairLayout's when the viewer became a pager (step 7).
import { expect, test } from "vitest";
import * as PV from "@/tools/pdfview/layout";
import type { Size } from "@/tools/pdfview/layout";

const OPTS = { pad: 10, gutter: 50 };
const A4: Size = [595, 842];

test("formatPageList sorts numerically, drops duplicates, joins with ', '", () => {
  expect(PV.formatPageList(new Set([7, 1, 5]))).toBe("1, 5, 7");
  expect(PV.formatPageList([10, 2, 2, 33])).toBe("2, 10, 33");
  expect(PV.formatPageList([])).toBe("");
});

test("buildRows pairs page N with page N when offset is 0", () => {
  const set = PV.buildRows(3, 3, 0);
  expect(set.start).toBe(1);
  expect(set.rows).toEqual([{ a: 1, b: 1 }, { a: 2, b: 2 }, { a: 3, b: 3 }]);
});

test("buildRows marks missing pages when the files differ in length", () => {
  expect(PV.buildRows(2, 3, 0).rows).toEqual([{ a: 1, b: 1 }, { a: 2, b: 2 }, { a: null, b: 3 }]);
  expect(PV.buildRows(3, 1, 0).rows).toEqual([{ a: 1, b: 1 }, { a: 2, b: null }, { a: 3, b: null }]);
});

test("buildRows with offset +1 puts B's extra first page on its own row", () => {
  const set = PV.buildRows(2, 3, 1);
  expect(set.start).toBe(0);
  expect(set.rows).toEqual([{ a: null, b: 1 }, { a: 1, b: 2 }, { a: 2, b: 3 }]);
});

test("buildRows with offset -1 puts A's extra first page on its own row", () => {
  const set = PV.buildRows(3, 2, -1);
  expect(set.start).toBe(1);
  expect(set.rows).toEqual([{ a: 1, b: null }, { a: 2, b: 1 }, { a: 3, b: 2 }]);
});

test("rowIndexForA finds A's page and clamps out-of-range input", () => {
  const set = PV.buildRows(5, 6, 1); // start 0
  expect(PV.rowIndexForA(set, 1)).toBe(1);
  expect(PV.rowIndexForA(set, 5)).toBe(5);
  expect(PV.rowIndexForA(set, -3)).toBe(0);
  expect(PV.rowIndexForA(set, 99)).toBe(set.rows.length - 1);
});

test("clampOffset keeps at least one overlapping page", () => {
  expect(PV.clampOffset(2, 5, 5)).toBe(2);
  expect(PV.clampOffset(9, 5, 5)).toBe(4);
  expect(PV.clampOffset(-9, 5, 5)).toBe(-4);
  expect(PV.clampOffset("abc", 5, 5)).toBe(0);
  expect(PV.clampOffset("1.4", 5, 5)).toBe(1);
});

test("stepScale zooms by 1.25 and stays within limits", () => {
  expect(PV.stepScale(1, 1)).toBeCloseTo(1.25, 9);
  expect(PV.stepScale(1, -1)).toBeCloseTo(0.8, 9);
  expect(PV.stepScale(PV.MAX_SCALE, 1)).toBe(PV.MAX_SCALE);
  expect(PV.stepScale(PV.MIN_SCALE, -1)).toBe(PV.MIN_SCALE);
});

test("percent reports 100 at actual size", () => {
  expect(PV.percent(PV.ACTUAL_SIZE)).toBe(100);
  expect(PV.percent(PV.ACTUAL_SIZE * 2)).toBe(200);
});

test("fitScale width splits the viewport between two columns", () => {
  const view = { width: 1250, height: 800 };
  // (1250 - 2*10 - 50) / 2 = 590 px per column
  expect(PV.fitScale("width", 590, 842, view, OPTS)).toBeCloseTo(1, 9);
});

test("fitScale page also fits the height", () => {
  const view = { width: 1250, height: 441 };
  // height: (441 - 20) / 842 = 0.5
  expect(PV.fitScale("page", 590, 842, view, OPTS)).toBeCloseTo(0.5, 9);
  expect(PV.fitScale("actual", 590, 842, view, OPTS)).toBeCloseTo(PV.ACTUAL_SIZE, 9);
});

test("pairLayout sizes both slots from the wider page", () => {
  const layout = PV.pairLayout(A4, [842, 595], 1, OPTS);
  expect(layout.a).toEqual({ w: 595, h: 842 });
  expect(layout.b).toEqual({ w: 842, h: 595 });
  expect(layout.slotW).toBe(842);
  expect(layout.totalW).toBe(20 + 2 * 842 + 50);
  expect(layout.totalH).toBe(20 + 842);
});

test("pairLayout sizes a missing page from the other side and rounds down", () => {
  const layout = PV.pairLayout(null, [401, 301], 0.5, OPTS);
  expect(layout.a).toEqual({ w: 200, h: 150 });
  expect(layout.b).toEqual({ w: 200, h: 150 });
});

test("a fitted pair fits the view", () => {
  const view = { width: 1333, height: 777 };
  for (const mode of ["width", "page"] as const) {
    const s = PV.fitScale(mode, 842, 842, view, OPTS);
    const layout = PV.pairLayout(A4, [842, 595], s, OPTS);
    expect(layout.totalW).toBeLessThanOrEqual(view.width);
    if (mode === "page") expect(layout.totalH).toBeLessThanOrEqual(view.height);
  }
});
