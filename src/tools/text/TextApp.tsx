// Textmanipulator: one textarea and a set of one-shot operations. Rebuilt
// from prodtools' static/text-app.js on the unchanged engine. The text lives
// in this component's state only (INTENT.md) and leaves only through copy.
//
// The copy flow is legacy's: an operation rewrites the text and its button
// turns into "Kopiera" (one button at a time); clicking it copies the text
// and shows "Kopierad!" for a moment. Any edit to the text resets every
// button. If the clipboard fails, the text is selected instead.
import { useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown, Copy, Info } from "lucide-react";
import { cn } from "cn";
import { AppShell } from "@/app/AppShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useFlash } from "@/hooks/use-flash";
import { apply, type Op } from "./engine";

const UNICODE_NOTE = "(OBS! alla bokstäver har inte stöd i unicode)";

const SCRIPTS: { op: Op; label: string; info: ReactNode }[] = [
  { op: "supNum", label: "Superscript 0-9", info: "Konvertera alla siffror i textrutan till upphöjda." },
  { op: "subNum", label: "Subscript 0-9", info: "Konvertera alla siffror i textrutan till nedsänkta." },
  {
    op: "supAlpha",
    label: "Superscript a-z",
    info: (
      <>
        Konvertera alla bokstäver i textrutan till upphöjda.
        <br />
        {UNICODE_NOTE}
      </>
    ),
  },
  {
    op: "subAlpha",
    label: "Subscript a-z",
    info: (
      <>
        Konvertera alla bokstäver i textrutan till nedsänkta.
        <br />
        {UNICODE_NOTE}
      </>
    ),
  },
];

const MORE: { op: Op; label: string }[] = [
  { op: "upper", label: "VERSALER" },
  { op: "lower", label: "gemener" },
  { op: "extractEmail", label: "Extrahera e-postadresser" },
  { op: "extractUrl", label: "Extrahera URL" },
];

export function TextApp() {
  const [text, setText] = useState("");
  // The operation whose button currently offers to copy, if any.
  const [copyOp, setCopyOp] = useState<Op | null>(null);
  const [copied, flashCopied, clearCopied] = useFlash();
  const input = useRef<HTMLTextAreaElement>(null);

  async function run(op: Op) {
    if (op !== copyOp) {
      setText(apply(op, text) ?? "");
      setCopyOp(op);
      clearCopied();
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fall back to selecting the text so it can be copied by hand.
      input.current?.focus();
      input.current?.select();
      return;
    }
    flashCopied();
  }

  function edit(value: string) {
    setText(value);
    setCopyOp(null);
    clearCopied();
  }

  const action = (op: Op, label: string, primary = false) => {
    const copying = op === copyOp;
    return (
      <Button
        key={op}
        variant={copying ? "outline" : primary ? "default" : "secondary"}
        size="lg"
        onClick={() => void run(op)}
        className={cn(
          "h-auto min-h-9 w-full min-w-0 shrink py-1.5 whitespace-normal",
          copying && "border-primary text-primary hover:text-primary",
        )}
      >
        {copying ? (
          <>
            {copied ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}
            {copied ? "Kopierad!" : "Kopiera"}
          </>
        ) : (
          label
        )}
      </Button>
    );
  };

  return (
    <AppShell tool="text">
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        <label htmlFor="text-input" className="sr-only">
          Text
        </label>
        <Textarea
          id="text-input"
          ref={input}
          value={text}
          onChange={(e) => edit(e.target.value)}
          spellCheck={false}
          placeholder="Klistra in text här..."
          className="field-sizing-fixed min-h-56 resize-y p-4 md:text-base"
        />

        <WithInfo label="Rensa text" info="Tar bort mjuka bindestreck, onödiga radbrytningar, dubbla mellanrum samt byter raka citattecken till typografiska.">
          {action("clean", "Rensa text", true)}
        </WithInfo>

        <div className="grid gap-2 sm:grid-cols-2">
          {SCRIPTS.map(({ op, label, info }) => (
            <WithInfo key={op} label={label} info={info}>
              {action(op, label)}
            </WithInfo>
          ))}
        </div>

        <details className="group rounded-xl border">
          <summary className="flex cursor-pointer list-none items-center justify-between rounded-xl px-4 py-2.5 text-sm font-medium outline-none select-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
            Fler verktyg
            <ChevronDown aria-hidden="true" className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>
          <div className="flex flex-col gap-2 px-4 pt-1 pb-4">
            {action("stripSvg", "Ta bort <svg>-taggar")}
            <div className="grid gap-2 sm:grid-cols-2">{MORE.map(({ op, label }) => action(op, label))}</div>
          </div>
        </details>

        <p role="status" className="sr-only">
          {copied ? "Texten är kopierad till urklipp" : ""}
        </p>
      </div>
    </AppShell>
  );
}

/** An action button with an info tooltip next to it. */
function WithInfo({ label, info, children }: { label: string; info: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-center gap-1">
      {children}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon-lg" aria-label={`Om ${label}`} className="text-muted-foreground">
            <Info />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="block text-balance">
          {info}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
