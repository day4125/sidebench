# Port plan: React + Tailwind + shadcn

Plan for rebuilding prodtools (plain HTML/CSS/JS) as sidebench, on React,
Tailwind and shadcn/ui. Written 2026-09-28.

The old app stays in the `day4125/prodtools` repo, frozen as it is. The new
app lives in this repo, `day4125/sidebench`, and is served from GitHub Pages
at https://day4125.github.io/sidebench/. Paths below like
`static/deworder.js` refer to files in prodtools.

## Why

- **PDF.js.** The vendored PDF.js is pinned to the 3.x legacy build because
  4.x+ is ESM-only and can't load without a bundler. 3.x is affected by
  CVE-2024-4367 (mitigated today with `isEvalSupported: false`, not fixed).
  A bundler lets us ship a current PDF.js.
- **Accessibility.** The PRD lists it as an open risk. Radix primitives
  (under shadcn) give keyboard, focus and ARIA behavior we currently
  hand-roll or lack.
- **Room to grow.** The planned tools (color tools, SVG viewer, diff checker)
  are form-heavy and stateful. Components pay off there.
- **New look.** The terminal/monospace theme is being retired. A token-driven
  design system is a better base for whatever replaces it.

## What changes and what doesn't

**Dropped:**

- "No build step." It was never a core principle.
- "No framework."
- "Plain global scripts, no ES modules." That rule existed only for
  `file://`.
- The terminal/monospace house style.

**Kept, and enforced more strictly than today:**

- **Data never leaves the machine.** Tool input is processed in memory only
  and leaves only through an explicit copy or download. It is never stored,
  cached or transmitted, and there are no cookies, telemetry or runtime
  network calls.
- **Runs offline.** No CDNs, remote fonts or remote anything at runtime.
- **UI state only in `localStorage`,** under `sidebench:site:*` (theme,
  sidebar).
- **Sandboxed previews.** User content renders in iframes with
  `sandbox="allow-same-origin"` only.
- **The deworder's functionality.** It's tried and tested; the port must
  match it, not improve it (see steps 2 and 5).

`file://` support is dropped. The app is hosted on GitHub Pages (see
"Delivery").

## Stack

- **Vite + React + TypeScript.** Multi-page build: one HTML entry per tool,
  no client-side router. Tools stay real pages.
- **Tailwind CSS v4.**
- **shadcn/ui.** Add components one at a time as they're needed, never the
  whole catalog. Each component's added dependencies are reviewed before it
  goes in (see "Dependency policy").
- **Icons:** lucide-react, bundled.
- **Fonts:** self-hosted (e.g. `@fontsource/*`), never Google Fonts.
- **Tests:** Vitest in browser mode with the Playwright provider (Playwright
  is already a dev dependency) for logic and components, and Playwright for
  end-to-end tests of the built output.

## Offline and security guarantees

These make the privacy rule enforced by the build, not a convention:

1. **CSP on every page** via `<meta http-equiv="Content-Security-Policy">`:
   `default-src 'self'; connect-src 'none'; img-src 'self' data: blob:;
   worker-src 'self' blob:; object-src 'none'; base-uri 'none';
   form-action 'none'`. GitHub Pages can't set response headers, so the
   meta tag is the only place for it. `connect-src 'none'` makes the
   browser refuse `fetch`/XHR/WebSocket even if a dependency tries. The
   policy was confirmed unchanged against PDF.js in step 3.
2. **Network-block e2e test.** Playwright opens every built page, runs each
   tool's main flow, and fails on any request that isn't to the local origin
   or a `blob:`/`data:` URL.
3. **No remote URLs in the build output.** A CI check greps `dist/` for
   `http://` / `https://` outside known-safe strings (license comments, SVG
   namespaces).
4. **PDF.js** has no `eval` since 6.x (the `isEvalSupported` option and
   the code path behind CVE-2024-4367 are gone), and WebAssembly stays off
   so the CSP needs no `'wasm-unsafe-eval'` (see step 3).

