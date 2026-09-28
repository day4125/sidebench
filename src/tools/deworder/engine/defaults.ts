/* deworder defaults — constants + the hardcoded NoK default config.
   Ported from prodtools' static/defaults.js; values unchanged. */

export const ALLOWED_TARGETS = [
  "h1", "h2", "h3", "h4", "h5", "h6",
  "p", "blockquote", "li", "ul", "ol",
  "em", "strong",
  "strip", "keep",
] as const;

export type Target = (typeof ALLOWED_TARGETS)[number];

export type TableMode = "keep" | "flatten";

export interface DeworderConfig {
  mapping: Record<string, string>;
  strip_all_classes: boolean;
  table_mode: TableMode;
  disallowed_tags: string[];
}

export const AUTO_STRIP_CLASSES: ReadonlySet<string> = new Set([
  "MsoCommentText",
  "MsoCommentReference",
  "MsoCommentSubject",
  "msocomanchor",
  "msocomoff",
  "msocomtxt",
]);

export const STRIPPED_ATTRS: ReadonlySet<string> = new Set([
  "style", "lang", "xml:lang",
  "align", "valign", "width", "height", "bgcolor",
  "border", "cellpadding", "cellspacing",
  "link", "vlink", "alink",
]);

// The hardcoded NoK default. The app boots from this directly — no
// network fetch. Config only changes when the user explicitly picks
// or downloads a config.json.
export const DEFAULT_CONFIG: DeworderConfig = {
  mapping: {
    MsoNormal: "p",
    NoKRubrik1: "h1",
    NoKRubrik2: "h2",
    NoKRubrik3: "h3",
    NoKRubrik4: "h4",
    NoKRubrik5: "h5",
    NoKText: "p",
    NoKIngress: "p",
    NoKPunktlista: "li",
    NoKTextIndrag: "p",
    NoKBildtext: "p",
    NoKArbetsinfo: "p",
    NoKBetoningFet: "strong",
    NoKBetoningFetFrg: "p",
    NoKBetoningKursiv: "em",
    NoKCitat: "p",
  },
  strip_all_classes: true,
  table_mode: "keep",
  disallowed_tags: [
    "img", "svg", "ins", "del", "script", "style", "iframe", "object", "embed", "hr",
    "meta", "link", "base", "noscript",
    "form", "input", "button", "textarea", "select", "option", "label", "fieldset", "legend",
    "frame", "frameset", "applet",
    "audio", "video", "source", "track", "canvas", "map", "area",
  ],
};
