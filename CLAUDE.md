# sidebench

Small browser tools for content production. Swedish UI, served from GitHub
Pages. Commands and test setup are in [README.md](README.md).

@docs/INTENT.md

## Where things are written down

- **docs/TODO.md** is the backlog. When an item is finished, move it to Done
  with the date. New follow-ups and deferred ideas go there too.
- **docs/DECISIONS.md** records settled choices with a date and the reason. Add
  an entry when a question is decided; don't re-open one without new facts.
- **PRODUCT.md** describes the users and what the product is for. It
  stays at the root because the Impeccable skill reads it from there.
- **docs/archive/** holds finished plans. History, not instructions.
- **docs/copy-review/** is the copy review in progress (temporary).
- **AGENTS.md** is a symlink to this file, for other coding agents. Edit
  CLAUDE.md.
- How a change was built goes in its commit message, not in a doc.

## Stack

- Vite + React + TypeScript, multi-page: one HTML entry per tool, no
  client-side router.
- Tailwind CSS v4, shadcn/ui (components in `src/components/ui/` are owned
  source and have been edited; see the comments there), lucide icons.
- Fonts self-hosted (`@fontsource-variable/geist`, Latin subset only).
- Tests: Vitest in browser mode (real Chromium) under `tests/unit/`,
  Playwright against the built `dist/` under `tests/e2e/`.

## Privacy, enforced by the build

- A CSP meta tag on every page, injected at build time by
  `vite.config.mts` (the dev server runs without it, for HMR). Keep
  `connect-src 'none'` and a strict `style-src`. Inline styles get
  blocked, so apply styles through the CSSOM or constructable
  stylesheets (see `src/lib/sandboxed-preview.ts`,
  `src/lib/style-singleton.ts`).
- `scripts/check-remote-urls.mjs` fails the build on `http(s)://` in
  `dist/` outside an allowlist.
- The e2e tests fail on off-origin requests, unexpected console errors,
  storage keys outside `sidebench:site:*` and cookies.
- Tool content lives in React state only. UI settings go through
  `src/lib/storage.ts`.
- The start page's privacy block mirrors the CSP in `vite.config.mts`.
  Keep the two in step.

## Dependencies

- Runtime dependencies are few, pinned through the lockfile and reviewed
  before adding: check for network calls and what they pull in. Every one
  handles user content.
- Add shadcn components one at a time, never the whole catalog. Ones that
  bring larger libraries (sonner, cmdk, react-hook-form + zod, recharts,
  react-day-picker, vaul, embla) need a reason.
- `npm audit` runs in CI but doesn't gate the build.

## Adding a tool

1. `<slug>.html` at the root (copy one, `lang="sv"`), loading
   `src/tools/<slug>/main.tsx`.
2. Add the page to `pages` in `vite.config.mts`.
3. An entry in `src/tools/registry.ts` (feeds the sidebar and the start
   page).
4. `main.tsx` mounts the app with `mount()` from `src/app/mount.tsx`; the
   app renders inside `<AppShell tool="<slug>">`.
5. Pure logic in an `engine.ts` with unit tests; UI in `<Name>App.tsx`
   with an e2e spec in `tests/e2e/`.

## Working here

- Run `npm test` (unit, then build and e2e) before committing. Most e2e
  tests find elements by their visible text, so a copy change updates the
  tests in the same commit.
- Commit messages: `Tool: what changed` as the subject, then a body saying
  what it does and why, in plain prose.
- `src/app/elements.tsx` (`elements.html`) shows every control the tools
  use. Check the look there when changing shared UI.
