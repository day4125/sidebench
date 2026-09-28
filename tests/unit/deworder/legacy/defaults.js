/* deworder defaults — constants + the hardcoded NoK default config.
   Plain global under window.Toolbox.deworder (no modules → loads from
   file://). Must load before deworder.js and deworder-app.js, which
   read these off the namespace. */

window.Toolbox = window.Toolbox || {};
window.Toolbox.deworder = window.Toolbox.deworder || {};

Object.assign(window.Toolbox.deworder, {
  ALLOWED_TARGETS: [
    "h1", "h2", "h3", "h4", "h5", "h6",
    "p", "blockquote", "li", "ul", "ol",
    "em", "strong",
    "strip", "keep",
  ],

  AUTO_STRIP_CLASSES: new Set([
    "MsoCommentText",
    "MsoCommentReference",
    "MsoCommentSubject",
    "msocomanchor",
    "msocomoff",
    "msocomtxt",
  ]),

  STRIPPED_ATTRS: new Set([
    "style", "lang", "xml:lang",
    "align", "valign", "width", "height", "bgcolor",
    "border", "cellpadding", "cellspacing",
    "link", "vlink", "alink",
  ]),

  // The hardcoded NoK default. The app boots from this directly — no
  // network fetch. Config only changes when the user explicitly picks
  // or downloads a config.json.
  DEFAULT_CONFIG: {
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
  },
});
