// PDF sida vid sida: pick an original (A) and a compressed copy (B), then
// page through both, one pair of pages at a time, in a full-window
// workspace. Rebuilt from prodtools'
// static/pdfview-app.js on the ported layout math (layout.ts) and PDF.js
// from pdfjs.ts.
//
// The PDFs are read with the File API and held in memory only (INTENT.md).
// The stars are in-memory too; the only thing that leaves the page is the
// star list, through an explicit copy.
import { useEffect, useRef, useState, type DragEvent } from "react";
import { ArrowRight, FileCheck, FileX, FolderOpen, LoaderCircle } from "lucide-react";
import { cn } from "cn";
import { AppShell } from "@/app/AppShell";
import { Button } from "@/components/ui/button";
import type { PDFDocumentLoadingTask } from "pdfjs-dist";
import { SIDE_NAME, firstFile, hasFiles, isPdf, type PdfFile, type Side, type Toast } from "./files";
import { openPdf } from "./pdfjs";
import { Workspace } from "./Workspace";

interface PickerStatus {
  text: string;
  state: "loading" | "ok" | "error";
}

export function PdfViewApp() {
  const [files, setFiles] = useState<Record<Side, PdfFile | null>>({ a: null, b: null });
  const [status, setStatus] = useState<Record<Side, PickerStatus | null>>({ a: null, b: null });
  const [open, setOpen] = useState(false);
  const [stars, setStars] = useState<ReadonlySet<number>>(new Set());
  // The B offset stays while the workspace is closed and reopened.
  const [offset, setOffset] = useState(0);
  const [toast, setToast] = useState<Toast | null>(null);

  // Mirrors for the async loader: a load bumps its side's token, so a stale
  // one is dropped, and it needs the current files and step.
  const tokens = useRef({ a: 0, b: 0 });
  const filesRef = useRef(files);
  const openRef = useRef(open);
  openRef.current = open;

  const setSide = (side: Side, value: PickerStatus | null) => setStatus((s) => ({ ...s, [side]: value }));
  const showToast = (text: string) => {
    if (openRef.current) setToast((t) => ({ id: (t?.id ?? 0) + 1, text }));
  };

  async function handleFile(side: Side, file: File | null | undefined) {
    if (!file) return;
    const current = filesRef.current[side];
    if (!isPdf(file)) {
      const kept = current ? ` (behåller ${current.name})` : "";
      setSide(side, { text: `Inte en PDF-fil: ${file.name}${kept}`, state: "error" });
      showToast(`${file.name} är inte en PDF.`);
      return;
    }
    const token = ++tokens.current[side];
    setSide(side, { text: "Läser…", state: "loading" });
    let task: PDFDocumentLoadingTask | null = null;
    try {
      task = openPdf(new Uint8Array(await file.arrayBuffer()));
      // Only the page count is read here; the workspace loads one page
      // per file at a time.
      const doc = await task.promise;
      if (token !== tokens.current[side]) {
        void task.destroy();
        return;
      }
      const loaded = { doc, name: file.name, size: file.size };
      filesRef.current = { ...filesRef.current, [side]: loaded };
      setFiles(filesRef.current);
      if (current) void current.doc.loadingTask.destroy();
      setSide(side, { text: `${file.name} – ${doc.numPages} sidor`, state: "ok" });
    } catch (e) {
      console.warn(e);
      if (task) void task.destroy();
      if (token !== tokens.current[side]) return;
      const kept = filesRef.current[side];
      setSide(side, {
        text: `Kunde inte läsa PDF: ${file.name}${kept ? ` (behåller ${kept.name})` : ""}`,
        state: "error",
      });
      showToast(`Kunde inte läsa ${file.name}.`);
      return;
    }
    // A file picked here starts a new review, so old flags go. A file
    // dropped onto the workspace replaces one side mid-review (e.g. a
    // re-compressed B), so the flags and position stay.
    if (openRef.current) showToast(`${SIDE_NAME[side]} bytt: ${file.name}`);
    else setStars(new Set());
  }

  // A drop that misses every drop target must not open the PDF in this tab.
  useEffect(() => {
    const over = (e: globalThis.DragEvent) => {
      if (e.defaultPrevented) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "none";
    };
    const drop = (e: globalThis.DragEvent) => {
      if (!e.defaultPrevented) e.preventDefault();
    };
    window.addEventListener("dragover", over);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragover", over);
      window.removeEventListener("drop", drop);
    };
  }, []);

  // Free the documents when the page goes away (unless it's kept in the
  // back/forward cache and may come back).
  useEffect(() => {
    const hide = (e: PageTransitionEvent) => {
      if (e.persisted) return;
      for (const f of Object.values(filesRef.current)) void f?.doc.loadingTask.destroy();
    };
    window.addEventListener("pagehide", hide);
    return () => window.removeEventListener("pagehide", hide);
  }, []);

  if (open && files.a && files.b) {
    return (
      <Workspace
        a={files.a}
        b={files.b}
        offset={offset}
        onOffsetChange={setOffset}
        stars={stars}
        onStarsChange={setStars}
        onDropFile={(side, file) => void handleFile(side, file)}
        onClose={() => {
          setOpen(false);
          setToast(null);
        }}
        toast={toast}
        onToast={showToast}
      />
    );
  }

  return (
    <AppShell tool="pdf-compare">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <p className="text-sm text-muted-foreground">
          Välj originalet och den komprimerade versionen. Båda visas sida vid sida, en sida i taget, och bläddras tillsammans.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          {(["a", "b"] as const).map((side) => (
            <DropZone
              key={side}
              side={side}
              status={status[side]}
              onFile={(file) => void handleFile(side, file)}
            />
          ))}
        </div>
        <div className="flex justify-end">
          <Button size="lg" disabled={!(files.a && files.b)} onClick={() => setOpen(true)}>
            Öppna sida vid sida
            <ArrowRight data-icon="inline-end" />
          </Button>
        </div>
      </div>
    </AppShell>
  );
}

