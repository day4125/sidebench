// The elements page: every button, field and kind of content the tools use,
// in one place, to check the look and compare states side by side. Parts
// that belong to one tool are imported from that tool, not copied, so this
// page shows what the tools show. Not in the tool registry or the nav.
import { useState, type ReactNode } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ChevronDown, ChevronUp, Download, Info, RotateCcw, Trash2 } from "lucide-react";
import { AppShell } from "@/app/AppShell";
import { mount } from "@/app/mount";
import { ToolCard } from "@/app/ToolCard";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { SourceName, StepHeader, StepIndicator } from "@/tools/deworder/DeworderApp";
import { SourceView } from "@/tools/deworder/PreviewStep";
import { DropZone as HtmlDropZone } from "@/tools/deworder/UploadStep";
import { FoldButton, Kbd, Mark, StepButton, TINT, ViewSwitch, type View } from "@/tools/diff/DiffApp";
import { NumberedTextarea } from "@/tools/diff/NumberedTextarea";
import type { PdfFile } from "@/tools/pdfview/files";
import { DropZone as PdfDropZone } from "@/tools/pdfview/PdfViewApp";
import { KbPerPage, OffsetInput, PageInput, Pill, StarsMenu } from "@/tools/pdfview/Workspace";
import { tools } from "@/tools/registry";
import { CleanButton, TextBox, useTextOps } from "@/tools/text/TextApp";

const SECTIONS = [
  ["farger", "Färger"],
  ["typografi", "Typografi"],
  ["knappar", "Knappar"],
  ["falt", "Fält"],
  ["innehall", "Innehåll"],
] as const;

function Elements() {
  return (
    <AppShell>
      <div className="mx-auto flex max-w-5xl min-w-0 flex-col gap-12 py-4 md:py-8">
        <header className="flex flex-col gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">Element</h1>
          <p className="max-w-2xl text-pretty text-muted-foreground">
            Alla knappar, fält och typer av innehåll som verktygen använder. Verktygens egna delar hämtas från
            verktygen, så sidan visar samma sak som de. Byt till mörkt läge i sidofältet för att se båda teman.
          </p>
          <nav aria-label="Avsnitt" className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {SECTIONS.map(([id, name]) => (
              <a key={id} href={`#${id}`} className="text-primary underline-offset-4 hover:underline">
                {name}
              </a>
            ))}
          </nav>
        </header>
        <Colors />
        <Typography />
        <Buttons />
        <Fields />
        <Content />
      </div>
    </AppShell>
  );
}

// ---------------------------------------------------------------------------
// Layout helpers

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="flex scroll-mt-6 flex-col gap-6">
      <h2 id={`${id}-h`} className="border-b pb-2 text-xl font-semibold tracking-tight">
        {title}
      </h2>
      {children}
    </section>
  );
}

/** One element: its name, where it's used, and the element itself. */
function Specimen({ name, where, wide, children }: { name: string; where?: string; wide?: boolean; children: ReactNode }) {
  return (
    <figure className={wide ? "flex min-w-0 flex-col gap-3 md:col-span-2" : "flex min-w-0 flex-col gap-3"}>
      <figcaption className="flex flex-wrap items-baseline gap-x-2 text-sm">
        <span className="font-medium">{name}</span>
        {where && <span className="text-muted-foreground">{where}</span>}
      </figcaption>
      <div className="flex min-w-0 flex-wrap items-center gap-3 rounded-xl border border-dashed p-4">{children}</div>
    </figure>
  );
}

function Grid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-6 md:grid-cols-2">{children}</div>;
}

// ---------------------------------------------------------------------------
// Colors. Class names spelled out so Tailwind sees them.

const TOKENS: [string, string][] = [
  ["background", "bg-background"],
  ["foreground", "bg-foreground"],
  ["card", "bg-card"],
  ["muted", "bg-muted"],
  ["muted-foreground", "bg-muted-foreground"],
  ["primary", "bg-primary"],
  ["primary-foreground", "bg-primary-foreground"],
  ["secondary", "bg-secondary"],
  ["accent", "bg-accent"],
  ["accent-foreground", "bg-accent-foreground"],
  ["destructive", "bg-destructive"],
  ["border", "bg-border"],
  ["input", "bg-input"],
  ["ring", "bg-ring"],
  ["sidebar", "bg-sidebar"],
];

