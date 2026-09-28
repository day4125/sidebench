import { useMemo, useRef, useState, type Ref } from "react";
import { ArrowDown, ArrowLeft, ArrowUp, Copy, Download, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFlash } from "@/hooks/use-flash";
import { saveFile } from "@/lib/download";
import { applyPreview, preparePreview } from "@/lib/sandboxed-preview";
import { SourceName, StepHeader, type Result, type Source } from "./DeworderApp";
import { highlightHtml, type TokenKind } from "./highlight";

interface Props {
  source: Source;
  result: Result;
  onNewFile: () => void;
  onAdjust: () => void;
  onError: (e: unknown) => void;
}

export function PreviewStep({ source, result, onNewFile, onAdjust, onError }: Props) {
  const [copied, flashCopied] = useFlash();
  const [saved, flashSaved] = useFlash();
  const before = useRef<HTMLIFrameElement>(null);
  const after = useRef<HTMLIFrameElement>(null);
  const [hasHeadings, setHasHeadings] = useState(false);
  const headingIndex = useRef(-1);

  const download = () => {
    const name = `${source.filename.replace(/\.[^.]+$/, "")}.cleaned.html`;
    saveFile(name, result.cleaned, "text/html;charset=utf-8");
    flashSaved();
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(result.cleaned);
      flashCopied();
    } catch (e) {
      onError(e);
    }
  };

  // Steps through the "after" pane's headings, wrapping around, and scrolls
  // the "before" pane to the heading with the same index. There, headings
  // are h1–h6 plus elements with a class mapped to one.
  const stepHeading = (delta: number) => {
    if (!before.current || !after.current) return;
    const afterHeadings = headingsIn(after.current, []);
    if (!afterHeadings.length) return;
    const i = headingIndex.current;
    const n = afterHeadings.length;
    const next = i < 0 ? (delta > 0 ? 0 : n - 1) : (((i + delta) % n) + n) % n;
    headingIndex.current = next;
    scrollToHeading(after.current, afterHeadings, next);
    scrollToHeading(before.current, headingsIn(before.current, result.headingClasses), next);
  };

  return (
    <>
      <section className="flex flex-col gap-4" aria-labelledby="step-3">
        <StepHeader n={3} title="Förhandsgranska och ladda ned">
          <span>
            {source.raw.length} → {result.cleaned.length} tecken
          </span>
          <SourceName name={source.filename} />
        </StepHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={onNewFile}>
            <RotateCcw data-icon="inline-start" />
            Ladda upp annan fil
          </Button>
          <Button variant="ghost" onClick={onAdjust}>
            <ArrowLeft data-icon="inline-start" />
            Justera mappning
          </Button>
          <Button className="ml-auto" onClick={download}>
            <Download data-icon="inline-start" />
            {saved ? "Nedladdad" : "Ladda ned HTML-fil"}
          </Button>
        </div>
      </section>

      <section className="relative" aria-label="Källkod">
        <Button variant="secondary" size="sm" className="absolute top-2 right-4" onClick={copy}>
          <Copy data-icon="inline-start" />
          {copied ? "Kopierat" : "Kopiera"}
        </Button>
        <SourceView source={result.cleaned} />
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="preview-heading">
        <h2 id="preview-heading" className="text-lg font-semibold tracking-tight">
          Renderad jämförelse
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <PreviewPane label="Före" html={source.raw} ref={before} />
          <PreviewPane
            label="Efter"
            html={result.cleaned}
            ref={after}
            onReady={(frame) => setHasHeadings(headingsIn(frame, []).length > 0)}
          />
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="outline" disabled={!hasHeadings} onClick={() => stepHeading(-1)}>
            <ArrowUp data-icon="inline-start" />
            Föregående rubrik
          </Button>
          <Button variant="outline" disabled={!hasHeadings} onClick={() => stepHeading(1)}>
            Nästa rubrik
            <ArrowDown data-icon="inline-end" />
          </Button>
        </div>
      </section>
    </>
  );
}

interface PaneProps {
  label: string;
  html: string;
  ref: Ref<HTMLIFrameElement>;
  onReady?: (frame: HTMLIFrameElement) => void;
}

function PreviewPane({ label, html, ref, onReady }: PaneProps) {
  const prepared = useMemo(() => preparePreview(html), [html]);
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <h3 className="text-sm font-medium text-muted-foreground">{label}</h3>
      <iframe
        ref={ref}
        title={`Förhandsvisning ${label.toLowerCase()}`}
        sandbox="allow-same-origin"
        srcDoc={prepared.srcdoc}
        onLoad={(e) => {
          applyPreview(e.currentTarget, prepared);
          onReady?.(e.currentTarget);
        }}
        className="h-90 w-full rounded-xl border bg-white md:h-120"
      />
    </div>
  );
}

const TOKEN_CLASS: Record<TokenKind, string> = {
  tag: "text-primary",
  attr: "text-sky-700 dark:text-sky-300",
  val: "text-violet-700 dark:text-violet-300",
  punc: "text-muted-foreground",
  ent: "text-amber-700 dark:text-amber-300",
  com: "text-muted-foreground italic",
  doc: "text-muted-foreground",
};

function SourceView({ source }: { source: string }) {
  const tokens = useMemo(() => highlightHtml(source), [source]);
  return (
    <pre
      data-testid="source"
      tabIndex={0}
      className="max-h-120 overflow-auto rounded-xl border bg-muted/40 p-4 pr-28 font-mono text-xs leading-relaxed whitespace-pre-wrap break-words outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {tokens.map((t, i) => (t.kind ? <span key={i} className={TOKEN_CLASS[t.kind]}>{t.text}</span> : t.text))}
    </pre>
  );
}

function headingsIn(frame: HTMLIFrameElement, classNames: string[]) {
  const doc = frame.contentDocument;
  if (!doc) return [];
  const selectors = ["h1", "h2", "h3", "h4", "h5", "h6"];
  for (const cls of classNames) {
    if (/^[A-Za-z][\w-]*$/.test(cls)) selectors.push(`.${cls}`);
  }
  return Array.from(doc.querySelectorAll(selectors.join(",")));
}

function scrollToHeading(frame: HTMLIFrameElement, headings: Element[], index: number) {
  const doc = frame.contentDocument;
  if (!doc || !headings.length) return;
  const el = headings[Math.max(0, Math.min(index, headings.length - 1))];
  const scroller = doc.scrollingElement || doc.documentElement;
  const top = el.getBoundingClientRect().top + scroller.scrollTop;
  scroller.scrollTo({ top, behavior: "smooth" });
}
