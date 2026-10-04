# Landing page prototype

Status (2026-09-30): variant B, "Solfjädern", with echoes and a starry sky
behind it, is the live start page: `index.html` → `src/app/landing.tsx` and
`src/app/landing.css`. The prototype pages are gone; see "Shipped" below.
The sections before it record how the design came about, and name the
prototype files as they were.

## The design: "Omloppet"

- **Centre:** the brand mark as a large teal tile, "sidebench" under it, and
  one small line: "Små verktyg för innehållsproduktion, helt i webbläsaren".
- **Ring:** every tool from the registry, plus a "Koden är öppen" card
  linking to the repo, spaced evenly on a dotted SVG circle, starting at the
  top in registry order. Each card has a spoke (a line from the centre) and
  a dot where it meets the ring. Cards are the same size: icon tile, name,
  tagline. No tool examples on them (tried, dropped: too busy).
- **Privacy block** under the ring: the page's security policy (CSP),
  directive by directive, each with a Swedish explanation. Mirrors
  `vite.config.mts`; keep the two in step.
- **Motion** (`landing-a.css`):
  - On load, spokes draw outwards one after another, then the cards fade in
    (with a short blur).
  - The dotted ring turns once every 120 s.
  - Hovering or focusing a card turns its spoke teal and sends one pulse
    from the centre out to the card. It plays once per hover: the pulse
    line is remounted with a new React `key` on each enter.
  - `prefers-reduced-motion` turns all of it off; the spoke still lights.
- **Below `xl` (1280 px):** no ring. The centre sits on top, cards in a
  grid (two columns from `md`, one on phones), then the privacy block.

## Variant B: "Solfjädern" (2026-09-30)

A variant of A, prototyped at `/sidebench/landing-b.html`
(`src/app/landing-proto/LandingB.tsx`, `landing-b.css`), now shipped. Same
cards, copy and privacy block as A. The `?motif=` and `?dots=` switches
below were prototype-only and didn't ship; the start page has the echoes
and the starry sky.

- **Logo at the top centre,** mark tile (64 px, radius 16) left of
  "sidebench" (`text-6xl`), set `DROP = 50` px down inside the bowl rather
  than on its rim. No tagline under it (dropped: the cards say what the
  tools do).
- **Bowl** under the logo, dotted: the bottom half of a blown-up logo tile
  (`BX = 232`, `BY = 140`), with straight sides, a flat floor, and corners
  rounded at the tile's own radius-to-size ratio (`TILE_R / TILE`) against
  the blown-up tile's shorter side, its full height `2 × BY`, so `BR` = 70 px
  (against the width it was 116 px: nearly a U). A half circle and then a superellipse came before it. It
  starts at the fan's centre line, traces in from both ends on load (a mask
  of the two halves), then its dots crawl slowly. `bowl(angle)` gives its
  point in a direction (ray against side, floor or corner arc); `bowlPath`
  samples it into a path.
- **Spokes run from the bowl,** not the centre: each starts where the ray
  from the centre to its card crosses the bowl (a dot there) and
  ends at the card's edge (taken as `W × CARD_H`). Load order is the bottom
  pair first, then outwards. Hover and focus fill the spoke with teal from
  the bowl out to the card (0.45 s, ease-out) instead of A's switch and
  pulse; leaving drains it back towards the bowl (0.25 s). It's a CSS
  transition on a second line over the grey spoke, so a quick hover-off
  reverses from wherever the fill has got to.
- **Card positions:** the cards can't sit evenly on a half circle. Eight
  cards 236 px wide would need a radius of ~510 px (too wide) for the bottom
  pair to clear each other. So the card centres sit on a half ellipse deeper
  than it is wide (`RX = 362`, `RY = 452`), in four rows at even depths
  (`ROWS = [32, 162, 293, 423]` px below the centre, 130 px apart), so the
  gaps between rows match. Each row's x comes from the ellipse, plus a push
  outwards per row, mirrored. The push is responsive: `OUT = [40, 0, 0, 0]`
  always, growing towards `OUT_WIDE = [100, 60, 0, 0]` as the fan has room
  (a ResizeObserver on the fan measures it; `spreadFor` turns the width
  into 0–1). At 1280 px with the sidebar open it's `OUT`; from about
  1440 px it's `OUT_WIDE`. The fan is full width (no `max-w-6xl`) so it can
  spread; the grid below `xl` keeps the max width. Registry order runs from the top left, down through the bottom,
  and up to "Koden är öppen" at the top right.
