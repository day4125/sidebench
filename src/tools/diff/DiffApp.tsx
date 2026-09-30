// Diff checker: paste two texts and see at once whether they're the same,
// and if not, step through each difference. Made for checking a text after
// a trip through the CMS or Word, where the answer is usually "identical"
// or a few slips. The texts and the result live in this component's state
// only (INTENT.md).
//
// The comparison is live: it runs shortly after typing stops, so there's no
// button and no result that can go stale. A text large enough to make that
// slow switches to Ctrl+Enter, and the old result is dimmed until then.
//
// Two views of one result: inline (the default, one flowing text with
// removed words struck through and added ones marked, like Word's track
// changes) and side by side. Phones always get inline. Unchanged runs fold
// down to one line of context around each difference. Inside a difference,
// the characters a round trip tends to slip in (non-breaking spaces, soft
// hyphens, zero-width characters, tabs) are drawn with Word's symbols for
// hidden characters, so a mark never looks empty.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronDown, ChevronsUpDown, ChevronUp, CircleCheck } from "lucide-react";
import { cn } from "cn";
import { AppShell } from "@/app/AppShell";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { HIDDEN, HIDDEN_SPLIT } from "@/lib/hidden-chars";
import { useIsMobile } from "@/hooks/use-mobile";
import { NumberedTextarea } from "./NumberedTextarea";
import { diff, type Cell, type DiffResult, type Row, type Seg } from "./engine";

const SIDES = [
  { id: "diff-a", label: "Text 1", placeholder: "Klistra in text 1 här..." },
  { id: "diff-b", label: "Text 2", placeholder: "Klistra in text 2 här..." },
] as const;

/** Wait this long after the last keystroke before comparing. */
const DEBOUNCE_MS = 150;
/** A comparison slower than this stops the live updates (Ctrl+Enter). */
const LIVE_BUDGET_MS = 200;
/** Unchanged lines kept on each side of a difference. */
const CONTEXT = 1;
/** Shorter unchanged runs than this aren't worth a fold row. */
const MIN_FOLD = 3;

export type View = "inline" | "split";

// ---------------------------------------------------------------------------
// State: the live comparison.

function useLiveDiff(a: string, b: string) {
  const [result, setResult] = useState<DiffResult | null>(null);
  const [slow, setSlow] = useState(false);
  const [stale, setStale] = useState(false);
  // Bumped per comparison, so the result view starts fresh (folds, place).
  const [version, setVersion] = useState(0);
  const empty = !a || !b;

  const run = useCallback(() => {
    if (!a || !b) return;
    const t = performance.now();
    const next = diff(a, b);
    setSlow(performance.now() - t > LIVE_BUDGET_MS);
    setResult(next);
    setStale(false);
    setVersion((v) => v + 1);
  }, [a, b]);

  useEffect(() => {
    if (empty) {
      setResult(null);
      setStale(false);
      setSlow(false);
      return;
    }
    if (slow) {
      setStale(true);
      return;
    }
    const id = window.setTimeout(run, DEBOUNCE_MS);
    return () => window.clearTimeout(id);
    // Only the texts start a comparison; `slow` is read as it stands.
  }, [a, b]);

  return { result: empty ? null : result, stale, version, run };
}

// ---------------------------------------------------------------------------

export function DiffApp() {
  const [texts, setTexts] = useState<[string, string]>(["", ""]);
  const [chosenView, setView] = useState<View>("inline");
  const mobile = useIsMobile();
  const view = mobile ? "inline" : chosenView;
  const { result, stale, version, run } = useLiveDiff(texts[0], texts[1]);

  // Ctrl+Enter compares at once, wherever the focus is.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        run();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [run]);

  const missing = texts[0] && !texts[1] ? "text 2" : !texts[0] && texts[1] ? "text 1" : null;

  return (
    <AppShell tool="diff">
      <div className="mx-auto flex max-w-6xl flex-col gap-5">
        <div className="grid gap-3 md:grid-cols-2">
          {SIDES.map((side, i) => (
            <NumberedTextarea
              key={side.id}
              id={side.id}
              aria-label={side.label}
              value={texts[i]}
              onChange={(e) => {
                const next: [string, string] = [...texts];
                next[i] = e.target.value;
                setTexts(next);
              }}
              spellCheck={false}
              placeholder={side.placeholder}
              className="h-56 md:h-72"
            />
          ))}
        </div>

        {missing && <p className="text-sm text-muted-foreground">Klistra in {missing} för att jämföra.</p>}
        {result && (
          <ResultView
            key={version}
            result={result}
            stale={stale}
            onRun={run}
            view={view}
            onView={mobile ? undefined : setView}
          />
        )}
      </div>
    </AppShell>
  );
}

