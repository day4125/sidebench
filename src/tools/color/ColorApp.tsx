// Färgväljare: paste a color and copy it in any format; check a
// text color against a background and fix the pair.
//
// Layout: two wells, Text and Bakgrund, each with its paste field, the OS
// color picker, the EyeDropper where the browser has one, and the color in
// every format to copy. The ratio sits between them. Under them a ruler
// from 1:1 to 21:1 (log scale) with the 3, 4.5 and 7 lines; the pair is a
// marker on it, and the nearest colors that pass AA and AAA are chips past
// the lines: text fixes above the ruler, background fixes below. Hovering
// a chip previews it (the marker slides there), clicking applies it. Then a
// preview of the pair with color-vision simulation.
//
// Colors live in React state only.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowLeftRight, Check, Copy, Palette, Pipette, X } from "lucide-react";
import { cn } from "cn";
import { AppShell } from "@/app/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useFlash } from "@/hooks/use-flash";
import {
  LEVELS,
  contrast,
  formatRatio,
  formats,
  parseColor,
  same,
  simulate,
  suggestions,
  toHex,
  type Rgb,
  type Side,
  type Suggestion,
  type Vision,
} from "./engine";

const START_TEXT = parseColor("#ffffff")!;
// The site's own primary button: white on the cobalt accent.
const START_BG = parseColor("#1a6fe1")!;

const SIDE_NAME: Record<Side, string> = { text: "Text", bg: "Bakgrund" };

/** CSS color for a style prop. */
const css = (c: Rgb) => (c.a < 1 ? `rgb(${c.r} ${c.g} ${c.b} / ${c.a})` : toHex(c));

/** Where a ratio sits on the ruler, 0–100 (log scale, 1 to 21). */
const pos = (ratio: number) => (Math.log(Math.min(21, Math.max(1, ratio))) / Math.log(21)) * 100;

interface EyeDropperCtor {
  new (): { open(): Promise<{ sRGBHex: string }> };
}
const eyeDropper = (globalThis as { EyeDropper?: EyeDropperCtor }).EyeDropper;

// ---------------------------------------------------------------------------
// Copying

function useCopy() {
  const [done, flash] = useFlash(1300);
  const [key, setKey] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const copy = useCallback(
    async (id: string, value: string) => {
      try {
        await navigator.clipboard.writeText(value);
      } catch {
        setStatus("Kunde inte kopiera. Markera värdet och tryck Ctrl+C.");
        return;
      }
      setKey(id);
      flash();
      setStatus(`Kopierat: ${value}`);
    },
    [flash],
  );
  return { copied: done ? key : null, copy, status };
}

type CopyFn = (id: string, value: string) => void;

// ---------------------------------------------------------------------------
// A well: one color, its inputs and formats

interface WellProps {
  side: Side;
  color: Rgb;
  shown: Rgb;
  onColor: (c: Rgb) => void;
  copied: string | null;
  onCopy: CopyFn;
  autoFocus?: boolean;
}

