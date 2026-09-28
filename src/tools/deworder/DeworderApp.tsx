// html-deworder: upload → map → preview. Rebuilt from prodtools'
// static/deworder-app.js on the unchanged engine. Everything from the
// document (file, text, mapping, output) lives in this component's state
// only (INTENT.md); it leaves only through copy or download.
import { useState, type ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "cn";
import { AppShell } from "@/app/AppShell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  DEFAULT_CONFIG,
  clean,
  decodeHtmlBytes,
  detectClasses,
  mergeConfig,
  type DetectedClass,
} from "./engine/deworder";
import { cleanConfig, formFromConfig, headingClasses, type MappingForm } from "./mapping";
import { MappingStep } from "./MappingStep";
import { PreviewStep } from "./PreviewStep";
import { UploadStep, type InputMode } from "./UploadStep";

type Step = 1 | 2 | 3;

export interface Source {
  filename: string;
  raw: string;
  rows: DetectedClass[];
}

export interface Result {
  cleaned: string;
  /** Classes mapped to h1–h6, to find headings in the "before" pane. */
  headingClasses: string[];
}

const CLEAN_ERROR = "Något gick fel vid rensningen. Kontrollera filen och försök igen.";
const CONFIG_ERROR = "Kunde inte läsa config-filen. Kontrollera att det är giltig JSON.";

export function DeworderApp() {
  const [step, setStep] = useState<Step>(1);
  const [error, setError] = useState<string | null>(null);
  // The loaded config (the default until a config.json is picked).
  const [config, setConfig] = useState(() => mergeConfig(DEFAULT_CONFIG));

  const [mode, setMode] = useState<InputMode>("file");
  const [file, setFile] = useState<File | null>(null);
  const [paste, setPaste] = useState("");

  const [source, setSource] = useState<Source | null>(null);
  const [form, setForm] = useState<MappingForm | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  function go(next: Step) {
    setError(null);
    setStep(next);
  }

  function fail(e: unknown, message: string) {
    console.warn(e);
    setError(message);
  }

  // Resets the table to `cfg`, as legacy renderMappingTable() did. With no
  // classes found it left the options alone, and so does this.
  function showConfig(cfg: typeof config, rows: DetectedClass[]) {
    if (rows.length) setForm(formFromConfig(cfg, rows));
    setExpanded(false);
  }

  async function toMapping() {
    try {
      let filename: string;
      let raw: string;
      if (mode === "file") {
        if (!file) throw new Error("No file selected");
        filename = file.name || "input.html";
        raw = decodeHtmlBytes(await file.arrayBuffer());
      } else {
        filename = "pasted.html";
        raw = paste;
      }
      const rows = detectClasses(raw);
      setSource({ filename, raw, rows });
      setForm(formFromConfig(config, rows));
      setExpanded(false);
      go(2);
    } catch (e) {
      fail(e, CLEAN_ERROR);
    }
  }

  function toPreview() {
    if (!source || !form) return;
    try {
      const cfg = cleanConfig(form, config);
      setResult({ cleaned: clean(source.raw, cfg), headingClasses: headingClasses(cfg) });
      go(3);
    } catch (e) {
      fail(e, CLEAN_ERROR);
    }
  }

  function startOver() {
    setFile(null);
    setPaste("");
    setSource(null);
    setForm(null);
    setResult(null);
    go(1);
  }

  async function loadConfig(picked: File): Promise<boolean> {
    try {
      const next = mergeConfig(JSON.parse(await picked.text()));
      setConfig(next);
      if (source) showConfig(next, source.rows);
      setError(null);
      return true;
    } catch {
      setError(CONFIG_ERROR);
      return false;
    }
  }

  return (
    <AppShell tool="deworder">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <StepIndicator step={step} onBack={go} />
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {step === 1 && (
          <UploadStep
            mode={mode}
            onModeChange={setMode}
            file={file}
            onFileChange={setFile}
            paste={paste}
            onPasteChange={setPaste}
            onContinue={toMapping}
          />
        )}
        {step === 2 && source && form && (
          <MappingStep
            source={source}
            form={form}
            onFormChange={setForm}
            expanded={expanded}
            onExpandedChange={setExpanded}
            config={config}
            onReset={() => showConfig(config, source.rows)}
            onLoadConfig={loadConfig}
            onNewFile={startOver}
            onPreview={toPreview}
          />
        )}
        {step === 3 && source && result && (
          <PreviewStep
            source={source}
            result={result}
            onNewFile={startOver}
            onAdjust={() => go(2)}
            onError={(e) => fail(e, "Kunde inte kopiera till urklipp.")}
          />
        )}
      </div>
    </AppShell>
  );
}

const STEPS = ["Ladda upp", "Mappa", "Förhandsgranska"];

// Steps behind the current one are buttons; moving forward is left to each
// step's own actions.
function StepIndicator({ step, onBack }: { step: Step; onBack: (s: Step) => void }) {
  return (
    <nav aria-label="Steg">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        {STEPS.map((label, i) => {
          const n = (i + 1) as Step;
          const done = n < step;
          const current = n === step;
          const dot = (
            <span
              aria-hidden="true"
              className={cn(
                "flex size-6 items-center justify-center rounded-full border text-xs font-medium",
                current && "border-primary bg-primary text-primary-foreground",
                done && "border-primary text-primary",
                !current && !done && "text-muted-foreground",
              )}
            >
              {done ? <Check className="size-3.5" /> : n}
            </span>
          );
          return (
            <li key={label} className="flex items-center gap-2">
              {i > 0 && <span aria-hidden="true" className="hidden h-px w-6 bg-border sm:block" />}
              {done ? (
                <button
                  type="button"
                  onClick={() => onBack(n)}
                  className="flex items-center gap-2 rounded-md px-1 py-0.5 text-foreground outline-none hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {dot}
                  {label}
                </button>
              ) : (
                <span
                  aria-current={current ? "step" : undefined}
                  className={cn("flex items-center gap-2 px-1 py-0.5", current ? "font-medium" : "text-muted-foreground")}
                >
                  {dot}
                  {label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** A step's heading row: number, title and a meta line. */
export function StepHeader({ n, title, children }: { n: number; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
      <h2 id={`step-${n}`} className="flex items-baseline gap-2 text-lg font-semibold tracking-tight">
        <span className="text-primary tabular-nums">{n}.</span>
        {title}
      </h2>
      {children && (
        <p className="flex flex-wrap gap-x-4 text-sm text-muted-foreground" data-testid="step-meta">
          {children}
        </p>
      )}
    </div>
  );
}

/** "källa: name.html" in the step meta lines. */
export function SourceName({ name }: { name: string }) {
  return (
    <span>
      källa: <code className="font-mono text-foreground">{name}</code>
    </span>
  );
}
