// SVG-viewer: get any SVG under the CMS's 500 kB limit, or cut one figure
// out of a collage as its own SVG.
//
// Layout: the budget strip across the top (the file's or the selection's
// size against the 500 kB line, with a lever's saving shown ahead as a
// hatched ghost), the canvas filling the rest, and a rail: Element (the
// tree, heaviest first), Minska (the levers), Färger and Kod. "Vikt" on the
// canvas paints every shape by its bytes.
//
// Every edit is a new version of the text, so all of them can be undone.
// The file lives in memory only (INTENT.md).
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { FileUp, Redo2, Scissors, Trash2, Undo2, X, Download, Copy, LoaderCircle } from "lucide-react";
import { cn } from "cn";
import { AppShell } from "@/app/AppShell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useFlash } from "@/hooks/use-flash";
import { Canvas, isTyping, type Backdrop } from "./Canvas";
import {
  BUDGET, HEAT_MAX, MAX_BYTES, SLOW_BYTES, SvgError, extract, formatBytes, heatRender, normalize, openSvg, remove, rotate, utf8Length, type SvgDoc,
} from "./engine";
import { DEFAULT_OPTIMIZE, SvgoRunner, isAbort, optimizeConfig } from "./optimize";
import { Code, Colors, Reduce, type Ghost } from "./Panels";
import { Tree } from "./Tree";

interface Version {
  text: string;
  label: string;
}

/** Undo keeps the original and the newest steps, within memory reason. */
function trim(v: Version[]): Version[] {
  let out = v.length > 25 ? [v[0], ...v.slice(-24)] : v;
  while (out.length > 2 && out.reduce((n, x) => n + x.text.length, 0) > 150_000_000) out = [out[0], ...out.slice(2)];
  return out;
}

const frame = () => new Promise<void>((r) => requestAnimationFrame(() => setTimeout(r, 0)));

function isSvgFile(f: File) {
  return /\.svgz?$/i.test(f.name) || f.type === "image/svg+xml";
}

async function readSvgFile(f: File): Promise<string> {
  const head = new Uint8Array(await f.slice(0, 2).arrayBuffer());
  if (head[0] === 0x1f && head[1] === 0x8b) {
    // .svgz: gzip, unpacked by the browser.
    const stream = f.stream().pipeThrough(new DecompressionStream("gzip"));
    return await new Response(stream).text();
  }
  return await f.text();
}

function baseName(name: string) {
  return name.replace(/\.svgz?$/i, "") || "bild";
}

