import { useState, type DragEvent } from "react";
import { ArrowRight, FileCheck, FolderOpen } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { SourceName, StepHeader } from "./DeworderApp";

export type InputMode = "file" | "paste";

interface Props {
  mode: InputMode;
  onModeChange: (mode: InputMode) => void;
  file: File | null;
  onFileChange: (file: File | null) => void;
  paste: string;
  onPasteChange: (text: string) => void;
  onContinue: () => void;
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
      <Tabs value={mode} onValueChange={(v) => onModeChange(v as InputMode)}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList aria-label="Inmatningssätt">
            <TabsTrigger value="file" className="px-3">
              <span>
                <code className="font-mono">.html</code>-fil
              </span>
            </TabsTrigger>
            <TabsTrigger value="paste" className="px-3">
              Klistra in
            </TabsTrigger>
          </TabsList>
          <Button onClick={onContinue} disabled={!ready}>
            Fortsätt
            <ArrowRight data-icon="inline-end" />
          </Button>
        </div>
        <TabsContent value="file" className="mt-2">
          <DropZone file={file} onFile={onFileChange} />
        </TabsContent>
        <TabsContent value="paste" className="mt-2">
          <Textarea
            aria-label="HTML-kod"
            value={paste}
            onChange={(e) => onPasteChange(e.target.value)}
            spellCheck={false}
            placeholder="Klistra in HTML-kod här…"
            className="min-h-40 font-mono text-xs"
          />
        </TabsContent>
      </Tabs>
    </section>
  );
}

function isHtmlFile(file: File) {
  return file.type === "text/html" || /\.html?$/i.test(file.name || "");
}

export function DropZone({ file, onFile }: { file: File | null; onFile: (file: File) => void }) {
  const [over, setOver] = useState(false);

  const hover = (e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setOver(true);
  };
  const leave = (e: DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false);
  };
  // An HTML file if one was dropped, else whatever came first.
  const drop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    const files = Array.from(e.dataTransfer.files);
    const picked = files.find(isHtmlFile) ?? files[0];
    if (picked) onFile(picked);
  };

  const Icon = file ? FileCheck : FolderOpen;
  return (
    <label
      data-testid="drop-zone"
      onDragEnter={hover}
      onDragOver={hover}
      onDragLeave={leave}
      onDrop={drop}
      className={cn(
        "flex min-h-40 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-6 text-center text-sm transition-colors",
        "hover:border-primary/60 hover:bg-accent/50 has-focus-visible:border-ring has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
        over && "border-primary bg-accent",
        file && !over && "border-primary/60",
      )}
    >
      <input
        type="file"
        accept=".html,.htm,text/html"
        className="sr-only"
        onChange={(e) => {
          const picked = e.target.files?.[0];
          if (picked) onFile(picked);
        }}
      />
      <Icon aria-hidden="true" className={cn("size-8", file ? "text-primary" : "text-muted-foreground")} />
      {file ? (
        <span className="font-mono break-all">{file.name}</span>
      ) : (
        <span className="text-muted-foreground">
          Dra och släpp eller <span className="text-primary underline underline-offset-4">klicka för att bläddra</span>
        </span>
      )}
    </label>
  );
}
