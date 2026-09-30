// Landing prototype B, "Solfjädern": the mark and name side by side at the
// top, a flat-bottomed bowl hanging under them, and the tools fanned out
// around it, each tied to the bowl by a spoke. The bowl traces in from both ends on load,
// spokes draw outwards, then the cards come in; hovering or focusing a card
// fills its spoke with teal from the bowl out to it. Below xl the fan becomes a
// grid. A variant of A (LandingA.tsx); see landing-prototype.md.
import "./all-live";
import "./landing-b.css";
import { useLayoutEffect, useMemo, useRef, useState, type ComponentType, type CSSProperties, type SVGProps } from "react";
import { ArrowUpRight, FileCode } from "lucide-react";
import { AppShell } from "@/app/AppShell";
import { BrandMark } from "@/app/BrandMark";
import { mount } from "@/app/mount";
import { tools } from "@/tools/registry";

const CSP = [
  ["connect-src 'none'", "inga anrop ut, inte ens till den egna servern"],
  ["default-src 'self'", "skript, typsnitt och stilar bara härifrån"],
  ["form-action 'none'", "inga formulär som skickar något"],
  ["object-src 'none'", "inga inbäddade insticksprogram"],
] as const;

const REPO = "https://github.com/day4125/sidebench";

/**
 * Geometry, px from the fan's centre (the top middle of the bowl; the logo
 * sits DROP below it).
 * BX/BY: the drawn bowl's half width and depth. It's the bottom half of a
 * blown-up logo tile: straight sides, flat floor, and corners rounded at
 * the tile's own radius-to-size ratio (TILE_R / TILE), taken against the
 * blown-up tile's shorter side (its full height, 2 × BY).
 * RX/RY: the half ellipse the card centres sit on;
 * deeper than wide, because side cards stack vertically (cheap) while the
 * two at the bottom sit side by side (costly). ROWS: the card rows' depths
 * below the centre, top to bottom, in even steps so the gaps between rows
 * match; each row's x comes from the ellipse (plus OUT), mirrored for the
 * left. 2 × (RX + OUT[0] + W/2) must fit the content width at xl.
 */
const BX = 232;
const BY = 140;
/** The logo tile's size and corner radius, px; the bowl's corners follow them. */
const TILE = 64;
const TILE_R = 16;
const BR = (2 * Math.min(BX, BY) * TILE_R) / TILE;
const RX = 362;
const RY = 452;
const W = 236;
const ROWS = [32, 162, 293, 423];
/**
 * Extra push outwards per row, off the ellipse: the upper two rows sit wider.
 * OUT always applies; OUT_WIDE is what they reach when the fan has the room
 * (wide screens, or the sidebar closed). In between, they go as far as fits.
 */
const OUT = [40, 0, 0, 0];
const OUT_WIDE = [100, 60, 0, 0];
/** A card's usual height, for where spokes meet it. */
const CARD_H = 88;
/** Distance from the container's top to the fan's centre. */
const TOP = 32;
/** How far the logo sits below the fan's centre, down inside the bowl. */
const DROP = 50;

interface Item {
  key: string;
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  name: string;
  line: string;
  external?: boolean;
}

const ITEMS: Item[] = [
  ...tools.map((t) => ({ key: t.slug, href: t.href ?? "#", icon: t.icon, name: t.name, line: t.tagline })),
  { key: "code", href: REPO, icon: FileCode, name: "Koden är öppen", line: "Se efter själv att inget skickas iväg", external: true },
];

/** The bowl's point in direction `a` (radians, 0 = right, π/2 = down). */
function bowl(a: number) {
  const c = Math.cos(a);
  const s = Math.sin(a);
  const ax = Math.abs(c);
  // Hit the side or the floor, whichever comes first…
  let r = Math.min(BX / (ax || 1e-9), BY / (s || 1e-9));
  // …unless that's in a corner, where the ray meets the corner's arc instead.
  const cx = BX - BR;
  const cy = BY - BR;
  if (r * ax > cx && r * s > cy) {
    const b = ax * cx + s * cy;
    r = b + Math.sqrt(b * b - (cx * cx + cy * cy - BR * BR));
  }
  return { x: r * c, y: r * s };
}

