// The start page, "Solfjädern": the mark and name side by side at the top,
// a flat-bottomed bowl hanging under them, and the tools fanned out around
// it, each tied to the bowl by a spoke. The bowl traces in from both ends on
// load, spokes draw outwards, then the cards come in; hovering or focusing a
// card fills its spoke with teal from the bowl out to it. Tools not built yet
// show dimmed and unlinked. Below xl the fan becomes a grid. Behind the fan,
// echoes of the bowl ripple outwards and, in dark mode, a starry sky with a
// crescent moon sits behind them; all of it leans towards whichever card is
// lit. See landing-prototype.md for how it came about.
import "./landing.css";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentType, type CSSProperties, type SVGProps } from "react";
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

/**
 * The echoes: whole tiles at the bowl's proportions and corner ratio, scaled
 * up from it, inner to outer. Each is a depth layer; when a card is lit they
 * all shift towards it, the outer (nearer) ones further, up to ECHO_SHIFT px.
 */
const ECHOES = [1.45, 1.95, 2.5, 3.1, 3.75];
const ECHO_SHIFT = 45;

/**
 * The glow around the lit card: stars within DOT_GLOW px of it turn teal.
 * DOT_AREA is the area the sky's masks cover, px from the fan's centre; wider
 * than any field, plus room to lean.
 */
const DOT_GLOW = 200;
const DOT_AREA = { x: -1200, y: -150, width: 2400, height: 900 };

/**
 * The starry sky, dark mode only: one star per STAR_CELL cell at most, jittered inside it, so they
 * spread evenly without lining up. Seeded, so it's the same sky every load.
 * Each star sits in one of three depth layers (far ones smaller, fainter,
 * leaning less); a few are bright, and a quarter twinkle, flaring teal on
 * their own slow cycles.
 */
const STAR_CELL = 44;
/** The share of stars that twinkle. */
const TWINKLE_SHARE = 0.25;
/** The sky's width, px, centred on the fan. */
const STAR_SPAN = 2000;
const STAR_LAYERS = [
  { r: [0.5, 0.9], o: 0.16, depth: 0.3 },
  { r: [0.8, 1.3], o: 0.22, depth: 0.6 },
  { r: [1.1, 1.8], o: 0.3, depth: 1 },
];

interface Star {
  x: number;
  y: number;
  layer: number;
  r: number;
  o: number;
  twinkle?: { dur: number; delay: number };
}

/** A small seeded random number generator (mulberry32), 0–1. */
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const STARS: Star[] = (() => {
  const rand = seeded(7);
  const stars: Star[] = [];
  for (let y = -80; y < 620; y += STAR_CELL) {
    for (let x = -STAR_SPAN / 2; x < STAR_SPAN / 2; x += STAR_CELL) {
      if (rand() > 0.55) continue;
      const layer = rand() < 0.45 ? 0 : rand() < 0.6 ? 1 : 2;
      const L = STAR_LAYERS[layer];
      const bright = rand() < 0.04;
      const dur = 4 + rand() * 7;
      stars.push({
        x: Math.round(x + rand() * STAR_CELL),
        y: Math.round(y + rand() * STAR_CELL),
        layer,
        r: +((L.r[0] + rand() * (L.r[1] - L.r[0])) * (bright ? 1.5 : 1)).toFixed(2),
        o: bright ? 0.55 : L.o,
        twinkle: rand() < TWINKLE_SHARE ? { dur, delay: -rand() * dur } : undefined,
      });
    }
  }
  return stars;
})();

/**
 * The moon, dark mode only: a crescent in the gap under the bowl, between
 * the two bottom spokes and a little left of the middle. Centre (x, y) px
 * from the fan's centre, disc radius r. It leans with the sky, depth ×
 * ECHO_SHIFT px.
 */
const MOON = { x: -32, y: 236, r: 30, depth: 0.55 };

/** Whether a point is behind the moon (with room for the stars' lean), where no twinkle should flare. */
function behindMoon(x: number, y: number) {
  return Math.hypot(x - MOON.x, y - MOON.y) < MOON.r + 40;
}

/** Whether a point is in the bowl or the space above it, where no stars show. */
function inBowl(x: number, y: number) {
  const ax = Math.abs(x);
  if (ax > BX || y > BY) return false;
  if (y <= 0) return true;
  const cx = BX - BR;
  const cy = BY - BR;
  return ax <= cx || y <= cy || Math.hypot(ax - cx, y - cy) <= BR;
}

