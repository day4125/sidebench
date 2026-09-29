// The review: one pair of pages at a time, [A page | gutter | B page],
// paged together. It fills the tool's page under the tool header, and
// fullscreen (F) lays the same view over the whole window, sidebar and
// header included. Only the two pages shown are loaded: their sizes
// are read when the pair comes up, and each page frees its canvas and its
// PDF.js resources when it goes (PageCell).
//
// A zoomed pair larger than the window scrolls inside it; a new pair starts
// at its top. Zoom keeps the point under the cursor (or the pair's top
// edge, for the buttons and keys) in place.
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type DragEvent, type ReactNode, type Ref } from "react";
import { flushSync } from "react-dom";
import { ArrowLeft, ChevronDown, ChevronLeft, ChevronRight, Copy, Check, Maximize2, Minimize2, Minus, Plus, Star } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useFlash } from "@/hooks/use-flash";
import {
  buildRows,
  clampOffset,
  clampScale,
  fitScale,
  formatPageList,
  pairLayout,
  percent,
  rowIndexForA,
  stepScale,
  type FitMode,
  type PairLayout,
  type Size,
} from "./layout";
import { firstFile, hasFiles, type PdfFile, type Side, type Toast } from "./files";
import { PageCell } from "./PageCell";

type Mode = FitMode | "custom";

const LAYOUT = { pad: 12, gutter: 52 };
const RERENDER_DELAY = 150; // ms after the last zoom step before re-rendering
const TOAST_TIME = 3200;
const ARROW_SCROLL = 40; // px per Up/Down press, like a browser's arrow scroll
const KB_TARGET = 300;
const FALLBACK_SIZE: Size = [595, 842]; // A4, for a page whose size can't be read
const MODES: FitMode[] = ["width", "page", "actual"];
const MODE_LABEL: Record<FitMode, string> = { width: "Bredd", page: "Sida", actual: "100 %" };

/** The pair on screen, with its page sizes once they're read. */
interface Pair {
  a: PdfFile;
  b: PdfFile;
  row: number;
  pageA: number | null;
  pageB: number | null;
  sizeA: Size | null;
  sizeB: Size | null;
}

async function pageSize(file: PdfFile, page: number | null): Promise<Size | null> {
  if (page === null) return null;
  try {
    const vp = (await file.doc.getPage(page)).getViewport({ scale: 1 });
    return [vp.width, vp.height];
  } catch {
    return FALLBACK_SIZE; // the page itself then shows as failed
  }
}

interface Props {
  a: PdfFile;
  b: PdfFile;
  offset: number;
  onOffsetChange: (offset: number) => void;
  stars: ReadonlySet<number>;
  onStarsChange: (stars: ReadonlySet<number>) => void;
  onDropFile: (side: Side, file: File | null) => void;
  onClose: () => void;
  toast: Toast | null;
  onToast: (text: string) => void;
}

