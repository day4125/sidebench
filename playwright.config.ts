import { defineConfig } from "@playwright/test";
import { chromiumPath } from "./tests/chromium.mts";

const port = 4173;
const local = `http://127.0.0.1:${port}/sidebench/`;

// BASE_URL points the tests at a deployed site instead of a local build,
// e.g. BASE_URL=https://day4125.github.io/sidebench/ npm run test:e2e
const remote = process.env.BASE_URL;

export default defineConfig({
  testDir: "tests/e2e",
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: remote ?? local,
    launchOptions: { executablePath: chromiumPath },
  },
  // Tests run against the production build, where the CSP is injected.
  webServer: remote
    ? undefined
    : {
        command: `npm run build && npx vite preview --host 127.0.0.1 --port ${port} --strictPort`,
        url: local,
        reuseExistingServer: !process.env.CI,
      },
});
