// Specialtecken: find a character the keyboard doesn't have and copy it.
// Made for the quick job: type a few letters, press Enter, paste elsewhere.
//
// Layout: the search field and category chips on top, the characters as a
// grid of tiles, and a details panel beside it (a bar along the bottom on
// narrow screens) with the character large, its name, code point and HTML
// entity, and the characters it's easily mistaken for. Telling – from — and
// − apart is half the reason to look a character up.
//
// A click on a tile copies it; hovering or focusing one only shows it in
// the panel. Enter in the search field copies the top match. The last
// copied characters are kept per tab in sessionStorage (UI state: they come
// from the catalogue, never from the user's material) and shown first, in
// a row that is always one row tall, so it updates live without moving the
// grid under the pointer.
import { memo, useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Check, Copy, Search, X } from "lucide-react";
import { cn } from "cn";
import { AppShell } from "@/app/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFlash } from "@/hooks/use-flash";
import { readSession, writeSession } from "@/lib/storage";
import { CATEGORIES, CHARS, describe, lookalikes, type Char } from "./data";
import { search } from "./search";

const RECENT_MAX = 12;
const ALL = "all";

/** "LATIN SMALL LETTER E WITH ACUTE" -> "Latin small letter e with acute". */
function sentence(name: string): string {
  const lower = name.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/** The HTML to paste into a CMS: the named entity, else a numeric one. */
function html(char: Char): string {
  return char.entity ? `&${char.entity};` : `&#x${char.code.slice(2)};`;
}

// ---------------------------------------------------------------------------
// State

function useRecent() {
  const [recent, setRecent] = useState<Char[]>(() => {
    try {
      const saved = JSON.parse(readSession("chars:recent") ?? "[]") as unknown;
      if (!Array.isArray(saved)) return [];
      return saved.flatMap((ch) => CHARS.filter((c) => c.ch === ch).slice(0, 1));
    } catch {
      return [];
    }
  });
  const push = useCallback((char: Char) => {
    setRecent((prev) => {
      // One already in the row stays put, so the tile under the pointer
      // doesn't swap.
      if (prev.some((c) => c.ch === char.ch)) return prev;
      const next = [char, ...prev].slice(0, RECENT_MAX);
      writeSession("chars:recent", JSON.stringify(next.map((c) => c.ch)));
      return next;
    });
  }, []);
  return [recent, push] as const;
}

/** How many columns the tile grids in `ref` have; they all share one. */
function useColumns(ref: React.RefObject<HTMLElement | null>) {
  const [cols, setCols] = useState(RECENT_MAX);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const grid = el.querySelector<HTMLElement>("[data-tile-grid]");
      if (grid) setCols(getComputedStyle(grid).gridTemplateColumns.split(" ").length);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    measure();
    return () => observer.disconnect();
  }, [ref]);
  return cols;
}

interface Section {
  id: string;
  title: string;
  chars: Char[];
}

function sectionsFor(query: string, cat: string, recent: Char[]): Section[] {
  if (query.trim()) {
    const hits = search(query).filter((c) => cat === ALL || c.cat === cat);
    return [{ id: "hits", title: hits.length === 1 ? "1 träff" : `${hits.length} träffar`, chars: hits }];
  }
  const cats = cat === ALL ? CATEGORIES : CATEGORIES.filter((c) => c.id === cat);
  const out = cats.map((c) => ({ id: c.id, title: c.name, chars: CHARS.filter((ch) => ch.cat === c.id) }));
  if (cat === ALL) out.unshift({ id: "recent", title: "Senast kopierade", chars: recent });
  return out;
}

// ---------------------------------------------------------------------------
// Pieces

/** How a character shows: itself, or a labelled box when it's invisible. */
function Glyph({ char, className, markClassName }: { char: Char; className?: string; markClassName?: string }) {
  if (char.mark) {
    return (
      <span
        aria-hidden="true"
        className={cn(
          "rounded-[3px] border border-dashed border-current px-1 py-0.5 text-[0.625rem] leading-none font-semibold tracking-wide opacity-70",
          markClassName,
        )}
      >
        {char.mark}
      </span>
    );
  }
  return (
    <span aria-hidden="true" className={cn("leading-none", className)}>
      {char.ch}
    </span>
  );
}

