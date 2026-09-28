// PDF.js, set up to work under the site's CSP (connect-src 'none') with no
// network at all: the file comes in as bytes from the File API, and every
// support file PDF.js would normally fetch is bundled instead.
import { getDocument, GlobalWorkerOptions, type PDFDocumentLoadingTask } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

// The worker runs as its own file, same origin (worker-src 'self').
GlobalWorkerOptions.workerSrc = workerUrl;

// Standard fonts and CMaps as lazy base64 chunks (scripts/vite-plugin-pdfjs.mts),
// loaded only when a document needs one.
const bundled: Record<string, Record<string, () => Promise<string>>> = {
  standardFontDataUrl: import.meta.glob<string>("/node_modules/pdfjs-dist/standard_fonts/*.{pfb,ttf}", {
    query: "?base64",
    import: "default",
  }),
  cMapUrl: import.meta.glob<string>("/node_modules/pdfjs-dist/cmaps/*.bcmap", {
    query: "?base64",
    import: "default",
  }),
};

/** Answers PDF.js's requests for support files from the bundle, never fetch. */
class BundledDataFactory {
  async fetch({ kind, filename }: { kind: string; filename: string }): Promise<Uint8Array> {
    const files = bundled[kind] ?? {};
    const load = Object.entries(files).find(([path]) => path.endsWith(`/${filename}`))?.[1];
    if (!load) throw new Error(`No bundled PDF.js ${kind} file: ${filename}`);
    return Uint8Array.fromBase64(await load());
  }
}

/** Opens a PDF from its bytes. The buffer is transferred to the worker. */
export function openPdf(data: Uint8Array): PDFDocumentLoadingTask {
  return getDocument({
    data,
    // Support files come from BundledDataFactory on the main thread.
    useWorkerFetch: false,
    BinaryDataFactory: BundledDataFactory,
    // Bundled standard fonts rather than whatever the system has, so a page
    // renders the same on every machine.
    useSystemFonts: false,
    // WebAssembly would need 'wasm-unsafe-eval' in the CSP. Without it, PDF.js
    // imports its pure-JS JPEG 2000 and JBIG2 decoders from here instead.
    // ICC color profiles need wasm, so ICC-based colors use their fallback.
    useWasm: false,
    wasmUrl: new URL(`${import.meta.env.BASE_URL}pdfjs/wasm/`, location.href).href,
  });
}
