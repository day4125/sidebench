// Serves PDF.js's support files without the network, so they work under
// connect-src 'none' (see src/tools/pdfview/pdfjs.ts).
//
// - `?base64` imports: a binary file (standard font, CMap) becomes a JS module
//   exporting its bytes as base64. Loaded through import.meta.glob, each one
//   is its own lazy chunk, fetched as a script (script-src 'self'), not by
//   fetch/XHR.
// - The pure-JS image decoders (JPEG 2000, JBIG2) that PDF.js imports by URL
//   from `wasmUrl` when WebAssembly is off. They must keep their file names,
//   so they're emitted to pdfjs/wasm/ as is.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { basename, dirname, join } from "node:path";
import type { Plugin } from "vite";

const pdfjsRoot = dirname(createRequire(import.meta.url).resolve("pdfjs-dist/package.json"));
const decoders = ["openjpeg_nowasm_fallback.js", "jbig2_nowasm_fallback.js"];
export const decoderDir = "pdfjs/wasm/";

export function pdfjs(): Plugin {
  let base = "/";
  return {
    name: "sidebench-pdfjs",
    enforce: "pre",
    configResolved(config) {
      base = config.base;
    },
    load(id) {
      const [file, query] = id.split("?");
      if (query !== "base64") return;
      return `export default ${JSON.stringify(readFileSync(file).toString("base64"))};`;
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const name = req.url && basename(req.url.split("?")[0]);
        if (!name || req.url !== `${base}${decoderDir}${name}` || !decoders.includes(name)) return next();
        res.setHeader("Content-Type", "text/javascript");
        res.end(readFileSync(join(pdfjsRoot, "wasm", name)));
      });
    },
    generateBundle() {
      for (const name of decoders) {
        this.emitFile({
          type: "asset",
          fileName: `${decoderDir}${name}`,
          source: readFileSync(join(pdfjsRoot, "wasm", name)),
        });
      }
    },
  };
}
