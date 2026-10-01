// The tool registry: the single source for the sidebar nav and the landing
// page grid. Ported from prodtools' static/tools.js.
import {
  BookOpen,
  BrushCleaning,
  Diff,
  Omega,
  Palette,
  PenTool,
  Type,
  type LucideIcon,
} from "lucide-react";

export type ToolStatus = "live" | "soon";

export interface Tool {
  /** Stable id, also marks the active nav link. */
  slug: string;
  /** Display name (sidebar and card heading). */
  name: string;
  icon: LucideIcon;
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
    icon: BrushCleaning,
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
    icon: PenTool,
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
    icon: Type,
    href: "text.html",
    status: "live",
    tagline: "Små engångsoperationer på text",
    desc:
      "Rensa text, byt skiftläge, gör upphöjda eller nedsänkta tecken, " +
      "ta bort <svg>-taggar och plocka ut e-postadresser eller URL:er.",
  },
  {
    slug: "chars",
    name: "Specialtecken",
    icon: Omega,
    href: "chars.html",
    status: "live",
    tagline: "Sök och kopiera tecken som tangentbordet saknar",
    desc:
      "Sök bland typografiska, matematiska och andra specialtecken på " +
      "svenska eller engelska. Kopiera tecknet eller dess HTML-entitet.",
  },
  {
    slug: "diff",
    name: "Diff checker",
    icon: Diff,
    href: "diff.html",
    status: "live",
    tagline: "Jämför två texter sida vid sida",
    desc:
      "Jämför två texter sida vid sida med radvis markering av tillägg, " +
      "borttagningar och ändringar.",
  },
  {
    slug: "pdf-compare",
    name: "PDF sida vid sida",
    icon: BookOpen,
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
    icon: Palette,
    href: "color.html",
    status: "live",
    tagline: "Konvertera färger och kontrollera kontrast",
    desc:
      "Klistra in en färg och kopiera den som hex, rgb, hsl eller oklch. " +
      "Kontrollera kontrasten mot WCAG och hitta närmaste färg som klarar AA eller AAA.",
  },
];

export function getTool(slug: string): Tool {
  const tool = tools.find((t) => t.slug === slug);
  if (!tool) throw new Error(`Unknown tool: ${slug}`);
  return tool;
}