function Well({ side, color, shown, onColor, copied, onCopy, autoFocus }: WellProps) {
  const [draft, setDraft] = useState(toHex(color));
  const [invalid, setInvalid] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const id = `well-${side}`;

  // A color set from elsewhere (picker, chip, swap) replaces the draft,
  // unless the draft already means that color.
  useEffect(() => {
    setDraft((d) => {
      const parsed = parseColor(d);
      return parsed && same(parsed, color) ? d : toHex(color);
    });
    setInvalid(false);
  }, [color]);

  function onDraft(value: string) {
    setDraft(value);
    const parsed = parseColor(value);
    setInvalid(value.trim() !== "" && !parsed);
    if (parsed) onColor(parsed);
  }

  async function sample() {
    if (!eyeDropper) return;
    try {
      const { sRGBHex } = await new eyeDropper().open();
      const parsed = parseColor(sRGBHex);
      if (parsed) onColor(parsed);
    } catch {
      // Cancelled with Esc.
    }
  }

  return (
    <section aria-labelledby={`${id}-label`} className="min-w-0">
      <div className="mb-2 flex h-8 items-center justify-between gap-2">
        <h2 id={`${id}-label`} className="font-semibold tracking-tight">
          {side === "text" ? "Textfärg" : "Bakgrund"}
        </h2>
        <div className="flex gap-1">
          <IconTip label="Öppna systemets färgväljare">
            <Button variant="ghost" size="icon-sm" onClick={() => picker.current?.click()}>
              <Palette />
            </Button>
          </IconTip>
          {eyeDropper && (
            <IconTip label="Pipett: hämta en färg från skärmen">
              <Button variant="ghost" size="icon-sm" onClick={sample}>
                <Pipette />
              </Button>
            </IconTip>
          )}
        </div>
      </div>
      <div className="relative overflow-hidden rounded-xl border bg-card shadow-xs dark:bg-input/30">
        {/* The swatch opens the OS picker too; the native input sits under it. */}
        <button
          type="button"
          onClick={() => picker.current?.click()}
          aria-label={`${SIDE_NAME[side]}: ${toHex(color)}. Öppna systemets färgväljare`}
          className="checker relative block h-20 w-full border-b outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
        >
          <span className="absolute inset-0 shadow-[inset_0_0_0_1px] shadow-foreground/10 transition-colors duration-200" style={{ backgroundColor: css(shown) }} />
        </button>
        <input
          ref={picker}
          type="color"
          tabIndex={-1}
          aria-hidden="true"
          value={toHex({ ...color, a: 1 })}
          onChange={(e) => {
            const parsed = parseColor(e.target.value);
            if (parsed) onColor({ ...parsed, a: color.a });
          }}
          className="pointer-events-none absolute size-0 opacity-0"
        />
        <div className="p-3">
          <label htmlFor={`${id}-input`} className="sr-only">
            {SIDE_NAME[side]}, klistra in eller skriv en färg
          </label>
          <div className="relative">
          <Input
            ref={field}
            id={`${id}-input`}
            value={draft}
            autoFocus={autoFocus}
            spellCheck={false}
            autoComplete="off"
            placeholder="#1a6fe1, rgb(…), hsl(…), oklch(…)"
            aria-invalid={invalid || undefined}
            aria-describedby={invalid ? `${id}-error` : undefined}
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => onDraft(e.target.value)}
            onBlur={() => {
              if (invalid || !draft.trim()) {
                setDraft(toHex(color));
                setInvalid(false);
              }
            }}
            className={cn("h-9 font-mono", invalid && "pr-28")}
          />
          {/* Inside the field, so the error takes no row of its own. */}
          {invalid && (
            <p id={`${id}-error`} className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-destructive">
              Okänd färg<span className="sr-only">, behåller {toHex(color)}</span>
            </p>
          )}
          </div>
          <dl className="mt-2 grid">
            {formats(color).map((f) => {
              const key = `${side}:${f.id}`;
              const done = copied === key;
              return (
                <div key={f.id} className="contents">
                  <dt className="sr-only">{f.label}</dt>
                  <dd>
                    <button
                      type="button"
                      onClick={() => onCopy(key, f.value)}
                      aria-label={`Kopiera ${f.label}: ${f.value}`}
                      className="group/fmt flex h-8 w-full items-center gap-3 rounded-md px-2 text-left text-sm outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      <span aria-hidden="true" className="w-12 shrink-0 text-xs font-medium tracking-wide text-muted-foreground">
                        {f.label}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-mono tabular-nums">{f.value}</span>
                      <span
                        className={cn(
                          "flex shrink-0 items-center gap-1 text-xs text-muted-foreground opacity-0 transition-opacity group-hover/fmt:opacity-100 group-focus-visible/fmt:opacity-100",
                          done && "text-primary opacity-100",
                        )}
                      >
                        {done ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                        {done ? "Kopierat" : "Kopiera"}
                      </span>
                    </button>
                  </dd>
                </div>
              );
            })}
          </dl>
        </div>
      </div>
    </section>
  );
}

function IconTip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild aria-label={label}>
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

// ---------------------------------------------------------------------------
// The ratio and what it passes