interface TileProps {
  char: Char;
  index: number;
  tabbable: boolean;
  selected: boolean;
  copied: boolean;
  onPick: (char: Char) => void;
  onFocusTile: (index: number) => void;
  onHover: (char: Char | null) => void;
  onKey: (e: KeyboardEvent<HTMLButtonElement>, index: number) => void;
  tileRef: (index: number, el: HTMLButtonElement | null) => void;
}

const Tile = memo(function Tile({ char, index, tabbable, selected, copied, onPick, onFocusTile, onHover, onKey, tileRef }: TileProps) {
  return (
    <button
      type="button"
      ref={(el) => tileRef(index, el)}
      tabIndex={tabbable ? 0 : -1}
      aria-label={char.name}
      aria-pressed={selected}
      onClick={() => onPick(char)}
      onFocus={() => onFocusTile(index)}
      onPointerEnter={() => onHover(char)}
      onKeyDown={(e) => onKey(e, index)}
      className={cn(
        "relative flex aspect-square items-center justify-center rounded-lg border bg-card text-[1.625rem] text-foreground shadow-xs outline-none transition-[background-color,border-color,color] duration-150 select-none",
        "hover:border-foreground/20 hover:bg-muted focus-visible:z-10 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-px dark:bg-input/30 dark:hover:bg-input/60",
        selected && "border-primary/60 bg-accent text-accent-foreground hover:border-primary/60 hover:bg-accent dark:bg-accent dark:hover:bg-accent",
        copied && "border-primary bg-primary text-primary-foreground hover:bg-primary dark:bg-primary dark:hover:bg-primary",
      )}
    >
      <Glyph char={char} />
      {copied && (
        <Check aria-hidden="true" className="absolute top-1 right-1 size-3 stroke-3" />
      )}
    </button>
  );
});

function CopyButton({ label, done, onCopy, variant, className }: { label: string; done: boolean; onCopy: () => void; variant: "default" | "outline"; className?: string }) {
  return (
    <Button variant={variant} onClick={onCopy} className={cn("h-9", className)}>
      {done ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}
      {done ? "Kopierat!" : label}
    </Button>
  );
}

interface DetailsProps {
  char: Char;
  copiedChar: boolean;
  copiedHtml: boolean;
  onCopy: (char: Char) => void;
  onCopyHtml: (char: Char) => void;
  onSelect: (char: Char) => void;
  glyphRef: React.RefObject<HTMLSpanElement | null>;
}

