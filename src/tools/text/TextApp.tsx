// Textmanipulator: one textarea and a set of one-shot operations, rebuilt
// from prodtools' static/text-app.js on the engine. The text lives in this
// component's state only (INTENT.md) and leaves only through copy.
//
// Layout: the text box carries a bar of paired icon buttons (super/subscript
// digits and letters, case, slug), a character count, a toggle that draws
// hidden characters in the text and a menu for the rarely used tools;
// "Rensa text", the one used most, runs full width below. One legend
// tooltip explains every button instead of a tooltip per button; only "…"
// has its own.
//
// The copy flow is legacy's: an operation rewrites the text and its button
// turns into "Kopiera" (one button at a time); clicking it copies the text
// and shows "Kopierad!" for a moment. Any edit to the text resets every
// button. If the clipboard fails, the text is selected instead.
//
// An operation works on the selection if there is one, else on the whole
// text. Either way it goes in through the browser's own editing
// (execCommand insertText), so Ctrl+Z undoes it like typing. Copy always
// takes the whole text.
import { Fragment, useLayoutEffect, useMemo, useRef, useState, type ComponentType, type RefObject } from "react";
import {
  Ampersand,
  AtSign,
  CaseLower,
  CaseSensitive,
  CaseUpper,
  Check,
  Code,
  CodeXml,
  Copy,
  Ellipsis,
  Info,
  Link,
  Link2,
  List,
  ListOrdered,
  ListX,
  Pilcrow,
  Space,
  WholeWord,
  WrapText,
} from "lucide-react";
import { cn } from "cn";
import { AppShell } from "@/app/AppShell";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useFlash } from "@/hooks/use-flash";
import { HIDDEN, tallyHidden } from "@/lib/hidden-chars";
import { readSetting, writeSetting } from "@/lib/storage";
import { apply, type Op } from "./engine";
import { SubDigits, SubLetters, SupDigits, SupLetters } from "./icons";

type Icon = ComponentType<{ className?: string }>;

interface OpDef {
  op: Op;
  /** Accessible name; the toolbar shows only the icon. */
  label: string;
  icon: Icon;
}

const CLEAN_INFO =
  "Tar bort mjuka bindestreck, onödiga radbrytningar, dubbla mellanrum samt byter raka citattecken till typografiska.";

// The toolbar, in pairs. `legend` and `note` feed the legend tooltip.
const GROUPS: { name: string; legend: string; note?: string; ops: [OpDef, OpDef] }[] = [
  {
    name: "Siffror",
    legend: "Upphöjda / nedsänkta siffror",
    ops: [
      { op: "supNum", label: "Upphöjda siffror", icon: SupDigits },
      { op: "subNum", label: "Nedsänkta siffror", icon: SubDigits },
    ],
  },
  {
    name: "Bokstäver",
    legend: "Upphöjda / nedsänkta bokstäver",
    note: "Alla bokstäver finns inte i unicode.",
    ops: [
      { op: "supAlpha", label: "Upphöjda bokstäver", icon: SupLetters },
      { op: "subAlpha", label: "Nedsänkta bokstäver", icon: SubLetters },
    ],
  },
  {
    name: "Skiftläge",
    legend: "VERSALER / gemener",
    ops: [
      { op: "upper", label: "VERSALER", icon: CaseUpper },
      { op: "lower", label: "gemener", icon: CaseLower },
    ],
  },
  {
    name: "Slug",
    legend: "Till / från URL-slug",
    note: "Per rad: Ny rapport blir ny-rapport, och tillbaka.",
    ops: [
      { op: "slug", label: "Till slug", icon: Link2 },
      { op: "deslug", label: "Från slug", icon: Space },
    ],
  },
];

const MORE: { name: string; ops: OpDef[] }[] = [
  {
    name: "Text",
    ops: [
      { op: "softClean", label: "Rensa text, behåll stycken", icon: WrapText },
      { op: "sentence", label: "Som i en mening", icon: CaseSensitive },
      { op: "nbspNumbers", label: "Hårt mellanslag i tal (10 000)", icon: WholeWord },
    ],
  },
  {
    name: "Rader",
    ops: [
      { op: "bullets", label: "Punktlista", icon: List },
      { op: "numbers", label: "Numrerad lista", icon: ListOrdered },
      { op: "dedupe", label: "Ta bort dubbletter", icon: ListX },
    ],
  },
  {
    name: "HTML",
    ops: [
      { op: "stripTags", label: "Ta bort HTML-taggar", icon: CodeXml },
      { op: "decodeEntities", label: "Avkoda entiteter (&amp;)", icon: Ampersand },
      { op: "stripSvg", label: "Ta bort <svg>-taggar", icon: Code },
    ],
  },
  {
    name: "Extrahera",
    ops: [
      { op: "extractEmail", label: "Extrahera e-postadresser", icon: AtSign },
      { op: "extractUrl", label: "Extrahera URL", icon: Link },
    ],
  },
];