- **Fit:** the top pair sets the width, `2 × (RX + OUT[0] + W/2)`, ~1036 px
  at its narrowest. At 1280 px with the sidebar open that leaves ~17 px to
  the panel edge on each side (checked at 1280, 1440 and 1920 px). Rows are
  130 px apart and the tallest card is 98 px, so a gap of ~30 px is the
  least between rows; a tagline that wraps to four lines would eat into it.
  Recheck if copy or the tool count changes.
- **Echoes (2026-09-30):** behind the fan, five whole-tile outlines at the
  bowl's proportions and corner ratio, scaled up from it (`ECHOES`, ×1.45 to
  ×3.75), hairline strokes fading outwards. They ripple in from the bowl on
  load. Hovering or focusing a card leans them all towards that card's
  direction from the fan's centre (a unit vector, so every card moves them
  equally far), the outer (nearer) ones furthest, up to `ECHO_SHIFT = 45` px:
  a parallax that sets off a beat after the spoke's fill (0.9 s ease-out,
  0.08 s delay) and settles back when the card is left. They sit in a field
  clipped to the fan and faded at its edges by a radial `mask-image`, so
  nothing ends on a hard line or adds horizontal scroll. Reduced motion keeps
  them still. Alone behind `?motif=echoes`.
- **Glyphs (2026-09-30, `?motif=glyphs`):** the tools' own icons,
  oversized (52–140 px), tilted and scattered around the fan (`GLYPHS`, px
  from its centre), as 1 px hairlines at low opacity. Same lean on hover as
  the echoes, depth by size (bigger = nearer = moves further, `s / 140 ×
  ECHO_SHIFT`). The lit card's own icons turn teal. The x positions are set
  for a 1720 px field and squeeze in proportionally on narrower ones (the fan
  width is now kept in state; `spread` is derived from it).
