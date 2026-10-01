// The canvas: the SVG as an image (fit, zoom, pan), an overlay that marks
// the hovered and selected elements, and the marquee. The heat render
// swaps in for the image while "Vikt" is on. View changes never touch the
// file; the two rotate buttons do (they're edits, undoable).
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { Flame, LoaderCircle, Maximize, Minus, Plus, RotateCcw, RotateCw } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { HEAT_MAX, formatBytes, heatColor, marquee, normalize, pickLevel, selectionBox, stepToward, type Box, type SvgDoc } from "./engine";

export type Backdrop = "checker" | "light" | "dark";

const BACKDROPS: { id: Backdrop; label: string }[] = [
  { id: "checker", label: "Rutmönster (genomskinligt)" },
  { id: "light", label: "Ljus bakgrund" },
  { id: "dark", label: "Mörk bakgrund" },
];

interface View {
  /** Screen pixels per user unit. */
  scale: number;
  /** Where the view's top-left corner sits in the stage. */
  x: number;
  y: number;
}

const TOOLBAR_SPACE = 72;
const MIN_SCALE = 0.005;
const MAX_SCALE = 256;

interface Props {
  svg: SvgDoc;
  imageUrl: string;
  heatUrl: string | null;
  heat: { on: boolean; mode: "area" | "shape"; min: number; max: number; available: boolean };
  onHeat: (on: boolean) => void;
  selection: number[];
  /** A sub-selection previewed elsewhere (a tree row hovered). */
  hover: number | null;
  onHover: (i: number | null) => void;
  onSelect: (sel: number[]) => void;
  onRotate: (quarters: number) => void;
  backdrop: Backdrop;
  onBackdrop: (b: Backdrop) => void;
  busy: boolean;
}