// ---------------------------------------------------------------------------
// State: the text and the legacy copy flow.

export function useTextOps() {
  const [text, setText] = useState("");
  const [copyOp, setCopyOp] = useState<Op | null>(null);
  const [copied, flashCopied, clearCopied] = useFlash();
  // The selection, for the count; [0, 0] when there is none.
  const [sel, setSel] = useState<[number, number]>([0, 0]);
  const input = useRef<HTMLTextAreaElement>(null);
  // Set while an operation writes, so edit() doesn't reset the copy state.
  const applying = useRef(false);

  /** Rewrite the selection, or the whole text, as one undoable edit. */
  function replace(op: Op) {
    const el = input.current;
    if (!el) return setText(apply(op, text) ?? "");
    const whole = el.selectionStart === el.selectionEnd;
    const from = whole ? 0 : el.selectionStart;
    const to = whole ? el.value.length : el.selectionEnd;
    const before = el.value;
    const result = apply(op, before.slice(from, to)) ?? "";
    const back = document.activeElement as HTMLElement | null;
    const scroll = el.scrollTop;
    el.focus();
    el.setSelectionRange(from, to);
    applying.current = true;
    const done = document.execCommand("insertText", false, result);
    applying.current = false;
    if (!done) setText(before.slice(0, from) + result + before.slice(to));
    // Keep a selection on what changed; after a whole-text run, the caret
    // goes to the start and the view stays where it was.
    const end = whole ? 0 : from + result.length;
    el.setSelectionRange(from, end);
    setSel([from, end]);
    el.scrollTop = scroll;
    back?.focus();
  }

  async function run(op: Op) {
    if (op !== copyOp) {
      replace(op);
      setCopyOp(op);
      clearCopied();
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fall back to selecting the text so it can be copied by hand.
      input.current?.focus();
      input.current?.select();
      return;
    }
    flashCopied();
  }

  function edit(value: string) {
    setText(value);
    if (applying.current) return;
    setCopyOp(null);
    clearCopied();
  }

  // Drawing hidden characters is a UI setting, so it's remembered.
  const [marks, setMarks] = useState(() => readSetting("text:hidden") === "1");
  function toggleMarks() {
    setMarks(!marks);
    writeSetting("text:hidden", marks ? "0" : "1");
  }

  function select(el: HTMLTextAreaElement) {
    setSel([el.selectionStart, el.selectionEnd]);
  }

  return { text, edit, run, copyOp, copied, input, sel, select, marks, toggleMarks };
}

type Ops = ReturnType<typeof useTextOps>;

/** What a button shows: its own face, or the copy state. */
function face(ops: Ops, def: OpDef) {
  const copying = ops.copyOp === def.op;
  const Icon = copying ? (ops.copied ? Check : Copy) : def.icon;
  const label = copying ? (ops.copied ? "Kopierad!" : "Kopiera") : def.label;
  return { copying, Icon, label };
}

// ---------------------------------------------------------------------------
// Buttons

/** The lead action, full width. Explained in the toolbar's legend. */
export function CleanButton({ ops }: { ops: Ops }) {
  const { copying, Icon, label } = face(ops, { op: "clean", label: "Rensa text", icon: Check });
  return (
    <Button
      variant={copying ? "outline" : "default"}
      onClick={() => void ops.run("clean")}
      className={cn(
        "h-11 w-full text-[0.9375rem]",
        copying && "border-primary bg-background text-primary hover:bg-primary/5 hover:text-primary dark:bg-background",
      )}
    >
      {copying && <Icon data-icon="inline-start" />}
      {label}
    </Button>
  );
}

/** One square in a joined pair. Named by aria-label only. */
function Square({ ops, def }: { ops: Ops; def: OpDef }) {
  const { copying, Icon, label } = face(ops, def);
  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => void ops.run(def.op)}
      className={cn(
        "relative flex h-8 w-[1.875rem] items-center justify-center text-foreground/75 sm:w-9 outline-none transition-colors first:rounded-l-[calc(var(--radius-md)-1px)] last:rounded-r-[calc(var(--radius-md)-1px)] hover:bg-muted hover:text-foreground focus-visible:z-10 focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-px",
        copying && "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary",
      )}
    >
      <Icon className="size-[1.125rem]" />
    </button>
  );
}

/** The raised surface that makes a pair read as buttons. */
const pairCls = "flex divide-x rounded-md border bg-background shadow-xs dark:bg-secondary";

/** Quiet toolbar button: no surface until hovered. */
const quietCls =
  "size-7 text-muted-foreground sm:size-8 hover:bg-background hover:text-foreground aria-expanded:bg-background dark:hover:bg-secondary dark:aria-expanded:bg-secondary";

