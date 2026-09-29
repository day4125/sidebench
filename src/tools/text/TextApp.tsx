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

  // `info`, when given, puts an info icon at the button's right edge (as in
  // legacy); only the icon opens the tooltip, which drops below the button.
  // The icon sits over the button rather than in it, since a button can't
  // hold another focusable element.
  const action = (op: Op, label: string, { primary = false, info }: { primary?: boolean; info?: ReactNode } = {}) => {
    const copying = op === copyOp;
    const button = (
      <Button
        key={op}
        variant={copying ? "outline" : primary ? "default" : "secondary"}
        size="lg"
        onClick={() => void run(op)}
        className={cn(
          "h-auto min-h-9 w-full min-w-0 shrink py-1.5 whitespace-normal",
          info && "px-10",
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
    if (!info) return button;
    return (
      <div key={op} className="relative">
        {button}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label={`Om ${label}`}
              className={cn(
                "absolute inset-y-0 right-1 flex w-8 cursor-help items-center justify-center rounded-md opacity-60 outline-none hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-3 focus-visible:ring-ring/50",
                copying ? "text-primary" : primary ? "text-primary-foreground" : "text-secondary-foreground",
              )}
            >
              <Info className="size-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" align="end" sideOffset={6} className="block">
            {info}
          </TooltipContent>
        </Tooltip>
      </div>
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
          className="field-sizing-fixed min-h-56 resize-none p-4 md:text-base"
        />

        {action("clean", "Rensa text", {
          primary: true,
          info: "Tar bort mjuka bindestreck, onödiga radbrytningar, dubbla mellanrum samt byter raka citattecken till typografiska.",
        })}

        <div className="grid gap-2 sm:grid-cols-2">
          {SCRIPTS.map(({ op, label, info }) => action(op, label, { info }))}
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