## Delivery

- **GitHub Pages**, built and deployed by a GitHub Actions workflow on push
  to `main`. Vite's `base` is set to the Pages path (`/sidebench/`).
- **Why it's safe:** a static host only serves the page's code. Files are
  opened with the File API and processed in the browser; there is no
  backend to receive them, and the CSP blocks any outgoing call. GitHub
  sees that someone loaded the page (like any web server), never the
  content.
- **Trust moves to the repo.** Whoever can push to `main` controls the code
  users run, including the CSP. Keep push access tight and require the CI
  checks (network-block test, remote-URL check) to pass before deploy.
- **The site and the repo are public.** The code has no secrets, and a
  public repo lets anyone check the privacy claims against the code that's
  served. (Pages on a private repo would also need a paid plan.)
- **Offline use** (optional, later): a service worker (PWA) lets the tools
  work with no connection after first load.

## Dependency policy

- Runtime dependencies are pinned through the lockfile and kept few: React,
  `radix-ui`, `class-variance-authority`, `cn` (shadcn's replacement for
  `clsx` + `tailwind-merge`, no dependencies), lucide, `pdfjs-dist`, plus
  `tw-animate-css` and `@fontsource-variable/geist` (CSS and font files
  only). The `shadcn` CLI is a dev dependency; only its CSS is bundled.
- Before adding a shadcn component, check what it installs. Components that
  pull in larger libraries (sonner, cmdk, react-hook-form + zod, recharts,
  react-day-picker, vaul, embla) need a reason to be added.
- `npm audit` is run in CI, but it doesn't gate the build.

## Layout (target)

```text
index.html                  # landing page entry
deworder.html               # one entry per tool
text.html
pdfview.html
src/
  app/                      # shared shell: layout, sidebar, theme toggle
  components/ui/            # shadcn components (owned source)
  lib/                      # cn(), storage helpers (sidebench:site:*)
  tools/
    registry.ts             # replaces static/tools.js
    deworder/
      engine/               # ported cleaner (defaults.ts, deworder.ts)
      DeworderApp.tsx
    text/
    pdfview/
  styles/globals.css        # design tokens (CSS variables) + Tailwind
tests/
  unit/                     # Vitest browser mode, per tool
  e2e/                      # Playwright against dist/
```

## Steps

### 0. Prepare

- The old app stays in the prodtools repo, untouched, and keeps working
  there until the port reaches parity. The new app is this repo (split out
  from a `legacy/` layout inside prodtools on 2026-09-28).
- `INTENT.md` holds the one core principle; every step below is checked
  against it.

### 1. Scaffold

- Vite + React + TS + Tailwind v4, multi-page config with the three tool
  entries plus `index.html`.
- `shadcn init`. Set the design tokens in `globals.css` as provisional
  placeholders; the new look is worked out later.
- Add the CSP meta tag, the network-block e2e test and the remote-URL check
  from day one, against a placeholder page.
- Remove the `docs` script from `package.json` and the `marked` dev
  dependency (the docs reader was deleted).

**Done when:** `npm run build` produces `dist/` and `npm test` runs the
network-block test green.

**Done 2026-09-28.** Notes:

- shadcn preset `radix-nova` (Nova: lucide, Geist via fontsource), base
  color neutral. Tokens are the preset's defaults for now.
- The CSP is injected by a build-only Vite plugin (`vite.config.mts`), so
  the dev server's inline HMR script and WebSocket still work. Tests run
  against the build.
- `npm run build` runs `tsc`, `vite build` and
  `scripts/check-remote-urls.mjs` (skips `/*! */` license banners).
- `npm test` builds, serves `dist/` with `vite preview` and runs
  `tests/e2e/network.spec.ts`: per page, no off-origin requests, no console
  errors, CSP present, and a same-origin `fetch` is refused. Both checks
  were confirmed to fail on a page with a remote `<img>`.