function Verdict({ ratio, onSwap }: { ratio: number; onSwap: () => void }) {
  const rows: [string, number, number | null][] = [
    ["Brödtext", 4.5, 7],
    ["Stor text", 3, 4.5],
    ["Grafik, UI", 3, null],
  ];
  const headline =
    ratio >= 7 ? "Klarar AAA" : ratio >= 4.5 ? "Klarar AA" : ratio >= 3 ? "Bara stor text och UI" : "Underkänd";
  const pass = ratio >= 4.5;
  return (
    <section aria-label="Kontrast" className="flex flex-col items-center pt-10 text-center">
      <p className="text-6xl leading-none font-semibold tracking-tight tabular-nums" aria-live="polite">
        {formatRatio(ratio)}
        <span className="text-3xl text-muted-foreground">:1</span>
      </p>
      <p className={cn("mt-2 text-sm font-medium", pass ? "text-primary" : ratio >= 3 ? "text-foreground" : "text-destructive")}>
        {headline}
      </p>
      <table className="mt-5 text-sm">
        <thead>
          <tr className="text-xs text-muted-foreground">
            <th className="sr-only">Typ</th>
            <th className="w-12 pb-1 font-medium">AA</th>
            <th className="w-12 pb-1 font-medium">AAA</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([name, aa, aaa]) => (
            <tr key={name}>
              <th scope="row" className="pr-3 text-left font-normal text-muted-foreground">
                {name}
              </th>
              <td>
                <Mark ok={ratio >= aa} need={aa} />
              </td>
              <td>{aaa === null ? <span className="text-muted-foreground/60" aria-label="Inget AAA-krav">–</span> : <Mark ok={ratio >= aaa} need={aaa} />}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Button variant="outline" size="sm" onClick={onSwap} className="mt-5">
        <ArrowLeftRight data-icon="inline-start" />
        Byt plats
      </Button>
    </section>
  );
}

function Mark({ ok, need }: { ok: boolean; need: number }) {
  const label = `${ok ? "Klarar" : "Klarar inte"} ${formatRatio(need)}:1`;
  return (
    <span className="flex h-7 items-center justify-center" title={label}>
      {ok ? (
        <Check aria-label={label} className="size-4 stroke-3 text-primary" />
      ) : (
        <X aria-label={label} className="size-4 stroke-3 text-destructive" />
      )}
    </span>
  );
}

// ---------------------------------------------------------------------------
// The ruler

/** The pair as a small sample: "Aa" in the text color on the background. */
function Pair({ text, bg, className }: { text: Rgb; bg: Rgb; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("checker relative flex items-center justify-center overflow-hidden rounded-md font-semibold ring-1 ring-foreground/15", className)}
    >
      <span className="absolute inset-0" style={{ backgroundColor: css(bg) }} />
      <span className="relative" style={{ color: css(text) }}>
        Aa
      </span>
    </span>
  );
}

interface RulerProps {
  /** The pair as set; the chips show their fix against it. */
  text: Rgb;
  bg: Rgb;
  /** The pair as shown, which a hovered chip may be previewing. */
  shownText: Rgb;
  shownBg: Rgb;
  ratio: number;
  fixes: Suggestion[];
  onPreview: (s: Suggestion | null) => void;
  onApply: (s: Suggestion) => void;
}

const TICKS = [1, 2, 3, 4.5, 7, 10, 15, 21];

