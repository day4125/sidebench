import { ArrowRight } from "lucide-react";
import { DropZone } from "@/components/drop-zone";
import { PASTE_CLASS, SourcePicker, type SourceMode } from "@/components/source-picker";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SourceName, StepHeader } from "./DeworderApp";

export type InputMode = SourceMode;

interface Props {
  mode: InputMode;
  onModeChange: (mode: InputMode) => void;
  file: File | null;
  onFileChange: (file: File | null) => void;
  paste: string;
  onPasteChange: (text: string) => void;
  /** With a file, reads that one (state hasn't caught up yet). */
  onContinue: (file?: File) => void;
}

export function UploadStep({ mode, onModeChange, file, onFileChange, paste, onPasteChange, onContinue }: Props) {
  const ready = mode === "file" ? file !== null : paste.trim().length > 0;
  return (
    <section className="flex flex-col gap-4" aria-labelledby="step-1">
      <StepHeader n={1} title="Ladda upp HTML-fil">
        {file ? (
          <SourceName name={file.name} />
        ) : (
          <span>
            Välj en <code className="font-mono">.html</code>-fil som exporterats från Word eller klistra in HTML
          </span>
        )}
      </StepHeader>
      <SourcePicker
        mode={mode}
        onModeChange={onModeChange}
        file={
          <DropZone
            title="Word-exporterad HTML"
            hint=".html eller .htm"
            accept=".html,.htm,text/html"
            prefer={isHtmlFile}
            status={file && { state: "ok", text: file.name }}
            onFile={(f) => {
              onFileChange(f);
              onContinue(f);
            }}
            data-testid="drop-zone"
          />
        }
        paste={
          <Textarea
            aria-label="HTML-kod"
            value={paste}
            onChange={(e) => onPasteChange(e.target.value)}
            spellCheck={false}
            placeholder="Klistra in HTML-kod här…"
            className={PASTE_CLASS}
          />
        }
        actionAt="bar"
        action={
          // A chosen file opens at once; the button opens pasted code, or a
          // file kept from before when coming back to this step.
          <Button onClick={() => onContinue()} disabled={!ready}>
            Öppna
            <ArrowRight data-icon="inline-end" />
          </Button>
        }
      />
    </section>
  );
}

function isHtmlFile(file: File) {
  return file.type === "text/html" || /\.html?$/i.test(file.name || "");
}