function downloadText(text: string, filename: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "image/svg+xml" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** A data URI with only the characters that need it escaped. */
function dataUri(text: string) {
  const body = encodeURIComponent(text.replace(/\s+/g, " ").trim())
    .replace(/%20/g, " ")
    .replace(/%3D/g, "=")
    .replace(/%3A/g, ":")
    .replace(/%2F/g, "/")
    .replace(/%2C/g, ",")
    .replace(/%3B/g, ";");
  return `data:image/svg+xml,${body}`;
}

export function SvgApp() {
  const [hist, setHist] = useState<{ versions: Version[]; at: number }>({ versions: [], at: -1 });
  const [name, setName] = useState("");
  const [svg, setSvg] = useState<SvgDoc | null>(null);
  const [docKey, setDocKey] = useState("0");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selection, setSelection] = useState<number[]>([]);
  const [hover, setHover] = useState<number | null>(null);
  const [tab, setTab] = useState("element");
  const [heatOn, setHeatOn] = useState(false);
  const [heat, setHeat] = useState<{ url: string; mode: "area" | "shape"; min: number; max: number } | null>(null);
  const [backdrop, setBackdrop] = useState<Backdrop>("checker");
  const [ghost, setGhost] = useState<Ghost | null>(null);
  const [selEst, setSelEst] = useState<{ raw: number; opt?: number | null; text: string } | null>(null);
  const [status, setStatus] = useState("");
  const [dragging, setDragging] = useState(false);
  const [paste, setPaste] = useState("");
  const [copied, flashCopied] = useFlash(1300);

  const svgRef = useRef<SvgDoc | null>(null);
  const histRef = useRef(hist);
  histRef.current = hist;
  const seq = useRef(0);
  const selRunner = useRef<SvgoRunner | null>(null);
  selRunner.current ??= new SvgoRunner();

  useEffect(() => () => {
    svgRef.current?.dispose();
    selRunner.current?.dispose();
  }, []);

  /** Opens text as the current document; "new" starts a fresh history, "edit" adds a version. */
  const open = useCallback(async (text: string, label: string, mode: "new" | "edit" | { goto: number }): Promise<boolean> => {
    setBusy(label);
    setError(null);
    await frame();
    let d: SvgDoc;
    try {
      d = openSvg(text);
    } catch (e) {
      setBusy(null);
      setError(e instanceof SvgError ? e.message : `Kunde inte läsa SVG:n: ${e instanceof Error ? e.message : e}`);
      return false;
    }
    svgRef.current?.dispose();
    svgRef.current = d;
    setSvg(d);
    setDocKey(String(++seq.current));
    setSelection([]);
    setHover(null);
    setGhost(null);
    if (mode === "new") setHist({ versions: [{ text, label }], at: 0 });
    else if (mode === "edit")
      setHist((h) => {
        const versions = trim([...h.versions.slice(0, h.at + 1), { text, label }]);
        return { versions, at: versions.length - 1 };
      });
    else setHist((h) => ({ ...h, at: mode.goto }));
    setBusy(null);
    setStatus(mode === "new" ? `Öppnade: ${formatBytes(d.bytes)}` : `${label}: ${formatBytes(d.bytes)}`);
    return true;
  }, []);

  const commit = useCallback((text: string, label: string) => open(text, label, "edit"), [open]);

  const loadFile = useCallback(
    async (f: File) => {
      if (!isSvgFile(f)) {
        setError(`${f.name} är inte en SVG-fil.`);
        return;
      }
      if (f.size > MAX_BYTES) {
        setError(`${f.name} är ${formatBytes(f.size)}. Filer över ${formatBytes(MAX_BYTES)} läses inte in, så att fliken inte fryser.`);
        return;
      }
      try {
        const text = await readSvgFile(f);
        if (await open(text, `Öppnade ${f.name}`, "new")) setName(f.name);
      } catch {
        setError(`Kunde inte läsa ${f.name}.`);
      }
    },
    [open],
  );

  const openPasted = useCallback(
    async (text: string) => {
      if (await open(text.trim(), "Inklistrad kod", "new")) setName("inklistrad.svg");
    },
    [open],
  );

  const undo = useCallback(() => {
    const h = histRef.current;
    if (h.at > 0 && !busy) void open(h.versions[h.at - 1].text, h.versions[h.at].label, { goto: h.at - 1 });
  }, [open, busy]);
  const redo = useCallback(() => {
    const h = histRef.current;
    if (h.at < h.versions.length - 1 && !busy) void open(h.versions[h.at + 1].text, h.versions[h.at + 1].label, { goto: h.at + 1 });
  }, [open, busy]);

  const cut = useCallback(() => {
    if (!svg || !selection.length) return;
    const text = selEst?.text ?? extract(svg, selection);
    void commit(text, `Urklipp: ${selection.length} element`);
  }, [svg, selection, selEst, commit]);

  const removeSelection = useCallback(() => {
    if (!svg || !selection.length) return;
    void commit(remove(svg, selection), `Tog bort ${selection.length} element`);
  }, [svg, selection, commit]);

  // The canvas image, and the heat render while "Vikt" is on.
  const imageUrl = useMemo(() => (svg ? URL.createObjectURL(new Blob([svg.displayText], { type: "image/svg+xml" })) : ""), [svg]);
  useEffect(() => () => URL.revokeObjectURL(imageUrl), [imageUrl]);

  const heatAvailable = !!svg && svg.shapes > 0 && svg.shapes <= HEAT_MAX;
  useEffect(() => {
    if (!svg || !heatOn || !heatAvailable) {
      setHeat(null);
      return;
    }
    let url = "";
    const t = window.setTimeout(() => {
      const h = heatRender(svg, selection.length ? selection : null);
      url = URL.createObjectURL(new Blob([h.text], { type: "image/svg+xml" }));
      setHeat({ url, mode: h.mode, min: h.min, max: h.max });
    }, 60);
    return () => {
      window.clearTimeout(t);
      if (url) URL.revokeObjectURL(url);
    };
  }, [svg, heatOn, heatAvailable, selection]);

  // The selection as its own file: raw size now, optimized estimate after.
  useEffect(() => {
    setSelEst(null);
    if (!svg || !selection.length) return;
    let live = true;
    const runner = selRunner.current!;
    const t = window.setTimeout(async () => {
      const text = extract(svg, selection);
      const raw = utf8Length(text);
      if (!live) return;
      setSelEst({ raw, text });
      try {
        const o = await runner.run(text, optimizeConfig(DEFAULT_OPTIMIZE));
        if (live) setSelEst({ raw, text, opt: utf8Length(o) });
      } catch (e) {
        if (live && !isAbort(e)) setSelEst({ raw, text, opt: null });
      }
    }, 120);
    return () => {
      live = false;
      window.clearTimeout(t);
      runner.cancel();
    };
  }, [svg, selection]);

  const downloadName = () => {
    const cutDone = hist.versions.slice(1, hist.at + 1).some((v) => v.label.startsWith("Urklipp"));
    return `${baseName(name)}${cutDone ? "-urklipp" : hist.at > 0 ? "-optimerad" : ""}.svg`;
  };
  const download = () => {
    if (!svg) return;
    downloadText(svg.text, downloadName());
    setStatus(`Laddade ner ${downloadName()}`);
  };
  const copy = async (what: "code" | "uri") => {
    if (!svg) return;
    try {
      await navigator.clipboard.writeText(what === "code" ? svg.text : dataUri(svg.text));
      flashCopied();
      setStatus(what === "code" ? "Koden kopierad" : "Data-URI kopierad");
    } catch {
      setStatus("Kunde inte kopiera. Använd Ladda ner i stället.");
    }
  };

  // Keys: undo/redo, Esc clears the selection, Delete removes it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      } else if (e.key === "Escape" && selection.length) setSelection([]);
      else if ((e.key === "Delete" || e.key === "Backspace") && selection.length && !busy) {
        e.preventDefault();
        removeSelection();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, selection, removeSelection, busy]);

  // Paste anywhere outside a field: an SVG file or SVG code opens.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (isTyping(e.target)) return;
      const file = Array.from(e.clipboardData?.files ?? []).find(isSvgFile);
      if (file) {
        e.preventDefault();
        void loadFile(file);
        return;
      }
      const text = e.clipboardData?.getData("text/plain") ?? "";
      if (/<svg[\s>]/i.test(text)) {
        e.preventDefault();
        void openPasted(text);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [loadFile, openPasted]);

  const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer.types).includes("Files");
  const dropProps = {
    onDragEnter: (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      setDragging(true);
    },
    onDragOver: (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    },
    onDragLeave: (e: DragEvent) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
    },
    onDrop: (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      setDragging(false);
      const files = Array.from(e.dataTransfer.files);
      const f = files.find(isSvgFile) ?? files[0];
      if (f) void loadFile(f);
    },
  };

  const onTreeSelect = useCallback(
    (i: number, add: boolean) => {
      if (!svg) return;
      setSelection((s) => (add ? (s.includes(i) ? s.filter((x) => x !== i) : normalize(svg, [...s, i])) : [i]));
    },
    [svg],
  );

  const h = hist;
  return (
    <AppShell tool="svg-viewer" fill>
      <div className="relative flex min-h-0 flex-1 flex-col" {...dropProps}>
        {svg ? (
          <>
            <Strip
              svg={svg}
              name={name}
              selection={selection}
              est={selEst}
              ghost={ghost}
              onCut={cut}
              onRemove={removeSelection}
              onClear={() => setSelection([])}
              undo={h.at > 0 ? { label: h.versions[h.at].label, run: undo } : null}
              redo={h.at < h.versions.length - 1 ? { label: h.versions[h.at + 1].label, run: redo } : null}
              onDownload={download}
              onCopy={() => copy("code")}
              copied={copied}
              onReduce={() => setTab("minska")}
              busy={!!busy}
            />
            {error && (
              <div className="border-b px-4 py-2">
                <Alert variant="destructive" className="flex items-start gap-2">
                  <AlertDescription className="flex-1">{error}</AlertDescription>
                  <Button size="icon-xs" variant="ghost" aria-label="Stäng felmeddelandet" onClick={() => setError(null)}>
                    <X />
                  </Button>
                </Alert>
              </div>
            )}
            {svg.bytes > SLOW_BYTES && (
              <p className="border-b bg-muted/50 px-4 py-1.5 text-xs text-muted-foreground">Stor fil: optimering och förhandsberäkningar tar några sekunder.</p>
            )}
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto md:flex-row md:overflow-hidden">
              <div className="flex h-[62svh] shrink-0 flex-col md:h-auto md:min-h-0 md:flex-1">
                <Canvas
                  svg={svg}
                  imageUrl={imageUrl}
                  heatUrl={heat?.url ?? null}
                  heat={{ on: heatOn && heatAvailable, mode: heat?.mode ?? "area", min: heat?.min ?? 0, max: heat?.max ?? 0, available: heatAvailable }}
                  onHeat={setHeatOn}
                  selection={selection}
                  hover={hover}
                  onHover={setHover}
                  onSelect={setSelection}
                  onRotate={(q) => void commit(rotate(svg, q), `Vred ${q === 1 ? "90° åt höger" : "90° åt vänster"}`)}
                  backdrop={backdrop}
                  onBackdrop={setBackdrop}
                  busy={!!busy}
                />
              </div>
              <aside aria-label="Verktyg" className="flex min-h-[70svh] flex-col border-t md:min-h-0 md:w-[22rem] md:border-t-0 md:border-l lg:w-[25rem]">
                <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col gap-0">
                  <div className="border-b px-3 py-2">
                    <TabsList className="w-full">
                      <TabsTrigger value="element">Element</TabsTrigger>
                      <TabsTrigger value="minska">Minska</TabsTrigger>
                      <TabsTrigger value="farger">Färger</TabsTrigger>
                      <TabsTrigger value="kod">Kod</TabsTrigger>
                    </TabsList>
                  </div>
                  <TabsContent value="element" className="flex min-h-0 flex-col">
                    <p className="border-b px-4 py-2 text-xs text-muted-foreground">
                      {svg.nodes.length.toLocaleString("sv-SE")} element, tyngst först. Klicka för att markera, Skift lägger till.
                    </p>
                    <Tree svg={svg} selection={selection} hover={hover} onHover={setHover} onSelect={onTreeSelect} />
                  </TabsContent>
                  <TabsContent value="minska" className="svg-scroll min-h-0 overflow-y-auto">
                    <Reduce svg={svg} docKey={docKey} onCommit={commit} onGhost={setGhost} selectionCount={selection.length} onCut={cut} />
                  </TabsContent>
                  <TabsContent value="farger" className="svg-scroll min-h-0 overflow-y-auto">
                    <Colors svg={svg} onCommit={commit} />
                  </TabsContent>
                  <TabsContent value="kod" className="flex min-h-0 flex-col">
                    <Code svg={svg} onCommit={commit} onCopy={copy} onDownload={download} />
                  </TabsContent>
                </Tabs>
              </aside>
            </div>
          </>
        ) : (
          <Empty busy={busy} error={error} paste={paste} onPaste={setPaste} onOpenPaste={() => openPasted(paste)} onFile={loadFile} />
        )}
        {dragging && (
          <div className="pointer-events-none absolute inset-2 z-20 grid place-items-center rounded-2xl border-2 border-dashed border-primary bg-background/85 backdrop-blur-sm">
            <p className="flex items-center gap-2 text-lg font-medium">
              <FileUp aria-hidden="true" className="size-5 text-primary" />
              Släpp för att öppna
            </p>
          </div>
        )}
        <p role="status" className="sr-only">
          {busy ?? status}
        </p>
      </div>
    </AppShell>
  );
}

