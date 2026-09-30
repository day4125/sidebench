# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Mainly the author: one person doing Swedish-language content production
work, who built sidebench as their own workbench. The site and repo are
public, so others may find and use it, but the tools are shaped around the
author's own jobs, not a wider audience.

## Product Purpose

Small browser tools for the side jobs of content production: cleaning
Word-exported HTML for CMS import, one-off text operations, and checking two
PDFs against each other (for example, spotting big faults after
compression), and finding special characters to copy. More tools are
planned (SVG viewer, color tools; see `src/tools/registry.ts`).

Success is a tool that does its one job quickly and correctly, and material
that never leaves the machine while it does.

## Positioning

Content processed by a tool never leaves the machine, and this is enforced
rather than promised: a Content Security Policy blocks every outgoing
connection, tests fail on any off-origin request, and content lives only in
memory. The code is public so the claim can be checked. See `INTENT.md`,
the rule every change is checked against.

## Operating Context

- Use depends on the tool. The deworder and text tools are quick jobs,
  opened for a few minutes mid-task next to the CMS or other work, then
  closed. The PDF viewer is a longer review session, paging through two
  documents of a few hundred pages.
- Material handled can be confidential, unpublished or copyrighted.
- Input arrives as files (drag-and-drop or picker) or pasted text; output
  leaves only by explicit copy or download.
- Served from GitHub Pages at https://day4125.github.io/sidebench/, one real
  page per tool, no client-side router.

## Capabilities and Constraints

- **Live tools:** html-deworder (upload, map Word classes to semantic tags,
  preview, download; must keep parity with the legacy prodtools engine and
  its `config.json` format), Textmanipulator, PDF sida vid sida (two PDFs,
  one page pair at a time, star pages that differ, KB per page), Diff
  checker (two texts compared live; inline or side-by-side view, folded
  unchanged runs, hidden characters shown), Specialtecken (search a
  hand-picked character set in Swedish or English, copy the character or its
  HTML entity; recent copies kept per tab in sessionStorage).
- **Privacy rules (non-negotiable, from `INTENT.md`):** all processing
  local; no network at runtime (no APIs, CDNs, remote fonts, analytics);
  content never written to storage; only UI state persists, under
  `sidebench:site:*`; user content previewed in sandboxed iframes; runtime
  dependencies kept few and reviewed.
- **CSP limits the UI toolkit:** no inline `<style>` injection (Radix Select
  is out, native selects used; scroll-lock shim in `src/lib/style-singleton.ts`),
  fonts self-hosted and subset (Geist, Latin only; other characters fall back
  to the system font so glyph loads can't reveal content).
- **UI language:** Swedish, no i18n layer.
- **Stack:** Vite, React, TypeScript, Tailwind v4, shadcn/ui (added one
  component at a time), lucide icons.
- **Open:** the visual direction. Current tokens are a placeholder (port
  plan step 7); shared patterns across tools (step indicators, drop zones,
  feedback, errors) are still to be decided. PWA/offline install is a later
  maybe.

## Brand Commitments

- Name: **sidebench**, lowercase. Brand mark is a workbench drawn on
  lucide's grid (`src/app/BrandMark.tsx`, `public/favicon.svg`).
- Tool names as in the registry (e.g. "html-deworder", "Textmanipulator").
- The old terminal/monospace house style from prodtools is retired and
  should not come back.

## Evidence on Hand

- Test fixtures only: `tests/unit/deworder/fixtures/` (Word exports and a
  golden cleaned file), `tests/e2e/fixtures/` (generated PDFs, a legacy
  `config.json`). Real documents stay local and gitignored.
- No users, testimonials, metrics or case studies exist. Don't invent any.

## Product Principles

1. **Privacy is structural.** A design or feature that needs content to
   leave the page, persist, or load something remote doesn't go in, however
   good it looks.
2. **One tool, one job, fast.** Quick-job tools should be usable within
   seconds of opening; nothing between the user and the task.
3. **Long sessions deserve room.** Review tools like the PDF viewer give the
   material the screen and stay out of the way.
4. **Proven behavior is preserved.** Ported logic keeps parity; UI changes
   to legacy behavior are deliberate and recorded.
5. **Built for one expert user.** Density and shortcuts over hand-holding.

## Accessibility & Inclusion

No specific user needs or formal standard. Keep sensible defaults: keyboard
operation, screen-reader labels (in Swedish), and contrast that holds in
light and dark themes.
