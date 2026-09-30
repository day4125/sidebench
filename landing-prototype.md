# Landing page prototype

Status (2026-09-29): prototype chosen, not shipped. The live start page is
still `index.html` → `src/app/landing.tsx`. The prototype runs next to it at
`/sidebench/landing-a.html` (`npm run dev`).

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

A variant of A at `/sidebench/landing-b.html`: `landing-b.html`,
`src/app/landing-proto/LandingB.tsx`, `landing-b.css`, `"landing-b"` in
`vite.config.mts`. Same cards, copy, privacy block and all-live hack.

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
- **Below `xl`:** the same as A, with the horizontal logo on top.

## Files

- `landing-a.html`: the entry page.
- `src/app/landing-proto/LandingA.tsx`: the page.
- `src/app/landing-proto/landing-a.css`: keyframes. A CSS file because the
  CSP blocks inline `<style>`; React's `style={{…}}` is fine (set through
  CSSOM, which CSP allows).
- `src/app/landing-proto/all-live.ts`: prototype-only hack that marks every
  registry tool live and gives unbuilt ones `href: "#"`, so the page shows
  the "all tools built" state.
- `vite.config.mts`: `"landing-a"` added to `pages`, so the prototype is also
  built and deployed. Remove it before pushing if it shouldn't go live.
- `src/app/AppSidebar.tsx` (a real change, not prototype-only): the
  live/soon split now happens at render time instead of module load, and the
  "Kommer snart" group is hidden when empty. Needed for `all-live.ts` to
  reach the sidebar in the production build; harmless otherwise.

## Geometry

Constants at the top of `LandingA.tsx`: ring radius `R = 340`, card width
`W = 228`. Positions are pixels from the ring's centre
(`left: calc(50% + x)`), so the ring doesn't scale. Constraints:

- `2 × (R + W/2)` (~910 px) must fit the content width at `xl`. At 1280 px
  with the sidebar open it's close to the limit.
- Neighbouring cards need `0.707 × R > W` to not overlap at 45°.
- The ring container is `h-[820px]`, about `2 × (R + card height/2)` plus
  margin.
- Eight items fill the ring evenly. With a different count the angles still
  work (`POINTS` divides the circle by `ITEMS.length`), but recheck overlap.
- The SVG is 1 × 1 px with `overflow: visible`, centred. Not 0 × 0: Chromium
  skips drawing a zero-size SVG.

## To ship it

1. Move `LandingA.tsx` into `src/app/landing.tsx` and the CSS next to it
   (import it from there).
2. Drop the `./all-live` import and delete `all-live.ts`, `landing-a.html`,
   `src/app/landing-proto/`, and `"landing-a"` in `vite.config.mts`.
3. Decide how unbuilt ("soon") tools show on the ring: leave them out, or
   show them dimmed and unlinked. The prototype assumed every tool is built.
4. Check the repo link (`https://github.com/day4125/sidebench`) and the
   "Koden är öppen" card's wording.
5. Update the elements page (`src/app/elements.tsx`) if the tool card
   changes, and delete `src/app/ToolCard.tsx` if nothing uses it any more.
6. Run the e2e tests: the landing page must still make no off-origin
   requests.

## Open points

- Small bits of spoke show between the name and the subheading, where their
  background patches don't meet. A single background behind the whole
  centre block would hide them.
- 1280 px is a high breakpoint for the ring. A smaller `R` with narrower
  cards could bring it down to `lg`.
- No page `<title>` or description yet beyond "sidebench (prototyp)".

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
