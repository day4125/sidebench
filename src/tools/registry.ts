// The tool registry: the single source for the sidebar nav and the landing
// page grid. Ported from prodtools' static/tools.js (icons come in step 4).

export type ToolStatus = "live" | "soon";

export interface Tool {
  /** Stable id, also marks the active nav link. */
  slug: string;
  /** Display name (sidebar and card heading). */
  name: string;
  /** Page URL relative to the site base; null while not built. */
  href: string | null;
  status: ToolStatus;
  /** The tool's own header sub-line. */
  tagline: string;
  /** One-paragraph blurb for the landing card. */
  desc: string;
}

export const tools: Tool[] = [
  {
    slug: "deworder",
    name: "html-deworder",
    href: "deworder.html",
    status: "live",
    tagline: "Gör Word-exporterade .html-filer redo för CMS-import",
    desc:
      "Rensa Word-exporterad HTML för CMS-import. Mappa klasser till " +
      "semantiska taggar, förhandsgranska och ladda ned.",
  },
  {
    slug: "svg-viewer",
    name: "SVG-viewer",
    href: null,
    status: "soon",
    tagline: "Granska, rendera och städa SVG-kod",
    desc:
      "Klistra in eller öppna en SVG — granska källkod, se renderat " +
      "resultat, kopiera minifierad eller formaterad utdata.",
  },
  {
    slug: "text",
    name: "Textmanipulator",
    href: "text.html",
    status: "live",
    tagline: "Små engångsoperationer på text",
    desc:
      "Rensa text, byt skiftläge, gör upphöjda eller nedsänkta tecken, " +
      "ta bort <svg>-taggar och plocka ut e-postadresser eller URL:er.",
  },
  {
    slug: "diff",
    name: "Diff checker",
    href: null,
    status: "soon",
    tagline: "Jämför två texter sida vid sida",
    desc:
      "Jämför två texter sida vid sida med radvis markering av tillägg, " +
      "borttagningar och ändringar.",
  },
  {
    slug: "pdf-compare",
    name: "PDF sida vid sida",
    href: "pdfview.html",
    status: "live",
    tagline: "Bläddra i två PDF:er samtidigt och flagga sidor med skillnader",
    desc:
      "Visa två PDF:er sida vid sida med gemensam bläddring och zoom. " +
      "Stjärnmärk sidor där något skiljer och kopiera listan (1, 5, 7). " +
      "Visar KB per sida för den komprimerade filen.",
  },
  {
    slug: "color",
    name: "Färgväljare",
    href: null,
    status: "soon",
    tagline: "Palett, kontrast och formatkonvertering",
    desc:
      "Palettextraktion, kontrastkontroll (WCAG), formatkonvertering " +
      "mellan hex, rgb, hsl och oklch.",
  },
  {
    slug: "pdf",
    name: "PDF-kalkylator",
    href: null,
    status: "soon",
    tagline: "Sidantal, filstorlek och utfallszoner",
    desc:
      "Beräkna sidantal, filstorlek och utfallszoner för trycksaker " +
      "direkt i webbläsaren.",
  },
];

export function getTool(slug: string): Tool {
  const tool = tools.find((t) => t.slug === slug);
  if (!tool) throw new Error(`Unknown tool: ${slug}`);
  return tool;
}