- **Dot grid (2026-09-30, alone behind `?motif=dots`):** three SVG `<pattern>` layers on
  one 36 px pitch, each offset a third of a cell along the diagonal, so at
  rest they interlock into one even diagonal lattice. Far layers have
  smaller, fainter dots and lean less (depth 0.3 / 0.6 / 1 × `ECHO_SHIFT`),
  so a lit card shears them apart. Dots within ~200 px of the lit card turn
  teal: a teal copy of the near layer, masked by a radial gradient centred
  on the card, fading in (0.5 s) and out from where it was (the last lit
  point is kept in a ref). The bowl and the space above it (up to the
  field's top) stay clear of dots: a mask of that shape on a group that
  doesn't lean, so the clear area stays fixed to the bowl line while the
  dots move under it.
- **Starry sky (2026-09-30, the default look for the dots; `?dots=grid`
  brings the grid back):** 421 stars on a jittered grid (at most one per
  44 px cell, 55% filled, placed randomly inside it), from a seeded random
  generator so the sky is the same every load. Each star sits in one of three
  depth layers (radius 0.5–0.9 / 0.8–1.3 / 1.1–1.8 px, opacity 0.16 / 0.22 /
  0.3, lean 0.3 / 0.6 / 1), and 4% are bright (1.5× size, opacity 0.55). About
  one in eight (42) twinkles: a CSS keyframe that rests for most of a 4–11 s
  cycle, then flares to twice the size in teal; each has its own duration and
  a negative delay, so they never sync. Around the lit card the stars turn
  teal, as with the grid (a teal copy of each layer under the same radial
  mask). Same bowl cut-out.
- **Stars in dark mode only.** The star layers and the twinkle canvas
  carry `.fan-stars`, hidden unless `<html>` has `.dark`; light mode shows
  the echoes alone. The canvas's animation loop stops in light mode and
  restarts when the theme switches (a MutationObserver on `<html>`'s class),
  so light mode costs only the bowl crawl (~5% main thread against ~7.5% in
  dark). The dot grid (`?dots=grid`) still shows in both.
- **Twinkles on a canvas.** A quarter of the stars twinkle (`TWINKLE_SHARE =
  0.25`, 95 stars): each rests for most of a 4–11 s cycle, then flares over
  12% of it to twice its size in teal and fades back, with its own duration
  and phase. They're drawn by `Twinkles`, one `<canvas>` over the sky that
  each frame clears and draws only the stars mid-flare (about a dozen at a
  time), following each layer's lean with the same delay, duration and
  easing as the CSS transition. Off under reduced motion. Twinkling stars
  inside the bowl are left out (`inBowl`), since the SVG bowl mask doesn't
  reach the canvas.
  Why a canvas: as CSS animations the twinkles were expensive whichever way
  they were drawn. In the SVG, each frame repainted the sky. As HTML dots,
  which should run on the GPU, Chrome still rebuilt the page's layers every
  frame (style recalc plus Layerize, ~4 ms a frame), though the same dots on
  a bare page cost nothing; not tracked down further.
  Measured in headless Chromium on the real GPU (`--enable-gpu
  --use-angle=vulkan`; the default headless mode renders in software and
  gave erratic numbers), main thread busy with everything on: CSS
  twinkles as HTML dots, 95 stars ~25%; canvas, 95 stars ~7.4%; bowl crawl
  alone ~6.5%.
- **Drift, tried and removed (2026-09-30):** a slow per-layer drift. Tiny
  hard dots pulse in brightness as they cross pixel boundaries, which
  looked like every star twinkling; soft gradient stars fixed that, but the
  page got heavy.
- **Moon (2026-10-01), dark mode only:** a crescent (r 30 px) in the gap
  under the bowl, between the two bottom spokes, a little left of the middle
  (`MOON`: 32 px left of and 236 px below the fan's centre). Lit on the left:
  the disc's left half less a half-ellipse terminator, at 55% foreground,
  with three craters clipped to the lit part, the dark side as a faint
  outline (earthshine), and a soft glow out to 2.4 × r. Its disc is filled
  with the page background and drawn after the stars, so it hides the stars
  behind it; twinkles near it are left out (`behindMoon`), as with the bowl.
  It leans with the sky (`depth` 0.55 × `ECHO_SHIFT`, ~25 px). It's always
  drawn: light mode keeps it 36 px lower and faded out, so switching to dark
  mode raises it and switching back sets it (opacity and translate
  transitions, not `display`). Prototyped at `landing-sun.html`, now gone.
- **Sun, tried and dropped (2026-10-01):** a light-mode counterpart, a teal
  disc with a glow, first with slowly turning rays, then a lens flare (five
  ghosts on a line through the sun, which swung around it on hover). Neither
  worked out, and a plain disc didn't either; light mode keeps the echoes
  alone.
- **Default motif: dots and echoes together.** The dot grid is the far
  field (its lean scaled by `DOT_DEPTH = 0.6`, so its layers move 11–27 px),
  the echoes in front of it (9–45 px), each at its solo opacity. `SHOW` in
  `LandingB.tsx` decides which motifs draw from the `?motif=` value.
- **Below `xl`:** the same as A, with the horizontal logo on top.

## Shipped (2026-09-30)

- `src/app/landing.tsx` is variant B with the echoes and the starry sky
  (dark mode only), without the glyph and dot-grid paths or the URL
  switches. Its CSS is `src/app/landing.css`.
- Tools not built yet show in the fan at their place, dimmed and unlinked:
  dashed border, muted icon and text, "Kommer snart" beside the name. They
  don't light a spoke or lean the sky. The fan stays at 8 cards, so its
  geometry is unchanged.
- Tool names are `<h3>` under a visually hidden "Verktyg" `<h2>`, as on the
  old index (the e2e test "landing page lists every tool" looks for them).
- Deleted: `landing-a.html`, `landing-b.html`, `src/app/landing-proto/`
  (both prototypes and `all-live.ts`), and their `vite.config.mts` entries.
- `scripts/check-remote-urls.mjs` allows the exact repo URL, the "Koden är
  öppen" link, which is opened only by a click and never fetched.
- Unit and e2e tests pass, including the check that the start page makes
  no off-origin requests.
- Still open: the elements page (`src/app/elements.tsx`) shows the old
  `ToolCard` as its tool-card specimen, and nothing else uses it any more.
  The fan's card lives inside `landing.tsx`, which mounts the page on
  import, so showing it there means moving `Card` into its own module first.

## Open points

- Small bits of spoke show between the name and the subheading, where their
  background patches don't meet. A single background behind the whole
  centre block would hide them.
- 1280 px is a high breakpoint for the ring. A smaller `R` with narrower
  cards could bring it down to `lg`.

## How we got here

Five sketches, all in the existing teal/Geist look:

- **A, launcher:** a search field with keyboard shortcuts. Dropped: seven
  tools don't need a search. It did produce the special-character picker
  idea (see Ideas in `port-plan.md`).
- **B, by material:** tools grouped by what you have (text, Word HTML,
  PDF, SVG and color), with a file-drag highlight. Its privacy block was
  kept.
- **C, tools at work:** each tool shown on a made-up example, cards at
  different sizes. Dropped: cards should be the same size.
- **D, hero plus uniform cards:** logo and name, privacy block beside them,
  same-size cards with examples.
- **E, the ring:** chosen, then simplified: examples removed, pulse plays
  once per hover instead of looping.