export function Canvas({ svg, imageUrl, heatUrl, heat, onHeat, selection, hover, onHover, onSelect, onRotate, backdrop, onBackdrop, busy }: Props) {
  const stage = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [view, setView] = useState<View>({ scale: 1, x: 0, y: 0 });
  const [drag, setDrag] = useState<{ kind: "pan" | "marquee"; sx: number; sy: number; x: number; y: number; vx: number; vy: number } | null>(null);
  const [caught, setCaught] = useState<number[]>([]);
  const space = useRef(false);
  const fitted = useRef<string>("");

  const v = svg.view;

  const fit = useCallback(() => {
    if (!size.w || !size.h) return;
    const scale = Math.min((size.w - 48) / v.w, (size.h - 48 - TOOLBAR_SPACE) / v.h);
    const s = Math.max(MIN_SCALE, scale);
    setView({ scale: s, x: (size.w - v.w * s) / 2, y: (size.h - TOOLBAR_SPACE - v.h * s) / 2 + 12 });
  }, [size.w, size.h, v.w, v.h]);

  useLayoutEffect(() => {
    const el = stage.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Refit when the drawing's window changes (new file, rotation, cut), not on other edits.
  useLayoutEffect(() => {
    const key = `${v.x} ${v.y} ${v.w} ${v.h} ${size.w > 0}`;
    if (fitted.current === key) return;
    fitted.current = key;
    fit();
  }, [v.x, v.y, v.w, v.h, size.w, fit]);

  const toUser = useCallback(
    (sx: number, sy: number) => ({ x: v.x + (sx - view.x) / view.scale, y: v.y + (sy - view.y) / view.scale }),
    [v.x, v.y, view],
  );

  const zoomAt = useCallback(
    (factor: number, sx = size.w / 2, sy = (size.h - TOOLBAR_SPACE) / 2) => {
      setView((cur) => {
        const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, cur.scale * factor));
        const k = scale / cur.scale;
        return { scale, x: sx - (sx - cur.x) * k, y: sy - (sy - cur.y) * k };
      });
    },
    [size.w, size.h],
  );

  // Wheel zooms at the pointer (non-passive, so the page doesn't scroll).
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      zoomAt(Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0015)), e.clientX - r.left, e.clientY - r.top);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space" && !isTyping(e.target)) {
        space.current = true;
        if (e.target === stage.current) e.preventDefault();
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") space.current = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  const local = (e: ReactPointerEvent) => {
    const r = stage.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const marqueeBox = (d: NonNullable<typeof drag>): Box => {
    const a = toUser(Math.min(d.sx, d.x), Math.min(d.sy, d.y));
    const b = toUser(Math.max(d.sx, d.x), Math.max(d.sy, d.y));
    return { x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y };
  };

  const hoverFrame = useRef(0);
  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (e.button !== 0 && e.button !== 1) return;
    // Focus for the zoom keys, without the keyboard focus ring.
    stage.current?.focus({ preventScroll: true, focusVisible: false } as FocusOptions);
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = local(e);
    // On touch a drag pans; a tap still selects.
    const kind = e.button === 1 || space.current || e.pointerType === "touch" ? "pan" : "marquee";
    setDrag({ kind, sx: p.x, sy: p.y, x: p.x, y: p.y, vx: view.x, vy: view.y });
    if (kind === "pan") e.preventDefault();
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const p = local(e);
    if (drag) {
      const next = { ...drag, x: p.x, y: p.y };
      setDrag(next);
      if (drag.kind === "pan") setView((cur) => ({ ...cur, x: drag.vx + p.x - drag.sx, y: drag.vy + p.y - drag.sy }));
      else if (moved(next)) {
        cancelAnimationFrame(hoverFrame.current);
        hoverFrame.current = requestAnimationFrame(() => setCaught(marquee(svg, marqueeBox(next))));
      }
      return;
    }
    cancelAnimationFrame(hoverFrame.current);
    hoverFrame.current = requestAnimationFrame(() => {
      const u = toUser(p.x, p.y);
      const leaf = svg.hit(u.x, u.y);
      onHover(leaf < 0 ? null : levelFor(leaf));
    });
  }

  /** What a click on a shape selects: inside the current group, one level down; else the figure. */
  function levelFor(leaf: number): number {
    if (selection.length === 1 && isAncestor(svg, selection[0], leaf) && selection[0] !== leaf) {
      // Stay on the selected group; a double-click goes in.
      return selection[0];
    }
    return pickLevel(svg, leaf);
  }

  function onPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    const d = drag;
    setDrag(null);
    setCaught([]);
    if (!d || (d.kind === "pan" && (moved(d) || e.pointerType !== "touch"))) return;
    if (!moved(d)) {
      const u = toUser(d.sx, d.sy);
      const leaf = svg.hit(u.x, u.y);
      if (leaf < 0) {
        if (!e.shiftKey) onSelect([]);
        return;
      }
      const pick = levelFor(leaf);
      if (e.shiftKey) {
        onSelect(selection.includes(pick) ? selection.filter((s) => s !== pick) : normalize(svg, [...selection, pick]));
      } else onSelect([pick]);
      return;
    }
    const got = marquee(svg, marqueeBox(d));
    onSelect(e.shiftKey ? normalize(svg, [...selection, ...got]) : got);
  }

  function onDoubleClick(e: React.MouseEvent<HTMLDivElement>) {
    const r = stage.current!.getBoundingClientRect();
    const u = toUser(e.clientX - r.left, e.clientY - r.top);
    const leaf = svg.hit(u.x, u.y);
    if (leaf < 0 || selection.length !== 1) return;
    const from = selection[0];
    if (from !== leaf && isAncestor(svg, from, leaf)) onSelect([stepToward(svg, from, leaf)]);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "+" || e.key === "=") zoomAt(1.25);
    else if (e.key === "-") zoomAt(0.8);
    else if (e.key === "0") fit();
    else if (e.key === "1") zoomAt(1 / view.scale);
    else return;
    e.preventDefault();
  }

  const box = { left: view.x, top: view.y, width: v.w * view.scale, height: v.h * view.scale };
  const marked = drag?.kind === "marquee" && moved(drag) ? caught : selection;
  const union = marked.length > 1 ? selectionBox(svg, marked) : null;
  const many = marked.length > 40;
  const tagBox = marked.length ? selectionBox(svg, marked) : null;
  const zoomPct = Math.round(view.scale * 100);

  return (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
      <div
        ref={stage}
        tabIndex={0}
        role="application"
        aria-label="Ritytan. Klicka för att markera, dra en ruta runt det som ska markeras, Skift lägger till. Hjul zoomar, mellanslag och dra panorerar."
        aria-roledescription="rityta"
        data-testid="svg-stage"
        className={cn(
          "svg-stage relative min-h-0 flex-1 touch-none overflow-hidden outline-none select-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-inset",
          `svg-stage-${backdrop}`,
          drag?.kind === "pan" ? "cursor-grabbing" : space.current ? "cursor-grab" : "cursor-crosshair",
        )}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          setDrag(null);
          setCaught([]);
        }}
        onPointerLeave={() => !drag && onHover(null)}
        onDoubleClick={onDoubleClick}
        onKeyDown={onKeyDown}
      >
        <img
          src={heat.on && heatUrl ? heatUrl : imageUrl}
          alt=""
          draggable={false}
          className={cn("pointer-events-none absolute max-w-none", busy && "opacity-40 transition-opacity")}
          style={box}
        />
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute overflow-visible"
          style={box}
          viewBox={`${v.x} ${v.y} ${v.w} ${v.h}`}
          preserveAspectRatio="none"
        >
          <rect x={v.x} y={v.y} width={v.w} height={v.h} className="svg-frame" vectorEffect="non-scaling-stroke" />
          {/* Many marks read as a mesh; past a few dozen only the outline shows. */}
          {(marked.length <= 40 ? marked : []).map((i) => {
            const b = svg.nodes[i].box;
            return b ? <rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} className="svg-sel" vectorEffect="non-scaling-stroke" /> : null;
          })}
          {union && <rect x={union.x} y={union.y} width={union.w} height={union.h} className={many ? "svg-sel" : "svg-union"} vectorEffect="non-scaling-stroke" />}
          {hover != null && !drag && svg.nodes[hover]?.box && !selection.includes(hover) && (
            <rect {...rectOf(svg.nodes[hover].box!)} className="svg-hover" vectorEffect="non-scaling-stroke" />
          )}
        </svg>
        {tagBox && drag?.kind !== "pan" && (
          <span
            className="pointer-events-none absolute rounded-md bg-primary px-1.5 py-0.5 text-xs font-medium whitespace-nowrap text-primary-foreground tabular-nums shadow-sm"
            style={{
              left: Math.max(4, view.x + (tagBox.x - v.x) * view.scale),
              top: Math.max(4, view.y + (tagBox.y - v.y) * view.scale - 24),
            }}
          >
            {marked.length === 1 ? svg.nodes[marked[0]].label || `<${svg.nodes[marked[0]].tag}>` : `${marked.length} element`}
          </span>
        )}
        {drag?.kind === "marquee" && moved(drag) && (
          <div
            className="pointer-events-none absolute rounded-xs border border-primary bg-primary/10"
            style={{ left: Math.min(drag.sx, drag.x), top: Math.min(drag.sy, drag.y), width: Math.abs(drag.x - drag.sx), height: Math.abs(drag.y - drag.sy) }}
          />
        )}
        {heat.on && <HeatLegend mode={heat.mode} min={heat.min} max={heat.max} />}
        {busy && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <LoaderCircle aria-hidden="true" className="size-6 animate-spin text-primary" />
          </div>
        )}
      </div>

      <div
        role="toolbar"
        aria-label="Visning"
        className="absolute bottom-4 left-1/2 flex max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-0.5 overflow-x-auto rounded-xl border bg-popover/95 p-1 shadow-lg shadow-foreground/5 backdrop-blur-sm"
      >
        <Tip label="Anpassa till ytan (0)">
          <Button variant="ghost" size="icon-sm" onClick={fit} aria-label="Anpassa till ytan">
            <Maximize />
          </Button>
        </Tip>
        <Tip label="Zooma ut (−)">
          <Button variant="ghost" size="icon-sm" onClick={() => zoomAt(0.8)} aria-label="Zooma ut">
            <Minus />
          </Button>
        </Tip>
        <Tip label="Visa i 100 % (1)">
          <Button variant="ghost" size="sm" className="w-14 tabular-nums" onClick={() => zoomAt(1 / view.scale)} aria-label={`Zoom ${zoomPct} procent. Visa i 100 procent`}>
            {zoomPct < 1 ? "<1" : zoomPct} %
          </Button>
        </Tip>
        <Tip label="Zooma in (+)">
          <Button variant="ghost" size="icon-sm" onClick={() => zoomAt(1.25)} aria-label="Zooma in">
            <Plus />
          </Button>
        </Tip>
        <Divider />
        <Tip label="Vrid 90° åt vänster (ändrar filen)">
          <Button variant="ghost" size="icon-sm" onClick={() => onRotate(3)} aria-label="Vrid 90 grader åt vänster" disabled={busy}>
            <RotateCcw />
          </Button>
        </Tip>
        <Tip label="Vrid 90° åt höger (ändrar filen)">
          <Button variant="ghost" size="icon-sm" onClick={() => onRotate(1)} aria-label="Vrid 90 grader åt höger" disabled={busy}>
            <RotateCw />
          </Button>
        </Tip>
        <Divider />
        <Tip label={heat.available ? "Färga varje form efter hur många byte den väger" : `Av: fler än ${HEAT_MAX.toLocaleString("sv-SE")} former`}>
          <Button
            variant="ghost"
            size="sm"
            aria-pressed={heat.on}
            disabled={!heat.available}
            onClick={() => onHeat(!heat.on)}
            className={cn("gap-1.5", heat.on && "bg-accent text-accent-foreground hover:bg-accent")}
          >
            <Flame />
            <span className="max-sm:sr-only">Vikt</span>
          </Button>
        </Tip>
        <Divider />
        <Tip label="Byt bakgrund">
          <button
            type="button"
            aria-label={`Bakgrund: ${BACKDROPS.find((b) => b.id === backdrop)!.label}. Byt`}
            onClick={() => onBackdrop(BACKDROPS[(BACKDROPS.findIndex((b) => b.id === backdrop) + 1) % BACKDROPS.length].id)}
            className={`svg-swatch svg-swatch-${backdrop} mx-1 size-5 shrink-0 rounded-full ring-1 ring-foreground/20 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:hidden`}
          />
        </Tip>
        <div role="radiogroup" aria-label="Bakgrund" className="flex items-center gap-1 px-1 max-sm:hidden">
          {BACKDROPS.map((b) => (
            <Tip key={b.id} label={b.label}>
              <button
                type="button"
                role="radio"
                aria-checked={backdrop === b.id}
                aria-label={b.label}
                onClick={() => onBackdrop(b.id)}
                className={cn(
                  `svg-swatch svg-swatch-${b.id} size-5 rounded-full ring-1 ring-foreground/20 outline-none transition-shadow focus-visible:ring-3 focus-visible:ring-ring/50`,
                  backdrop === b.id && "ring-2 ring-primary ring-offset-2 ring-offset-popover",
                )}
              />
            </Tip>
          ))}
        </div>
      </div>
    </div>
  );
}

