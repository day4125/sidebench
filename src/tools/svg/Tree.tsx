// The element tree, heaviest first at every level, with each element's
// bytes and its share of the file. Virtualized: a book collage can hold
// 30 000 elements. Hovering a row lights the element on the canvas;
// clicking selects it (Skift adds).
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "cn";
import { formatBytes, type SvgDoc } from "./engine";

const ROW = 28;

interface Props {
  svg: SvgDoc;
  selection: number[];
  hover: number | null;
  onHover: (i: number | null) => void;
  onSelect: (i: number, add: boolean) => void;
}

/** Root and every single-child wrapper below it start open. */
function initialOpen(svg: SvgDoc): Set<number> {
  const open = new Set<number>([0]);
  let i = 0;
  for (;;) {
    const drawn = svg.nodes[i].children.filter((c) => svg.nodes[c].rendered);
    if (drawn.length !== 1 || svg.nodes[drawn[0]].leaf) break;
    i = drawn[0];
    open.add(i);
  }
  return open;
}

export function Tree({ svg, selection, hover, onHover, onSelect }: Props) {
  const [open, setOpen] = useState(() => initialOpen(svg));
  const [scroll, setScroll] = useState(0);
  const [height, setHeight] = useState(400);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => setOpen(initialOpen(svg)), [svg]);

  // Children sorted by weight, computed once per document.
  const sorted = useMemo(() => svg.nodes.map((n) => [...n.children].sort((a, b) => svg.nodes[b].bytes - svg.nodes[a].bytes)), [svg]);

  const rows = useMemo(() => {
    const out: number[] = [];
    const visit = (i: number) => {
      out.push(i);
      if (open.has(i)) for (const c of sorted[i]) visit(c);
    };
    visit(0);
    return out;
  }, [open, sorted]);

  // A selection made on the canvas opens its ancestors and scrolls to it.
  useEffect(() => {
    if (!selection.length) return;
    const first = selection[0];
    const need: number[] = [];
    for (let p = svg.nodes[first].parent; p >= 0; p = svg.nodes[p].parent) if (!open.has(p)) need.push(p);
    if (need.length) setOpen((o) => new Set([...o, ...need]));
  }, [selection, svg]);

  useEffect(() => {
    if (!selection.length || !box.current) return;
    const at = rows.indexOf(selection[0]);
    if (at < 0) return;
    const top = at * ROW;
    const el = box.current;
    if (top < el.scrollTop || top + ROW > el.scrollTop + el.clientHeight) el.scrollTop = Math.max(0, top - el.clientHeight / 3);
  }, [selection, rows]);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setHeight(e.contentRect.height));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const total = svg.nodes[0].bytes || 1;
  const first = Math.max(0, Math.floor(scroll / ROW) - 8);
  const last = Math.min(rows.length, Math.ceil((scroll + height) / ROW) + 8);
  const selected = new Set(selection);

  const toggle = (i: number) =>
    setOpen((o) => {
      const n = new Set(o);
      if (n.has(i)) n.delete(i);
      else n.add(i);
      return n;
    });

  return (
    <div
      ref={box}
      className="svg-scroll relative min-h-0 flex-1 overflow-auto"
      onScroll={(e) => setScroll(e.currentTarget.scrollTop)}
      onPointerLeave={() => onHover(null)}
    >
      <ul aria-label="Element, tyngst först" className="relative" style={{ height: rows.length * ROW }}>
        {rows.slice(first, last).map((i, k) => {
          const n = svg.nodes[i];
          const kids = n.children.length > 0;
          const isOpen = open.has(i);
          const pick = n.rendered && n.box && i > 0;
          const share = n.bytes / total;
          const on = selected.has(i);
          return (
            <li
              key={i}
              className={cn(
                "absolute inset-x-0 flex items-center gap-1 pr-2 text-sm",
                on ? "bg-accent text-accent-foreground" : hover === i && "bg-muted",
              )}
              style={{ top: (first + k) * ROW, height: ROW, paddingLeft: 4 + Math.min(n.depth, 14) * 12 }}
              onPointerEnter={() => onHover(pick ? i : null)}
            >
              <button
                type="button"
                tabIndex={kids ? 0 : -1}
                aria-label={kids ? `${isOpen ? "Fäll ihop" : "Fäll ut"} <${n.tag}>` : undefined}
                aria-expanded={kids ? isOpen : undefined}
                disabled={!kids}
                onClick={() => toggle(i)}
                className="grid size-5 shrink-0 place-items-center rounded-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 disabled:opacity-0"
              >
                <ChevronRight aria-hidden="true" className={cn("size-3.5 transition-transform", isOpen && "rotate-90")} />
              </button>
              <button
                type="button"
                aria-pressed={pick ? on : undefined}
                onClick={(e) => (pick ? onSelect(i, e.shiftKey) : kids && toggle(i))}
                className={cn(
                  "flex h-full min-w-0 flex-1 items-center gap-2 rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-inset",
                  !n.rendered && "text-muted-foreground",
                )}
              >
                <span className="shrink-0 font-mono text-xs">{n.tag}</span>
                <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{rowLabel(n.el, n.label, n.tag)}</span>
                <span className="shrink-0 text-xs tabular-nums">{formatBytes(n.bytes)}</span>
                <span aria-hidden="true" className="h-1 w-10 shrink-0 overflow-hidden rounded-full bg-muted">
                  <span className="block h-full rounded-full bg-primary/70" style={{ width: `${Math.max(share * 100, share > 0 ? 3 : 0)}%` }} />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function rowLabel(el: Element, label: string, tag: string): string {
  if (label) return label;
  if (tag === "text") return (el.textContent ?? "").trim().slice(0, 40);
  return "";
}
