// Minimal viewer from the PDF.js spike (port-plan.md, step 3): one or two
// PDFs side by side, pages rendered only near the viewport. The real UI is
// rebuilt in step 6; src/tools/pdfview/pdfjs.ts is what carries over.
import { useEffect, useRef, useState } from "react";
import {
  RenderingCancelledException,
  type PDFDocumentLoadingTask,
  type PDFDocumentProxy,
  type RenderTask,
} from "pdfjs-dist";
import { getTool } from "@/tools/registry";
import { openPdf } from "./pdfjs";

export function PdfView() {
  const tool = getTool("pdf-compare");
  const [files, setFiles] = useState<File[]>([]);

  return (
    <main className="mx-auto max-w-7xl p-6">
      <a href="./" className="text-sm text-muted-foreground hover:underline">
        ← sidebench
      </a>
      <h1 className="mt-4 text-2xl font-semibold">{tool.name}</h1>
      <p className="mt-1 text-muted-foreground">
        Förhandsversion: visar en eller två PDF:er sida vid sida.
      </p>
      <label className="mt-6 inline-flex cursor-pointer items-center gap-3 rounded-md border px-4 py-2 text-sm hover:bg-muted">
        Öppna PDF:er
        <input
          type="file"
          accept="application/pdf,.pdf"
          multiple
          className="sr-only"
          onChange={(e) => setFiles([...(e.target.files ?? [])].slice(0, 2))}
        />
      </label>
      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-flow-col md:auto-cols-fr">
        {files.map((file, i) => (
          <PdfDocument key={`${i}:${file.name}:${file.lastModified}`} file={file} />
        ))}
      </div>
    </main>
  );
}

function PdfDocument({ file }: { file: File }) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Placeholder shape for pages not rendered yet: the first page's.
  const [ratio, setRatio] = useState(Math.SQRT2);

  useEffect(() => {
    let task: PDFDocumentLoadingTask | null = null;
    let cancelled = false;
    file
      .arrayBuffer()
      .then(async (buffer) => {
        if (cancelled) return;
        task = openPdf(new Uint8Array(buffer));
        const pdf = await task.promise;
        const first = (await pdf.getPage(1)).getViewport({ scale: 1 });
        if (cancelled) return;
        setRatio(first.height / first.width);
        setDoc(pdf);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
      void task?.destroy();
      setDoc(null);
    };
  }, [file]);

  return (
    <section data-testid="pdf-document" data-pages={doc?.numPages} className="min-w-0">
      <h2 className="truncate text-sm font-medium">
        {file.name} · {doc ? `${doc.numPages} sidor` : error ? "Kunde inte öppnas" : "Läser…"}
      </h2>
      {error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="mt-3 flex flex-col gap-4">
        {doc &&
          Array.from({ length: doc.numPages }, (_, i) => (
            <PdfPage key={i} doc={doc} pageNumber={i + 1} initialRatio={ratio} />
          ))}
      </div>
    </section>
  );
}

type PageState = "idle" | "rendering" | "rendered" | "error";

/** One page. Renders when near the viewport and frees its canvas when not. */
function PdfPage({ doc, pageNumber, initialRatio }: { doc: PDFDocumentProxy; pageNumber: number; initialRatio: number }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<PageState>("idle");
  const [ratio, setRatio] = useState(initialRatio);

  useEffect(() => {
    const box = boxRef.current!;
    const canvas = canvasRef.current!;
    let task: RenderTask | null = null;
    // Bumped on every show/hide, so a render that outlived its turn stops.
    let generation = 0;

    async function render(mine: number) {
      setState("rendering");
      const page = await doc.getPage(pageNumber);
      if (mine !== generation) return;
      const natural = page.getViewport({ scale: 1 });
      setRatio(natural.height / natural.width);
      const viewport = page.getViewport({
        scale: (box.clientWidth / natural.width) * window.devicePixelRatio,
      });
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      task = page.render({ canvas, viewport });
      try {
        await task.promise;
        if (mine === generation) setState("rendered");
      } catch (e) {
        if (e instanceof RenderingCancelledException) return;
        console.error(e);
        setState("error");
      }
    }

    function hide() {
      task?.cancel();
      task = null;
      canvas.width = 0;
      canvas.height = 0;
      setState("idle");
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        generation++;
        if (entry.isIntersecting) void render(generation);
        else hide();
      },
      { rootMargin: "100% 0px" },
    );
    observer.observe(box);
    return () => {
      observer.disconnect();
      generation++;
      task?.cancel();
    };
  }, [doc, pageNumber]);

  return (
    <div
      ref={boxRef}
      data-testid="pdf-page"
      data-page={pageNumber}
      data-state={state}
      className="relative w-full bg-white shadow-sm ring-1 ring-border"
      style={{ aspectRatio: `1 / ${ratio}` }}
    >
      <canvas ref={canvasRef} className="absolute inset-0 size-full" />
    </div>
  );
}