function HeatLegend({ mode, min, max }: { mode: "area" | "shape"; min: number; max: number }) {
  const stops = [0, 0.25, 0.5, 0.75, 1].map((t) => `${heatColor(t)} ${t * 100}%`).join(", ");
  return (
    <div className="pointer-events-none absolute top-3 left-3 rounded-lg border bg-popover/95 px-3 py-2 text-xs shadow-sm backdrop-blur-sm">
      <p className="mb-1.5 font-medium">{mode === "area" ? "Vikt per yta" : "Vikt per form i markeringen"}</p>
      <div className="h-2 w-44 rounded-full" style={{ backgroundImage: `linear-gradient(to right, ${stops})` }} />
      <div className="mt-1 flex justify-between text-muted-foreground tabular-nums">
        {mode === "area" ? (
          <>
            <span>Lätt</span>
            <span>Tungt för sin storlek</span>
          </>
        ) : (
          <>
            <span>{formatBytes(min)}</span>
            <span>{formatBytes(max)}</span>
          </>
        )}
      </div>
    </div>
  );
}

function Tip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}

const Divider = () => <span aria-hidden="true" className="mx-1 h-5 w-px shrink-0 bg-border" />;

const moved = (d: { sx: number; sy: number; x: number; y: number }) => Math.abs(d.x - d.sx) + Math.abs(d.y - d.sy) > 4;

const rectOf = (b: Box) => ({ x: b.x, y: b.y, width: b.w, height: b.h });

function isAncestor(svg: SvgDoc, a: number, i: number) {
  for (let p = i; p >= 0; p = svg.nodes[p].parent) if (p === a) return true;
  return false;
}

export function isTyping(t: EventTarget | null) {
  return t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
}
