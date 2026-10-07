# Decisions

Settled choices and why, newest first. Add one when a question is decided;
if a later decision reverses one, say so in the new entry rather than
editing the old one. The backlog is in [TODO.md](TODO.md).

## 2026-10-07 · Specialtecken: a click chooses, the button copies

A click on a tile only chooses the character; copying is the "Kopiera
tecken" button, Enter on a tile, or Enter in the search (top match). Copying
on click while also showing the character in the details mixed two
actions. The details became a band above the search, sticky with it in a
solid head, and the grid got the full width. The categories moved from a
row of chips into a menu beside the search. Dropped: the HTML copy button
(the entity is still shown and selects with one click), the hover preview
(it swapped the character on the way to the button), the hint text, and
the recent copies. Recents were tried in the grid, in the details, beside
the search and behind a button, and none earned its place, so the tool no
longer writes anything to sessionStorage. Prototyped with a panel beside
the grid and a dock at the bottom; the band won.

## 2026-10-05 · Cobalt accent, soft green for "copied"

The accent moves from teal to cobalt `#1a6fe1`, the same color in light
and dark mode with white text on it (4.6:1). Picked from seven candidates
tried live on the elements page. A lighter blue for dark mode (`#68a5ff`
with dark text) was tried and dropped for looking off; the cost is that
primary-colored text in dark mode (links, "Kopiera", icons) reaches 3.7:1,
under AA's 4.5. No color passes 4.5:1 as text on both white and `#14171f`
(it would need luminance ≤ 0.183 and ≥ 0.228 at once). Teal left green
free to mean "done": `--success` (a soft green tint) and
`--success-foreground` (the green text on it), first used for "Kopierad!"
on Textmanipulator's main button, tint without a border.

## 2026-09-30 · Clipboard snippets may live in sessionStorage

The planned Clipboard tool keeps its snippets in sessionStorage, like
Specialtecken's recent characters, without an exception in INTENT.md. The
snippets are short, recurring tags the user types (e.g. metadata for image
uploads), not the material INTENT protects. Guards: a per-snippet length
cap so a pasted passage can't be stored, sessionStorage only (never
localStorage), a clear-all button. Known caveats, accepted: Chromium writes
sessionStorage to disk for tab restore, and the storage origin
`day4125.github.io` is shared with the user's other Pages sites. Per-tab
scope is enough; anything that must last longer doesn't belong in this
tool.

## 2026-09-30 · Special characters became a tool of its own

Specialtecken (`chars.html`), copying rather than inserting at the cursor,
instead of a menu in Textmanipulator. It took the place of the planned
PDF-kalkylator, which was dropped.

## 2026-09-28 · Native selects, not Radix Select

Radix Select's viewport injects an inline `<style>` each time it opens,
which the CSP blocks. shadcn's `native-select` has no dependencies, no
portal and no injected style.

## 2026-09-28 · Rebuild prodtools as sidebench on React, Tailwind, shadcn

Why: the vendored PDF.js was stuck on 3.x (4.x+ is ESM-only and needs a
bundler; 3.x is affected by CVE-2024-4367); Radix primitives give keyboard,
focus and ARIA behavior that was hand-rolled or missing; the planned tools
are form-heavy and stateful; and the terminal/monospace look was being
retired. Dropped with it: "no build step", "no framework", "no ES modules"
(only ever needed for `file://`) and `file://` support itself. The old app
stays frozen in `day4125/prodtools`. The full plan is
`docs/archive/port-plan.md`.

## 2026-09-28 · Hosting on GitHub Pages, public repo

A static host only serves the code; files are opened with the File API and
the CSP blocks any outgoing call, so GitHub sees a page load, never the
content. Trust moves to the repo: whoever can push to `main` controls the
code and the CSP, so keep push access tight and keep the CI checks gating
the deploy. Public, so anyone can check the privacy claims against the code
that's served (Pages on a private repo would also need a paid plan).

## 2026-09-28 · UI language Swedish, no i18n layer

## 2026-09-28 · Deworder parity, not improvement

The port matches the legacy engine's behavior exactly, checked by a
differential test against the untouched legacy code. More golden fixtures
from real Word exports are deferred until good test documents exist.

## 2026-09-28 · PDF.js: `pdfjs-dist` directly, WebAssembly off

Not react-pdf, which adds eight runtime packages for a thin wrapper.
WebAssembly off so the CSP needs no `'wasm-unsafe-eval'`; PDF.js uses its
pure-JS JPEG 2000 and JBIG2 decoders. The cost is approximate ICC colors.

## 2026-09-28 · PDF.js support files load on demand

Standard fonts, CMaps and decoders are bundled and loaded as chunks when a
document needs them. The host's log can show which fonts or CJK encodings
a PDF uses, never its content, which is fine for the viewer's purpose
(spotting big faults after compression). So the PDF tests allow same-origin
requests after load, unlike the other tools. Likewise accepted: the
deworder's CSP console warnings (each inline style in an uploaded document
logs one while `DOMParser` parses; output is unaffected).

## 2026-09-28 · Geist, Latin subset only

The package's other subsets load when a character in their range is shown,
so a subscript letter or pasted Polish text made a request that told the
host about the content. The Latin subset covers Swedish; anything else
falls back to the system font.