/** One tooltip for every button: "Rensa text", then each pair's icons and
 * what they do. "Fler verktyg" has its own. */
function Legend() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Om knapparna" className={cn(quietCls, "cursor-help")}>
          <Info className="size-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" align="end" sideOffset={8} className="block w-80 max-w-[calc(100vw-2rem)] p-3">
        <p className="mb-3 border-b pb-2.5">
          <span className="font-medium">Rensa text</span>
          <span className="block text-muted-foreground">{CLEAN_INFO}</span>
        </p>
        <ul className="grid gap-2.5">
          {GROUPS.map((g) => (
            <li key={g.name} className="grid grid-cols-[3.25rem_1fr] items-start gap-x-3">
              <span className="flex gap-1.5 pt-px">
                {g.ops.map(({ op, icon: Icon }) => (
                  <Icon key={op} className="size-[1.125rem]" />
                ))}
              </span>
              <span>
                <span className="font-medium">{g.legend}</span>
                {g.note && <span className="block text-muted-foreground">{g.note}</span>}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 border-t pt-2.5 text-muted-foreground">
          Ett klick ändrar texten. Ett till kopierar den.
        </p>
      </TooltipContent>
    </Tooltip>
  );
}

const count = (n: number) => n.toLocaleString("sv-SE");

/** Characters, words and lines of the selection, or of the whole text. */
function Count({ ops }: { ops: Ops }) {
  const [from, to] = ops.sel;
  const selected = to > from;
  const part = selected ? ops.text.slice(from, to) : ops.text;
  if (!ops.text) return null;
  const chars = [...part].length;
  const words = part.match(/\S+/g)?.length ?? 0;
  const lines = part.split("\n").length;
  return (
    <p className="mr-1.5 hidden self-center text-xs whitespace-nowrap text-muted-foreground tabular-nums sm:block">
      {selected && "Markerat: "}
      {count(chars)} tecken · {count(words)} ord
      <span className="hidden md:inline">
        {" "}
        · {count(lines)} {lines === 1 ? "rad" : "rader"}
      </span>
    </p>
  );
}

function MoreMenu({ ops }: { ops: Ops }) {
  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Fler verktyg" className={quietCls}>
              <Ellipsis className="size-4" />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={6}>
          Fler verktyg
        </TooltipContent>
      </Tooltip>
      {/* An operation focuses the text box to write through it; that
          mustn't close the menu, or its button couldn't turn into Kopiera. */}
      <PopoverContent
        align="end"
        side="top"
        className="grid max-h-(--radix-popover-content-available-height) w-72 gap-0 overflow-y-auto p-1 sm:w-[34rem] sm:grid-cols-2 sm:gap-x-1"
        onFocusOutside={(e) => e.preventDefault()}
      >
        {MORE.map((group) => (
          <div key={group.name} role="group" aria-label={group.name} className="pb-1">
            <p aria-hidden="true" className="px-2.5 pt-1 pb-0.5 text-xs text-muted-foreground">
              {group.name}
            </p>
            {group.ops.map((def) => {
              const { copying, Icon, label } = face(ops, def);
              return (
                <Button
                  key={def.op}
                  variant="ghost"
                  onClick={() => void ops.run(def.op)}
                  className={cn(
                    "h-8 w-full justify-start gap-2.5 px-2.5 font-normal",
                    copying ? "text-primary hover:text-primary" : "text-foreground",
                  )}
                >
                  <Icon className={cn("size-4", !copying && "text-muted-foreground")} />
                  {label}
                </Button>
              );
            })}
          </div>
        ))}
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// Hidden characters

/** Toolbar toggle. Its tooltip tallies what the text holds; a dot on the
 * button says there is something to see while it's off. */
function MarksToggle({ ops }: { ops: Ops }) {
  const tally = useMemo(() => tallyHidden(ops.text), [ops.text]);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Visa dolda tecken"
          aria-pressed={ops.marks}
          onClick={ops.toggleMarks}
          className={cn(
            quietCls,
            "relative",
            ops.marks && "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary dark:hover:bg-primary/15",
          )}
        >
          <Pilcrow className="size-4" />
          {!ops.marks && tally.length > 0 && (
            <span aria-hidden="true" className="absolute top-1 right-1 size-1.5 rounded-full bg-primary" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" align="end" sideOffset={6} className="block max-w-72">
        <span className="font-medium">{ops.marks ? "Dölj dolda tecken" : "Visa dolda tecken"}</span>
        {(tally.length ? tally : [ops.text ? "Inga i texten" : "Hårda mellanslag, mjuka bindestreck, tabbar"]).map((line) => (
          <span key={line} className="block text-muted-foreground">
            {line}
          </span>
        ))}
      </TooltipContent>
    </Tooltip>
  );
}

// The same text as the text box, laid out identically behind it (same
// padding, font, wrapping and scrollbar gutter) but invisible, with a mark
// drawn where each hidden character sits. Marks are absolutely positioned,
// so they never move the text; the text box stays the real editor on top,
// transparent. "¶" marks each line break.
const MARKED = /([\u00A0\u202F\t\u00AD\u200B-\u200D\u2060\uFEFF\n])/;

/** A hidden character, wrapped so its mark centers on it. The wrapper is
 * an inline span, so the layout stays the text box's. Zero-width
 * characters get their mark above the gap, where it can't cover a letter. */
function Marked({ ch }: { ch: string }) {
  const { glyph } = HIDDEN[ch];
  const center = "absolute left-1/2 -translate-x-1/2";
  let mark;
  if (ch === "\u00AD") {
    mark = <span className={cn(center, "-top-[0.55em] text-[0.75em] text-primary")}>{glyph}</span>;
  } else if (glyph) {
    mark = <span className={cn(center, "top-0 text-primary")}>{glyph}</span>;
  } else {
    mark = (
      <span className={cn(center, "top-[0.25em] h-[1em] w-[0.3em] rounded-[1px] border border-dashed border-primary")} />
    );
  }
  return (
    <span className="relative">
      {ch}
      {mark}
    </span>
  );
}

/** "¶" at the end of a line, from an empty anchor before the break. */
function LineEnd() {
  return (
    <span className="relative">
      <span className="absolute top-0 left-0.5 text-muted-foreground/50">¶</span>
    </span>
  );
}

function Marks({ text, input }: { text: string; input: RefObject<HTMLTextAreaElement | null> }) {
  const layer = useRef<HTMLDivElement>(null);
  // Follow the text box's scroll, also after an edit changes its height.
  useLayoutEffect(() => {
    if (layer.current && input.current) layer.current.scrollTop = input.current.scrollTop;
  });
  return (
    <div
      ref={layer}
      data-marks=""
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden p-4 text-base break-words whitespace-pre-wrap text-transparent select-none [scrollbar-gutter:stable]"
    >
      {text.split(MARKED).map((piece, i) =>
        piece === "\n" ? (
          <Fragment key={i}>
            <LineEnd />
            {piece}
          </Fragment>
        ) : HIDDEN[piece] ? (
          <Marked key={i} ch={piece} />
        ) : (
          piece
        ),
      )}
      {/* A trailing line break needs a line after it, as in the text box. */}
      {" "}
    </div>
  );
}

/** The text field with the toolbar of operations along its bottom edge. */
export function TextBox({ ops }: { ops: Ops }) {
  return (
    <div className="rounded-xl border bg-card shadow-xs focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30">
      <label htmlFor="text-input" className="sr-only">
        Text
      </label>
      <div className="relative">
        {ops.marks && <Marks text={ops.text} input={ops.input} />}
        <Textarea
          id="text-input"
          ref={ops.input}
          value={ops.text}
          onChange={(e) => ops.edit(e.target.value)}
          onSelect={(e) => ops.select(e.currentTarget)}
          onScroll={(e) => {
            const layer = e.currentTarget.parentElement?.querySelector<HTMLElement>("[data-marks]");
            if (layer) layer.scrollTop = e.currentTarget.scrollTop;
          }}
          spellCheck={false}
          placeholder="Klistra in text här..."
          className={cn(
            "relative field-sizing-fixed min-h-72 resize-none rounded-none rounded-t-xl border-0 bg-transparent p-4 shadow-none focus-visible:ring-0 md:text-base dark:bg-transparent",
            ops.marks && "[scrollbar-gutter:stable]",
          )}
        />
      </div>
      <div
        role="group"
        aria-label="Textverktyg"
        className="flex flex-wrap items-center gap-x-1.5 gap-y-2 rounded-b-xl border-t bg-muted/50 px-2 py-2 sm:gap-x-3 sm:px-2.5"
      >
        {GROUPS.map((g) => (
          <div key={g.name} role="group" aria-label={g.name} className={pairCls}>
            {g.ops.map((def) => (
              <Square key={def.op} ops={ops} def={def} />
            ))}
          </div>
        ))}
        <div className="ml-auto flex sm:gap-0.5">
          <Count ops={ops} />
          <MarksToggle ops={ops} />
          <Legend />
          <MoreMenu ops={ops} />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

export function TextApp() {
  const ops = useTextOps();
  return (
    <AppShell tool="text">
      <div className="mx-auto flex max-w-3xl flex-col gap-3">
        <TextBox ops={ops} />
        <CleanButton ops={ops} />
      </div>
      <p role="status" className="sr-only">
        {ops.copied ? "Texten är kopierad till urklipp" : ""}
      </p>
    </AppShell>
  );
}
