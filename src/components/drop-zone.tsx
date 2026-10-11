import { useState, type DragEvent } from "react";
import { FileCheck, FileX, FolderOpen, LoaderCircle } from "lucide-react";
import { cn } from "cn";

export interface DropStatus {
  state: "loading" | "ok" | "error";
  text: string;
}

interface Props {
  /** What goes here: "Original", "SVG-fil". */
  title: string;
  /** Accepted formats and limits, one short line. */
  hint: string;
  accept: string;
  onFile: (file: File) => void;
  /** Chooses among several dropped files; the first one otherwise. */
  prefer?: (file: File) => boolean;
  /** Replaces the action line once a file is loading, loaded or refused. */
  status?: DropStatus | null;
  /** The page handles drops itself (SVG-viewer takes them anywhere) and says when one hovers. */
  over?: boolean;
  "data-testid"?: string;
  statusTestId?: string;
}

/**
 * The one file target every tool uses: same height, frame, icon and copy
 * pattern (title, action, formats), so a tool's upload looks like every
 * other's. Width comes from where it's placed.
 */
export function DropZone({ title, hint, accept, onFile, prefer, status, over: overProp, statusTestId, ...rest }: Props) {
  const [overSelf, setOverSelf] = useState(false);
  const own = overProp === undefined;
  const over = own ? overSelf : overProp;

  const hover = (e: DragEvent) => {
    if (!Array.from(e.dataTransfer.types).includes("Files")) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setOverSelf(true);
  };
  const leave = (e: DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOverSelf(false);
  };
  const drop = (e: DragEvent) => {
    e.preventDefault();
    setOverSelf(false);
    const files = Array.from(e.dataTransfer.files);
    const picked = (prefer && files.find(prefer)) ?? files[0];
    if (picked) onFile(picked);
  };

  const state = status?.state;
  const Icon = state === "ok" ? FileCheck : state === "error" ? FileX : state === "loading" ? LoaderCircle : FolderOpen;
  return (
    <label
      data-testid={rest["data-testid"]}
      {...(own && { onDragEnter: hover, onDragOver: hover, onDragLeave: leave, onDrop: drop })}
      className={cn(
        "flex min-h-52 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed p-6 text-center text-sm transition-colors",
        "hover:border-primary/60 hover:bg-accent/40 has-focus-visible:border-ring has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
        over && "border-primary bg-accent",
        state === "ok" && !over && "border-primary/60",
      )}
    >
      <input
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
      <Icon
        aria-hidden="true"
        className={cn(
          "mb-2 size-8",
          state === "error" ? "text-destructive" : "text-primary",
          state === "loading" && "animate-spin",
        )}
      />
      <span className="text-base font-medium tracking-tight">{title}</span>
      <span aria-live="polite" data-testid={statusTestId} className={cn("break-all", state === "error" && "text-destructive")}>
        {status ? (
          status.text
        ) : (
          <span className="text-muted-foreground">
            Dra och släpp eller <span className="text-primary underline underline-offset-4">välj en fil</span>
          </span>
        )}
      </span>
      <span className="text-xs text-muted-foreground">{hint}</span>
    </label>
  );
}