// ---------------------------------------------------------------------------
// The budget strip

interface StripProps {
  svg: SvgDoc;
  name: string;
  selection: number[];
  est: { raw: number; opt?: number | null } | null;
  ghost: Ghost | null;
  onCut: () => void;
  onRemove: () => void;
  onClear: () => void;
  undo: { label: string; run: () => void } | null;
  redo: { label: string; run: () => void } | null;
  onDownload: () => void;
  onCopy: () => void;
  copied: boolean;
  onReduce: () => void;
  busy: boolean;
}

function Strip({ svg, name, selection, est, ghost, onCut, onRemove, onClear, undo, redo, onDownload, onCopy, copied, onReduce, busy }: StripProps) {
  const selected = selection.length > 0;
  const value = selected ? est?.raw ?? null : svg.bytes;
  // A lever's saving (whole file) or the selection's optimized estimate.
  const to = selected ? (est?.opt ?? null) : ghost?.bytes ?? null;
  const max = Math.max(BUDGET * 1.25, (value ?? 0) * 1.04);
  const pct = (n: number) => `${Math.min(100, (n / max) * 100)}%`;
  const over = value != null && value > BUDGET;

  return (
    <section aria-label="Storlek mot gränsen 500 kB" className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b px-4 py-3">
      {/* Fixed width and lines: hovering a lever must never move the bar. */}
      <div className="w-64 max-w-full shrink-0">
        <p className="truncate text-xs text-muted-foreground">
          {selected ? (
            <>
              Markeringen som egen fil · {selection.length} element <span className="text-muted-foreground/80">· hela filen {formatBytes(svg.bytes)}</span>
            </>
          ) : (
            <>{name || "Hela filen"}</>
          )}
        </p>
        <p className="flex items-baseline gap-2">
          <span data-testid="svg-size" className="text-2xl leading-tight font-semibold tracking-tight tabular-nums">
            {value == null ? "…" : formatBytes(value)}
          </span>
          {selected && est?.opt != null && <span className="text-sm text-muted-foreground tabular-nums">≈ {formatBytes(est.opt)} optimerad</span>}
          {selected && est && est.opt === undefined && <LoaderCircle aria-label="Beräknar optimerad storlek" className="size-3.5 animate-spin text-muted-foreground" />}
        </p>
        {/* Kept while the selection's size is pending, so the strip never changes height. */}
        {value == null ? (
          <p className="text-xs" aria-hidden="true">
            &nbsp;
          </p>
        ) : !selected && ghost ? (
            <p className="truncate text-xs tabular-nums text-muted-foreground">
              {ghost.label} → <span className="font-medium text-foreground">{formatBytes(ghost.bytes)}</span>
            </p>
          ) : (
            <p className={cn("truncate text-xs font-medium tabular-nums", over ? "text-destructive" : "text-primary")}>
              {over ? `${formatBytes(value - BUDGET)} över gränsen` : `${formatBytes(BUDGET - value)} under gränsen`}
            </p>
          )}
      </div>

      <div className="relative min-w-[14rem] flex-1 pt-5" aria-hidden="true">
        <div className="relative h-3 overflow-hidden rounded-full bg-muted">
          {value != null && (
            <>
              <div className="absolute inset-y-0 left-0 bg-primary transition-[width] duration-300 ease-out" style={{ width: pct(Math.min(value, BUDGET)) }} />
              {over && (
                <div className="absolute inset-y-0 bg-destructive/80 transition-[width] duration-300 ease-out" style={{ left: pct(BUDGET), width: `calc(${pct(value)} - ${pct(BUDGET)})` }} />
              )}
              {to != null && to < value && (
                <div className="svg-ghost absolute inset-y-0" style={{ left: pct(to), width: `calc(${pct(value)} - ${pct(to)})` }} />
              )}
            </>
          )}
        </div>
        <div className="absolute top-3 bottom-[-4px] w-0.5 rounded-full bg-foreground" style={{ left: pct(BUDGET) }} />
        <span className="absolute top-0 -translate-x-1/2 text-[0.7rem] leading-none font-medium tabular-nums" style={{ left: pct(BUDGET) }}>
          500 kB
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-1">
        {selected ? (
          <>
            <Button size="sm" onClick={onCut} disabled={busy}>
              <Scissors data-icon="inline-start" />
              Klipp ut
            </Button>
            <Button size="sm" variant="ghost" onClick={onRemove} disabled={busy}>
              <Trash2 data-icon="inline-start" />
              Ta bort
            </Button>
            <Tip label="Avmarkera (Esc)">
              <Button size="icon-sm" variant="ghost" aria-label="Avmarkera" onClick={onClear}>
                <X />
              </Button>
            </Tip>
          </>
        ) : (
          over && (
            <Button size="sm" variant="outline" onClick={onReduce}>
              Minska…
            </Button>
          )
        )}
        {(selected || over) && <span aria-hidden="true" className="mx-1 h-5 w-px bg-border" />}
        <Tip label={undo ? `Ångra: ${undo.label}` : "Inget att ångra"}>
          <Button size="icon-sm" variant="ghost" aria-label={undo ? `Ångra: ${undo.label}` : "Ångra"} disabled={!undo || busy} onClick={undo?.run}>
            <Undo2 />
          </Button>
        </Tip>
        <Tip label={redo ? `Gör om: ${redo.label}` : "Inget att göra om"}>
          <Button size="icon-sm" variant="ghost" aria-label={redo ? `Gör om: ${redo.label}` : "Gör om"} disabled={!redo || busy} onClick={redo?.run}>
            <Redo2 />
          </Button>
        </Tip>
        <Tip label="Kopiera koden">
          <Button size="icon-sm" variant="ghost" aria-label="Kopiera koden" onClick={onCopy}>
            <Copy className={cn(copied && "text-primary")} />
          </Button>
        </Tip>
        <Button size="sm" variant="secondary" onClick={onDownload}>
          <Download data-icon="inline-start" />
          Ladda ner
        </Button>
      </div>
    </section>
  );
}

