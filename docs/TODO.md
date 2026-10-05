# To do

The backlog. When an item is finished, move it to Done with the date.
Settled choices go in [DECISIONS.md](DECISIONS.md).

## Open

### Every page

- **Copy review** (started 2026-10-04). Every string a page can show, in
  one `.md` per page under `docs/copy-review/` (temporary). The user rewrites
  strings in place; Claude maps the edits back into the source and tests.
  Format, mapping steps and the page checklist are in
  `docs/copy-review/README.md`; rules for every page in
  `docs/copy-review/_style.md`.
  Specialtecken is the pilot. Every page also gets a UX revisit later; a
  page revisited then gets its copy checked again.
- **Visual direction and shared patterns** (left over from the port, step
  7). Accent decided (cobalt, plus `--success` green, 2026-10-05); the rest
  of the tokens in `globals.css` are still first pass. Share what the tools
  have in common: step indicators, drop zones (still local to the deworder
  and the PDF viewer), action rows, copy and download feedback (only
  Textmanipulator's main button uses the green "Kopierad!" so far; its
  squares and menu, Specialtecken and Färgväljare still confirm in the
  accent), errors and status lines, info
  tooltips, empty states, keyboard shortcuts. Layout: page width, use of
  the space beside the sidebar, full-window views. Check light and dark,
  phone width, keyboard and screen readers across all pages.

### Textmanipulator

- **Result report for every action.** "Rensa text" already reports what a
  run did, in a line under the button (hyphen guesses listed word by word
  on hover). Extend it to the other actions, into the same line, ranked by
  how much the result needs checking rather than by how often the action
  is used:
  - **Guesses: name the words.** Som i en mening (lowers names, which
    can't be told from ordinary words), Hårt mellanslag i tal (can't tell
    "klass 5 100 elever" from a number).
  - **Changes you can't see, or that remove something: a count.** Ta bort
    dolda tecken, Avkoda entiteter, Ta bort `<svg>`-taggar, Ta bort
    dubbletter (lines removed), Ta bort HTML-taggar.
  - **Extract: how many were found, and above all when none were.** Today
    Extrahera e-post/URL on a text without any replaces the text with
    nothing, silently.
  - **Visible and certain: nothing.** Case, upphöjt/nedsänkt, slug, lists.
- **UX revisit** (noted 2026-10-01). The tool outgrew its toolbar design:
  many toolbar buttons plus count, ¶ toggle, legend and "…"; a long "Fler
  verktyg" menu; the legend covers only the toolbar; the bar wraps to two
  rows at phone width. Part of it:
  - The shape of the report line (left open 2026-10-04).
  - **Legend for the hidden-character marks:** what `°`, `→`, `¬`, the
    dashed box and `¶` stand for. Today only the ¶ toggle's tooltip counts
    them by name; nothing ties a mark in the text to its meaning.
- **Dark mode:** the main button's "Kopiera" outline is grey, not teal.

### New tools

- **Clipboard** (noted 2026-09-30). Snippets copied over and over while
  working on a project: save one, copy it back with one click. Takes the
  "Koden är öppen" card's place on the start page. Storage is settled (see
  DECISIONS.md, 2026-09-30): sessionStorage only, with a per-snippet
  length cap (~200–300 characters), a clear-all button, and tests for the
  cap and for no stray storage keys.

### SVG-viewer

- **Node simplification** (reducing points). Lossy, so manual only; build
  it if a real file shows it's needed.

### Cleanup

- **Retire the deworder parity check.** Delete the legacy engine copy in
  `tests/unit/deworder/legacy/` and `differential.test.ts`. First snapshot
  the legacy output for `fixtures/word-branches.html` as a second golden
  file (it has no expected output of its own), or drop the fixture.
- **README: how to add a tool.**
- **Flaky e2e test** (noted 2026-10-05). `pdfview.spec.ts` "the workspace
  opens under the tool header and goes fullscreen and back" failed once in
  a full `npm test` run (a `toHaveAttribute` expectation), then passed
  four times alone and in the next full run. Likely timing under load;
  find what it waits on.

### Later, if wanted

- **PWA / offline install:** a service worker so the tools work with no
  connection after the first load.
- **ICC colors in the PDF viewer:** need WebAssembly, so `'wasm-unsafe-eval'`
  in the CSP. Revisit only if color accuracy matters (e.g. CMYK print PDFs).

## Done

- 2026-10-04 Textmanipulator: "Rensa text" runs a recipe you set, which
  also always removes soft hyphens and zero-width characters (the planned
  "turbo mode").
- 2026-10-04 Port from prodtools finished. The plan and its notes are
  archived in `docs/archive/port-plan.md`; the start page's design history
  in `docs/archive/landing-prototype.md`.
