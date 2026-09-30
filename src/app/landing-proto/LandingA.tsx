// Landing prototype, "Omloppet": the mark and one line in the middle, the
// tools on a circle around it, each tied to the centre by a spoke. Spokes
// draw outwards on load; hovering or focusing a card lights its spoke and
// sends one pulse out to it. Below xl there's no room for the ring, and the
// cards fall back to a grid. See landing-prototype.md.
import "./all-live";
import "./landing-a.css";
import { useState, type ComponentType, type SVGProps } from "react";
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

/** Ring radius and card width, px. 2 × (R + W/2) must fit the content width at xl. */
const R = 340;
const W = 228;

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

/** Each item's centre, relative to the ring's centre, from the top clockwise. */
const POINTS = ITEMS.map((_, i) => {
  const a = -Math.PI / 2 + (i * 2 * Math.PI) / ITEMS.length;
  return { x: Math.round(R * Math.cos(a)), y: Math.round(R * Math.sin(a)) };
});

function Landing() {
  // Which spoke is lit, and a counter that remounts its pulse so the pulse
  // plays once per hover rather than looping.
  const [lit, setLit] = useState<number | null>(null);
  const [pulse, setPulse] = useState(0);
  const light = (i: number | null) => {
    setLit(i);
    if (i !== null) setPulse((n) => n + 1);
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl py-4 md:py-8">
        {/* Ring, xl and up. */}
        <div className="relative hidden h-[820px] xl:block">
          {/* 1 px, not 0: Chromium skips drawing a zero-size SVG even with overflow visible. */}
          <svg aria-hidden="true" width="1" height="1" className="absolute top-1/2 left-1/2 overflow-visible">
            <circle r={R} className="orbit-ring fill-none stroke-foreground/25" strokeWidth={1.5} strokeDasharray="2 10" strokeLinecap="round" />
            {POINTS.map((p, i) => (
              <g key={i}>
                <line
                  x2={p.x}
                  y2={p.y}
                  pathLength={1}
                  className={`orbit-spoke transition-[stroke,stroke-width] duration-300 ${
                    lit === i ? "stroke-primary" : "stroke-foreground/15"
                  }`}
                  strokeWidth={lit === i ? 2 : 1.25}
                  style={{ animationDelay: `${150 + i * 70}ms` }}
                />
                {lit === i && (
                  <line
                    key={pulse}
                    x2={p.x}
                    y2={p.y}
                    pathLength={1}
                    className="orbit-pulse stroke-primary"
                    strokeWidth={4}
                    strokeLinecap="round"
                  />
                )}
                <circle cx={p.x} cy={p.y} r={4} className={lit === i ? "fill-primary" : "fill-foreground/25"} />
              </g>
            ))}
          </svg>

          <Hub className="absolute top-1/2 left-1/2 w-72 -translate-x-1/2 -translate-y-1/2" />

          <ul>
            {ITEMS.map((item, i) => (
              <li
                key={item.key}
                className="orbit-card absolute"
                style={{
                  width: W,
                  left: `calc(50% + ${POINTS[i].x - W / 2}px)`,
                  top: `calc(50% + ${POINTS[i].y}px)`,
                  translate: "0 -50%",
                  animationDelay: `${450 + i * 70}ms`,
                }}
              >
                <Card item={item} onLit={(on) => light(on ? i : null)} />
              </li>
            ))}
          </ul>
        </div>

        {/* Grid below xl. */}
        <div className="xl:hidden">
          <Hub className="mx-auto max-w-sm py-6 md:py-10" />
          <ul className="mt-6 grid gap-3 md:grid-cols-2">
            {ITEMS.map((item) => (
              <li key={item.key}>
                <Card item={item} />
              </li>
            ))}
          </ul>
        </div>

        <section aria-labelledby="proof-h" className="mx-auto mt-16 max-w-xl text-center xl:mt-6">
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

/** The centre: mark, name, one line. */
function Hub({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-col items-center text-center ${className}`}>
      <span className="flex size-20 items-center justify-center rounded-3xl bg-primary text-primary-foreground shadow-[0_12px_32px_-10px] shadow-primary/60 ring-8 ring-background">
        <BrandMark className="size-12" />
      </span>
      <h1 className="mt-4 bg-background px-2 text-5xl font-semibold tracking-[-0.04em]">sidebench</h1>
      <p className="mt-1 bg-background px-2 text-sm text-pretty text-muted-foreground">
        Små verktyg för innehållsproduktion, helt i webbläsaren
      </p>
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
      className="group flex min-h-24 items-center gap-3 rounded-2xl border bg-card px-4 py-3 transition-[border-color,box-shadow,translate] duration-200 hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-[0_14px_32px_-16px] hover:shadow-primary/40 focus-visible:border-primary/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
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