- Locally the tests use `/usr/bin/chromium` (Playwright's own browsers
  aren't installed); `CHROMIUM_PATH` overrides.

### 2. Port the deworder engine (logic only, no UI)

- Copy `static/defaults.js` and `static/deworder.js` into
  `src/tools/deworder/engine/` as ES modules. The **only** changes are
  swapping the `window.Toolbox.deworder` global for `import`/`export` and
  adding types. No refactors, no "improvements."
- Public API stays the same: `clean`, `decodeHtmlBytes`, `detectClasses`,
  `mergeConfig`, plus the constants (`ALLOWED_TARGETS`,
  `AUTO_STRIP_CLASSES`, `STRIPPED_ATTRS`, `DEFAULT_CONFIG`, …).
- Port `tests/deworder/deworder.test.html` to Vitest browser mode (a real
  browser; jsdom's `DOMParser` serializes differently and would give false
  failures).
- **Golden test:** `tests/deworder/fixtures/verify-fixture.html`
  must clean to exactly `verify-fixture.cleaned.html` under the default
  config.
- **Differential test:** load the legacy engine and the new one in the same
  browser and run both on the same inputs (the fixture, every input from
  the unit tests, and a few configs: default, `strip_all_classes` off,
  each `table_mode`). Their output must be identical. This gives parity
  without needing new test documents.
- Deferred: more golden fixtures from real Word exports, once good test
  documents exist. Not a blocker.

**Done when:** the ported unit tests, the golden test and the differential
test all pass.

**Done 2026-09-28.** Notes:

- `src/tools/deworder/engine/defaults.ts` and `deworder.ts`. `deworder.ts`
  was generated from the legacy file's body, then typed. With the types
  stripped (Node's `stripTypeScriptTypes`) it diffs against the legacy
  logic as whitespace only. Two type-only assertions (`!`, `as Element`)
  cover DOM narrowing TS can't see.
- Vitest 5 in browser mode (`vitest.config.mts`, `@vitest/browser-playwright`)
  under `tests/unit/`. `npm test` now runs `test:unit` then `test:e2e`;
  both use the Chromium path from `tests/chromium.mts`.
- `engine.test.ts`: the legacy cases one to one, including the golden test
  (fixtures copied into `tests/unit/deworder/fixtures/`). Inputs live in
  `inputs.ts` so the differential test reuses them.
- `differential.test.ts` imports the untouched legacy scripts (copied from
  prodtools into `tests/unit/deworder/legacy/`) and compares
  `clean` (every input × 7 configs), `detectClasses`, `decodeHtmlBytes`,
  `mergeConfig` and the constants. The legacy tests missed some branches
  (empty `<em>`, `<u>`/`<font>`, `o:spid`, letter list markers, nested
  tables, …), so `tests/unit/deworder/fixtures/word-branches.html` adds a
  Word-style document that reaches them, with the legacy engine as the
  oracle. It also runs as windows-1252 bytes. Checked by planting small
  changes in the port: each one fails the suite.
- Real Word exports dropped into `tests/unit/deworder/local/` (gitignored)
  are picked up by the differential test automatically.

### 3. Spike: PDF.js and deploy

- Current PDF.js through npm, via react-pdf (its React wrapper) or
  `pdfjs-dist` directly.
- Render two real PDFs of about 200 pages each (the existing manual test
  case) under the CSP, with the worker running as its own file.
- Deploy the scaffold to GitHub Pages with the Actions workflow, and run the
  network-block test against the deployed site once.

**Done when:** PDF.js renders correctly under the final CSP, and the Pages
deploy works.

**Done 2026-09-28.** Deploy notes:

- `.github/workflows/deploy.yml`: every push and PR runs `npm ci`,
  `npm audit` (not gating) and `npm test` on Node 26; on `main` the tested
  `dist/` is uploaded and deployed. Actions are pinned to commit SHAs.
  Pages is set to deploy from Actions (`build_type: workflow`).
- `BASE_URL=https://day4125.github.io/sidebench/ npm run test:e2e` runs the
  network-block test against the live site; green on the first deploy.

PDF.js notes:

- **`pdfjs-dist` 6.3 directly, not react-pdf.** react-pdf adds eight runtime
  packages (es-toolkit, clsx, tiny-invariant, …) for a thin wrapper, and
  step 6 rebuilds the viewer UI anyway.
- **The CSP stays as it was.** PDF.js normally fetches standard fonts,
  CMaps, ICC profiles and wasm decoders; `connect-src 'none'` blocks all of
  that. `src/tools/pdfview/pdfjs.ts` turns worker fetching off
  (`useWorkerFetch: false`) and answers PDF.js's requests from a
  `BinaryDataFactory` that reads bundled copies. `scripts/vite-plugin-pdfjs.mts`
  turns each font/CMap into a lazy base64 chunk, loaded as a script, never
  fetched.
- **WebAssembly off** (`useWasm: false`): it would need `'wasm-unsafe-eval'`.
  PDF.js then imports its pure-JS JPEG 2000 and JBIG2 decoders from
  `pdfjs/wasm/` (emitted by the plugin under their original names). The
  cost: ICC color profiles need wasm, so ICC-based colors use PDF.js's
  approximate conversion. Revisit if color accuracy matters (e.g. CMYK
  print PDFs), weighing it against loosening the CSP.
- **Bundled standard fonts** (`useSystemFonts: false`), so a page looks
  the same on every machine.
- **Spike viewer** in `src/tools/pdfview/PdfView.tsx`: one or two PDFs side
  by side, pages rendered near the viewport and freed when far away.
  Throwaway UI; `pdfjs.ts` is what step 6 builds on.
- **Tests** (`tests/e2e/pdfview.spec.ts`): `tests/e2e/fixtures/features.pdf`
  (made by `scripts/make-pdf-fixture.mjs`) has one page each for standard
  fonts, a predefined CMap and a JPEG 2000 image. The test checks pixels on
  each, that the bundled font/CMap/decoder files were the ones loaded, and
  that there are no off-origin requests, CSP violations or PDF.js warnings
  (page and worker). A second test renders every page of up to two PDFs in
  `tests/local/pdf/` (gitignored) side by side. With Think Python (244 pages)
  and Think Stats (264 pages) from Green Tea Press: all 508 pages in about
  a minute, clean, far pages freed. Spot-checked against Poppler
  (`pdftoppm`): same layout and fonts.
- Not covered: JBIG2 (no encoder here to make a fixture; it loads through
  the same path as JPEG 2000) and PDFs not made with LaTeX (InDesign, Word).
- The remote-URL check now allows a few PDF.js strings that are never
  fetched: XML namespaces, a license comment, dummy base URLs for URL
  parsing, and the `http://` prefix it adds to `www.` links.

### 4. Shell and design system

- Layout, sidebar (shadcn Sidebar), theme toggle (light/dark via class on
  `<html>`, stored as `sidebench:site:theme`), landing page from
  `registry.ts`.
- Replace `static/icons.js` with lucide icons, plus custom SVGs where lucide
  has nothing suitable.
- New visual direction set in the tokens. Iterate here, not per tool.

**First pass done 2026-09-28.** The visual direction needs a lot more
work, but is deferred until real tool UIs exist to judge it against (step
7); the tokens below are a placeholder direction, not a decision.
Notes:

- `src/app/AppShell.tsx` frames every page: shadcn Sidebar (`inset`
  variant, collapses to icons with tooltips, a Sheet under 768 px) and a
  header with the toggle plus the tool's icon, name and tagline from the
  registry. `AppSidebar.tsx` lists live tools, then planned ones (disabled)
  under "Kommer snart", with the theme toggle in the footer. The landing
  page is two card grids from `registry.ts`. Each tool page wraps its
  content in `<AppShell tool="slug">`.
- **Icons:** `registry.ts` entries carry a lucide icon. The brand mark (a
  workbench, `src/app/BrandMark.tsx`, and `public/favicon.svg`) is drawn on
  lucide's grid because lucide has no bench.
- **Theme:** saved choice, else the system's. `public/theme-init.js`, a
  classic blocking script added to every page's `<head>` by a Vite plugin,
  sets the class before first paint; a file rather than an inline script
  keeps the CSP unchanged. `src/lib/theme.ts` flips it.
- **Storage:** `src/lib/storage.ts` wraps localStorage under
  `sidebench:site:` (`theme`, `sidebar`). shadcn's Sidebar saves its state
  in a cookie; that was changed to `sidebench:site:sidebar`.
- **CSP and Radix:** Radix's scroll lock (Sheet, Dialog, Select, menus)
  injects an inline `<style>` through `react-style-singleton`, which the
  CSP blocks. `src/lib/style-singleton.ts` replaces that package (Vite
  alias) and applies the same CSS as a constructable stylesheet, which CSP
  doesn't restrict, so `style-src` stays strict. (Step 5 ended up using
  native selects instead of Radix Select; see there.)
- **Other edits to shadcn source:** Swedish screen-reader strings; the
  menu button's tooltip is kept closed while hidden (expanded or mobile),
  since an open-but-hidden tooltip swallowed Escape.
- **Tokens:** cool neutral surfaces with one teal accent. Light: primary
  `#0f766e` (white text passes AA). Dark: surfaces from `#11141c`, primary
  `#2dd4bf` with dark text.
- **Tests:** `tests/e2e/shell.spec.ts` covers nav from the registry, the
  theme (system default, saved choice, applied with the app's scripts
  blocked), saved collapse and tooltips, the mobile menu (no CSP errors,
  scroll locked, Escape closes), and storage (only `sidebench:site:*`
  keys, no cookies).

### 5. Rebuild the deworder UI

Rebuild `deworder-app.js` (~550 lines) as React components on top of the
unchanged engine. Behavior to keep:

- **Three steps:** ladda upp → mappa → förhandsgranska, with the step
  indicator.
- **Step 1:** drag-and-drop or file picker; the file is read as bytes and
  decoded with `decodeHtmlBytes` (keeps the charset detection). Paste also
  works.
- **Step 2:** a table of detected classes, each mapped to a target from
  `ALLOWED_TARGETS` (shadcn Select for each row); `strip_all_classes` and
  `table_mode` options; restore defaults; load a `config.json` via a file
  picker; download `config.json`.
- **Config compatibility:** existing `config.json` files must load
  unchanged, and downloaded ones must match the current format.
- **Step 3:** before/after previews in sandboxed iframes
  (`allow-same-origin` only), source view with copy, download as
  `<name>.cleaned.html`.
- **No new storage:** file contents and mappings in React state only.

**Done when:** e2e tests cover upload → map → preview → copy/download on the
fixtures, including loading and saving a `config.json`, and the
network-block test is green on the page.

**Done 2026-09-28.** Notes:

- `src/tools/deworder/`: `DeworderApp.tsx` holds all state (content in
  React state only) and the step indicator; `UploadStep`, `MappingStep`
  and `PreviewStep` are the three steps. `mapping.ts` holds the legacy
  config semantics as pure functions: the table's form from a config,
  what `clean()` gets (only the detected classes), and the downloaded
  `config.json` (the loaded config with the table on top, same key order,
  2-space indent). `highlight.ts` is the legacy source highlighter,
  returning tokens instead of an HTML string.
- **Native selects, not Radix Select.** Radix Select's viewport injects an
  inline `<style>` each time it opens, which the CSP blocks. shadcn's
  `native-select` has no dependencies, no portal and no injected style,
  and is what legacy used. `select.tsx` isn't installed.
- **Previews under the CSP** (`src/lib/sandboxed-preview.ts`). A srcdoc
  iframe inherits the page's CSP, so Word's `<style>` blocks and
  `style=""` attributes were blocked and the "before" pane lost its look.
  They're taken out before the srcdoc is built and applied after load
  through CSSOM (constructable stylesheets, `el.style.cssText`), which CSP
  doesn't restrict, so `style-src` stays strict. The preview also gets a
  stricter CSP of its own (`default-src 'none'; img-src data:`): the page
  policy allows `'self'`, so a relative `<img src="image001.png">` would
  have sent a file name from the document to the host. `src`, `srcset`,
  `background`, `poster` and `on*` attributes, scripts, links, `<base>`,
  embeds and `<meta http-equiv>` (refresh navigates, which CSP doesn't
  cover) are removed, and link clicks are cancelled. Only the previews
  change; source, copy and download use the engine's output as it is.
- **Known console noise:** the engine parses with `DOMParser`, and Chromium
  checks the page CSP while parsing, so each inline style in an uploaded
  document logs a CSP violation (the style isn't applied; the parsed DOM
  and the output are unaffected). Fixing it would mean changing the engine
  or loosening `style-src`; neither seemed worth it. The e2e test allows
  exactly those violations, matched by the hash the browser reports.
- **Deviations from legacy UI behavior** (the engine is untouched):
  - A class found on several tags has several rows; they now share one
    value. Legacy gave each row its own `<select>` and the last one won,
    silently dropping an edit to an earlier row.
  - Errors show inline (`role="alert"`) instead of `alert()`.
  - A `table_mode` other than `flatten` in a loaded config shows as
    "keep" (legacy showed an empty select and saved `""`); the engine
    treats both as keep. A mapping target outside `ALLOWED_TARGETS` still
    shows as `h1`, as legacy's select did.
  - The collapsed table renders only its first five rows instead of
    clipping them with CSS, so hidden rows aren't tabbable.
- **Tests:** `tests/e2e/deworder.spec.ts` covers file picker, paste and
  drag-and-drop (as windows-1252 bytes, like Word's exports), the golden
  file through download, copy and source view, mapping edits, collapse,
  options, reset, step navigation, loading prodtools' own `config.json`
  (`tests/e2e/fixtures/legacy-config.json`) and a partial one, the
  download format and reloading it, invalid JSON, the sandboxed previews
  (styles applied, nothing loaded, links inert), heading navigation, and
  `word-branches.html` through the UI under the CSP against the legacy
  engine on a page without one. Every test also fails on any request
  after page load (even same-origin), unexpected console errors, non-UI
  localStorage keys or cookies. Unit tests: `tests/unit/deworder/ui.test.ts`
  (mapping semantics, lossless highlighting) and
  `tests/unit/sandboxed-preview.test.ts`. The two preview checks were
  confirmed to fail with image `src` kept and with the CSSOM step removed.

### 6. Rebuild Textmanipulator and the PDF viewer

- **Text:** port `static/text.js` (DOM-free) as a module with its tests,
  then rebuild the UI. The `[?]` info tooltips become shadcn Tooltips.
- **PDF viewer:** rebuild on the PDF.js version from step 3. Its UI can be
  rethought, since it isn't bound by parity.
- The "soon" tools from `tools.js` carry over into `registry.ts` as planned
  entries.

**Done 2026-09-28.** Notes:

- **Text engine:** `src/tools/text/engine.ts`, the legacy `text.js` with
  ES exports and types only (type-stripped, it diffs against legacy as one
  type assertion). The 13 legacy cases are in
  `tests/unit/text/engine.test.ts`.
- **Text UI:** `src/tools/text/TextApp.tsx`. Legacy's copy flow as it was:
  an operation rewrites the text and its button turns into "Kopiera" (one
  at a time), "Kopierad!" for 1.6 s, any edit resets every button, and a
  failed copy selects the text. The info icons are shadcn Tooltips next to
  their buttons (a button can't hold another). "Fler verktyg" stays a
  native `<details>`. A screen-reader status line says when the text is
  copied. `useFlash` gained a third item that cancels a running flash, so
  a new copy button never inherits "Kopierad!".
- **Geist, Latin subset only** (`globals.css`). The package's other
  subsets (Latin Extended, Cyrillic, Vietnamese) load when a character in
  their range is shown, so a subscript letter or pasted Polish text made a
  request that told the host about the content. The text e2e test caught
  it. The Latin subset covers Swedish and is loaded by the UI's own text;
  anything else falls back to the system font.
- **PDF layout:** `src/tools/pdfview/layout.ts`, the legacy `pdfview.js`
  with ES exports and types only (type-stripped, it differs only in how
  signatures wrap). The 15 legacy cases are in
  `tests/unit/pdfview/layout.test.ts`.
- **PDF viewer UI:** same features as legacy, rebuilt.
  - `PdfViewApp.tsx` is step 1 (two drop zones, progress while every page
    size is read, stale loads dropped by a token) and holds the files, the
    stars, the B offset and the toast, so they survive closing and
    reopening. It also stops a stray drop from opening a PDF in the tab.
  - `Workspace.tsx` is the full-window review. It replaces the shell
    rather than covering it (a `fixed` `<main>`, not the Fullscreen API).
    Only the rows in the window range are rendered, from state. A fit mode's
    scale is derived from the window and the files, so resizing and
    swapping a file refit by themselves; a custom zoom is state. Every
    scroll change (jump, zoom anchor, keeping the A page across an offset,
    file or resize) goes through one `useLayoutEffect` once the new layout
    is in the DOM. Zoom runs under `flushSync`, so the next Ctrl+wheel
    event starts from the new layout.
  - `PageCell.tsx` owns its canvas: an effect keyed on (file, page, render
    scale) draws into a new canvas and swaps it in when done, freeing the
    old one (width = 0). The render scale follows the zoom 150 ms after it
    settles. A cell reused for another page drops the old picture at once.
  - Changes from legacy: toolbar in shadcn buttons with lucide icons; the
    stars menu is a shadcn Popover (Radix, non-modal: no injected style,
    Escape closes it before the workspace); the "one file at a time"
    message on a multi-file drop is gone (legacy overwrote it with "läser…"
    at once, so it never showed); no step indicator (two steps, and the
    workspace has its own "Tillbaka"). PDF.js 6 has no `doc.destroy()`;
    documents are freed through `doc.loadingTask.destroy()`, and a file that
    fails to open has its task destroyed too.
- **Tests:** `tests/e2e/pdfview.spec.ts` replaces the spike's. It builds
  PDFs in memory (`tests/e2e/make-pdf.ts`, any page count and size) for:
  picking and refusing files (non-PDF, broken PDF), drop zones and stray
  drops, row pairing with missing pages and the offset (clamped), the
  buttons, page field and keys, stars (flag, list, jump, copy, clear,
  Escape order, kept on reopen, cleared by a new pick), a failed copy,
  zoom (fit modes, steps, Ctrl+wheel, re-render at the new size), drop to
  replace a side (veil, toast, place and flags kept), virtualization, and
  KB/sida. The spike's checks carry over: `features.pdf` pixels and bundled
  chunks, and every page of two local PDFs (`tests/local/pdf/`, 264 rows
  in about 25 s). The drop and zoom tests were confirmed to fail with the
  zoom anchor removed and with the A page not kept across a change.
- **Same-origin requests after load are allowed in the PDF tests,** unlike
  the other tools, because PDF.js loads its worker and the font, CMap and
  decoder chunks a document needs on demand (see "Open decisions").
- **Lessons:**
  - Playwright moves the mouse in one jump, and Radix Tooltip keeps a
    tooltip open when the only pointer event after leaving the trigger is
    inside its grace area. Move with `steps` to test closing on leave.
  - `pkill -f "vite preview"` kills its own shell when the pattern appears
    anywhere in the command line (a `pgrep` in the same line too). Use
    `pkill -f "vite [p]review"`.
  - Radix Popover (non-modal) and Tooltip work under the CSP.
  - Step indicator and drop zones are still local to each tool
    (`DeworderApp.tsx`, `UploadStep.tsx`, `PdfViewApp.tsx`); step 7
    decides whether to share them.

### 7. Visual direction and shared UI/UX

With all three tools rebuilt, decide the look and the patterns they share,
across tools rather than per tool:

- The visual direction, set in the tokens (`globals.css`), replacing the
  placeholder from step 4.
- Shared patterns: step indicators, drop zones, action rows, copy and
  download feedback, errors and status messages, info tooltips, empty
  states, keyboard shortcuts. Extract what the tools share into
  `src/app/` or `src/components/`, and make the tools consistent.
- Layout: page width, how a tool uses the space next to the sidebar, and
  full-window views like the PDF workspace.
- Check light and dark, phone width, keyboard use and screen readers
  across all pages.

**Done when:** the tokens and shared patterns are decided and applied to
every tool, and the e2e suite is green.

**Progress:**

- **PDF viewer is a pager (2026-09-28).** One pair of pages at a time
  (A's page, gutter, B's page), with only those two pages loaded. Replaces
  step 6's scrolling stack of every row.
  - Opening a file reads only the page count; the up-front pass over every
    page's size and its "sida N av M" progress are gone (`PdfFile.sizes`
    removed). The workspace reads the two pages' sizes when a pair comes up
    and shows it once they're known, so paging never flashes empty.
  - Leaving a page frees its canvas (as before) and calls PDF.js's
    `page.cleanup()`, so a page's parsed content and images don't pile up
    in the document's cache.
  - Fit modes fit the pair shown, so they refit per page (a landscape
    page gets its own scale). A pair larger than the view scrolls inside it
    and is centered while it fits (auto margins in a flex scroller); a new
    pair starts at its top.
  - Keys: Left/Right and Page Up/Down turn the page, Home/End as before;
    Up/Down now scroll a zoomed pair instead of paging (handled by the
    workspace, so they work wherever the focus is).
  - Zoom anchors on the pair's on-screen box (measured before and after a
    `flushSync`), replacing the row-based anchor math.
  - `layout.ts`: `computeLayout`, `rowAt` and `windowRange` replaced by
    `pairLayout` (sizes round down, so a fitted pair never overflows by a
    pixel). Unit tests updated the same way.
  - Tests: paging checks exactly two pages on screen after each key, Up/Down
    scrolling and a new page starting at the top; the old virtualization
    test now checks one row, two canvases, and that a left page's canvas is
    emptied. The local 244/264-page pair still renders every page, clean.

### 8. Cut over

- Once the new deworder has parity, delete the legacy engine copy in
  `tests/unit/deworder/legacy/` and the differential test with it.
  `word-branches.html` has no expected output of its own: before deleting
  the legacy engine, snapshot its output for that fixture as a second
  golden file, or drop the fixture.
- Extend the README with how to add a tool.

## Open decisions

- **Visual direction:** decided in step 7, now that all three tools are
  rebuilt.

- **PDF.js support files loaded on demand.** The bundled standard fonts,
  CMaps and JPEG 2000/JBIG2 decoders are separate files that load only
  when a PDF needs one (step 3). The host's request log can therefore show
  which standard fonts or CJK encodings a PDF uses: nothing of the text,
  but more than "someone opened the page". It's the same kind of leak as
  the Geist subsets (step 6), on a bigger scale: the CMaps are a few MB.
  Options: preload them all with the page, keep only the standard fonts
  eager, or cache them with the service worker (PWA) so they're fetched
  once, independently of any document.

- **PWA / offline install:** later, if wanted.

## Decided

- **PDF library:** `pdfjs-dist` directly; WebAssembly off, CSP unchanged
  (2026-09-28).
- **Hosting:** GitHub Pages (2026-09-28).
- **Name and repo:** the new app is sidebench, in its own public repo;
  prodtools is kept as it is (2026-09-28).
- **UI language:** Swedish, as today, no i18n layer (2026-09-28).
- **Deworder parity:** match current functionality; more real test
  documents deferred (2026-09-28).
