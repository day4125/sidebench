// The rail's panels: Minska (the levers and "Nå budget"), Färger (the
// palette, recolor) and Kod (code in and out).
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Check, Copy, Download, LoaderCircle, Scissors, Target, TriangleAlert, X } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { parseColor, toHex } from "@/tools/color/engine";
import { BUDGET, formatBytes, recolor, utf8Length, type SvgDoc } from "./engine";
import { DEFAULT_IMAGES, MAX_SIDES, inspect, recompressText, type ImageInfo, type ImageOptions } from "./images";
import { CLEANUP, DEFAULT_CLEANUP, DEFAULT_OPTIMIZE, SvgoRunner, cleanupConfig, isAbort, optimizeConfig, type OptimizeOptions } from "./optimize";

export interface Ghost {
  /** Size after the change. */
  bytes: number;
  label: string;
}

type Commit = (text: string, label: string) => Promise<boolean>;

// ---------------------------------------------------------------------------
// Previews: each lever computes its result ahead, so its saving shows on
// the button and applying it is instant.

interface Preview {
  key: string;
  busy: boolean;
  text?: string | null;
  error?: string;
}

function usePreview(key: string, run: () => Promise<string | null>, cancel: () => void, delay: number): Preview {
  const [state, setState] = useState<Preview>({ key, busy: true });
  const runRef = useRef(run);
  runRef.current = run;
  useEffect(() => {
    let live = true;
    setState({ key, busy: true });
    const t = window.setTimeout(async () => {
      try {
        const text = await runRef.current();
        if (live) setState({ key, busy: false, text });
      } catch (e) {
        if (live && !isAbort(e)) setState({ key, busy: false, error: e instanceof Error ? e.message : String(e) });
      }
    }, delay);
    return () => {
      live = false;
      window.clearTimeout(t);
      cancel();
    };
    // run and cancel are read through refs; the key says when to rerun.
  }, [key]);
  return state.key === key ? state : { key, busy: true };
}

function useRunner() {
  const r = useRef<SvgoRunner | null>(null);
  r.current ??= new SvgoRunner();
  useEffect(() => () => r.current?.dispose(), []);
  return r.current;
}

// ---------------------------------------------------------------------------
// Minska

interface ReduceProps {
  svg: SvgDoc;
  docKey: string;
  onCommit: Commit;
  onGhost: (g: Ghost | null) => void;
  selectionCount: number;
  onCut: () => void;
}

const IMAGE_STEPS: ImageOptions[] = [
  { format: "image/webp", quality: 0.8, maxSide: 0 },
  { format: "image/webp", quality: 0.7, maxSide: 2000 },
  { format: "image/webp", quality: 0.6, maxSide: 1500 },
  { format: "image/webp", quality: 0.5, maxSide: 1000 },
];

const FORMAT_NAME: Record<string, string> = { "image/webp": "WebP", "image/jpeg": "JPEG", "image/png": "PNG", "image/gif": "GIF", "image/svg+xml": "SVG" };