function Ruler({ text, bg, shownText, shownBg, ratio, fixes, onPreview, onApply }: RulerProps) {
  const row = (side: Side) => fixes.filter((f) => f.side === side);
  const empty = ratio >= 7 ? "Klarar AAA, inget att justera." : "Ingen färg i den här riktningen når nivån.";
  const chips = (side: Side) => (
    <div className={cn("relative h-14", side === "text" ? "mb-2" : "mt-1")}>
      <span className="absolute top-1/2 left-0 -translate-y-1/2 text-xs text-muted-foreground">
        Justera {side === "text" ? "texten" : "bakgrunden"}
      </span>
      {row(side).length === 0 && (
        <span className="absolute top-1/2 left-[50%] -translate-y-1/2 text-xs text-muted-foreground/80">{empty}</span>
      )}
      {row(side).map((s) => (
        <button
          key={s.level}
          type="button"
          aria-label={`${side === "text" ? "Byt textfärg" : "Byt bakgrund"} till ${toHex(s.color)}: ${formatRatio(s.ratio)}:1, klarar ${s.level.toUpperCase()}`}
          onPointerEnter={() => onPreview(s)}
          onPointerLeave={() => onPreview(null)}
          onFocus={() => onPreview(s)}
          onBlur={() => onPreview(null)}
          onClick={() => {
            onPreview(null);
            onApply(s);
          }}
          style={{ left: `${pos(s.ratio)}%` }}
          className={cn(
            "group/chip absolute flex -translate-x-1/2 flex-col items-center gap-1 rounded-lg p-1 outline-none transition-[background-color,transform] duration-150 hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-95",
            side === "text" ? "bottom-0 flex-col" : "top-0 flex-col-reverse",
          )}
        >
          <span className="text-[0.6875rem] leading-none font-semibold tracking-wide text-muted-foreground group-hover/chip:text-foreground">
            {s.level.toUpperCase()}
          </span>
          <Pair text={side === "text" ? s.color : text} bg={side === "bg" ? s.color : bg} className="h-8 w-11 text-sm" />
        </button>
      ))}
    </div>
  );

  return (
    <section aria-label="Kontrastlinjal" className="mt-8 rounded-xl border bg-card px-4 py-3 shadow-xs sm:px-6 dark:bg-input/30">
      {chips("text")}
      <div className="relative">
        {/* Zones: under 3 fails everything; then large text, AA, AAA. */}
        <div className="relative flex h-2.5 overflow-hidden rounded-full bg-muted">
          <span className="h-full bg-destructive/25" style={{ width: `${pos(3)}%` }} />
          <span className="h-full bg-primary/20" style={{ width: `${pos(4.5) - pos(3)}%` }} />
          <span className="h-full bg-primary/45" style={{ width: `${pos(7) - pos(4.5)}%` }} />
          <span className="h-full flex-1 bg-primary/75" />
        </div>
        {LEVELS.map((l) => (
          <span key={l.id} aria-hidden="true" className="absolute -top-2 -bottom-2 w-px bg-foreground/40" style={{ left: `${pos(l.ratio)}%` }} />
        ))}
        {/* The pair itself rides the ruler. It is 36px tall on a 10px bar, so it
            reaches up over the bottom of the text chips; without
            pointer-events-none it would slide under the pointer while a chip
            previews, end the hover, slide back and start it again. */}
        <span
          className="pointer-events-none absolute top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 transition-[left] duration-300 ease-out motion-reduce:transition-none"
          style={{ left: `${pos(ratio)}%` }}
        >
          <Pair text={shownText} bg={shownBg} className="h-9 w-12 text-base shadow-md ring-2 ring-background" />
        </span>
      </div>
      <div aria-hidden="true" className="relative mt-3 h-8 text-xs tabular-nums">
        {TICKS.map((t) => {
          const level = LEVELS.find((l) => l.ratio === t);
          return (
            <span
              key={t}
              className={cn(
                "absolute flex -translate-x-1/2 flex-col items-center leading-tight",
                t === 1 && "translate-x-0 items-start",
                t === 21 && "-translate-x-full items-end",
                level ? "font-medium text-foreground" : "text-muted-foreground",
              )}
              style={{ left: `${pos(t)}%` }}
            >
              {formatRatio(t)}
              {level && <span className="hidden text-[0.6875rem] font-normal text-muted-foreground sm:block">{level.name}</span>}
            </span>
          );
        })}
      </div>
      {chips("bg")}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Preview with color-vision simulation

const VISIONS: { id: Vision; name: string; note: string }[] = [
  { id: "normal", name: "Normalt seende", note: "" },
  { id: "protan", name: "Protanopi", note: "rödblind" },
  { id: "deutan", name: "Deuteranopi", note: "grönblind" },
  { id: "tritan", name: "Tritanopi", note: "blåblind" },
  { id: "gray", name: "Gråskala", note: "akromatopsi" },
];

function Preview({ text, bg }: { text: Rgb; bg: Rgb }) {
  const [vision, setVision] = useState<Vision>("normal");
  const t = simulate(text, vision);
  const b = simulate(bg, vision);
  return (
    <section aria-label="Förhandsvisning" className="mt-8 grid gap-4 lg:grid-cols-[1fr_15rem]">
      <div className="checker relative overflow-hidden rounded-xl shadow-xs">
        <div className="absolute inset-0 rounded-xl shadow-[inset_0_0_0_1px] shadow-foreground/10 transition-colors duration-200" style={{ backgroundColor: css(b) }} />
        <div className="relative flex h-full flex-col justify-center gap-4 p-6 md:p-8" style={{ color: css(t) }}>
          <p className="text-2xl leading-tight font-bold tracking-tight text-balance">Stor text, 24 pixlar i fetstil</p>
          <p className="max-w-[62ch] text-base leading-relaxed">
            Brödtext i 16 pixlar. Så här läses en ingress eller en artikel i den här färgkombinationen, med{" "}
            <span className="underline underline-offset-4">en länk</span> mitt i meningen och siffror som 1 234,50 kr.
          </p>
          <p className="text-sm">Liten text, 14 pixlar: bildtexter, datum och fotnoter.</p>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <span className="inline-flex h-9 items-center rounded-lg px-4 text-sm font-medium" style={{ backgroundColor: css(t), color: css(b) }}>
              Knapp
            </span>
            <span className="inline-flex h-9 items-center rounded-lg border-2 px-4 text-sm font-medium" style={{ borderColor: css(t) }}>
              Kantknapp
            </span>
            <Palette aria-hidden="true" className="size-6" />
          </div>
        </div>
      </div>
      <div role="radiogroup" aria-label="Synsimulering" className="grid content-start gap-1">
        <p className="mb-1 text-sm font-medium">Synsimulering</p>
        {VISIONS.map((v) => {
          const r = contrast(simulate(text, v.id), simulate(bg, v.id));
          const on = vision === v.id;
          return (
            <button
              key={v.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setVision(v.id)}
              className={cn(
                "flex items-center gap-3 rounded-lg border border-transparent px-3 py-1.5 text-left text-sm outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
                on && "border-primary/40 bg-accent text-accent-foreground hover:bg-accent",
              )}
            >
              <span className="min-w-0 flex-1 truncate">
                <span className="font-medium">{v.name}</span>
                {v.note && <span className="ml-1.5 text-xs text-muted-foreground">{v.note}</span>}
              </span>
              <span className={cn("tabular-nums", r < 4.5 && "text-destructive")}>{formatRatio(r)}:1</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

export function ColorApp() {
  const [text, setText] = useState(START_TEXT);
  const [bg, setBg] = useState(START_BG);
  const [preview, setPreview] = useState<Suggestion | null>(null);
  const { copied, copy, status } = useCopy();

  const shownText = preview?.side === "text" ? preview.color : text;
  const shownBg = preview?.side === "bg" ? preview.color : bg;
  const ratio = contrast(shownText, shownBg);
  const fixes = useMemo(() => suggestions(text, bg), [text, bg]);

  const set = useCallback((side: Side, c: Rgb) => (side === "text" ? setText(c) : setBg(c)), []);

  return (
    <AppShell tool="color">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-6 md:grid-cols-[1fr_13rem_1fr] lg:grid-cols-[1fr_16rem_1fr]">
          <Well side="text" color={text} shown={shownText} onColor={setText} copied={copied} onCopy={copy} autoFocus />
          <div className="order-last md:order-none">
            <Verdict
              ratio={ratio}
              onSwap={() => {
                setText(bg);
                setBg(text);
              }}
            />
          </div>
          <Well side="bg" color={bg} shown={shownBg} onColor={setBg} copied={copied} onCopy={copy} />
        </div>
        <Ruler text={text} bg={bg} shownText={shownText} shownBg={shownBg} ratio={ratio} fixes={fixes} onPreview={setPreview} onApply={(s) => set(s.side, s.color)} />
        <Preview text={shownText} bg={shownBg} />
        <p role="status" className="sr-only">
          {status}
        </p>
      </div>
    </AppShell>
  );
}
