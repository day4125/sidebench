# sidebench

Small browser tools for content production: cleaning Word-exported HTML,
text operations, viewing PDFs, and more over time.

**Live:** https://day4125.github.io/sidebench/

Content you process never leaves your machine. Everything runs in the
browser, a Content Security Policy blocks all outgoing connections, and the
tests fail if any page makes a request anywhere but its own origin. See
[INTENT.md](INTENT.md) for the rule every change is checked against.

## Development

```sh
npm install
npm run dev        # dev server (no CSP, for HMR)
npm test           # unit tests, then build + end-to-end tests
npm run build      # type-check, build to dist/, check for remote URLs
```

Unit tests run in a real Chromium (Vitest browser mode); end-to-end tests
run Playwright against the production build. Locally both use
`/usr/bin/chromium` if Playwright's browser isn't installed
(`CHROMIUM_PATH` overrides).

Pushes to `main` are tested and deployed to GitHub Pages by
`.github/workflows/deploy.yml`.

Backlog in [TODO.md](TODO.md), settled choices in
[DECISIONS.md](DECISIONS.md). Adding a tool is described in
[CLAUDE.md](CLAUDE.md#adding-a-tool).