interface ZoneProps {
  side: Side;
  status: PickerStatus | null;
  onFile: (file: File | null) => void;
}

function DropZone({ side, status, onFile }: ZoneProps) {
  const [over, setOver] = useState(false);

  const hover = (e: DragEvent) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setOver(true);
  };
  const leave = (e: DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false);
  };
  const drop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    onFile(firstFile(e));
  };

  const state = status?.state;
  const Icon = state === "ok" ? FileCheck : state === "error" ? FileX : state === "loading" ? LoaderCircle : FolderOpen;
  return (
    <label
      data-testid={`drop-${side}`}
      onDragEnter={hover}
      onDragOver={hover}
      onDragLeave={leave}
      onDrop={drop}
      className={cn(
        "flex min-h-48 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-6 text-center text-sm transition-colors",
        "hover:border-primary/60 hover:bg-accent/50 has-focus-visible:border-ring has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
        over && "border-primary bg-accent",
        state === "ok" && !over && "border-primary/60",
      )}
    >
      <span className="text-base font-medium">{SIDE_NAME[side]}</span>
      <input
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only"
        onChange={(e) => {
          onFile(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />
      <Icon
        aria-hidden="true"
        className={cn(
          "size-8",
          state === "ok" ? "text-primary" : state === "error" ? "text-destructive" : "text-muted-foreground",
          state === "loading" && "animate-spin",
        )}
      />
      <span aria-live="polite" data-testid={`status-${side}`} className={cn(state === "error" && "text-destructive", "break-all")}>
        {status ? (
          status.text
        ) : (
          <span className="text-muted-foreground">
            Dra och släpp eller <span className="text-primary underline underline-offset-4">klicka för att bläddra</span>
          </span>
        )}
      </span>
    </label>
  );
}