function Tip({ label, children }: { label: string; children: React.ReactElement }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

// ---------------------------------------------------------------------------
// Nothing open yet

function Empty({
  busy, error, paste, onPaste, onOpenPaste, onFile,
}: { busy: string | null; error: string | null; paste: string; onPaste: (s: string) => void; onOpenPaste: () => void; onFile: (f: File) => void }) {
  return (
    <div className="svg-scroll flex min-h-0 flex-1 overflow-y-auto">
      <div className="m-auto grid w-full max-w-3xl gap-6 p-4 md:p-8">
        <label
          data-testid="drop-zone"
          className="group flex min-h-64 cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-8 text-center transition-colors hover:border-primary/60 hover:bg-accent/40 has-focus-visible:border-ring has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
        >
          <input
            type="file"
            accept=".svg,.svgz,image/svg+xml"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
              e.target.value = "";
            }}
          />
          {busy ? (
            <LoaderCircle aria-hidden="true" className="size-9 animate-spin text-primary" />
          ) : (
            <FileUp aria-hidden="true" className="size-9 text-muted-foreground transition-colors group-hover:text-primary" />
          )}
          <span className="text-lg font-medium tracking-tight">{busy ? "Läser in…" : "Släpp en SVG här"}</span>
          <span className="text-sm text-muted-foreground">
            eller <span className="text-primary underline underline-offset-4">välj en fil</span>. .svg eller .svgz, upp till {formatBytes(MAX_BYTES)}.
          </span>
        </label>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-2">
          <label htmlFor="svg-paste" className="text-sm font-medium">
            Eller klistra in koden
          </label>
          <Textarea
            id="svg-paste"
            value={paste}
            onChange={(e) => onPaste(e.target.value)}
            spellCheck={false}
            placeholder={'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">…</svg>'}
            className="min-h-32 font-mono text-xs"
          />
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">Ctrl+V var som helst på sidan öppnar också kod eller en kopierad fil.</p>
            <Button onClick={onOpenPaste} disabled={!paste.trim() || !!busy}>
              Öppna koden
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