// ---------------------------------------------------------------------------
// The result: verdict bar, then the chosen view.

function ResultView({
  result,
  stale,
  onRun,
  view,
  onView,
}: {
  result: DiffResult;
  stale: boolean;
  onRun: () => void;
  view: View;
  onView?: (v: View) => void;
}) {
  const [current, setCurrent] = useState<number | null>(null);
  const [opened, setOpened] = useState<ReadonlySet<number>>(new Set());
  const body = useRef<HTMLDivElement>(null);
  const items = useMemo(() => foldRows(result.rows, opened), [result.rows, opened]);
  const same = result.blocks === 0;

  const go = useCallback(
    (step: 1 | -1) => {
      if (same) return;
      const n = result.blocks;
      setCurrent((c) => (c === null ? (step === 1 ? 0 : n - 1) : (c + step + n) % n));
    },
    [result.blocks, same],
  );

  // Bring the current difference into view and mark its arrival. Runs after
  // the view is in the DOM, so it also follows a switch of view.
  useEffect(() => {
    if (current === null || !body.current) return;
    const first = body.current.querySelector<HTMLElement>(`[data-block-start="${current}"]`);
    if (!first) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    first.scrollIntoView({ block: "center", behavior: still ? "auto" : "smooth" });
    // Focus follows, unless it's in a text field: typing shouldn't be cut off.
    if (!(document.activeElement instanceof HTMLTextAreaElement)) first.focus({ preventScroll: true });
    if (still) return;
    for (const cell of body.current.querySelectorAll<HTMLElement>(`[data-block="${current}"]`)) {
      cell.animate(
        [{ boxShadow: "inset 0 0 0 2px var(--primary)" }, { boxShadow: "inset 0 0 0 2px transparent" }],
        { duration: 1100, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
      );
    }
  }, [current, view]);

  // Alt+Down / Alt+Up step through the differences from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        go(e.key === "ArrowDown" ? 1 : -1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  const open = (start: number) => setOpened((s) => new Set(s).add(start));

  return (
    <section aria-label="Resultat" className="flex flex-col">
      <Verdict result={result} stale={stale} onRun={onRun} current={current} onStep={go} view={view} onView={onView} />
      {!same && (
        <div
          ref={body}
          className={cn(
            "overflow-hidden rounded-xl border bg-card transition-opacity duration-200",
            stale && "opacity-45",
          )}
        >
          {view === "inline" ? (
            <InlineView items={items} current={current} onOpen={open} />
          ) : (
            <SplitView items={items} current={current} onOpen={open} />
          )}
        </div>
      )}
      <p aria-live="polite" className="sr-only">
        {current !== null ? `Skillnad ${current + 1} av ${result.blocks}` : ""}
      </p>
    </section>
  );
}

// ---------------------------------------------------------------------------
// The verdict: the answer first, then the way through it.

function Verdict({
  result,
  stale,
  onRun,
  current,
  onStep,
  view,
  onView,
}: {
  result: DiffResult;
  stale: boolean;
  onRun: () => void;
  current: number | null;
  onStep: (step: 1 | -1) => void;
  view: View;
  onView?: (v: View) => void;
}) {
  const same = result.blocks === 0;
  return (
    <div className="sticky top-0 z-10 -mx-1 mb-2 flex flex-wrap items-center gap-x-4 gap-y-2 bg-background px-1 py-2">
      <div role="status" className="flex min-w-0 flex-1 flex-col">
        {stale ? (
          <>
            <span className="font-medium">Texten har ändrats</span>
            <span className="text-sm text-muted-foreground">
              Stora texter jämförs inte medan du skriver. Tryck <Kbd>Ctrl</Kbd> <Kbd>Enter</Kbd>.
            </span>
          </>
        ) : same ? (
          <>
            <span className="flex items-center gap-2 text-base font-medium">
              <CircleCheck aria-hidden="true" className="size-5 text-primary" />
              Texterna är identiska
            </span>
            <span className="pl-7 text-sm text-muted-foreground">
              {plural(result.rows.length, "rad", "rader")} jämförda, tecken för tecken
            </span>
          </>
        ) : (
          <>
            <span className="text-base font-medium">{plural(result.blocks, "skillnad", "skillnader")}</span>
            <span className="text-sm text-muted-foreground">{rowSummary(result)}</span>
          </>
        )}
        {result.truncated && !stale && (
          <span className="text-sm text-muted-foreground">
            Texterna skiljer sig för mycket för en exakt jämförelse, så allt mellan första och sista gemensamma rad
            visas som ändrat.
          </span>
        )}
      </div>

      {stale ? (
        <Button variant="outline" size="sm" onClick={onRun}>
          Jämför
        </Button>
      ) : (
        !same && (
          <div className="flex flex-wrap items-center gap-3">
            {/* One difference needs no way through: it's already on screen. */}
            {result.blocks > 1 && (
              <div role="group" aria-label="Skillnader" className="flex items-center gap-1">
                <span className="mr-1 text-sm tabular-nums text-muted-foreground">
                  {current !== null ? `Skillnad ${current + 1} av ${result.blocks}` : "Gå till skillnad"}
                </span>
                <StepButton label="Föregående skillnad" keys="Alt+ArrowUp" hint="↑" onClick={() => onStep(-1)}>
                  <ChevronUp />
                </StepButton>
                <StepButton label="Nästa skillnad" keys="Alt+ArrowDown" hint="↓" onClick={() => onStep(1)}>
                  <ChevronDown />
                </StepButton>
              </div>
            )}
            {onView && <ViewSwitch view={view} onView={onView} />}
          </div>
        )
      )}
    </div>
  );
}

export function StepButton({
  label,
  keys,
  hint,
  onClick,
  children,
}: {
  label: string;
  keys: string;
  hint: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          aria-label={label}
          aria-keyshortcuts={keys}
          onClick={onClick}
          className="size-8"
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={6}>
        {label}
        <span className="flex gap-0.5">
          <Kbd>Alt</Kbd>
          <Kbd>{hint}</Kbd>
        </span>
      </TooltipContent>
    </Tooltip>
  );
}

export function ViewSwitch({ view, onView }: { view: View; onView: (v: View) => void }) {
  const options: [View, string][] = [
    ["inline", "Inline"],
    ["split", "Sida vid sida"],
  ];
  return (
    <div role="group" aria-label="Visning" className="flex rounded-lg bg-muted p-0.5">
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          aria-pressed={view === v}
          onClick={() => onView(v)}
          className={cn(
            "h-7 rounded-md px-2.5 text-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
            view === v && "bg-background text-foreground shadow-xs dark:bg-secondary",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded border bg-muted px-1 py-px font-sans text-xs text-foreground">{children}</kbd>;
}

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

/** "Rader: 2 ändrade, 1 borttagen", leaving out kinds with none. */
function rowSummary({ changed, removed, added }: DiffResult) {
  const parts = [
    changed && plural(changed, "ändrad", "ändrade"),
    removed && plural(removed, "borttagen", "borttagna"),
    added && plural(added, "tillagd", "tillagda"),
  ].filter(Boolean);
  return `Rader: ${parts.join(", ")}`;
}

// ---------------------------------------------------------------------------
// Folding: each difference keeps CONTEXT unchanged lines around it; longer
// unchanged runs become one row that opens in place.

type Item = { type: "row"; row: Row } | { type: "fold"; start: number; count: number };

function foldRows(rows: Row[], opened: ReadonlySet<number>): Item[] {
  const items: Item[] = [];
  let i = 0;
  while (i < rows.length) {
    if (rows[i].kind !== "equal") {
      items.push({ type: "row", row: rows[i++] });
      continue;
    }
    const start = i;
    while (i < rows.length && rows[i].kind === "equal") i++;
    const head = start > 0 ? CONTEXT : 0;
    const tail = i < rows.length ? CONTEXT : 0;
    const hidden = i - start - head - tail;
    const from = start + head;
    if (hidden >= MIN_FOLD && !opened.has(from)) {
      for (let r = start; r < from; r++) items.push({ type: "row", row: rows[r] });
      items.push({ type: "fold", start: from, count: hidden });
      for (let r = from + hidden; r < i; r++) items.push({ type: "row", row: rows[r] });
    } else {
      for (let r = start; r < i; r++) items.push({ type: "row", row: rows[r] });
    }
  }
  return items;
}

export function FoldButton({ count, onOpen }: { count: number; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-2 bg-muted/50 px-3 py-1.5 text-left text-xs text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50"
    >
      <ChevronsUpDown aria-hidden="true" className="size-3.5" />
      {plural(count, "oförändrad rad", "oförändrade rader")}
    </button>
  );
}

// Tints for removed (red) and added (green) text: the line, its number, and
// the words that changed inside it.
export const TINT = {
  delete: {
    line: "bg-red-500/10",
    no: "bg-red-500/15",
    word: "rounded-sm bg-red-500/25 decoration-red-600/70 dark:bg-red-400/25 dark:decoration-red-300/70",
  },
  insert: {
    line: "bg-emerald-500/10",
    no: "bg-emerald-500/15",
    word: "rounded-sm bg-emerald-500/25 no-underline dark:bg-emerald-400/20",
  },
};

const gutterCls = "select-none px-2 py-1 text-right text-xs leading-6 text-muted-foreground tabular-nums";
const textCls = "min-w-0 px-3 py-1 leading-6 whitespace-pre-wrap break-words";

/** Line numbers take the accent while their difference is the current one. */
const currentNo = "font-medium text-primary";

// Stable keys: a row is known by its line numbers.
const rowKey = (row: Row) => `r${row.a?.no ?? ""}-${row.b?.no ?? ""}`;

// ---------------------------------------------------------------------------
// Inline: one column, old and new line numbers in the gutter.

function InlineView({
  items,
  current,
  onOpen,
}: {
  items: Item[];
  current: number | null;
  onOpen: (start: number) => void;
}) {
  let lastBlock: number | null = null;
  return (
    <div className="divide-y divide-border/60">
      {items.map((item) => {
        if (item.type === "fold") {
          return <FoldButton key={`f${item.start}`} count={item.count} onOpen={() => onOpen(item.start)} />;
        }
        const { row } = item;
        const starts = row.block !== null && row.block !== lastBlock;
        lastBlock = row.block;
        const tint = row.kind === "delete" ? TINT.delete : row.kind === "insert" ? TINT.insert : null;
        const isCurrent = row.block !== null && row.block === current;
        return (
          <div
            key={rowKey(row)}
            data-kind={row.kind}
            data-block={row.block ?? undefined}
            data-block-start={starts ? row.block! : undefined}
            tabIndex={starts ? -1 : undefined}
            className={cn("grid grid-cols-[2.25rem_2.25rem_minmax(0,1fr)] outline-none", tint?.line)}
          >
            <span className={cn(gutterCls, tint?.no, isCurrent && currentNo)}>{row.a?.no}</span>
            <span className={cn(gutterCls, tint?.no, isCurrent && currentNo)}>{row.b?.no}</span>
            <p className={cn(textCls, "max-w-[75ch]")}>
              <RowLabel kind={row.kind} />
              {row.inline.map((s, i) => (
                <InlineSeg key={i} seg={s} whole={row.kind !== "change"} />
              ))}
              <Blank empty={row.inline.every((s) => s.text === "")} />
            </p>
          </div>
        );
      })}
    </div>
  );
}

function InlineSeg({ seg, whole }: { seg: Seg; whole: boolean }) {
  if (seg.op === "equal") return <>{seg.text}</>;
  // A whole removed or added line is tinted by its row; a removed one is
  // also struck through. Inside a changed line, only the words are marked.
  if (whole) {
    return seg.op === "delete" ? (
      <del className="decoration-red-600/50 dark:decoration-red-300/50">{seg.text}</del>
    ) : (
      <>{seg.text}</>
    );
  }
  return <Mark kind={seg.op} text={seg.text} />;
}

// ---------------------------------------------------------------------------
// Side by side: the original left, the changed text right.

function SplitView({
  items,
  current,
  onOpen,
}: {
  items: Item[];
  current: number | null;
  onOpen: (start: number) => void;
}) {
  let lastBlock: number | null = null;
  return (
    <table className="w-full table-fixed border-collapse">
      <colgroup>
        <col className="w-11" />
        <col />
        <col className="w-11" />
        <col />
      </colgroup>
      <tbody className="divide-y divide-border/60">
        {items.map((item) => {
          if (item.type === "fold") {
            return (
              <tr key={`f${item.start}`}>
                <td colSpan={4} className="p-0">
                  <FoldButton count={item.count} onOpen={() => onOpen(item.start)} />
                </td>
              </tr>
            );
          }
          const { row } = item;
          const starts = row.block !== null && row.block !== lastBlock;
          lastBlock = row.block;
          return (
            <tr
              key={rowKey(row)}
              data-kind={row.kind}
              data-block-start={starts ? row.block! : undefined}
              tabIndex={starts ? -1 : undefined}
              className="outline-none"
            >
              <SplitCell row={row} side="a" current={current} />
              <SplitCell row={row} side="b" current={current} />
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function SplitCell({ row, side, current }: { row: Row; side: "a" | "b"; current: number | null }) {
  const cell: Cell | null = row[side];
  const edge = side === "b" && "border-l";
  if (!cell) {
    // The other side has a line this one doesn't: hatched, so it can't be
    // mistaken for an empty line.
    return (
      <td
        colSpan={2}
        data-block={row.block ?? undefined}
        className={cn("bg-[repeating-linear-gradient(135deg,transparent_0_5px,var(--color-border)_5px_6px)]", edge)}
      />
    );
  }
  const kind = side === "a" ? "delete" : "insert";
  const changed = row.kind !== "equal";
  const tint = TINT[kind];
  const isCurrent = row.block !== null && row.block === current;
  return (
    <>
      <td className={cn(gutterCls, "align-top", edge, changed && tint.no, isCurrent && currentNo)}>{cell.no}</td>
      <td data-block={row.block ?? undefined} className={cn(textCls, "align-top", changed && tint.line)}>
        {changed && <span className="sr-only">{SPLIT_LABEL[row.kind][side === "a" ? 0 : 1]}</span>}
        {cell.parts.map((p, i) =>
          // A line changed as a whole is tinted by its cell alone.
          p.changed && cell.parts.length > 1 ? <Mark key={i} kind={kind} text={p.text} /> : <span key={i}>{p.text}</span>,
        )}
        <Blank empty={cell.parts.every((p) => p.text === "")} />
      </td>
    </>
  );
}

const SPLIT_LABEL: Record<Row["kind"], [string, string]> = {
  equal: ["", ""],
  change: ["Ändrad rad, före: ", "Ändrad rad, efter: "],
  delete: ["Borttagen rad: ", ""],
  insert: ["", "Tillagd rad: "],
};

const ROW_LABEL: Record<Row["kind"], string> = {
  equal: "",
  change: "Ändrad rad: ",
  delete: "Borttagen rad: ",
  insert: "Tillagd rad: ",
};

function RowLabel({ kind }: { kind: Row["kind"] }) {
  return ROW_LABEL[kind] ? <span className="sr-only">{ROW_LABEL[kind]}</span> : null;
}

/** Keeps an empty line one line tall. */
function Blank({ empty }: { empty: boolean }) {
  return empty ? "​" : null;
}

// ---------------------------------------------------------------------------
// Marks: the words that changed inside a line. Whitespace at a mark's edges
// stays outside it, so marks hug the words. A mark that is only whitespace
// shows it, since otherwise it would look empty.

export function Mark({ kind, text }: { kind: "delete" | "insert"; text: string }) {
  const [, lead, core, trail] = /^( *)([\s\S]*?)( *)$/.exec(text)!;
  const Tag = kind === "delete" ? "del" : "ins";
  const onlySpace = core === "";
  return (
    <>
      {!onlySpace && lead}
      <Tag className={cn(TINT[kind].word, "[del+&]:ml-0.5", (onlySpace || !core.trim()) && "px-0.5")}>
        <span className="sr-only">{kind === "delete" ? "(borttaget: " : "(tillagt: "}</span>
        <Visible text={onlySpace ? text : core} spaces={onlySpace || /^\s+$/.test(core)} />
        <span className="sr-only">)</span>
      </Tag>
      {!onlySpace && trail}
    </>
  );
}

const SPACE = { glyph: "·", name: "mellanslag" };

/** Text with its hidden characters drawn. Plain spaces only when `spaces`. */
function Visible({ text, spaces }: { text: string; spaces: boolean }) {
  return text.split(HIDDEN_SPLIT).map((piece, i) => {
    const hidden = piece === " " ? (spaces ? SPACE : null) : HIDDEN[piece];
    if (!hidden) return piece;
    return (
      <Tooltip key={i}>
        <TooltipTrigger asChild>
          <span className="text-current/60">
            {hidden.glyph ? (
              <span aria-hidden="true">{hidden.glyph}</span>
            ) : (
              // Zero-width: a hairline box where the character sits.
              <span
                aria-hidden="true"
                className="mx-px inline-block h-[1em] w-[0.3em] rounded-[1px] border border-dashed border-current align-[-0.15em]"
              />
            )}
            <span className="sr-only">[{hidden.name}]</span>
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={4}>
          {hidden.name}
        </TooltipContent>
      </Tooltip>
    );
  });
}