/** The twinkling stars, drawn apart from the rest; none inside the bowl, as its mask doesn't reach them, or behind the moon. */
const TWINKLES = STARS.filter((st) => st.twinkle && !inBowl(st.x, st.y) && !behindMoon(st.x, st.y));

/** The stars are the far field, behind the echoes, and lean less. */
const DOT_DEPTH = 0.6;

/** A rounded rectangle centred on the fan's centre, `k` times the bowl's size. */
function echoPath(k: number) {
  const x = BX * k;
  const y = BY * k;
  const r = BR * k;
  return `M ${-x + r} ${-y} H ${x - r} A ${r} ${r} 0 0 1 ${x} ${-y + r} V ${y - r} A ${r} ${r} 0 0 1 ${x - r} ${y} H ${-x + r} A ${r} ${r} 0 0 1 ${-x} ${y - r} V ${-y + r} A ${r} ${r} 0 0 1 ${-x + r} ${-y} Z`;
}

interface Item {
  key: string;
  /** Null for a tool not built yet, which shows dimmed and unlinked. */
  href: string | null;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  name: string;
  line: string;
  external?: boolean;
}

const ITEMS: Item[] = [
  ...tools.map((t) => ({
    key: t.slug,
    href: t.status === "live" ? t.href : null,
    icon: t.icon,
    name: t.name,
    line: t.tagline,
  })),
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
  const [width, setWidth] = useState(0);
  const spread = spreadFor(width);
  useLayoutEffect(() => {
    const el = fan.current;
    if (!el) return;
    const measure = () => setWidth(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const POINTS = useMemo(() => layout(spread), [spread]);

  // Where the stars' glow sits: the lit card, or the last one lit while it fades out.
  const glowAt = useRef({ x: 0, y: 0 });
  if (lit !== null) glowAt.current = POINTS[lit];

  // The lit card's direction from the fan's centre, as a unit vector; the
  // echoes and stars lean along it.
  const lean = useMemo(() => {
    if (lit === null) return { x: 0, y: 0 };
    const { x, y } = POINTS[lit];
    const d = Math.hypot(x, y) || 1;
    return { x: x / d, y: y / d };
  }, [lit, POINTS]);

  return (
    <AppShell>
      <div className="py-4 md:py-8">
        <h2 className="sr-only">Verktyg</h2>
        {/* Fan, xl and up. Full width (no max-w), so wide screens let it spread. */}
        <div ref={fan} className="relative hidden xl:block" style={{ height: HEIGHT }}>
          {/* The echoes and stars, clipped to a field a little taller than the fan and faded out at its edges. */}
          <div aria-hidden="true" className="fan-field pointer-events-none absolute inset-x-0 -top-8 -bottom-16 overflow-hidden">
            <svg width="1" height="1" className="absolute left-1/2 overflow-visible" style={{ top: TOP + 32 }}>
              <defs>
                <radialGradient id="fan-dots-fade" gradientUnits="userSpaceOnUse" cx={glowAt.current.x} cy={glowAt.current.y} r={DOT_GLOW}>
                  <stop offset="0" stopColor="#fff" />
                  <stop offset="1" stopColor="#fff" stopOpacity="0" />
                </radialGradient>
                <mask id="fan-dots-mask" maskUnits="userSpaceOnUse" {...DOT_AREA}>
                  <rect {...DOT_AREA} fill="url(#fan-dots-fade)" />
                </mask>
                {/* Everything but the bowl and the space above it, which stay clear of stars. */}
                <mask id="fan-dots-bowl" maskUnits="userSpaceOnUse" {...DOT_AREA}>
                  <rect {...DOT_AREA} fill="#fff" />
                  <path d={`${bowlPath(0, Math.PI)} L ${-BX} ${DOT_AREA.y} L ${BX} ${DOT_AREA.y} Z`} fill="#000" />
                </mask>
              </defs>
              {/* The mask sits on a group that doesn't lean, so the clear area stays put while the stars move. */}
              <g mask="url(#fan-dots-bowl)" className="fan-stars">
                {STAR_LAYERS.map((L, i) => {
                  const stars = STARS.filter((st) => st.layer === i);
                  return (
                    <g key={i} className="fan-layer" style={leanStyle(lean, L.depth * DOT_DEPTH * ECHO_SHIFT, 500 + i * 140)}>
                      {stars.map((st, j) => (
                        <circle key={j} cx={st.x} cy={st.y} r={st.r} fillOpacity={st.o} className="fill-foreground" />
                      ))}
                      {/* The same stars in teal, shown only around the lit card. */}
                      <g mask="url(#fan-dots-mask)" className={`fan-dots-glow ${lit !== null ? "is-lit" : ""}`}>
                        {stars.map((st, j) => (
                          <circle key={j} cx={st.x} cy={st.y} r={st.r * 1.2} className="fill-primary" />
                        ))}
                      </g>
                    </g>
                  );
                })}
              </g>
              <Moon lean={lean} />
              {ECHOES.map((k, i) => (
                <path
                  key={k}
                  d={echoPath(k)}
                  className="fan-layer fill-none stroke-foreground"
                  strokeWidth={1}
                  strokeOpacity={0.13 - i * 0.015}
                  style={leanStyle(lean, ((i + 1) / ECHOES.length) * ECHO_SHIFT, 500 + i * 110)}
                />
              ))}
            </svg>
            <Twinkles lean={lean} />
          </div>

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
                <Card item={ITEMS[i]} onLit={ITEMS[i].href ? (on) => setLit(on ? i : null) : undefined} />
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

/**
 * The twinkles, drawn on a canvas. As CSS animations (in the SVG, or as HTML
 * dots) they had Chrome rebuild the page's layers every frame; here each
 * frame clears the canvas and draws only the stars mid-flare, and nothing
 * else on the page is touched. A star rests for most of its cycle, then
 * flares over 12% of it to twice its size in teal and fades back. Each layer
 * follows the lean like the rest of the sky, with the same delay, duration
 * and easing as the CSS transition. Off under reduced motion.
 */
const TW_PAD = { x: STAR_SPAN / 2, top: 100, h: 800 };
const LEAN_DELAY = 80;
const LEAN_MS = 900;

function Twinkles({ lean }: { lean: { x: number; y: number } }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const leanRef = useRef(lean);
  leanRef.current = lean;

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = STAR_SPAN * dpr;
    canvas.height = TW_PAD.h * dpr;

    // The teal, read from the theme; and the loop runs only in dark mode, the
    // only one with stars. Both are rechecked when the theme changes.
    let color = "";
    let frame = 0;
    const onTheme = () => {
      color = getComputedStyle(canvas).getPropertyValue("--color-primary").trim();
      const dark = document.documentElement.classList.contains("dark");
      if (dark && !frame) frame = requestAnimationFrame(draw);
      if (!dark && frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
    };
    const themeWatch = new MutationObserver(onTheme);
    themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    // Each layer's lean offset, as a transition from `from` to `to`.
    const moves = STAR_LAYERS.map(() => ({ from: { x: 0, y: 0 }, to: { x: 0, y: 0 }, start: 0 }));
    const offset = (m: (typeof moves)[number], now: number) => {
      const k = easeOut(Math.min(1, Math.max(0, (now - m.start) / LEAN_MS)));
      return { x: m.from.x + (m.to.x - m.from.x) * k, y: m.from.y + (m.to.y - m.from.y) * k };
    };

    const born = performance.now();
    const draw = (now: number) => {
      frame = requestAnimationFrame(draw);
      const l = leanRef.current;
      STAR_LAYERS.forEach((L, i) => {
        const d = L.depth * DOT_DEPTH * ECHO_SHIFT;
        const m = moves[i];
        if (m.to.x !== l.x * d || m.to.y !== l.y * d) {
          m.from = offset(m, now);
          m.to = { x: l.x * d, y: l.y * d };
          m.start = now + LEAN_DELAY;
        }
      });
      const offs = moves.map((m) => offset(m, now));
      // Fade the twinkles in with the sky's load ripple.
      const intro = Math.min(1, Math.max(0, (now - born - 600) / 900));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, STAR_SPAN, TW_PAD.h);
      ctx.fillStyle = color;
      const t = now / 1000;
      for (const st of TWINKLES) {
        const { dur, delay } = st.twinkle!;
        const p = (((t - delay) % dur) + dur) % dur / dur;
        if (p < 0.76) continue;
        const k = easeInOut(p < 0.88 ? (p - 0.76) / 0.12 : (1 - p) / 0.12);
        const o = offs[st.layer];
        ctx.globalAlpha = 0.9 * k * intro;
        ctx.beginPath();
        ctx.arc(st.x + TW_PAD.x + o.x, st.y + TW_PAD.top + o.y, st.r * (1 + k), 0, 2 * Math.PI);
        ctx.fill();
      }
    };
    onTheme();
    return () => {
      cancelAnimationFrame(frame);
      themeWatch.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={ref}
      className="fan-stars absolute"
      style={{ left: `calc(50% - ${TW_PAD.x}px)`, top: TOP + 32 - TW_PAD.top, width: STAR_SPAN, height: TW_PAD.h }}
    />
  );
}

/** cubic-bezier(0.16, 1, 0.3, 1), the lean's easing, solved for x → y. */
function easeOut(x: number) {
  const bez = (a: number, b: number, t: number) => 3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;
  let lo = 0;
  let hi = 1;
  for (let n = 0; n < 20; n++) {
    const mid = (lo + hi) / 2;
    if (bez(0.16, 0.3, mid) < x) lo = mid;
    else hi = mid;
  }
  return bez(1, 1, (lo + hi) / 2);
}

/** The twinkle's ease in and out. */
function easeInOut(x: number) {
  return x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2;
}

/** A background layer's offset along the lean, `depth` px at most, and its load delay. */
function leanStyle(lean: { x: number; y: number }, depth: number, delay: number): CSSProperties {
  return {
    translate: `${(lean.x * depth).toFixed(1)}px ${(lean.y * depth).toFixed(1)}px`,
    animationDelay: `${delay}ms`,
  };
}

/**
 * The moon, lit on the left, with a faint glow. Always drawn; CSS keeps it
 * down and faded out in light mode, so switching to dark mode raises it.
 * Drawn after the stars, so its disc hides the stars behind it.
 */
function Moon({ lean }: { lean: { x: number; y: number } }) {
  const { x, y, r, depth } = MOON;
  // The crescent: the disc's left half, less a half ellipse (the
  // terminator) bulging the same way.
  const crescent = `M ${x} ${y - r} A ${r} ${r} 0 0 0 ${x} ${y + r} A ${r * 0.45} ${r} 0 0 1 ${x} ${y - r} Z`;
  return (
    <g className="fan-moon">
      <defs>
        <radialGradient id="fan-moon-glow" gradientUnits="userSpaceOnUse" cx={x} cy={y} r={r * 2.4}>
          <stop offset="0.4" className="[stop-color:var(--color-foreground)]" stopOpacity="0.04" />
          <stop offset="1" className="[stop-color:var(--color-foreground)]" stopOpacity="0" />
        </radialGradient>
        <clipPath id="fan-moon-lit">
          <path d={crescent} />
        </clipPath>
      </defs>
      <g className="fan-layer" style={leanStyle(lean, depth * ECHO_SHIFT, 900)}>
        <circle cx={x} cy={y} r={r * 2.4} fill="url(#fan-moon-glow)" />
        {/* The disc in the page's background, so the stars behind it don't show through. */}
        <circle cx={x} cy={y} r={r} className="fill-background" />
        {/* The dark side, just visible: earthshine. */}
        <circle cx={x} cy={y} r={r} className="fill-foreground stroke-foreground" fillOpacity={0.03} strokeOpacity={0.12} strokeWidth={1} />
        <path d={crescent} className="fill-foreground" fillOpacity={0.55} />
        {/* A few craters, on the lit side only. */}
        <g clipPath="url(#fan-moon-lit)" className="fill-background" fillOpacity={0.3}>
          <circle cx={x - r * 0.72} cy={y + r * 0.12} r={r * 0.13} />
          <circle cx={x - r * 0.55} cy={y + r * 0.62} r={r * 0.09} />
          <circle cx={x - r * 0.68} cy={y - r * 0.5} r={r * 0.07} />
        </g>
      </g>
    </g>
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
  if (!item.href) {
    return (
      <div className="flex min-h-22 items-center gap-3 rounded-2xl border border-dashed bg-card px-4 py-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <Icon aria-hidden="true" className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline gap-x-2 text-muted-foreground">
            <h3 className="font-semibold tracking-tight">{item.name}</h3>
            <span className="text-[0.6875rem] font-medium">Kommer snart</span>
          </span>
          <span className="block text-xs text-pretty text-muted-foreground/80">{item.line}</span>
        </span>
      </div>
    );
  }
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
        <h3 className="flex items-center gap-1 font-semibold tracking-tight group-hover:text-primary">
          {item.name}
          {item.external && <ArrowUpRight aria-hidden="true" className="size-3.5 text-muted-foreground" />}
        </h3>
        <span className="block text-xs text-pretty text-muted-foreground">{item.line}</span>
      </span>
    </a>
  );
}

mount(<Landing />);
