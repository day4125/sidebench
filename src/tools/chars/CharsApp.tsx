// Specialtecken: find a character the keyboard doesn't have and copy it.
// Made for the quick job: type a few letters, press Enter, paste elsewhere.
//
// Layout, top down: a sticky head holding the details band (the chosen
// character large, its names and codes, the copy button and the characters
// it's easily mistaken for; telling – from — and − apart is half the reason
// to look one up) and under it the search with the categories in a menu;
// then the grid at full width. Narrow screens show the chosen character in
// a bar along the bottom instead of the band.
//
// A click or arrow key on a tile only chooses it. Copying is the copy
// button, Enter on a tile, or Enter in the search (copies the top match).
import { memo, useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronDown, Copy, ListFilter, Search, X } from "lucide-react";
import { cn } from "cn";
import { AppShell } from "@/app/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useFlash } from "@/hooks/use-flash";
import { CATEGORIES, CHARS, describe, lookalikes, type Char } from "./data";
import { queryCode, search } from "./search";

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

/** A category's name as a menu or button shows it. */
function catLabel(c: { name: string; short?: string }): string {
  return c.short ?? c.name;
}

// ---------------------------------------------------------------------------
// State

/** Whether the sticky head has left its place: a sentinel above it is gone. */
function useStuck() {
  const ref = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([e]) => setStuck(!e.isIntersecting));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, stuck] as const;
}

interface Section {
  id: string;
  title: string;
  chars: Char[];
}

function sectionsFor(query: string, cat: string): Section[] {
  if (query.trim()) {
    const hits = search(query).filter((c) => cat === ALL || c.cat === cat);
    return [{ id: "hits", title: hits.length === 1 ? "1 träff" : `${hits.length} träffar`, chars: hits }];
  }
  const cats = cat === ALL ? CATEGORIES : CATEGORIES.filter((c) => c.id === cat);
  return cats.map((c) => ({ id: c.id, title: c.name, chars: CHARS.filter((ch) => ch.cat === c.id) }));
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

/** The character large, with a dashed baseline so dashes and dots show where they sit. */
function BigGlyph({ char, glyphRef, className }: { char: Char; glyphRef?: React.RefObject<HTMLSpanElement | null>; className?: string }) {
  return (
    <span ref={glyphRef} className={cn("relative leading-none select-all", className)}>
      {char.mark ? (
        <>
          <Glyph char={char} markClassName="text-sm px-1.5 py-1" />
          <span className="sr-only">{char.ch}</span>
        </>
      ) : (
        <>
          <span className="relative z-10">{char.ch}</span>
          {/* A zero-size inline box sits on the baseline; the dashed line
              hangs from it. */}
          <span aria-hidden="true" className="relative inline-block size-0">
            <span className="absolute top-0 -left-[50vw] w-screen border-t border-dashed border-foreground/15" />
          </span>
        </>
      )}
    </span>
  );
}

interface TileProps {
  char: Char;
  index: number;
  tabbable: boolean;
  selected: boolean;
  onChoose: (index: number) => void;
  onCopy: (char: Char) => void;
  onKey: (e: KeyboardEvent<HTMLButtonElement>, index: number) => void;
  tileRef: (index: number, el: HTMLButtonElement | null) => void;
}

const Tile = memo(function Tile({ char, index, tabbable, selected, onChoose, onCopy, onKey, tileRef }: TileProps) {
  return (
    <button
      type="button"
      ref={(el) => tileRef(index, el)}
      tabIndex={tabbable ? 0 : -1}
      aria-label={char.name}
      aria-pressed={selected}
      onClick={() => onChoose(index)}
      onFocus={() => onChoose(index)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          onCopy(char);
        } else onKey(e, index);
      }}
      className={cn(
        "relative flex aspect-square scroll-mt-64 scroll-mb-40 items-center justify-center rounded-lg border bg-card text-[1.625rem] text-foreground shadow-xs outline-none transition-[background-color,border-color,color] duration-150 select-none",
        "hover:border-foreground/20 hover:bg-muted focus-visible:z-10 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 dark:hover:bg-input/60",
        selected && "border-primary/60 bg-accent text-accent-foreground hover:border-primary/60 hover:bg-accent dark:bg-accent dark:hover:bg-accent",
      )}
    >
      <Glyph char={char} />
    </button>
  );
});

function CopyButton({ label, done, onCopy, className }: { label: string; done: boolean; onCopy: () => void; className?: string }) {
  return (
    <Button onClick={onCopy} className={cn("h-9", className)}>
      {done ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}
      {done ? "Kopierat!" : label}
    </Button>
  );
}