export function Workspace({ a, b, offset, onOffsetChange, stars, onStarsChange, onDropFile, onClose, toast, onToast }: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const pairEl = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<{ width: number; height: number } | null>(null);
  const [mode, setMode] = useState<Mode>("width");
  const [customScale, setCustomScale] = useState(1);
  const [starsOpen, setStarsOpen] = useState(false);
  const [veil, setVeil] = useState<Side | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  const numA = a.doc.numPages;
  const numB = b.doc.numPages;
  const effOffset = clampOffset(offset, numA, numB);
  const rowSet = useMemo(() => buildRows(numA, numB, effOffset), [numA, numB, effOffset]);
  // The position is kept as an A page number (rows with no A page too:
  // 0 or less, or past the end), so a new offset or file stays on it.
  const [at, setAt] = useState(1);
  const row = rowIndexForA(rowSet, at);
  const current = rowSet.rows[row];
  const goToRow = (i: number) => setAt(rowSet.start + Math.max(0, Math.min(rowSet.rows.length - 1, i)));

  // Read the new pair's page sizes, then show it. Until then the previous
  // pair stays up, so paging never flashes an empty view.
  const [pair, setPair] = useState<Pair | null>(null);
  useEffect(() => {
    const [pageA, pageB] = [current.a, current.b];
    if (pair && pair.a === a && pair.b === b && pair.row === row && pair.pageA === pageA && pair.pageB === pageB) return;
    let cancelled = false;
    void Promise.all([pageSize(a, pageA), pageSize(b, pageB)]).then(([sizeA, sizeB]) => {
      if (!cancelled) setPair({ a, b, row, pageA, pageB, sizeA, sizeB });
    });
    return () => {
      cancelled = true;
    };
  }, [a, b, row, current.a, current.b]);

  // A fit mode's scale follows the window and the pair shown; a custom zoom stays.
  const maxW = Math.max(pair?.sizeA?.[0] ?? 0, pair?.sizeB?.[0] ?? 0);
  const maxH = Math.max(pair?.sizeA?.[1] ?? 0, pair?.sizeB?.[1] ?? 0);
  const scale = mode === "custom" || !view || !pair ? customScale : fitScale(mode, maxW, maxH, view, LAYOUT);
  const lay = useMemo(() => (pair ? pairLayout(pair.sizeA, pair.sizeB, scale, LAYOUT) : null), [pair, scale]);

  // Pages re-render once a zoom settles; until then they're stretched. A new
  // pair renders at the current scale straight away.
  const [renderScale, setRenderScale] = useState<number | null>(null);
  const [renderedPair, setRenderedPair] = useState<Pair | null>(null);
  if (pair !== renderedPair && view) {
    setRenderedPair(pair);
    setRenderScale(scale);
  }
  useEffect(() => {
    if (renderScale === null || renderScale === scale) return;
    const timer = window.setTimeout(() => setRenderScale(scale), RERENDER_DELAY);
    return () => window.clearTimeout(timer);
  }, [scale, renderScale]);

  // Latest values for event handlers that outlive a render.
  const latest = useRef({ scale, row, rowSet, current });
  latest.current = { scale, row, rowSet, current };

  // Measure the scroller before anything is laid out, and on every resize.
  useLayoutEffect(() => {
    const el = scroller.current!;
    const measure = () => {
      setView((v) =>
        v && v.width === el.clientWidth && v.height === el.clientHeight ? v : { width: el.clientWidth, height: el.clientHeight },
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    el.focus({ preventScroll: true });
    return () => observer.disconnect();
  }, []);

  // A new pair starts at its top.
  useLayoutEffect(() => {
    if (scroller.current) scroller.current.scrollTop = 0;
  }, [pair]);

  // The pair's box relative to the scroller's viewport.
  function pairBox() {
    const el = pairEl.current;
    if (!el || !scroller.current) return null;
    const r = el.getBoundingClientRect();
    const s = scroller.current.getBoundingClientRect();
    return { left: r.left - s.left, top: r.top - s.top, width: r.width, height: r.height };
  }

  // ---- zoom ----
  // Zoom to `next`, keeping the point at (cx, cy) in the viewport in place.
  // Runs synchronously so the next wheel event starts from the new layout.
  function zoomTo(next: number, cx: number, cy: number) {
    const el = scroller.current;
    const before = pairBox();
    flushSync(() => {
      setCustomScale(next);
      setMode("custom");
    });
    const after = pairBox();
    if (!el || !before || !after) return;
    el.scrollLeft += after.left - (cx - ((cx - before.left) / before.width) * after.width);
    el.scrollTop += after.top - (cy - ((cy - before.top) / before.height) * after.height);
  }

  // The pair's top edge (or the view's, once scrolled past it), horizontally centered.
  function anchorTop(): [number, number] {
    const el = scroller.current!;
    return [el.clientWidth / 2, Math.max(0, pairBox()?.top ?? 0)];
  }

  function zoomBy(dir: number) {
    zoomTo(stepScale(latest.current.scale, dir), ...anchorTop());
  }

  function fit(m: FitMode) {
    flushSync(() => setMode(m));
    const el = scroller.current;
    if (!el) return;
    el.scrollTop = 0;
    el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
  }

  function cycleMode() {
    fit(MODES[(MODES.indexOf(mode as FitMode) + 1) % MODES.length]);
  }

  // Ctrl+wheel zooms the viewer; a plain wheel scrolls a zoomed pair.
  const onWheel = useRef<(e: WheelEvent) => void>(() => {});
  onWheel.current = (e) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    const rect = scroller.current!.getBoundingClientRect();
    zoomTo(clampScale(latest.current.scale * Math.exp(-e.deltaY * 0.0025)), e.clientX - rect.left, e.clientY - rect.top);
  };
  useEffect(() => {
    const el = scroller.current!;
    const handler = (e: WheelEvent) => onWheel.current(e);
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);

  // ---- stars ----
  const starList = formatPageList(stars);
  function toggleStar(page: number | null) {
    if (!page) return;
    const next = new Set(stars);
    if (next.has(page)) next.delete(page);
    else next.add(page);
    onStarsChange(next);
  }

  // ---- keys ----
  // Left/Right and Page Up/Down turn the page; Up/Down scroll a pair
  // that's larger than the view.
  const onKey = useRef<(e: KeyboardEvent) => void>(() => {});
  onKey.current = (e) => {
    if (e.defaultPrevented) return; // e.g. Escape that closed a menu or tooltip
    const target = e.target as HTMLElement | null;
    if (target && ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName)) {
      if (e.key === "Escape") target.blur();
      return; // don't hijack typing in the page, offset or copy fields
    }
    if (e.ctrlKey || e.metaKey) {
      // Ctrl +/-/0 zoom the viewer instead of the browser.
      if (e.key === "+" || e.key === "=") zoomBy(1);
      else if (e.key === "-") zoomBy(-1);
      else if (e.key === "0") fit("width");
      else return;
      e.preventDefault();
      return;
    }
    if (e.altKey) return;
    const { row, rowSet, current } = latest.current;
    switch (e.key) {
      case "Escape":
        if (fullscreen) setFullscreen(false);
        else onClose();
        break;
      case "f":
      case "F":
        setFullscreen(!fullscreen);
        break;
      case "ArrowLeft":
      case "PageUp":
        goToRow(row - 1);
        break;
      case "ArrowRight":
      case "PageDown":
        goToRow(row + 1);
        break;
      case "ArrowUp":
      case "ArrowDown":
        // Scroll the pair wherever the focus is (e.g. on the body after
        // the page field commits).
        if (scroller.current?.contains(target)) return; // native scroll
        scroller.current?.scrollBy(0, (e.key === "ArrowUp" ? -1 : 1) * ARROW_SCROLL);
        break;
      case "Home":
        goToRow(0);
        break;
      case "End":
        goToRow(rowSet.rows.length - 1);
        break;
      case "s":
      case "S":
        toggleStar(current.a);
        break;
      case "+":
      case "=":
        zoomBy(1);
        break;
      case "-":
        zoomBy(-1);
        break;
      case "0":
        fit("width");
        break;
      default:
        return;
    }
    e.preventDefault();
  };
  useEffect(() => {
    const handler = (e: KeyboardEvent) => onKey.current(e);
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // ---- drop onto the left or right half to replace that side ----
  function sideAt(clientX: number): Side {
    const r = (pairEl.current ?? scroller.current!).getBoundingClientRect();
    return clientX < r.left + r.width / 2 ? "a" : "b";
  }
  const dragOver = (e: DragEvent) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setVeil(sideAt(e.clientX));
  };
  const dragLeave = (e: DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setVeil(null);
  };
  const drop = (e: DragEvent) => {
    e.preventDefault();
    setVeil(null);
    onDropFile(sideAt(e.clientX), firstFile(e));
  };

  return (
    <TooltipProvider>
      <section
        aria-label="Granska sida vid sida"
        data-fullscreen={fullscreen}
        className={cn("flex flex-col bg-background", fullscreen ? "fixed inset-0 z-40" : "relative min-h-0 min-w-0 flex-1")}
        onDragOver={dragOver}
        onDragLeave={dragLeave}
        onDrop={drop}
      >
        <div className="flex flex-wrap items-center gap-x-2 gap-y-2 border-b px-3 py-2 text-sm">
          <Button variant="ghost" onClick={onClose}>
            <ArrowLeft data-icon="inline-start" />
            Tillbaka
          </Button>
          <Sep />
          <div role="group" aria-label="Sidnavigering" className="flex items-center gap-1">
            <Button variant="outline" size="icon" aria-label="Föregående sida" disabled={row <= 0} onClick={() => goToRow(row - 1)}>
              <ChevronLeft />
            </Button>
            <PageInput value={current.a ? String(current.a) : "–"} onCommit={(n) => setAt(rowSet.start + rowIndexForA(rowSet, n))} />
            <span className="px-1 text-muted-foreground tabular-nums">av {numA}</span>
            <Button
              variant="outline"
              size="icon"
              aria-label="Nästa sida"
              disabled={row >= rowSet.rows.length - 1}
              onClick={() => goToRow(row + 1)}
            >
              <ChevronRight />
            </Button>
          </div>
          <Sep />
          <div role="group" aria-label="Zoom" className="flex items-center gap-1">
            <Button variant="outline" size="icon" aria-label="Zooma ut" onClick={() => zoomBy(-1)}>
              <Minus />
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" className="min-w-16 tabular-nums" onClick={cycleMode} aria-label={`Zoom: ${mode === "custom" ? `${percent(scale)} %` : MODE_LABEL[mode]}`}>
                  {mode === "custom" ? `${percent(scale)} %` : MODE_LABEL[mode]}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Växla: anpassa bredd, anpassa sida, 100 %</TooltipContent>
            </Tooltip>
            <Button variant="outline" size="icon" aria-label="Zooma in" onClick={() => zoomBy(1)}>
              <Plus />
            </Button>
          </div>
          <Sep />
          <OffsetInput value={effOffset} onCommit={(v) => onOffsetChange(clampOffset(v, numA, numB))} />
          <Sep />
          <StarsMenu
            page={current.a}
            onToggle={() => toggleStar(current.a)}
            stars={stars}
            text={starList}
            open={starsOpen}
            onOpenChange={setStarsOpen}
            onJump={(page) => setAt(page)}
            onClear={() => onStarsChange(new Set())}
            onToast={onToast}
          />
          <span className="flex-1" />
          <KbPerPage file={b} />
          <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
            <span className="max-w-48 truncate" title={`Original: ${a.name}`} data-testid="name-a">
              {a.name}
            </span>
            <span aria-hidden="true">↔</span>
            <span className="max-w-48 truncate" title={`Komprimerad: ${b.name}`} data-testid="name-b">
              {b.name}
            </span>
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label={fullscreen ? "Avsluta helskärm" : "Helskärm"}
                aria-pressed={fullscreen}
                onClick={() => setFullscreen(!fullscreen)}
              >
                {fullscreen ? <Minimize2 /> : <Maximize2 />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{fullscreen ? "Avsluta helskärm (F eller Esc)" : "Helskärm (F)"}</TooltipContent>
          </Tooltip>
        </div>

        <div
          ref={scroller}
          tabIndex={0}
          aria-label="Sidor"
          data-testid="scroller"
          className="flex flex-1 overflow-auto bg-muted outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
        >
          {pair && lay && renderScale !== null && (
            <PagePair
              ref={pairEl}
              pair={pair}
              layout={lay}
              renderScale={renderScale}
            />
          )}
        </div>

        {veil && (
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-50 grid grid-cols-2 gap-3 p-3">
            {(["a", "b"] as const).map((side) => (
              <div
                key={side}
                data-testid={`veil-${side}`}
                data-over={veil === side}
                className={cn(
                  "flex items-center justify-center rounded-xl border-2 border-dashed text-base font-medium",
                  veil === side ? "border-primary bg-primary/15 text-foreground" : "border-transparent bg-background/40 text-transparent",
                )}
              >
                Släpp för att byta {side === "a" ? "original" : "komprimerad"}
              </div>
            ))}
          </div>
        )}
        <ToastView toast={toast} />
      </section>
    </TooltipProvider>
  );
}

function Sep() {
  return <span aria-hidden="true" className="mx-1 hidden h-5 w-px bg-border sm:block" />;
}

interface PairProps {
  ref: Ref<HTMLDivElement>;
  pair: Pair;
  layout: PairLayout;
  renderScale: number;
}

// Centered by its auto margins while it fits the view; once it's larger,
// it starts at the top left and the scroller scrolls it.
function PagePair({ ref, pair, layout, renderScale }: PairProps) {
  const { pageA: a, pageB: b } = pair;
  const slot = `${layout.slotW}px`;
  const numTitle = !a ? `Bara i den komprimerade (sida ${b})` : !b ? `Bara i originalet (sida ${a})` : undefined;
  return (
    <div
      ref={ref}
      data-testid="pdf-row"
      data-row={pair.row}
      className="m-auto grid shrink-0 items-start"
      style={{ padding: LAYOUT.pad, gridTemplateColumns: `${slot} ${LAYOUT.gutter}px ${slot}` }}
    >
      <div className="flex justify-end">
        <PageCell side="a" file={pair.a} page={a} box={layout.a} renderScale={renderScale} />
      </div>
      <div className="flex justify-center pt-1">
        <span
          title={numTitle}
          data-testid="page-number"
          className="text-center text-xs leading-tight font-semibold whitespace-pre text-primary tabular-nums"
        >
          {a && b && a !== b ? `${a}\n↕\n${b}` : String(a ?? b)}
        </span>
      </div>
      <div className="flex justify-start">
        <PageCell side="b" file={pair.b} page={b} box={layout.b} renderScale={renderScale} />
      </div>
    </div>
  );
}

/** A number field that shows `value` until edited, then commits on Enter or blur. */
export function PageInput({ value, onCommit }: { value: string; onCommit: (n: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    const n = parseInt(draft ?? "", 10);
    setDraft(null);
    if (!isNaN(n)) onCommit(n);
  };
  return (
    <Input
      inputMode="numeric"
      aria-label="Sidnummer i originalet"
      className="h-8 w-14 text-center tabular-nums"
      value={draft ?? value}
      onFocus={(e) => {
        setDraft(value);
        e.currentTarget.select();
      }}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
      onBlur={commit}
    />
  );
}

/**
 * B's page offset. Commits on the input's native change event: Enter, blur
 * after an edit, or a spinner/arrow step.
 */
export function OffsetInput({ value, onCommit }: { value: number; onCommit: (v: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const commit = useRef(onCommit);
  commit.current = onCommit;
  useEffect(() => {
    const el = ref.current!;
    const handler = () => {
      commit.current(el.value);
      setDraft(null);
    };
    el.addEventListener("change", handler);
    return () => el.removeEventListener("change", handler);
  }, []);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <label className="flex items-center gap-1.5 whitespace-nowrap">
          <span aria-hidden="true">B ±</span>
          <Input
            ref={ref}
            type="number"
            step={1}
            aria-label="Sidförskjutning för den komprimerade filen"
            className="h-8 w-16 tabular-nums"
            value={draft ?? String(value)}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
          />
        </label>
      </TooltipTrigger>
      <TooltipContent>Förskjut den komprimerade filen, t.ex. +1 om den har ett extra omslag först</TooltipContent>
    </Tooltip>
  );
}

interface StarsProps {
  /** The A page shown, which the star button flags; null on a row with no A page. */
  page: number | null;
  onToggle: () => void;
  stars: ReadonlySet<number>;
  text: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onJump: (page: number) => void;
  onClear: () => void;
  onToast: (text: string) => void;
}

/**
 * The one place for flags: a split button whose star flags the page shown
 * and whose count opens the list, with jump, copy and clear.
 */
export function StarsMenu({ page, onToggle, stars, text, open, onOpenChange, onJump, onClear, onToast }: StarsProps) {
  const [copied, flashCopied] = useFlash();
  const field = useRef<HTMLInputElement>(null);
  const count = stars.size;
  const starred = page !== null && stars.has(page);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Leave the list selected for a manual copy.
      field.current?.focus();
      field.current?.select();
      onToast("Kunde inte kopiera automatiskt – tryck Ctrl+C.");
      return;
    }
    flashCopied();
  }

  return (
    <div role="group" aria-label="Flaggor" className="flex items-center">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            aria-pressed={starred}
            aria-label={page === null ? "Flagga sida" : `Flagga sida ${page}`}
            disabled={page === null}
            onClick={onToggle}
            className="rounded-r-none"
          >
            <Star className={cn(starred && "fill-amber-500 text-amber-500")} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{starred ? "Ta bort flaggan (S)" : "Flagga sidan (S)"}</TooltipContent>
      </Tooltip>
      <Popover open={open} onOpenChange={onOpenChange}>
        <PopoverTrigger asChild>
          <Button variant="outline" aria-label={`Flaggade sidor: ${count}`} className="-ml-px gap-1 rounded-l-none px-2 tabular-nums">
            {count}
            <ChevronDown data-icon="inline-end" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" aria-label="Flaggade sidor">
          {count === 0 ? (
            <p className="text-muted-foreground">Inga flaggade sidor. Tryck S eller stjärnan.</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-1" role="group" aria-label="Gå till sida">
                {text.split(", ").map((p) => (
                  <Button key={p} variant="secondary" size="xs" className="tabular-nums" onClick={() => onJump(Number(p))}>
                    {p}
                  </Button>
                ))}
              </div>
              <div className="flex gap-1">
                <Input ref={field} readOnly value={text} aria-label="Flaggade sidor som text" className="h-8" />
                <Button variant="outline" onClick={() => void copy()}>
                  {copied ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}
                  {copied ? "Kopierad!" : "Kopiera"}
                </Button>
              </div>
              <Button variant="link" size="sm" className="self-start px-0" onClick={onClear}>
                Rensa alla
              </Button>
            </>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

/** Size per page of the compressed file, against a fixed target. */
export function KbPerPage({ file }: { file: PdfFile }) {
  if (!file.size) return null;
  const n = file.doc.numPages;
  const kb = file.size / 1024 / n;
  const over = kb > KB_TARGET;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          data-testid="kbpp"
          data-over={over}
          className={cn(
            "rounded-md px-1.5 py-0.5 font-medium tabular-nums outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
            over ? "bg-destructive/10 text-destructive" : "text-primary",
          )}
        >
          {kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB/sida
        </span>
      </TooltipTrigger>
      <TooltipContent>
        Komprimerad fil: {(file.size / 1048576).toFixed(1)} MB · {n} sidor · mål {KB_TARGET} KB/sida
      </TooltipContent>
    </Tooltip>
  );
}

function ToastView({ toast }: { toast: Toast | null }) {
  const [shown, setShown] = useState<Toast | null>(null);
  useEffect(() => {
    if (!toast) return;
    setShown(toast);
    const timer = window.setTimeout(() => setShown(null), TOAST_TIME);
    return () => window.clearTimeout(timer);
  }, [toast]);
  return (
    <p role="status" aria-live="polite" className="pointer-events-none absolute inset-x-0 bottom-6 z-50 flex justify-center">
      {shown && <Pill>{shown.text}</Pill>}
    </p>
  );
}

export function Pill({ children }: { children: ReactNode }) {
  return <span className="rounded-full bg-foreground px-4 py-2 text-sm text-background shadow-lg">{children}</span>;
}
