// Syntax highlighting for the cleaned-HTML source view. Ported from
// highlightHtmlSource() in prodtools' static/deworder-app.js: the same
// regexes, returning tokens instead of an HTML string. Joining the tokens'
// text gives back the source exactly.

export type TokenKind = "tag" | "attr" | "val" | "punc" | "com" | "doc" | "ent";

export interface Token {
  kind?: TokenKind;
  text: string;
}

export function highlightHtml(source: string): Token[] {
  const re = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<![a-zA-Z][^>]*>|<\/?[a-zA-Z][^>]*>/g;
  const out: Token[] = [];
  let last = 0;
  let m;
  while ((m = re.exec(source)) !== null) {
    if (m.index > last) text(out, source.slice(last, m.index));
    tag(out, m[0]);
    last = m.index + m[0].length;
  }
  if (last < source.length) text(out, source.slice(last));
  return out;
}

function text(out: Token[], s: string) {
  const re = /&(#\d+|#x[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g;
  let last = 0;
  let m;
  while ((m = re.exec(s)) !== null) {
    if (m.index > last) out.push({ text: s.slice(last, m.index) });
    out.push({ kind: "ent", text: m[0] });
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push({ text: s.slice(last) });
}

function tag(out: Token[], s: string) {
  if (s.startsWith("<!--")) return void out.push({ kind: "com", text: s });
  if (s.startsWith("<!")) return void out.push({ kind: "doc", text: s });
  const m = s.match(/^<(\/?)([a-zA-Z][\w:-]*)([\s\S]*?)(\/?)>$/);
  if (!m) return void out.push({ text: s });
  const [, slash, name, rest, selfClose] = m;
  out.push({ kind: "punc", text: `<${slash}` }, { kind: "tag", text: name });
  attrs(out, rest);
  out.push({ kind: "punc", text: `${selfClose}>` });
}

function attrs(out: Token[], s: string) {
  const re = /(\s+)|([a-zA-Z_:][\w:.-]*)(\s*=\s*)?("[^"]*"|'[^']*'|[^\s"'=<>`]+)?/g;
  let last = 0;
  let m;
  while ((m = re.exec(s)) !== null) {
    if (m.index > last) out.push({ text: s.slice(last, m.index) });
    if (m[1] !== undefined) {
      out.push({ text: m[1] });
    } else if (m[2] !== undefined) {
      out.push({ kind: "attr", text: m[2] });
      if (m[3] !== undefined) out.push({ kind: "punc", text: m[3] });
      if (m[4] !== undefined) out.push({ kind: "val", text: m[4] });
    }
    last = re.lastIndex;
    if (m[0].length === 0) re.lastIndex++;
  }
  if (last < s.length) out.push({ text: s.slice(last) });
}
