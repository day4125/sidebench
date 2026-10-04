# Intent

sidebench is a set of small browser tools for content production: cleaning
Word-exported HTML, text operations, comparing PDFs, and more over time.

## The principle

**Content processed by a tool never leaves the machine.**

The materials going through these tools can be confidential, unpublished or
copyrighted. Everything else about the project is negotiable: stack, look,
structure, which tools exist. This isn't.

## What it means in practice

- **All processing is local.** Everything runs in the browser, with no
  backend and no server-side step.
- **No network at runtime.** No API calls, CDNs, remote fonts, analytics,
  telemetry or error reporting. The tools work fully offline.
- **Enforced, not just avoided.** A Content Security Policy blocks outgoing
  connections on every page, and a test fails if any page makes a request
  to anywhere other than itself. A dependency that tries to call out gets
  stopped by the browser.
- **Content lives in memory only.** It isn't written to `localStorage`,
  IndexedDB, caches or cookies. It leaves only when the user explicitly
  copies or downloads it.
- **UI state may persist, content may not.** Things like the theme or
  sidebar state can be saved locally under `sidebench:site:*`. Never
  anything from the material being processed.
- **User content is rendered sandboxed.** Previews of processed HTML go in
  iframes with `sandbox="allow-same-origin"` only, so embedded scripts,
  forms and navigation can't run.
- **Dependencies are a trust decision.** Every runtime dependency is code
  that handles the content. Keep them few, pinned and reviewed before
  adding.

## Not principles

These are implementation choices and can change:

- Build step or not, framework or not.
- Where the code is served from: GitHub Pages, a local server or
  `file://`. Loading the page is fine; sending content anywhere is not.
- Visual style and UI language.

## Checking a change

Before merging, ask: does this add any way for content to leave the machine,
or to outlive the session? That includes a network call, a new storage
write, or a dependency that could do either. If yes, it doesn't go in.
