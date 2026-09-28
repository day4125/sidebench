import { resolve } from "node:path";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";
import { chromiumPath } from "./tests/chromium.mts";

// Unit tests run in a real browser: the deworder engine relies on
// DOMParser, and jsdom serializes differently from Chromium.
export default defineConfig({
  resolve: {
    alias: { "@": resolve(import.meta.dirname, "src") },
  },
  test: {
    include: ["tests/unit/**/*.test.ts"],
    browser: {
      enabled: true,
      headless: true,
      provider: playwright({ launchOptions: { executablePath: chromiumPath } }),
      instances: [{ browser: "chromium" }],
    },
  },
});
