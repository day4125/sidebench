// What an operation changed, for the text box's brief highlight. The text
// before and after is diffed by word, and the result is split into runs:
// unchanged, new, or a point where something was removed with nothing in
// its place.
import { myers } from "@/tools/diff/engine";

export interface Run {
  /** Empty for "gone". */
  text: string;
  kind: "same" | "new" | "gone";
}

// Words (letters and digits) and runs of whitespace are tokens; every other
// character is a token of its own, so a swapped quote marks only the quote.
const TOKEN = /(\s+|[^\p{L}\p{N}\s])/u;
const tokens = (t: string) => t.split(TOKEN).filter(Boolean);

/** Past this many token edits the whole result counts as new. */
const MAX_EDITS = 1000;

export function changedRuns(before: string, after: string): Run[] {
  const a = tokens(before);
  const b = tokens(after);
  const steps = myers(a, b, MAX_EDITS);
  if (!steps) return after ? [{ text: after, kind: "new" }] : [];
  const runs: Run[] = [];
  const push = (text: string, kind: Run["kind"]) => {
    const last = runs[runs.length - 1];
    if (last?.kind === kind && kind !== "gone") last.text += text;
    else runs.push({ text, kind });
  };
  let j = 0;
  // A removal shows only if nothing new takes its place.
  let gone = false;
  for (const step of steps) {
    if (step === "delete") {
      gone = true;
      continue;
    }
    if (step === "equal" && gone) push("", "gone");
    gone = false;
    push(b[j++], step === "equal" ? "same" : "new");
  }
  if (gone) push("", "gone");
  return runs;
}
