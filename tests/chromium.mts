import { existsSync } from "node:fs";

// Locally, use the system Chromium when Playwright's own browser isn't
// installed. CHROMIUM_PATH overrides; CI uses Playwright's browser.
export const chromiumPath =
  process.env.CHROMIUM_PATH ??
  (!process.env.CI && existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined);