/** The bowl as a path from direction `from` to `to`, sampled finely. */
function bowlPath(from: number, to: number) {
  const n = 120;
  return Array.from({ length: n + 1 }, (_, i) => {
    const p = bowl(from + ((to - from) * i) / n);
    return `${i ? "L" : "M"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
  }).join(" ");
}

/** Each row's x on the right, on the ellipse, before any push outwards. */
const BASE_X = ROWS.map((y) => Math.round(RX * Math.sqrt(1 - (y / RY) ** 2)));

/**
 * Each card's centre, left end to right end through the bottom, and where its
 * spoke leaves the bowl. `spread` (0–1) is how far along from OUT to OUT_WIDE
 * the rows are pushed.
 */
function layout(spread: number) {
  const rowX = BASE_X.map((x, r) => x + OUT[r] + spread * (OUT_WIDE[r] - OUT[r]));
  return [
    ...ROWS.map((y, r) => ({ x: -rowX[r], y })),
    ...ROWS.map((y, r) => ({ x: rowX[r], y })).reverse(),
  ].map(({ x, y }) => {
    const b = bowl(Math.atan2(y, x));
    // Where the spoke meets the card's box (taken as W × CARD_H), so it ends
    // at the edge rather than running on under the card; a fill would seem
    // to stall behind it otherwise.
    const dx = x - b.x;
    const dy = y - b.y;
    const t = 1 - Math.min(W / 2 / Math.abs(dx || 1e-9), CARD_H / 2 / Math.abs(dy || 1e-9), 1);
    return { x, y, ax: b.x, ay: b.y, ex: b.x + dx * t, ey: b.y + dy * t };
  });
}

/** How far the fan can spread in a container this wide: the widest row's cards stop at its edges. */
function spreadFor(width: number) {
  const room = width / 2 - W / 2 - (BASE_X[0] + OUT[0]);
  return Math.max(0, Math.min(1, room / (OUT_WIDE[0] - OUT[0])));
}

/** Load order: the bottom pair first, then outwards to the ends. */
const RANK = layout(0).map((_, i, all) => Math.floor(Math.abs(i - (all.length - 1) / 2)));

const HEIGHT = TOP + ROWS[ROWS.length - 1] + 80;

function Landing() {
  // Which spoke is lit.
  const [lit, setLit] = useState<number | null>(null);

  // The fan's width decides how far its upper rows spread.
  const fan = useRef<HTMLDivElement>(null);
  const [spread, setSpread] = useState(0);
  useLayoutEffect(() => {
    const el = fan.current;
    if (!el) return;
    const measure = () => setSpread(spreadFor(el.clientWidth));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const POINTS = useMemo(() => layout(spread), [spread]);

  return (
    <AppShell>
      <div className="py-4 md:py-8">
        {/* Fan, xl and up. Full width (no max-w), so wide screens let it spread. */}
        <div ref={fan} className="relative hidden xl:block" style={{ height: HEIGHT }}>
          {/* 1 px, not 0: Chromium skips drawing a zero-size SVG even with overflow visible. */}
          <svg
            aria-hidden="true"
            width="1"
            height="1"
            className="absolute left-1/2 overflow-visible"
            style={{ top: TOP }}
          >
            <defs>
              <mask id="fan-mask" maskUnits="userSpaceOnUse" x={-BX - 20} y={-20} width={2 * BX + 40} height={BY + 40}>
                <path d={bowlPath(Math.PI, Math.PI / 2)} pathLength={1} className="fan-reveal fill-none stroke-white" strokeWidth={12} />
                <path d={bowlPath(0, Math.PI / 2)} pathLength={1} className="fan-reveal fill-none stroke-white" strokeWidth={12} />
              </mask>
            </defs>

            <g mask="url(#fan-mask)">
              <path
                d={bowlPath(Math.PI, 0)}
                className="fan-arc fill-none stroke-foreground/30"
                strokeWidth={1.5}
                strokeDasharray="2 10"
                strokeLinecap="round"
              />
            </g>

            {POINTS.map((p, i) => (
              <g key={i}>
                <line
                  x1={p.ax}
                  y1={p.ay}
                  x2={p.ex}
                  y2={p.ey}
                  pathLength={1}
                  className="fan-spoke stroke-foreground/15"
                  strokeWidth={1.25}
                  style={{ animationDelay: `${600 + RANK[i] * 90}ms` }}
                />
                {/* The fill: teal drawn from the bowl out to the card while lit,
                    drained back to the bowl when not. */}
                <line
                  x1={p.ax}
                  y1={p.ay}
                  x2={p.ex}
                  y2={p.ey}
                  pathLength={1}
                  className={`fan-fill stroke-primary ${lit === i ? "is-lit" : ""}`}
                  strokeWidth={2}
                  strokeLinecap="round"
                />
                <circle
                  cx={p.ax}
                  cy={p.ay}
                  r={lit === i ? 5 : 4}
                  className={`transition-[r,fill] duration-300 ${lit === i ? "fill-primary" : "fill-foreground/30"}`}
                />
              </g>
            ))}
          </svg>

          <Hub className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2" style={{ top: TOP + DROP }} />

          <ul>
            {POINTS.map((p, i) => (
              <li
                key={ITEMS[i].key}
                className="fan-card absolute"
                style={{
                  width: W,
                  left: `calc(50% + ${p.x - W / 2}px)`,
                  top: TOP + p.y,
                  translate: "0 -50%",
                  animationDelay: `${850 + RANK[i] * 90}ms`,
                }}
              >
                <Card item={ITEMS[i]} onLit={(on) => setLit(on ? i : null)} />
              </li>
            ))}
          </ul>
        </div>

        {/* Grid below xl. */}
        <div className="mx-auto max-w-6xl xl:hidden">
          <div className="flex flex-col items-center py-6 text-center md:py-10">
            <Hub />
          </div>
          <ul className="mt-6 grid gap-3 md:grid-cols-2">
            {ITEMS.map((item) => (
              <li key={item.key}>
                <Card item={item} />
              </li>
            ))}
          </ul>
        </div>

        <section aria-labelledby="proof-h" className="mx-auto mt-16 max-w-xl text-center">
          <h2 id="proof-h" className="font-semibold tracking-tight">
            Materialet lämnar aldrig datorn
          </h2>
          <p className="mt-1.5 text-sm text-pretty text-muted-foreground">
            Varje sida bär en säkerhetspolicy som webbläsaren håller. Ett verktyg som försökte skicka något
            skulle stoppas där.
          </p>
          <dl className="mt-4 overflow-hidden rounded-xl border bg-card text-left font-mono text-[0.8125rem]">
            {CSP.map(([rule, meaning]) => (
              <div key={rule} className="grid gap-0.5 border-b px-4 py-2.5 last:border-b-0 sm:grid-cols-[11.5rem_1fr] sm:gap-3">
                <dt className="text-primary">{rule}</dt>
                <dd className="font-sans text-muted-foreground">{meaning}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </AppShell>
  );
}

/** The logo: mark tile left of the name, one line. */
function Hub({ className = "", style }: { className?: string; style?: CSSProperties }) {
  return (
    <div className={`flex items-center gap-4 ${className}`} style={style}>
      <span
        style={{ width: TILE, height: TILE, borderRadius: TILE_R }}
        className="flex shrink-0 items-center justify-center bg-primary text-primary-foreground">
        <BrandMark className="size-10" />
      </span>
      <h1 className="text-6xl font-semibold tracking-[-0.04em]">sidebench</h1>
    </div>
  );
}

function Card({ item, onLit }: { item: Item; onLit?: (on: boolean) => void }) {
  const Icon = item.icon;
  return (
    <a
      href={item.href}
      onMouseEnter={() => onLit?.(true)}
      onMouseLeave={() => onLit?.(false)}
      onFocus={() => onLit?.(true)}
      onBlur={() => onLit?.(false)}
      className="group flex min-h-22 items-center gap-3 rounded-2xl border bg-card px-4 py-3 transition-[border-color,box-shadow,translate] duration-200 hover:-translate-y-0.5 hover:border-primary/60 focus-visible:border-primary/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
        <Icon aria-hidden="true" className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1 font-semibold tracking-tight group-hover:text-primary">
          {item.name}
          {item.external && <ArrowUpRight aria-hidden="true" className="size-3.5 text-muted-foreground" />}
        </span>
        <span className="block text-xs text-pretty text-muted-foreground">{item.line}</span>
      </span>
    </a>
  );
}

mount(<Landing />);
