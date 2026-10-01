import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { pdfjs } from "./scripts/vite-plugin-pdfjs.mts";

// The privacy rule from INTENT.md, enforced by the browser. GitHub Pages
// can't set response headers, so the policy ships as a meta tag.
// connect-src 'none' refuses fetch/XHR/WebSocket, even to our own origin.
const CSP = [
  "default-src 'self'",
  "connect-src 'none'",
  "img-src 'self' data: blob:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join("; ");

// Build only: the dev server needs inline scripts and a WebSocket for HMR.
function csp(): Plugin {
  return {
    name: "sidebench-csp",
    apply: "build",
    transformIndexHtml: {
      order: "pre",
      handler: () => [
        {
          tag: "meta",
          attrs: { "http-equiv": "Content-Security-Policy", content: CSP },
          injectTo: "head-prepend",
        },
      ],
    },
  };
}

// Shared <head> tags for every page. theme-init.js is a classic blocking
// script (see the file); both live in public/ and are served as they are.
function head(): Plugin {
  let base = "/";
  return {
    name: "sidebench-head",
    configResolved: (config) => {
      base = config.base;
    },
    transformIndexHtml: () => [
      { tag: "link", attrs: { rel: "icon", type: "image/svg+xml", href: `${base}favicon.svg` }, injectTo: "head" },
      { tag: "script", attrs: { src: `${base}theme-init.js` }, injectTo: "head" },
    ],
  };
}

// One HTML entry per tool; no client-side router.
const pages = ["index", "deworder", "text", "pdfview", "diff", "chars", "elements", "color", "svg"];

export default defineConfig({
  base: "/sidebench/",
  plugins: [react(), tailwindcss(), csp(), head(), pdfjs()],
  resolve: {
    alias: [
      { find: "@", replacement: resolve(import.meta.dirname, "src") },
      // CSP-safe stand-in, see the file.
      { find: /^react-style-singleton$/, replacement: resolve(import.meta.dirname, "src/lib/style-singleton.ts") },
    ],
  },
  build: {
    rollupOptions: {
      input: Object.fromEntries(
        pages.map((p) => [p, resolve(import.meta.dirname, `${p}.html`)]),
      ),
    },
  },
});