export function Reduce({ svg, docKey, onCommit, onGhost, selectionCount, onCut }: ReduceProps) {
  const [cleanup, setCleanup] = useState<string[]>(DEFAULT_CLEANUP);
  const [opt, setOpt] = useState<OptimizeOptions>(DEFAULT_OPTIMIZE);
  const [img, setImg] = useState<ImageOptions>(DEFAULT_IMAGES);
  const [auto, setAuto] = useState<{ busy: boolean; text: string; tone?: "ok" | "warn" | "error" } | null>(null);
  const cleanRunner = useRunner();
  const optRunner = useRunner();
  const autoRunner = useRunner();

  const big = svg.bytes > 2_000_000;
  const delay = big ? 700 : 250;

  const cleanPrev = usePreview(
    `${docKey}|${cleanup.join(",")}`,
    () => (cleanup.length ? cleanRunner.run(svg.text, cleanupConfig(cleanup)) : Promise.resolve(null)),
    () => cleanRunner.cancel(),
    delay,
  );
  const optPrev = usePreview(
    `${docKey}|${opt.precision}|${opt.keepIds}`,
    () => optRunner.run(svg.text, optimizeConfig(opt)),
    () => optRunner.cancel(),
    delay,
  );
  const imgPrev = usePreview(
    `${docKey}|${img.format}|${img.quality}|${img.maxSide}`,
    async () => (svg.images.length ? (await recompressText(svg.text, img)).text : null),
    () => {},
    delay + 150,
  );

  useEffect(() => () => onGhost(null), [onGhost]);
  // Another edit or undo clears the last run's result; its own commit doesn't.
  const ownCommit = useRef(false);
  useEffect(() => {
    if (ownCommit.current) ownCommit.current = false;
    else setAuto(null);
  }, [docKey]);

  async function reach() {
    let text = svg.text;
    const size = () => utf8Length(text);
    const done: string[] = [];
    const say = (t: string) => setAuto({ busy: true, text: t });
    try {
      say("Rensar metadata…");
      text = await autoRunner.run(text, cleanupConfig(DEFAULT_CLEANUP));
      done.push("rensning");
      if (size() > BUDGET) {
        const floor = Math.max(svg.view.w, svg.view.h) < 100 ? 2 : 1;
        let used = 3;
        for (let p = 3; p >= floor; p--) {
          say(`Optimerar med ${p} decimaler…`);
          text = await autoRunner.run(text, optimizeConfig({ ...opt, precision: p }));
          used = p;
          if (size() <= BUDGET) break;
        }
        done.push(`optimering (${used} decimaler)`);
      }
      if (size() > BUDGET && svg.images.length) {
        const base = text;
        let label = "";
        for (const s of IMAGE_STEPS) {
          say(`Komprimerar bilder: WebP ${Math.round(s.quality * 100)} %${s.maxSide ? `, högst ${s.maxSide} px` : ""}…`);
          const r = await recompressText(base, s);
          text = r.text;
          label = `bilder WebP ${Math.round(s.quality * 100)} %${s.maxSide ? ` högst ${s.maxSide} px` : ""}`;
          if (size() <= BUDGET) break;
        }
        done.push(label);
      }
      const final = size();
      ownCommit.current = true;
      if (!(await onCommit(text, `Nå budget: ${done.join(", ")}`))) ownCommit.current = false;
      setAuto(
        final <= BUDGET
          ? { busy: false, tone: "ok", text: `Klart: ${formatBytes(final)}, ${formatBytes(BUDGET - final)} under gränsen. Steg: ${done.join(", ")}.` }
          : {
              busy: false,
              tone: "warn",
              text: `Når inte 500 kB: ${formatBytes(final)} efter alla säkra steg (${done.join(", ")}). Ta bort element eller klipp ut en mindre del.`,
            },
      );
    } catch (e) {
      if (isAbort(e)) setAuto(null);
      else setAuto({ busy: false, tone: "error", text: `Avbröts av ett fel: ${e instanceof Error ? e.message : e}` });
    }
  }

  const over = svg.bytes > BUDGET;

  return (
    <div className="flex flex-col gap-6 p-4">
      {selectionCount > 0 && (
        <p className="flex items-start gap-2 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
          <span className="flex-1">Åtgärderna gäller hela filen. Klipp ut markeringen först om bara den ska minskas.</span>
          <Button size="xs" variant="outline" onClick={onCut}>
            <Scissors data-icon="inline-start" />
            Klipp ut
          </Button>
        </p>
      )}

      <section aria-labelledby="lever-auto" className="flex flex-col gap-2">
        <h3 id="lever-auto" className="sr-only">
          Nå budget
        </h3>
        {auto?.busy ? (
          <div className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm" role="status">
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin text-primary" />
            <span className="flex-1">{auto.text}</span>
            <Button size="xs" variant="ghost" onClick={() => autoRunner.cancel()}>
              Avbryt
            </Button>
          </div>
        ) : (
          <Button size="lg" className="w-full" disabled={!over} onClick={reach}>
            <Target data-icon="inline-start" />
            {over ? "Nå budget automatiskt" : "Filen är redan under 500 kB"}
          </Button>
        )}
        {over && !auto && (
          <p className="text-xs text-muted-foreground">
            Rensar, optimerar med färre decimaler och komprimerar bilder, i den ordningen, tills filen är under 500 kB. Tar aldrig bort element. Går att ångra.
          </p>
        )}
        {auto && !auto.busy && (
          <p role="status" className={cn("text-xs", auto.tone === "ok" ? "text-primary" : auto.tone === "warn" ? "text-foreground" : "text-destructive")}>
            {auto.text}
          </p>
        )}
      </section>

      <Lever
        id="lever-cleanup"
        title="Rensa metadata"
        note="Tar också bort radbrytningar och indrag."
        svg={svg}
        preview={cleanPrev}
        apply="Rensa"
        label={`Rensning (${cleanup.length} delar)`}
        disabled={!cleanup.length}
        onCommit={onCommit}
        onGhost={onGhost}
      >
        <ul className="grid gap-1.5">
          {CLEANUP.map((c) => (
            <li key={c.plugin}>
              <label className="flex cursor-pointer items-start gap-2.5 text-sm">
                <Checkbox
                  className="mt-0.5"
                  checked={cleanup.includes(c.plugin)}
                  onCheckedChange={(v) => setCleanup((s) => (v ? [...s, c.plugin] : s.filter((p) => p !== c.plugin)))}
                />
                <span className="min-w-0">
                  <span className={cn(c.label.startsWith("<") && "font-mono text-xs")}>{c.label}</span>
                  {c.hint && <span className={cn("ml-1.5 text-xs", c.risky ? "text-destructive" : "text-muted-foreground")}>{c.hint}</span>}
                </span>
              </label>
            </li>
          ))}
        </ul>
      </Lever>

      <Lever
        id="lever-optimize"
        title="Optimera (SVGO)"
        note={big ? "Stor fil: optimeringen tar några sekunder." : undefined}
        svg={svg}
        preview={optPrev}
        apply="Optimera"
        label={`Optimering (${opt.precision} decimaler)`}
        onCommit={onCommit}
        onGhost={onGhost}
      >
        <div className="grid gap-3">
          <label className="grid gap-1.5 text-sm">
            <span className="flex justify-between">
              <span>Decimaler i koordinater</span>
              <span className="tabular-nums text-muted-foreground">{opt.precision}</span>
            </span>
            <input
              type="range"
              min={0}
              max={5}
              step={1}
              value={opt.precision}
              onChange={(e) => setOpt((o) => ({ ...o, precision: Number(e.target.value) }))}
              className="svg-range"
            />
            <span className="text-xs text-muted-foreground">Färre decimaler ger mindre fil. 0–1 kan synas på små eller detaljrika bilder.</span>
          </label>
          <label className="flex cursor-pointer items-start gap-2.5 text-sm">
            <Checkbox className="mt-0.5" checked={opt.keepIds} onCheckedChange={(v) => setOpt((o) => ({ ...o, keepIds: !!v }))} />
            <span>
              Behåll id-namn
              <span className="block text-xs text-muted-foreground">Korta id:n kan krocka om flera SVG:er ligger inbäddade på samma sida.</span>
            </span>
          </label>
        </div>
      </Lever>

      <Lever
        id="lever-images"
        title={`Bilder i filen${svg.images.length ? ` (${svg.images.length})` : ""}`}
        svg={svg}
        preview={svg.images.length ? imgPrev : { key: "", busy: false, text: null }}
        apply="Komprimera bilder"
        label={`Bilder ${FORMAT_NAME[img.format]} ${Math.round(img.quality * 100)} %${img.maxSide ? `, högst ${img.maxSide} px` : ""}`}
        disabled={!svg.images.length}
        onCommit={onCommit}
        onGhost={onGhost}
      >
        {svg.images.length ? (
          <div className="grid gap-3">
            <ImageList svg={svg} />
            <div className="grid grid-cols-2 gap-2">
              <label className="grid gap-1 text-xs text-muted-foreground">
                Format
                <NativeSelect size="sm" className="w-full" value={img.format} onChange={(e) => setImg((o) => ({ ...o, format: e.target.value as ImageOptions["format"] }))}>
                  <NativeSelectOption value="image/webp">WebP (behåller genomskinlighet)</NativeSelectOption>
                  <NativeSelectOption value="image/jpeg">JPEG (genomskinligt blir vitt)</NativeSelectOption>
                </NativeSelect>
              </label>
              <label className="grid gap-1 text-xs text-muted-foreground">
                Största sida
                <NativeSelect size="sm" className="w-full" value={img.maxSide} onChange={(e) => setImg((o) => ({ ...o, maxSide: Number(e.target.value) }))}>
                  {MAX_SIDES.map((s) => (
                    <NativeSelectOption key={s} value={s}>
                      {s ? `${s} px` : "Behåll storleken"}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </label>
            </div>
            <label className="grid gap-1.5 text-sm">
              <span className="flex justify-between">
                <span>Kvalitet</span>
                <span className="tabular-nums text-muted-foreground">{Math.round(img.quality * 100)} %</span>
              </span>
              <input
                type="range"
                min={0.3}
                max={0.95}
                step={0.05}
                value={img.quality}
                onChange={(e) => setImg((o) => ({ ...o, quality: Number(e.target.value) }))}
                className="svg-range"
              />
            </label>
            <p className="text-xs text-muted-foreground">En bild som inte blir mindre lämnas som den är.</p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Inga inbäddade bilder.</p>
        )}
      </Lever>

      <p className="text-xs text-muted-foreground">
        Element tar du bort genom att markera dem och trycka <kbd className="rounded border px-1 font-sans">Delete</kbd> eller välja Ta bort ovanför.
      </p>
    </div>
  );
}

interface LeverProps {
  id: string;
  title: string;
  note?: string;
  svg: SvgDoc;
  preview: Preview;
  apply: string;
  label: string;
  disabled?: boolean;
  onCommit: Commit;
  onGhost: (g: Ghost | null) => void;
  children: ReactNode;
}

function Lever({ id, title, note, svg, preview, apply, label, disabled, onCommit, onGhost, children }: LeverProps) {
  const after = preview.text != null ? utf8Length(preview.text) : null;
  const saving = after != null ? svg.bytes - after : null;
  const useful = saving != null && saving > 0;
  const ghost = () => (useful ? onGhost({ bytes: after!, label: title }) : onGhost(null));
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3 border-t pt-5">
      <div>
        <h3 id={id} className="font-semibold tracking-tight">
          {title}
        </h3>
        {note && <p className="text-xs text-muted-foreground">{note}</p>}
      </div>
      {children}
      <div className="flex items-center gap-3">
        <Button
          variant="secondary"
          disabled={disabled || !useful}
          onPointerEnter={ghost}
          onPointerLeave={() => onGhost(null)}
          onFocus={ghost}
          onBlur={() => onGhost(null)}
          onClick={async () => {
            onGhost(null);
            if (preview.text) await onCommit(preview.text, label);
          }}
        >
          {apply}
        </Button>
        <span className="text-sm tabular-nums" aria-live="polite">
          {disabled ? null : preview.busy ? (
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" />
              Beräknar…
            </span>
          ) : preview.error ? (
            <span className="text-destructive">Gick inte: {preview.error.slice(0, 80)}</span>
          ) : useful ? (
            <span>
              <span className="font-medium text-primary">−{formatBytes(saving!)}</span>
              <span className="text-muted-foreground"> → {formatBytes(after!)}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">Ingen vinst</span>
          )}
        </span>
      </div>
    </section>
  );
}

function ImageList({ svg }: { svg: SvgDoc }) {
  const [info, setInfo] = useState<Map<number, ImageInfo | null>>(new Map());
  useEffect(() => {
    let live = true;
    (async () => {
      const m = new Map<number, ImageInfo | null>();
      for (const img of svg.images.slice(0, 12)) {
        m.set(img.node, await inspect(img));
        if (!live) return;
        setInfo(new Map(m));
      }
    })();
    return () => {
      live = false;
    };
  }, [svg]);
  const shown = svg.images.slice(0, 6);
  return (
    <ul className="grid gap-1.5">
      {shown.map((img) => {
        const i = info.get(img.node);
        return (
          <li key={img.node} className="flex items-center gap-3 text-xs">
            <img src={img.href} alt="" className="checker size-9 shrink-0 rounded-md object-contain ring-1 ring-foreground/10" />
            <span className="min-w-0 flex-1">
              <span className="block font-medium">
                {FORMAT_NAME[img.mime] ?? img.mime}
                {i && <span className="font-normal text-muted-foreground tabular-nums"> · {i.width} × {i.height} px{i.alpha ? " · genomskinlig" : ""}</span>}
              </span>
            </span>
            <span className="shrink-0 tabular-nums">{formatBytes(img.bytes)}</span>
          </li>
        );
      })}
      {svg.images.length > shown.length && <li className="text-xs text-muted-foreground">och {svg.images.length - shown.length} till</li>}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Färger

export function Colors({ svg, onCommit }: { svg: SvgDoc; onCommit: Commit }) {
  const [pick, setPick] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  useEffect(() => setPick(null), [svg]);
  useEffect(() => {
    if (pick) setDraft(pick);
  }, [pick]);
  const to = parseColor(draft);
  const toHexValue = to ? toHex(to) : null;

  if (!svg.palette.length) return <p className="p-4 text-sm text-muted-foreground">Inga färger hittades i koden.</p>;

  return (
    <div className="flex flex-col gap-4 p-4">
      <p className="text-xs text-muted-foreground">
        {svg.palette.length} färger i filen, flest användningar först. Välj en för att byta den överallt: attribut, <code className="font-mono">style</code> och{" "}
        <code className="font-mono">&lt;style&gt;</code>.
      </p>
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(3.25rem,1fr))] gap-2">
        {svg.palette.map((s) => (
          <li key={s.key}>
            <button
              type="button"
              aria-pressed={pick === s.key}
              onClick={() => setPick(pick === s.key ? null : s.key)}
              className={cn(
                "group grid w-full gap-1 rounded-lg p-1 text-left outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
                pick === s.key && "bg-accent hover:bg-accent",
              )}
            >
              <span className="checker relative block h-9 overflow-hidden rounded-md ring-1 ring-foreground/15">
                <span className="absolute inset-0" style={{ backgroundColor: s.key }} />
              </span>
              <span className="truncate font-mono text-[0.65rem] leading-tight">{s.key}</span>
              <span className="text-[0.65rem] leading-tight text-muted-foreground tabular-nums">{s.count}×</span>
            </button>
          </li>
        ))}
      </ul>
      {pick && (
        <section aria-label={`Byt ${pick}`} className="grid gap-3 rounded-xl border p-3">
          <div className="flex items-center gap-3">
            <span className="checker relative size-10 shrink-0 overflow-hidden rounded-md ring-1 ring-foreground/15">
              <span className="absolute inset-0" style={{ backgroundColor: pick }} />
            </span>
            <span aria-hidden="true" className="text-muted-foreground">→</span>
            <label className="checker relative size-10 shrink-0 cursor-pointer overflow-hidden rounded-md ring-1 ring-foreground/15">
              <span className="absolute inset-0" style={{ backgroundColor: toHexValue ?? "transparent" }} />
              <input
                type="color"
                aria-label="Välj ny färg"
                value={(toHexValue ?? pick).slice(0, 7)}
                onChange={(e) => setDraft(e.target.value)}
                className="absolute inset-0 cursor-pointer opacity-0"
              />
            </label>
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              aria-label="Ny färg"
              aria-invalid={!to || undefined}
              spellCheck={false}
              className="h-9 min-w-0 flex-1 font-mono"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={!toHexValue || toHexValue === pick} onClick={() => onCommit(recolor(svg, pick, toHexValue!), `Färg ${pick} → ${toHexValue}`)}>
              Byt färg
            </Button>
            <Button size="sm" variant="outline" onClick={() => onCommit(recolor(svg, pick, "currentColor"), `Färg ${pick} → currentColor`)}>
              Gör till currentColor
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">currentColor tar textfärgen där SVG:n sitter inbäddad, så den kan styras med CSS.</p>
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Kod

const EDIT_LIMIT = 2_000_000;
const SHOW_LIMIT = 200_000;

export function Code({ svg, onCommit, onCopy, onDownload }: { svg: SvgDoc; onCommit: Commit; onCopy: (what: "code" | "uri") => void; onDownload: () => void }) {
  const editable = svg.bytes <= EDIT_LIMIT;
  const [draft, setDraft] = useState(svg.text);
  useEffect(() => setDraft(svg.text), [svg]);
  const shown = useMemo(() => (editable ? null : svg.text.slice(0, SHOW_LIMIT)), [editable, svg]);
  const changed = editable && draft !== svg.text;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={() => onCopy("code")}>
          <Copy data-icon="inline-start" />
          Kopiera kod
        </Button>
        <Button size="sm" variant="secondary" onClick={onDownload}>
          <Download data-icon="inline-start" />
          Ladda ner .svg
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onCopy("uri")}>
          Kopiera som data-URI
        </Button>
      </div>
      {!editable && (
        <p className="flex gap-2 text-xs text-muted-foreground">
          <TriangleAlert aria-hidden="true" className="size-3.5 shrink-0" />
          Filen är för stor för att redigeras här. Visar de första {formatBytes(SHOW_LIMIT)}; kopiera eller ladda ner för hela koden.
        </p>
      )}
      <Textarea
        aria-label="SVG-kod"
        value={editable ? draft : shown!}
        readOnly={!editable}
        onChange={(e) => setDraft(e.target.value)}
        spellCheck={false}
        className="svg-scroll min-h-64 flex-1 resize-none font-mono text-xs leading-relaxed [field-sizing:fixed]"
      />
      {changed && (
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => onCommit(draft, "Kodändring")}>
            <Check data-icon="inline-start" />
            Använd ändringarna
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setDraft(svg.text)}>
            <X data-icon="inline-start" />
            Släng
          </Button>
          <span className="text-xs text-muted-foreground tabular-nums">{formatBytes(utf8Length(draft))}</span>
        </div>
      )}
    </div>
  );
}
