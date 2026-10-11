import type { ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type SourceMode = "file" | "paste";

/**
 * The input of every upload screen, in one order: the Fil / Klistra in
 * switch (when the tool takes pasted code), the input itself, then a footer
 * with a hint on the left and the primary action, always "Öppna", on the
 * right. The button stays in place in both tabs, disabled until there's
 * something to open; a chosen file opens straight away without it.
 *
 * `actionAt="bar"` puts the action beside the switch instead, for a step in
 * a sequence whose later steps keep their actions at the top (deworder).
 */
export function SourcePicker({
  mode, onModeChange, file, paste, hint, action, actionAt = "footer",
}: {
  mode: SourceMode;
  onModeChange: (mode: SourceMode) => void;
  file: ReactNode;
  paste: ReactNode;
  hint?: ReactNode;
  action?: ReactNode;
  actionAt?: "footer" | "bar";
}) {
  const inBar = actionAt === "bar";
  return (
    <Tabs value={mode} onValueChange={(v) => onModeChange(v as SourceMode)} className="gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TabsList aria-label="Inmatningssätt">
          <TabsTrigger value="file" className="px-3">
            Fil
          </TabsTrigger>
          <TabsTrigger value="paste" className="px-3">
            Klistra in
          </TabsTrigger>
        </TabsList>
        {inBar && action}
      </div>
      <TabsContent value="file">{file}</TabsContent>
      <TabsContent value="paste">{paste}</TabsContent>
      {(hint || !inBar) && <SourceFooter hint={hint} action={inBar ? undefined : action} />}
    </Tabs>
  );
}

/** Hint left, action right. */
export function SourceFooter({ hint, action }: { hint?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex min-h-9 flex-wrap items-center justify-between gap-3">
      <p className="text-xs text-muted-foreground">{hint}</p>
      {action && <div className="ml-auto">{action}</div>}
    </div>
  );
}

/** The paste side's text box: as tall as a drop zone, code in mono. */
export const PASTE_CLASS = "min-h-52 font-mono text-xs";
