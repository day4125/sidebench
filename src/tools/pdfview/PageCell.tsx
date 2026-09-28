// One page in the workspace. It owns its canvas: rendered at the display
// size × devicePixelRatio (capped), drawn into a new canvas that replaces
// the old one only once it's done, so a zoom never flashes blank. Every
// canvas is freed (width = 0) when it's replaced, cancelled or unmounted.
import { useEffect, useRef, useState } from "react";
import { RenderingCancelledException, type RenderTask } from "pdfjs-dist";
import { cn } from "cn";
import type { PdfFile, Side } from "./files";
import type { Box } from "./layout";

const MAX_CANVAS_PIXELS = 16 * 1024 * 1024;

/** What the cell has finished drawing, or failed to. */
interface Drawn {
  file: PdfFile;
  page: number;
  error: boolean;
}

interface Props {
  side: Side;
  file: PdfFile;
  /** Page number, or null for a row where this side has no page. */
  page: number | null;
  box: Box;
  /** CSS px per point to render at. */
  renderScale: number;
}

function free(canvas: HTMLCanvasElement | null) {
  if (!canvas) return;
  canvas.width = 0;
  canvas.height = 0;
  canvas.remove();
}

export function PageCell({ side, file, page, box, renderScale }: Props) {
  const holder = useRef<HTMLDivElement>(null);
  const shown = useRef<HTMLCanvasElement | null>(null);
  // Which page `shown` holds.
  const shownFor = useRef<{ file: PdfFile; page: number } | null>(null);
  const [drawn, setDrawn] = useState<Drawn | null>(null);
  const state = drawn?.file === file && drawn.page === page ? (drawn.error ? "error" : "rendered") : "rendering";

  useEffect(() => {
    if (page === null) return;
    // Another page's picture must not stand in while this one renders; the
    // same page at the old zoom may (stretched).
    if (shownFor.current && (shownFor.current.file !== file || shownFor.current.page !== page)) {
      free(shown.current);
      shown.current = null;
      shownFor.current = null;
    }
    const doc = file.doc;
    let cancelled = false;
    let task: RenderTask | null = null;
    let canvas: HTMLCanvasElement | null = null;

    (async () => {
      try {
        const p = await doc.getPage(page);
        if (cancelled) return;
        const base = p.getViewport({ scale: 1 });
        let s = renderScale * (window.devicePixelRatio || 1);
        const px = base.width * s * base.height * s;
        if (px > MAX_CANVAS_PIXELS) s *= Math.sqrt(MAX_CANVAS_PIXELS / px);
        const viewport = p.getViewport({ scale: s });
        canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.floor(viewport.width));
        canvas.height = Math.max(1, Math.floor(viewport.height));
        canvas.className = "absolute inset-0 size-full";
        task = p.render({ canvas, viewport });
        await task.promise;
        if (cancelled) {
          free(canvas);
          return;
        }
        free(shown.current);
        holder.current!.append(canvas);
        shown.current = canvas;
        shownFor.current = { file, page };
        canvas = null;
        setDrawn({ file, page, error: false });
      } catch (e) {
        free(canvas);
        if (cancelled || e instanceof RenderingCancelledException) return;
        // Anything else leaves the page blank rather than breaking the view.
        console.error(e);
        setDrawn({ file, page, error: true });
      }
    })();

    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [file, page, renderScale]);

  // A page that leaves the screen also gives back what PDF.js holds for it
  // (parsed content, images). PDF.js defers this while a render is running.
  useEffect(() => {
    if (page === null) return;
    return () => {
      // A closed document throws or rejects here; nothing to free then.
      void (async () => (await file.doc.getPage(page)).cleanup())().catch(() => {});
    };
  }, [file, page]);

  useEffect(
    () => () => {
      free(shown.current);
      shown.current = null;
    },
    [],
  );

  const label = side === "a" ? "Original" : "Komprimerad";
  if (page === null) {
    return (
      <div
        data-testid="pdf-missing"
        data-side={side}
        className="flex items-center justify-center rounded-sm border-2 border-dashed text-sm text-muted-foreground"
        style={{ width: box.w, height: box.h }}
      >
        saknas
      </div>
    );
  }
  return (
    <div
      ref={holder}
      role="img"
      aria-label={`${label}, sida ${page}`}
      data-testid="pdf-page"
      data-side={side}
      data-page={page}
      data-state={state}
      className={cn("relative bg-white shadow-sm ring-1 ring-border", state === "error" && "bg-destructive/10")}
      style={{ width: box.w, height: box.h }}
    />
  );
}
