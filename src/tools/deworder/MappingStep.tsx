import { useRef } from "react";
import { ArrowLeft, ArrowRight, ChevronDown, Download, FileJson, Info, RotateCcw } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useFlash } from "@/hooks/use-flash";
import { saveFile } from "@/lib/download";
import { SourceName, StepHeader, type Source } from "./DeworderApp";
import { ALLOWED_TARGETS, type DeworderConfig, type TableMode, type Target } from "./engine/deworder";
import { configFile, type MappingForm } from "./mapping";

// The table shows this many rows until "Visa alla".
const COLLAPSED_ROWS = 5;

interface Props {
  source: Source;
  form: MappingForm;
  onFormChange: (form: MappingForm) => void;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  config: DeworderConfig;
  onReset: () => void;
  onLoadConfig: (file: File) => Promise<boolean>;
  onNewFile: () => void;
  onPreview: () => void;
}

export function MappingStep(props: Props) {
  const { source, form, onFormChange, expanded, onExpandedChange, config } = props;
  const { rows } = source;
  const configInput = useRef<HTMLInputElement>(null);
  const [loaded, flashLoaded] = useFlash();
  const [saved, flashSaved] = useFlash();

  const collapsible = rows.length > COLLAPSED_ROWS;
  const shown = collapsible && !expanded ? rows.slice(0, COLLAPSED_ROWS) : rows;

  const setTarget = (className: string, target: Target) =>
    onFormChange({ ...form, mapping: { ...form.mapping, [className]: target } });

  return (
    <section className="flex flex-col gap-4" aria-labelledby="step-2">
      <StepHeader n={2} title="Mappa klasser till taggar">
        <span>{rows.length} klasser hittade</span>
        <SourceName name={source.filename} />
      </StepHeader>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={props.onReset}>
          <RotateCcw data-icon="inline-start" />
          Återställ standardvärden
        </Button>
        <Button variant="ghost" onClick={props.onNewFile}>
          <ArrowLeft data-icon="inline-start" />
          Ladda upp annan fil
        </Button>
        <Button className="ml-auto" onClick={props.onPreview}>
          Förhandsgranska
          <ArrowRight data-icon="inline-end" />
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border">
        {rows.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Klass</TableHead>
                <TableHead>
                  <span className="inline-flex items-center gap-1">
                    Mål
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          aria-label="Hjälp om mål"
                          className="rounded-full text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
                        >
                          <Info className="size-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-64">
                        Välj en måltagg för varje klass. <strong>strip</strong> tar bort elementet helt,{" "}
                        <strong>keep</strong> lämnar det oförändrat.
                      </TooltipContent>
                    </Tooltip>
                  </span>
                </TableHead>
                <TableHead>Originaltagg</TableHead>
                <TableHead className="pr-4 text-right">Antal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((row) => (
                <TableRow key={`${row.tag_name}.${row.class_name}`}>
                  <TableCell className="pl-4 font-mono">.{row.class_name}</TableCell>
                  <TableCell>
                    <NativeSelect
                      size="sm"
                      className="w-32 font-mono"
                      aria-label={`Mål för .${row.class_name}`}
                      value={form.mapping[row.class_name]}
                      onChange={(e) => setTarget(row.class_name, e.target.value as Target)}
                    >
                      {ALLOWED_TARGETS.map((t) => (
                        <NativeSelectOption key={t} value={t}>
                          {t}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </TableCell>
                  <TableCell className="font-mono text-muted-foreground">&lt;{row.tag_name}&gt;</TableCell>
                  <TableCell className="pr-4 text-right tabular-nums">{row.count}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="p-4 text-sm text-muted-foreground">Inga klasser hittades.</p>
        )}
        {collapsible && (
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => onExpandedChange(!expanded)}
            className="flex w-full items-center justify-center gap-1.5 border-t py-2 text-sm text-muted-foreground outline-none hover:bg-muted/50 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
          >
            {expanded ? "Visa färre" : "Visa alla"}
            <span className="tabular-nums">
              ({shown.length}/{rows.length})
            </span>
            <ChevronDown aria-hidden="true" className={cn("size-4 transition-transform", expanded && "rotate-180")} />
          </button>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Checkbox
            id="strip-all-classes"
            checked={form.strip_all_classes}
            onCheckedChange={(v) => onFormChange({ ...form, strip_all_classes: v === true })}
          />
          <Label htmlFor="strip-all-classes" className="font-normal">
            Ta bort alla återstående class-attribut från utdata
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="table-mode" className="font-normal">
            Tabeller:
          </Label>
          <NativeSelect
            id="table-mode"
            size="sm"
            value={form.table_mode}
            onChange={(e) => onFormChange({ ...form, table_mode: e.target.value as TableMode })}
          >
            <NativeSelectOption value="keep">Behåll som tabeller</NativeSelectOption>
            <NativeSelectOption value="flatten">Omvandla till stycken</NativeSelectOption>
          </NativeSelect>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => configInput.current?.click()}>
          <FileJson data-icon="inline-start" />
          {loaded ? "Laddad" : "Välj config"}
        </Button>
        <input
          ref={configInput}
          type="file"
          accept=".json,application/json"
          hidden
          data-testid="config-input"
          onChange={async (e) => {
            const input = e.currentTarget;
            const picked = input.files?.[0];
            input.value = "";
            if (picked && (await props.onLoadConfig(picked))) flashLoaded();
          }}
        />
        <Button
          variant="outline"
          onClick={() => {
            saveFile("config.json", configFile(form, config), "application/json;charset=utf-8");
            flashSaved();
          }}
        >
          <Download data-icon="inline-start" />
          {saved ? "Nedladdad" : "Ladda ned config.json"}
        </Button>
      </div>
    </section>
  );
}
