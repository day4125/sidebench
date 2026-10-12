import { expect, test } from "vitest";
import { changedRuns } from "@/tools/text/changes";

test("an unchanged text is one unchanged run", () => {
  expect(changedRuns("Hej då", "Hej då")).toEqual([{ text: "Hej då", kind: "same" }]);
});

test("a swapped character is marked on its own, not its word", () => {
  expect(changedRuns('"citat" här', "”citat” här")).toEqual([
    { text: "”", kind: "new" },
    { text: "citat", kind: "same" },
    { text: "”", kind: "new" },
    { text: " här", kind: "same" },
  ]);
});

test("a changed word is marked whole", () => {
  expect(changedRuns("en ny rapport", "en NY rapport")).toEqual([
    { text: "en ", kind: "same" },
    { text: "NY", kind: "new" },
    { text: " rapport", kind: "same" },
  ]);
});

test("a removal with nothing in its place leaves a point", () => {
  expect(changedRuns("a, b", "a b")).toEqual([
    { text: "a", kind: "same" },
    { text: "", kind: "gone" },
    { text: " b", kind: "same" },
  ]);
  expect(changedRuns("a b.", "a b")).toEqual([
    { text: "a b", kind: "same" },
    { text: "", kind: "gone" },
  ]);
});

test("a joined hyphenation is one new word", () => {
  expect(changedRuns("i under-\nsökningen", "i undersökningen")).toEqual([
    { text: "i ", kind: "same" },
    { text: "undersökningen", kind: "new" },
  ]);
});

test("past the edit limit the whole result counts as new", () => {
  const before = Array.from({ length: 1200 }, (_, i) => `ord${i}`).join(" ");
  const after = before.toUpperCase();
  expect(changedRuns(before, after)).toEqual([{ text: after, kind: "new" }]);
});

test("an emptied text leaves only the point", () => {
  expect(changedRuns("Hej", "")).toEqual([{ text: "", kind: "gone" }]);
});