/** The characters this one is easily mistaken for; a click chooses one. */
function Lookalikes({ char, onSelect }: { char: Char; onSelect: (char: Char) => void }) {
  const like = lookalikes(char.ch).map(describe);
  if (like.length === 0) return null;
  return (
    <div className="flex items-center gap-3">
      <h3 className="text-xs text-muted-foreground">Förväxlas lätt med</h3>
      <ul className="flex flex-wrap gap-1">
        {like.map((c) => (
          <li key={c.ch}>
            <button
              type="button"
              onClick={() => onSelect(c)}
              aria-label={`${c.name}, ${c.code}`}
              title={`${c.name} · ${c.code}`}
              className="flex h-9 min-w-9 shrink-0 items-center justify-center rounded-md border bg-background px-1 text-lg outline-none transition-colors hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 dark:hover:bg-input/60"
            >
              <Glyph char={c} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The categories behind a button, as wide as their names. */
function CategoryMenu({ cat, onChange }: { cat: string; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const current = CATEGORIES.find((c) => c.id === cat);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          aria-label={`Kategori: ${current?.name ?? "Alla"}`}
          className={cn(
            "h-11 gap-2 rounded-xl px-3.5 shadow-xs",
            current && "border-primary/40 bg-accent text-accent-foreground hover:bg-accent hover:text-accent-foreground dark:bg-accent dark:hover:bg-accent",
          )}
        >
          <ListFilter data-icon="inline-start" />
          {current ? catLabel(current) : "Alla"}
          <ChevronDown data-icon="inline-end" className="opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-max gap-0 p-1">
        <div role="group" aria-label="Kategori" className="grid">
          {[{ id: ALL, name: "Alla" }, ...CATEGORIES].map((c) => (
            <Button
              key={c.id}
              variant="ghost"
              aria-pressed={cat === c.id}
              title={"short" in c && c.short ? c.name : undefined}
              onClick={() => {
                onChange(c.id);
                setOpen(false);
              }}
              className="h-8 justify-start gap-2 pr-4 pl-2 font-normal"
            >
              <Check className={cn("size-4 text-primary", cat !== c.id && "invisible")} />
              {catLabel(c)}
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface DetailsProps {
  char: Char;
  copied: boolean;
  onCopy: (char: Char) => void;
  onSelect: (char: Char) => void;
  glyphRef?: React.RefObject<HTMLSpanElement | null>;
}

/**
 * The chosen character as a band across the top: the glyph, then two rows.
 * Above, what it's called and the copy button; below, its codes and its
 * lookalikes.
 */
function DetailsBand({ char, copied, onCopy, onSelect, glyphRef }: DetailsProps) {
  const cat = CATEGORIES.find((c) => c.id === char.cat);
  return (
    <section
      aria-label="Valt tecken"
      className="hidden grid-cols-[9rem_minmax(0,1fr)] overflow-hidden rounded-xl border bg-card shadow-xs lg:grid dark:bg-input/30"
    >
      <div className="relative flex min-h-36 items-center justify-center overflow-hidden border-r bg-muted/40 dark:bg-transparent">
        <BigGlyph char={char} glyphRef={glyphRef} className="text-[4.5rem]" />
      </div>
      <div className="grid grid-rows-[1fr_auto]">
        <div className="flex items-start justify-between gap-6 px-5 pt-4 pb-3">
          <div className="min-w-0">
            <h2 className="text-xl leading-tight font-semibold tracking-tight text-balance">{char.name}</h2>
            {char.en && (
              <p lang="en" title={char.en} className="mt-1 truncate text-sm text-muted-foreground">
                {sentence(char.en)}
              </p>
            )}
          </div>
          <CopyButton label="Kopiera tecken" done={copied} onCopy={() => onCopy(char)} className="h-10 min-w-44 shrink-0" />
        </div>
        <div className="flex min-h-14 flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t px-5 py-2.5">
          <dl className="flex gap-6 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Kodpunkt</dt>
              <dd className="font-mono tabular-nums">{char.code}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">HTML</dt>
              <dd className="font-mono select-all">{html(char)}</dd>
            </div>
            {cat && (
              <div>
                <dt className="text-xs text-muted-foreground">Kategori</dt>
                <dd>{catLabel(cat)}</dd>
              </div>
            )}
          </dl>
          <Lookalikes char={char} onSelect={onSelect} />
        </div>
      </div>
    </section>
  );
}

/** Narrow screens: the chosen character as a bar along the bottom. */
function DetailsBar({ char, copied, onCopy }: DetailsProps) {
  return (
    <section
      aria-label="Valt tecken"
      className="sticky bottom-0 z-20 -mx-4 mt-4 flex items-center gap-3 border-t bg-background px-4 py-2.5 md:-mx-6 md:px-6 lg:hidden"
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
      <CopyButton label="Kopiera" done={copied} onCopy={() => onCopy(char)} />
    </section>
  );
}

// ---------------------------------------------------------------------------

export function CharsApp() {
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState(ALL);
  const [chosen, setChosen] = useState<Char>(CHARS[0]);
  const [active, setActive] = useState(0);
  const [copied, flashCopied, clearCopied] = useFlash(1400);
  const [status, setStatus] = useState("");
  const [sentinel, stuck] = useStuck();

  const input = useRef<HTMLInputElement>(null);
  const glyph = useRef<HTMLSpanElement>(null);
  const tiles = useRef<(HTMLButtonElement | null)[]>([]);

  const sections = useMemo(() => sectionsFor(query, cat), [query, cat]);
  const flat = useMemo(() => sections.flatMap((s) => s.chars), [sections]);
  const searching = query.trim() !== "";
  const code = queryCode(query);

  // A new search or category shows its top match and starts the grid there.
  useEffect(() => {
    setActive(0);
    if (searching && flat[0]) setChosen(flat[0]);
    // Only on a new list, not on every copy.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, cat]);

  // Choosing another character takes the "Kopierat!" off the button.
  useEffect(() => clearCopied(), [chosen]); // eslint-disable-line react-hooks/exhaustive-deps

  const copy = useCallback(
    async (char: Char) => {
      setChosen(char);
      try {
        await navigator.clipboard.writeText(char.ch);
      } catch {
        // Select the character in the band so it can be copied by hand.
        clearCopied();
        const sel = window.getSelection();
        if (glyph.current && sel) sel.selectAllChildren(glyph.current);
        setStatus("Kunde inte kopiera. Tecknet är markerat, tryck Ctrl+C.");
        return;
      }
      flashCopied();
      setStatus(`Kopierat: ${char.name}`);
    },
    [clearCopied, flashCopied],
  );

  const copyTile = useCallback((char: Char) => void copy(char), [copy]);
  const choose = useCallback(
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

  const details: DetailsProps = {
    char: chosen,
    copied,
    onCopy: (c) => void copy(c),
    onSelect: setChosen,
    glyphRef: glyph,
  };
  let index = 0;

  return (
    <AppShell tool="chars">
      <div ref={sentinel} aria-hidden="true" className="h-px" />
      {/* The head: solid, the page's full width, sticky. A rule and a
          shadow under it once the grid scrolls beneath. */}
      <div
        className={cn(
          "sticky top-0 z-30 -mx-4 -mt-4 border-b border-transparent bg-background px-4 pt-4 pb-3 transition-[border-color,box-shadow] duration-200 md:-mx-6 md:-mt-6 md:px-6 md:pt-6",
          stuck && "border-border shadow-[0_8px_16px_-12px_rgb(0_0_0/0.25)] md:pt-4",
        )}
      >
        <div className="mx-auto grid max-w-6xl gap-3">
          <DetailsBand {...details} />
          <div className="flex items-center gap-2">
            <div className="relative min-w-0 flex-1">
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
                className={cn("h-11 rounded-xl bg-card pl-10 text-base shadow-xs md:text-base [&::-webkit-search-cancel-button]:hidden", code ? "pr-28" : "pr-10")}
              />
              {code && (
                <span
                  title="Kodpunkt"
                  className="absolute top-1/2 right-11 -translate-y-1/2 font-mono text-xs text-muted-foreground tabular-nums"
                >
                  {code}
                </span>
              )}
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
            <CategoryMenu cat={cat} onChange={setCat} />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl">
        <div className="mt-3 grid gap-6">
          {flat.length === 0 && (
            <div className="rounded-xl border border-dashed px-6 py-12 text-center">
              <p className="font-medium">Inga tecken matchar ”{query.trim()}”.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Sök på svenska eller engelska, på HTML-entitet (mdash) eller på kodpunkt (U+2192).
              </p>
            </div>
          )}
          {sections.map((s) =>
            s.chars.length === 0 ? null : (
              <section key={s.id} aria-labelledby={`sec-${s.id}`}>
                <h2 id={`sec-${s.id}`} className="mb-2 text-sm font-medium">
                  {s.title}
                </h2>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(3.5rem,1fr))] gap-1.5">
                  {s.chars.map((char) => {
                    const i = index++;
                    return (
                      <Tile
                        key={`${s.id}-${char.code}-${char.name}`}
                        char={char}
                        index={i}
                        tabbable={i === active}
                        selected={char === chosen}
                        onChoose={choose}
                        onCopy={copyTile}
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
        <DetailsBar {...details} />
      </div>
      <p role="status" className="sr-only">
        {status}
      </p>
    </AppShell>
  );
}
