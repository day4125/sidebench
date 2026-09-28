import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

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

// One HTML entry per tool; no client-side router.
const pages = ["index", "deworder", "text", "pdfview"];

export default defineConfig({
  base: "/sidebench/",
  plugins: [react(), tailwindcss(), csp()],
  resolve: {
    alias: { "@": resolve(import.meta.dirname, "src") },
  },
  build: {
    rollupOptions: {
      input: Object.fromEntries(
        pages.map((p) => [p, resolve(import.meta.dirname, `${p}.html`)]),
      ),
    },
  },
});