const STATE_COLORS: [string, string, string][] = [
  ["Borttaget (rad)", TINT.delete.line, "Diff"],
  ["Tillagt (rad)", TINT.insert.line, "Diff"],
  ["Borttaget (ord)", TINT.delete.word, "Diff"],
  ["Tillagt (ord)", TINT.insert.word, "Diff"],
  ["Flaggad", "bg-amber-500", "PDF, stjärna"],
  ["Över målet", "bg-destructive/10", "PDF, KB/sida"],
];

function Colors() {
  return (
    <Section id="farger" title="Färger">
      <div>
        <h3 className="mb-3 text-sm font-medium text-muted-foreground">Temafärger (globals.css)</h3>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {TOKENS.map(([name, cls]) => (
            <li key={name} className="flex flex-col gap-1.5">
              <span className={`h-12 rounded-lg ring-1 ring-border ring-inset ${cls}`} />
              <code className="font-mono text-xs">--{name}</code>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h3 className="mb-3 text-sm font-medium text-muted-foreground">Tillståndsfärger</h3>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {STATE_COLORS.map(([name, cls, where]) => (
            <li key={name} className="flex flex-col gap-1.5">
              <span className={`h-12 rounded-lg ring-1 ring-border ring-inset ${cls}`} />
              <span className="text-xs">
                {name}
                <span className="block text-muted-foreground">{where}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------------------

function Typography() {
  return (
    <Section id="typografi" title="Typografi">
      <div className="flex flex-col gap-8">
        <Specimen name="Sidrubrik och ingress" where="Startsidan">
          <div className="flex flex-col gap-2">
            <p className="text-3xl font-semibold tracking-tight">sidebench</p>
            <p className="max-w-2xl text-lg text-pretty">Små verktyg för innehållsproduktion.</p>
            <p className="max-w-2xl text-pretty text-muted-foreground">
              Allt körs lokalt i webbläsaren: inga nätverksanrop, inga cookies och inga externa servrar.
            </p>
          </div>
        </Specimen>
        <Specimen name="Verktygsrubrik" where="Sidhuvudet på varje verktyg (AppShell)">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-3">
            <p className="font-semibold tracking-tight">html-deworder</p>
            <p className="truncate text-sm text-muted-foreground">Gör Word-exporterade .html-filer redo för CMS-import</p>
          </div>
        </Specimen>
        <Specimen name="Stegrubrik med metarad" where="Deworder (StepHeader)">
          <div className="w-full">
            <StepHeader n={2} title="Mappa klasser till taggar">
              <span>12 klasser hittade</span>
              <SourceName name="rapport.html" />
            </StepHeader>
          </div>
        </Specimen>
        <Grid>
          <Specimen name="Avsnittsrubrik" where="Deworder">
            <p className="text-lg font-semibold tracking-tight">Renderad jämförelse</p>
          </Specimen>
          <Specimen name="Panel- och grupprubrik" where="Deworder, startsidan">
            <p className="text-sm font-medium text-muted-foreground">Kommer snart</p>
          </Specimen>
          <Specimen name="Brödtext och dämpad text">
            <div className="flex flex-col gap-1">
              <p>Välj originalet och den komprimerade versionen.</p>
              <p className="text-sm text-muted-foreground">Klistra in text B för att jämföra.</p>
            </div>
          </Specimen>
          <Specimen name="Kod, tangenter och länk" where="Deworder, Diff, drop-ytor">
            <code className="font-mono text-sm">.MsoNormal</code>
            <span className="flex gap-0.5">
              <Kbd>Alt</Kbd>
              <Kbd>↓</Kbd>
            </span>
            <span className="text-sm text-primary underline underline-offset-4">klicka för att bläddra</span>
          </Specimen>
        </Grid>
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------------------

const VARIANTS = ["default", "outline", "secondary", "ghost", "destructive", "link"] as const;
const SIZES = ["xs", "sm", "default", "lg"] as const;
const ICON_SIZES = ["icon-xs", "icon-sm", "icon", "icon-lg"] as const;

function Buttons() {
  const [view, setView] = useState<View>("inline");
  const ops = useTextOps();
  return (
    <Section id="knappar" title="Knappar">
      <div className="flex flex-col gap-8">
        <Specimen name="Varianter, aktiv och inaktiv" where="Button" wide>
          <div className="grid w-full grid-cols-[auto_auto_auto] items-center justify-start gap-x-6 gap-y-3 text-sm">
            {VARIANTS.map((v) => (
              <div key={v} className="contents">
                <code className="font-mono text-xs text-muted-foreground">{v}</code>
                <span>
                  <Button variant={v}>Fortsätt</Button>
                </span>
                <span>
                  <Button variant={v} disabled>
                    Fortsätt
                  </Button>
                </span>
              </div>
            ))}
          </div>
        </Specimen>
        <Grid>
          <Specimen name="Storlekar" where="xs: PDF-sidor i stjärnmenyn, sm: Kopiera, lg: Öppna sida vid sida">
            {SIZES.map((s) => (
              <Button key={s} size={s} variant="outline">
                {s}
              </Button>
            ))}
          </Specimen>
          <Specimen name="Ikonknappar" where="PDF: sida och zoom">
            {ICON_SIZES.map((s) => (
              <Button key={s} size={s} variant="outline" aria-label={s}>
                <Trash2 />
              </Button>
            ))}
          </Specimen>
          <Specimen name="Med ikon före och efter" where="Alla verktyg">
            <Button variant="outline">
              <RotateCcw data-icon="inline-start" />
              Återställ standardvärden
            </Button>
            <Button variant="ghost">
              <ArrowLeft data-icon="inline-start" />
              Justera mappning
            </Button>
            <Button>
              <Download data-icon="inline-start" />
              Ladda ned HTML-fil
            </Button>
            <Button size="lg">
              Öppna sida vid sida
              <ArrowRight data-icon="inline-end" />
            </Button>
          </Specimen>
          <Specimen name="Rubriknavigering" where="Deworder, under förhandsvisningen">
            <Button variant="outline">
              <ArrowUp data-icon="inline-start" />
              Föregående rubrik
            </Button>
            <Button variant="outline">
              Nästa rubrik
              <ArrowDown data-icon="inline-end" />
            </Button>
          </Specimen>
          <Specimen name="Stegknappar med kortkommando" where="Diff (håll över för tipset)">
            <StepButton label="Föregående skillnad" keys="Alt+ArrowUp" hint="↑" onClick={() => {}}>
              <ChevronUp />
            </StepButton>
            <StepButton label="Nästa skillnad" keys="Alt+ArrowDown" hint="↓" onClick={() => {}}>
              <ChevronDown />
            </StepButton>
          </Specimen>
          <Specimen name="Växlare" where="Diff: visningsläge">
            <ViewSwitch view={view} onView={setView} />
          </Specimen>
          <Specimen name="Hopfälld rad" where="Diff: oförändrade rader">
            <div className="w-full overflow-hidden rounded-lg border">
              <FoldButton count={14} onOpen={() => {}} />
            </div>
          </Specimen>
          <Specimen name="Stegindikator" where="Deworder (klicka på ett klart steg)">
            <StepDemo />
          </Specimen>
          <Specimen name="Huvudknapp med kopieringsläge" where="Textmanipulator (klicka två gånger)" wide>
            <div className="w-full">
              <CleanButton ops={ops} />
            </div>
          </Specimen>
        </Grid>
      </div>
    </Section>
  );
}

function StepDemo() {
  const [step, setStep] = useState<1 | 2 | 3>(3);
  return (
    <div className="flex flex-col gap-3">
      <StepIndicator step={step} onBack={setStep} />
      {step < 3 && (
        <Button variant="link" size="sm" className="self-start px-0" onClick={() => setStep(3)}>
          Tillbaka till steg 3
        </Button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

const PDF_STATES = [
  null,
  { text: "Läser…", state: "loading" },
  { text: "rapport.pdf – 24 sidor", state: "ok" },
  { text: "Inte en PDF-fil: bild.png", state: "error" },
] as const;

function Fields() {
  const ops = useTextOps();
  const [numbered, setNumbered] = useState("Första raden\nAndra raden, som är lång nog att radbrytas när fältet är smalt\nTredje raden");
  const [page, setPage] = useState(3);
  const [offset, setOffset] = useState(0);
  const [checked, setChecked] = useState(true);
  return (
    <Section id="falt" title="Fält">
      <Grid>
        <Specimen name="Textfält" where="Input: PDF-verktyget">
          <div className="flex w-full flex-col gap-3">
            <Input placeholder="Platshållare" />
            <Input defaultValue="Ifyllt värde" />
            <Input readOnly value="1, 5, 7 (skrivskyddat)" />
            <Input disabled placeholder="Inaktivt" />
            <Input aria-invalid defaultValue="Ogiltigt värde" />
          </div>
        </Specimen>
        <Specimen name="Sifferfält" where="PDF: sidnummer och förskjutning">
          <span className="flex items-center gap-1 text-sm">
            <PageInput value={String(page)} onCommit={setPage} />
            <span className="px-1 text-muted-foreground tabular-nums">av 24</span>
          </span>
          <OffsetInput value={offset} onCommit={(v) => setOffset(Number(v) || 0)} />
        </Specimen>
        <Specimen name="Rullgardin" where="NativeSelect: Deworder">
          <div className="flex flex-col gap-3">
            <NativeSelect aria-label="Standardstorlek" defaultValue="p">
              {["p", "h1", "h2", "strip", "keep"].map((t) => (
                <NativeSelectOption key={t} value={t}>
                  {t}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <NativeSelect size="sm" aria-label="Liten storlek" className="w-32 font-mono" defaultValue="h2">
              {["p", "h1", "h2", "strip", "keep"].map((t) => (
                <NativeSelectOption key={t} value={t}>
                  {t}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
        </Specimen>
        <Specimen name="Kryssruta med etikett" where="Checkbox, Label: Deworder">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Checkbox id="el-check" checked={checked} onCheckedChange={(v) => setChecked(v === true)} />
              <Label htmlFor="el-check" className="font-normal">
                Ta bort alla återstående class-attribut
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="el-check-off" disabled />
              <Label htmlFor="el-check-off" className="font-normal">
                Inaktiv
              </Label>
            </div>
          </div>
        </Specimen>
        <Specimen name="Flikar" where="Tabs: Deworder, inmatningssätt" wide>
          <Tabs defaultValue="file" className="w-full">
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
            <TabsContent value="file" className="mt-2 text-sm text-muted-foreground">
              Innehållet för den första fliken.
            </TabsContent>
            <TabsContent value="paste" className="mt-2">
              <Textarea placeholder="Klistra in HTML-kod här…" className="min-h-24 font-mono text-xs" />
            </TabsContent>
          </Tabs>
        </Specimen>
        <Specimen name="Textyta" where="Textarea: Deworder">
          <Textarea placeholder="Klistra in HTML-kod här…" className="min-h-32 font-mono text-xs" />
        </Specimen>
        <Specimen name="Textyta med radnummer" where="Diff">
          <NumberedTextarea
            aria-label="Text med radnummer"
            value={numbered}
            onChange={(e) => setNumbered(e.target.value)}
            className="h-40 w-full"
          />
        </Specimen>
        <Specimen name="Textyta med verktygsrad" where="Textmanipulator" wide>
          <div className="w-full">
            <TextBox ops={ops} />
          </div>
        </Specimen>
        <Specimen name="Drop-yta, tom och vald fil" where="Deworder" wide>
          <div className="grid w-full gap-4 md:grid-cols-2">
            <HtmlDropZone file={null} onFile={() => {}} />
            <HtmlDropZone file={new File([""], "rapport.html")} onFile={() => {}} />
          </div>
        </Specimen>
        <Specimen name="Drop-yta: tom, läser, klar, fel" where="PDF sida vid sida" wide>
          <div className="grid w-full gap-4 md:grid-cols-2">
            {PDF_STATES.map((status, i) => (
              <PdfDropZone key={i} side={i % 2 ? "b" : "a"} status={status && { ...status }} onFile={() => {}} />
            ))}
          </div>
        </Specimen>
      </Grid>
    </Section>
  );
}

// ---------------------------------------------------------------------------

const SAMPLE_HTML = `<!-- rensad -->
<h2>Inledning</h2>
<p class="ingress">Rapporten visar &amp; förklarar resultatet.</p>`;

// Only the size and page count are read.
const pdf = (sizeKb: number): PdfFile => ({ name: "b.pdf", size: sizeKb * 1024, doc: { numPages: 10 } }) as unknown as PdfFile;

function Content() {
  const [stars, setStars] = useState<ReadonlySet<number>>(new Set([1, 5, 7]));
  const [starsOpen, setStarsOpen] = useState(false);
  return (
    <Section id="innehall" title="Innehåll">
      <Grid>
        <Specimen name="Märken" where="Badge: startsidan (secondary)">
          {(["default", "secondary", "outline", "destructive", "ghost", "link"] as const).map((v) => (
            <Badge key={v} variant={v}>
              {v}
            </Badge>
          ))}
        </Specimen>
        <Specimen name="Tipsruta" where="Tooltip: PDF, Diff, Deworder">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline">Håll över mig</Button>
            </TooltipTrigger>
            <TooltipContent>Växla: anpassa bredd, anpassa sida, 100 %</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="Hjälp"
                className="rounded-full text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <Info className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-64">
              Välj en måltagg för varje klass. <strong>strip</strong> tar bort elementet helt.
            </TooltipContent>
          </Tooltip>
        </Specimen>
        <Specimen name="Meddelande" where="Alert: Deworder (fel)" wide>
          <div className="flex w-full flex-col gap-3">
            <Alert>
              <AlertTitle>Standard</AlertTitle>
              <AlertDescription>Används inte än, men finns i komponenterna.</AlertDescription>
            </Alert>
            <Alert variant="destructive">
              <AlertDescription>Något gick fel vid rensningen. Kontrollera filen och försök igen.</AlertDescription>
            </Alert>
          </div>
        </Specimen>
        <Specimen name="Tabell" where="Table: Deworder, mappning" wide>
          <div className="w-full overflow-hidden rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Klass</TableHead>
                  <TableHead>Mål</TableHead>
                  <TableHead>Originaltagg</TableHead>
                  <TableHead className="pr-4 text-right">Antal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[
                  ["MsoNormal", "p", "p", 48],
                  ["Rubrik1", "h2", "p", 6],
                  ["MsoListParagraph", "strip", "p", 12],
                ].map(([cls, target, tag, n]) => (
                  <TableRow key={cls}>
                    <TableCell className="pl-4 font-mono">.{cls}</TableCell>
                    <TableCell>
                      <NativeSelect size="sm" className="w-32 font-mono" aria-label={`Mål för .${cls}`} defaultValue={target}>
                        {["p", "h2", "strip"].map((t) => (
                          <NativeSelectOption key={t} value={t}>
                            {t}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                    </TableCell>
                    <TableCell className="font-mono text-muted-foreground">&lt;{tag}&gt;</TableCell>
                    <TableCell className="pr-4 text-right tabular-nums">{n}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Specimen>
        <Specimen name="Källkod med färgning" where="Deworder, steg 3" wide>
          <div className="w-full">
            <SourceView source={SAMPLE_HTML} />
          </div>
        </Specimen>
        <Specimen name="Ändrade ord" where="Diff">
          <p className="leading-6">
            Rapporten <Mark kind="delete" text="visade" />
            <Mark kind="insert" text="visar" /> att resultatet <Mark kind="insert" text="tydligt " />
            förbättrats.
          </p>
        </Specimen>
        <Specimen name="KB per sida, under och över målet" where="PDF">
          <span className="text-sm">
            <KbPerPage file={pdf(1800)} />
          </span>
          <span className="text-sm">
            <KbPerPage file={pdf(4600)} />
          </span>
        </Specimen>
        <Specimen name="Stjärnmeny" where="Popover: PDF, flaggade sidor">
          <StarsMenu
            page={5}
            onToggle={() => setStars((s) => new Set(s.has(5) ? [...s].filter((p) => p !== 5) : [...s, 5]))}
            stars={stars}
            text={[...stars].sort((x, y) => x - y).join(", ")}
            open={starsOpen}
            onOpenChange={setStarsOpen}
            onJump={() => setStarsOpen(false)}
            onClear={() => setStars(new Set())}
            onToast={() => {}}
          />
        </Specimen>
        <Specimen name="Notis" where="PDF (visas nere i mitten)">
          <Pill>Komprimerad bytt: rapport-v2.pdf</Pill>
        </Specimen>
        <Specimen name="Verktygskort, aktivt och kommande" where="Startsidan" wide>
          <ul className="grid w-full gap-4 sm:grid-cols-2">
            <ToolCard tool={tools.find((t) => t.href)!} />
            <ToolCard tool={tools.find((t) => !t.href)!} />
          </ul>
        </Specimen>
      </Grid>
    </Section>
  );
}

mount(<Elements />);