/** The panel beside the grid: the character large and everything about it. */
function Details({ char, copiedChar, copiedHtml, onCopy, onCopyHtml, onSelect, glyphRef }: DetailsProps) {
  const like = lookalikes(char.ch).map(describe);
  const cat = CATEGORIES.find((c) => c.id === char.cat)?.name;
  return (
    <section aria-label="Valt tecken" className="overflow-hidden rounded-xl border bg-card shadow-xs dark:bg-input/30">
      <div className="relative flex h-44 items-center justify-center border-b bg-muted/40 dark:bg-transparent">
        <span ref={glyphRef} className="relative text-[5.5rem] leading-none select-all">
          {char.mark ? (
            <>
              <Glyph char={char} markClassName="text-base px-2 py-1" />
              <span className="sr-only">{char.ch}</span>
            </>
          ) : (
            <>
              <span className="relative z-10">{char.ch}</span>
              {/* A zero-size inline box sits on the baseline; the dashed line
                  hangs from it, so dashes and dots show where they sit. */}
              <span aria-hidden="true" className="relative inline-block size-0">
                <span className="absolute top-0 -left-[50vw] w-screen border-t border-dashed border-foreground/15" />
              </span>
            </>
          )}
        </span>
      </div>
      <div className="grid gap-4 p-4">
        <div>
          <h2 className="text-lg leading-tight font-semibold tracking-tight text-balance">{char.name}</h2>
          {char.en && (
            <p lang="en" title={char.en} className="mt-0.5 text-sm text-balance text-muted-foreground">
              {sentence(char.en)}
            </p>
          )}
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
          {cat && (
            <>
              <dt className="text-muted-foreground">Kategori</dt>
              <dd>{cat}</dd>
            </>
          )}
          <dt className="text-muted-foreground">Kodpunkt</dt>
          <dd className="font-mono tabular-nums">{char.code}</dd>
          <dt className="text-muted-foreground">HTML</dt>
          <dd className="font-mono break-all">{html(char)}</dd>
        </dl>
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <CopyButton variant="default" label="Kopiera tecken" done={copiedChar} onCopy={() => onCopy(char)} />
          <CopyButton variant="outline" label="HTML" done={copiedHtml} onCopy={() => onCopyHtml(char)} />
        </div>
        {like.length > 0 && (
          <div className="border-t pt-3.5">
            <h3 className="mb-2 text-sm text-muted-foreground">Förväxlas lätt med</h3>
            <ul className="flex flex-wrap gap-1.5">
              {like.map((c) => (
                <li key={c.ch}>
                  <button
                    type="button"
                    onClick={() => onSelect(c)}
                    aria-label={`${c.name}, ${c.code}`}
                    title={`${c.name} · ${c.code}`}
                    className="flex h-10 min-w-10 items-center justify-center rounded-md border bg-background px-1.5 text-xl outline-none transition-colors hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 dark:hover:bg-input/60"
                  >
                    <Glyph char={c} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

/** Narrow screens: the selection as a bar pinned to the bottom. */
function DetailsBar({ char, copied, onCopy }: { char: Char; copied: boolean; onCopy: (char: Char) => void }) {
  return (
    <section
      aria-label="Valt tecken"
      className="sticky bottom-0 z-20 -mx-4 mt-4 flex items-center gap-3 border-t bg-background/95 px-4 py-2.5 backdrop-blur-sm md:-mx-6 md:px-6 lg:hidden"
    >
      <span className="flex size-12 shrink-0 items-center justify-center rounded-lg border bg-card text-3xl dark:bg-input/30">
        <Glyph char={char} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{char.name}</p>
        <p className="truncate font-mono text-xs text-muted-foreground tabular-nums">
          {char.code} · {html(char)}
        </p>
      </div>
      <CopyButton variant="default" label="Kopiera" done={copied} onCopy={() => onCopy(char)} />
    </section>
  );
}

// ---------------------------------------------------------------------------

export function CharsApp() {
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState(ALL);
  const [recent, pushRecent] = useRecent();
  const [chosen, setChosen] = useState<Char>(CHARS[0]);
  const [hovered, setHovered] = useState<Char | null>(null);
  const [active, setActive] = useState(0);
  const [copiedCh, setCopiedCh] = useState<string | null>(null);
  const [copiedKind, setCopiedKind] = useState<"char" | "html">("char");
  const [copied, flashCopied, clearCopied] = useFlash(1400);
  const [status, setStatus] = useState("");

  const input = useRef<HTMLInputElement>(null);
  const glyph = useRef<HTMLSpanElement>(null);
  const tiles = useRef<(HTMLButtonElement | null)[]>([]);

  const results = useRef<HTMLDivElement>(null);
  const cols = useColumns(results);
  const sections = useMemo(() => sectionsFor(query, cat, recent.slice(0, cols)), [query, cat, recent, cols]);
  const flat = useMemo(() => sections.flatMap((s) => s.chars), [sections]);
  const searching = query.trim() !== "";

  // A new search or category shows its top match and starts the grid there.
  useEffect(() => {
    setActive(0);
    if (searching && flat[0]) setChosen(flat[0]);
    // Only on a new list, not on every copy.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, cat]);

  const shown = hovered ?? chosen;

  const copy = useCallback(
    async (char: Char, kind: "char" | "html" = "char") => {
      setChosen(char);
      try {
        await navigator.clipboard.writeText(kind === "html" ? html(char) : char.ch);
      } catch {
        // Select the character in the panel so it can be copied by hand.
        clearCopied();
        const sel = window.getSelection();
        if (glyph.current && sel) sel.selectAllChildren(glyph.current);
        setStatus("Kunde inte kopiera. Tecknet är markerat, tryck Ctrl+C.");
        return;
      }
      setCopiedCh(char.ch);
      setCopiedKind(kind);
      flashCopied();
      if (CHARS.includes(char)) pushRecent(char);
      setStatus(`Kopierat: ${char.name}${kind === "html" ? " som HTML" : ""}`);
    },
    [clearCopied, flashCopied, pushRecent],
  );

  const pick = useCallback((char: Char) => void copy(char), [copy]);
  const focusTile = useCallback(
    (i: number) => {
      setActive(i);
      setChosen(flat[i]);
    },
    [flat],
  );
  const tileRef = useCallback((i: number, el: HTMLButtonElement | null) => {
    tiles.current[i] = el;
  }, []);

  /** The tile in `dir` from tile `i`, by position on screen. */
  function neighbour(i: number, dir: "up" | "down"): number {
    const from = tiles.current[i]?.getBoundingClientRect();
    if (!from) return i;
    const x = from.left + from.width / 2;
    let best = i;
    let bestRow = Infinity;
    let bestDx = Infinity;
    tiles.current.forEach((el, j) => {
      if (!el || j >= flat.length) return;
      const r = el.getBoundingClientRect();
      const dy = dir === "down" ? r.top - from.top : from.top - r.top;
      if (dy < from.height / 2) return;
      const dx = Math.abs(r.left + r.width / 2 - x);
      if (dy < bestRow - 1 || (Math.abs(dy - bestRow) <= 1 && dx < bestDx)) {
        best = j;
        bestRow = dy;
        bestDx = dx;
      }
    });
    return best;
  }

  const onTileKey = useCallback(
    (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
      const last = flat.length - 1;
      let next: number | null = null;
      if (e.key === "ArrowRight") next = Math.min(i + 1, last);
      else if (e.key === "ArrowLeft") next = Math.max(i - 1, 0);
      else if (e.key === "ArrowDown") next = neighbour(i, "down");
      else if (e.key === "ArrowUp") {
        next = neighbour(i, "up");
        if (next === i) {
          e.preventDefault();
          input.current?.focus();
          return;
        }
      } else if (e.key === "Home") next = 0;
      else if (e.key === "End") next = last;
      else if (e.key === "Escape" || e.key === "Backspace" || (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && e.key !== " ")) {
        // Typing from the grid goes back to the search.
        e.preventDefault();
        if (e.key === "Backspace") setQuery((q) => q.slice(0, -1));
        else if (e.key !== "Escape") setQuery((q) => q + e.key);
        input.current?.focus();
        return;
      }
      if (next === null) return;
      e.preventDefault();
      tiles.current[next]?.focus();
      tiles.current[next]?.scrollIntoView({ block: "nearest" });
    },
    // neighbour reads refs and flat only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [flat],
  );

  function onSearchKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && searching && flat[0]) {
      e.preventDefault();
      void copy(chosen);
    } else if (e.key === "ArrowDown" && flat.length) {
      e.preventDefault();
      tiles.current[active]?.focus();
    } else if (e.key === "Escape" && query) {
      e.preventDefault();
      setQuery("");
    }
  }

  const copiedChar = copied && copiedKind === "char" && copiedCh === shown.ch;
  const copiedHtml = copied && copiedKind === "html" && copiedCh === shown.ch;
  let index = 0;

  return (
    <AppShell tool="chars">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start">
        <div className="min-w-0">
          <div className="grid gap-3">
            <div className="relative">
              <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3.5 size-[1.125rem] -translate-y-1/2 text-muted-foreground" />
              <label htmlFor="char-search" className="sr-only">
                Sök tecken
              </label>
              <Input
                id="char-search"
                ref={input}
                type="search"
                autoFocus
                autoComplete="off"
                spellCheck={false}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onSearchKey}
                placeholder="Sök tecken..."
                className="h-11 rounded-xl bg-card pr-10 pl-10 text-base shadow-xs md:text-base [&::-webkit-search-cancel-button]:hidden"
              />
              {query && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Töm sökningen"
                  onClick={() => {
                    setQuery("");
                    input.current?.focus();
                  }}
                  className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground"
                >
                  <X />
                </Button>
              )}
            </div>
            <div
              role="group"
              aria-label="Kategori"
              className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:flex-wrap md:px-0"
            >
              {[{ id: ALL, name: "Alla" }, ...CATEGORIES].map((c) => (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={cat === c.id}
                  onClick={() => setCat(c.id)}
                  className={cn(
                    "h-7 shrink-0 rounded-full border px-3 text-sm whitespace-nowrap text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                    cat === c.id && "border-primary/40 bg-accent font-medium text-accent-foreground hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  {"short" in c && c.short ? c.short : c.name}
                </button>
              ))}
            </div>
          </div>

          <div ref={results} className="mt-5 grid gap-6" onPointerLeave={() => setHovered(null)}>
            {flat.length === 0 && (
              <div className="rounded-xl border border-dashed px-6 py-12 text-center">
                <p className="font-medium">Inga tecken matchar ”{query.trim()}”.</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Sök på svenska eller engelska, på HTML-entitet (mdash) eller på kodpunkt (U+2192).
                </p>
              </div>
            )}
            {sections.map((s) =>
              s.chars.length === 0 && s.id !== "recent" ? null : (
                <section key={s.id} aria-labelledby={`sec-${s.id}`}>
                  <h2 id={`sec-${s.id}`} className="mb-2 flex items-baseline gap-2 text-sm font-medium">
                    {s.title}
                    {s.id === "recent" && <span className="font-normal text-muted-foreground">i den här fliken</span>}
                  </h2>
                  <div data-tile-grid className="grid grid-cols-[repeat(auto-fill,minmax(3.25rem,1fr))] gap-1.5">
                    {s.chars.length === 0 && (
                      // Holds the row's height until the first copy.
                      <>
                        <div aria-hidden="true" className="aspect-square rounded-lg border border-dashed" />
                        <p className="col-[2/-1] self-center pl-1.5 text-sm text-muted-foreground">
                          Tecken du kopierar hamnar här.
                        </p>
                      </>
                    )}
                    {s.chars.map((char) => {
                      const i = index++;
                      return (
                        <Tile
                          key={`${s.id}-${char.code}-${char.name}`}
                          char={char}
                          index={i}
                          tabbable={i === active}
                          selected={char === chosen}
                          copied={copied && copiedCh === char.ch}
                          onPick={pick}
                          onFocusTile={focusTile}
                          onHover={setHovered}
                          onKey={onTileKey}
                          tileRef={tileRef}
                        />
                      );
                    })}
                  </div>
                </section>
              ),
            )}
          </div>
          <DetailsBar char={shown} copied={copied && copiedCh === shown.ch} onCopy={(c) => void copy(c)} />
        </div>

        <aside className="sticky top-6 hidden lg:block">
          <Details
            char={shown}
            copiedChar={copiedChar}
            copiedHtml={copiedHtml}
            onCopy={(c) => void copy(c)}
            onCopyHtml={(c) => void copy(c, "html")}
            onSelect={setChosen}
            glyphRef={glyph}
          />
          <p className="mt-3 px-1 text-xs leading-relaxed text-muted-foreground">
            Klick kopierar. <kbd className="font-sans font-medium text-foreground/80">Enter</kbd> i sökfältet kopierar första träffen, pilarna flyttar i rutnätet.
          </p>
        </aside>
      </div>
      <p role="status" className="sr-only">
        {status}
      </p>
    </AppShell>
  );
}
