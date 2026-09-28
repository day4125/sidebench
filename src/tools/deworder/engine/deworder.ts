/* deworder engine — Word-exported HTML → clean semantic HTML.
   Ported from prodtools' static/deworder.js (a copy lives in
   tests/unit/deworder/legacy/). The logic is unchanged: the only
   differences are ES module imports/exports instead of the
   window.Toolbox.deworder global, and type annotations. Parity with the
   legacy engine is checked by tests/unit/deworder/differential.test.ts. */

import {
  AUTO_STRIP_CLASSES,
  DEFAULT_CONFIG,
  STRIPPED_ATTRS,
  type DeworderConfig,
  type TableMode,
} from "./defaults";

export {
  ALLOWED_TARGETS,
  AUTO_STRIP_CLASSES,
  DEFAULT_CONFIG,
  STRIPPED_ATTRS,
  type DeworderConfig,
  type TableMode,
  type Target,
} from "./defaults";

/** One Word class as found on one tag, with how often it occurs. */
export interface DetectedClass {
  tag_name: string;
  class_name: string;
  count: number;
}

const META_CHARSET_RE = /<meta[^>]+?charset\s*=\s*["']?([\w:.-]+)/i;
const CXSP_SUFFIX_RE = /CxSp(?:First|Middle|Last)$/;
const MSO_COMMENT_RE = /<!--\[if[^>]*?\]>[\s\S]*?<!\[endif\]-->/gi;
const DOWNLEVEL_REVEALED_RE = /<!\[if\s+([^\]]+)\]>([\s\S]*?)<!\[endif\]>/gi;
const PLAIN_COMMENT_RE = /<!--[\s\S]*?-->/g;
const PI_RE = /<\?[^>]*\?>/g;
const BLOCK_TAGS = new Set(["p", "div", "li", "h1", "h2", "h3", "h4", "h5", "h6"]);
const IGNORED_INLINE_CLASSES = new Set(["SpellE", "GramE"]);
const EMPTY_INLINE_TAGS = new Set(["strong", "em"]);
const EMPTY_BLOCK_TAGS = new Set(["p", "blockquote", "li", "ul", "ol", "h1", "h2", "h3", "h4", "h5", "h6"]);

export function decodeHtmlBytes(arrayBuffer: ArrayBuffer | Uint8Array): string {
  const bytes = arrayBuffer instanceof Uint8Array ? arrayBuffer : new Uint8Array(arrayBuffer);
  const declared = detectDeclaredCharset(bytes);
  return decodeBytes(bytes, declared || "utf-8");
}

export function detectClasses(htmlString: string): DetectedClass[] {
  const doc = parseHtml(stripWordNoise(htmlString));
  const body = doc.body || doc.documentElement;

  for (const element of allElements(body)) {
    if ((element.getAttribute("style") || "").includes("mso-element:comment")) {
      element.remove();
    }
  }

  for (const element of allElements(body)) {
    if (classList(element).some((className) => AUTO_STRIP_CLASSES.has(className))) {
      element.remove();
    }
  }

  const seen = new Map<string, DetectedClass>();
  for (const element of allElements(body)) {
    const tagName = element.localName;
    if (tagName === "div") {
      continue;
    }

    for (const className of classList(element)) {
      if (IGNORED_INLINE_CLASSES.has(className)) {
        continue;
      }
      const normalized = normalizeClass(className);
      const key = `${tagName}\u0000${normalized}`;
      const current = seen.get(key) || { tag_name: tagName, class_name: normalized, count: 0 };
      current.count += 1;
      seen.set(key, current);
    }
  }

  return [...seen.values()].sort((a, b) => {
    const blockDiff = Number(!BLOCK_TAGS.has(a.tag_name)) - Number(!BLOCK_TAGS.has(b.tag_name));
    if (blockDiff) {
      return blockDiff;
    }
    return compareStrings(a.tag_name, b.tag_name) || compareStrings(a.class_name, b.class_name);
  });
}

export function clean(htmlString: string, config: Partial<DeworderConfig> = {}): string {
  const cfg = mergeConfig(config);
  const mapping = cfg.mapping;
  const doc = parseHtml(stripWordNoise(htmlString));
  const body = doc.body || doc.documentElement;

  for (const element of allElements(body)) {
    if (element.localName.includes(":")) {
      element.remove();
    }
  }

  const disallowedTags = new Set(cfg.disallowed_tags);
  for (const element of allElements(body)) {
    if (disallowedTags.has(element.localName)) {
      element.remove();
    }
  }

  for (const span of elementsByTag(body, "span")) {
    if (classList(span).some((className) => IGNORED_INLINE_CLASSES.has(className))) {
      unwrapElement(span);
    }
  }

  for (const element of allElements(body)) {
    if (classList(element).some((className) => AUTO_STRIP_CLASSES.has(className))) {
      element.remove();
    }
  }

  // Detect Word list paragraphs independently of class mapping. Word marks
  // every list item with mso-list: on the <p> itself, and hides the real
  // marker (a number, letter, or bullet glyph) in a <span style='mso-list:
  // Ignore'>. Read that marker to decide ol vs ul, tag the paragraph, then
  // delete the marker span so it doesn't survive as literal text.
  for (const p of elementsByTag(body, "p")) {
    if (!(p.getAttribute("style") || "").includes("mso-list:")) {
      continue;
    }
    const marker = p.querySelector('span[style*="mso-list:Ignore"]');
    if (marker) {
      if (/[a-z0-9]/i.test(marker.textContent || "")) {
        p.setAttribute("data-deworder-ol", "");
      }
      marker.remove();
    }
    p.setAttribute("data-deworder-list-item", "true");
  }

  for (const element of allElements(body).filter((node) => ["p", "span"].includes(node.localName))) {
    const isListItem = element.hasAttribute("data-deworder-list-item");
    if (isListItem) {
      element.removeAttribute("data-deworder-list-item");
    }
    const target = isListItem ? "li" : mappedTarget(element, mapping);
    if (!target || target === "keep") {
      continue;
    }
    if (target === "strip") {
      element.remove();
      continue;
    }
    const effectiveTag = target === "ol" ? "li" : target;
    const replacement = replaceElementTag(doc, element, effectiveTag);
    replacement.removeAttribute("class");
    if (target === "ol") {
      replacement.setAttribute("data-deworder-ol", "");
    }
  }

  for (const element of allElements(body)) {
    if ((element.getAttribute("style") || "").includes("mso-element:comment")) {
      element.remove();
    }
  }

  for (const div of elementsByTag(body, "div")) {
    unwrapElement(div);
  }

  handleTables(body, cfg.table_mode, doc);

  wrapConsecutiveListItems(doc, body);

  for (const element of allElements(body).filter((node) => ["b", "i", "font", "u"].includes(node.localName))) {
    if (element.localName === "b") {
      replaceElementTag(doc, element, "strong");
    } else if (element.localName === "i") {
      replaceElementTag(doc, element, "em");
    } else {
      unwrapElement(element);
    }
  }

  for (const link of elementsByTag(body, "a")) {
    const href = (link.getAttribute("href") || "").trim();
    const text = (link.textContent || "").trim();
    if (href && /^https?:\/\//i.test(href) && href !== text) {
      link.append(doc.createTextNode(` (${href})`));
    }
    unwrapElement(link);
  }

  for (const br of elementsByTag(body, "br")) {
    br.remove();
  }

  for (const element of allElements(body)) {
    for (const attr of Array.from(element.attributes)) {
      if (shouldStripAttr(attr.name)) {
        element.removeAttribute(attr.name);
      }
    }
  }

  if (cfg.strip_all_classes) {
    for (const element of allElements(body)) {
      element.removeAttribute("class");
    }
  }

  for (const span of elementsByTag(body, "span")) {
    if (!span.attributes.length) {
      unwrapElement(span);
    }
  }

  collapseNested(body, "strong");
  collapseNested(body, "em");
  removeEmptyElements(body, EMPTY_INLINE_TAGS);
  removeEmptyElements(body, EMPTY_BLOCK_TAGS);

  return serializeBodyFragment(body);
}

export function mergeConfig(config: Partial<DeworderConfig> = {}): DeworderConfig {
  return {
    mapping: {
      ...DEFAULT_CONFIG.mapping,
      ...(config.mapping || {}),
    },
    strip_all_classes: config.strip_all_classes !== false,
    table_mode: config.table_mode || DEFAULT_CONFIG.table_mode,
    disallowed_tags: config.disallowed_tags || DEFAULT_CONFIG.disallowed_tags,
  };
}

function detectDeclaredCharset(bytes: Uint8Array): string {
  const head = String.fromCharCode(...bytes.slice(0, 4096));
  const match = META_CHARSET_RE.exec(head);
  return match ? match[1].trim().toLowerCase() : "";
}

function decodeBytes(bytes: Uint8Array, encoding: string): string {
  try {
    return new TextDecoder(encoding, { fatal: false }).decode(bytes);
  } catch {
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  }
}

function stripWordNoise(htmlString: string): string {
  return String(htmlString)
    .replace(MSO_COMMENT_RE, "")
    // Downlevel-revealed conditionals wrap several kinds of fallback content
    // (VML images, comment-annotation UI, and list markers). Drop them all
    // wholesale as before, EXCEPT !supportLists blocks: keep their inner
    // content so the list marker survives for ol/ul detection in clean().
    .replace(DOWNLEVEL_REVEALED_RE, (_match, condition: string, inner: string) =>
      /!\s*supportLists/i.test(condition) ? inner : "")
    .replace(PLAIN_COMMENT_RE, "")
    .replace(PI_RE, "");
}

function parseHtml(htmlString: string): Document {
  return new DOMParser().parseFromString(htmlString, "text/html");
}

function allElements(root: Element): Element[] {
  return Array.from(root.querySelectorAll("*"));
}

function elementsByTag(root: Element, tagName: string): Element[] {
  return Array.from(root.getElementsByTagName(tagName));
}

function classList(element: Element): string[] {
  return (element.getAttribute("class") || "").trim().split(/\s+/).filter(Boolean);
}

function normalizeClass(className: string): string {
  return className.replace(CXSP_SUFFIX_RE, "");
}

function mappedTarget(element: Element, mapping: Record<string, string>): string {
  for (const className of classList(element)) {
    const lookup = Object.hasOwn(mapping, className) ? className : normalizeClass(className);
    if (Object.hasOwn(mapping, lookup)) {
      return mapping[lookup];
    }
  }
  return "";
}

function replaceElementTag(doc: Document, element: Element, tagName: string): Element {
  const replacement = doc.createElement(tagName);
  for (const attr of Array.from(element.attributes)) {
    replacement.setAttribute(attr.name, attr.value);
  }
  while (element.firstChild) {
    replacement.append(element.firstChild);
  }
  element.replaceWith(replacement);
  return replacement;
}

function unwrapElement(element: Element): void {
  element.replaceWith(...Array.from(element.childNodes));
}

function wrapConsecutiveListItems(doc: Document, root: Element): void {
  const parents: Element[] = [];
  const seen = new Set<Element>();
  for (const li of elementsByTag(root, "li")) {
    const parent = li.parentElement;
    if (!parent || parent.localName === "ul" || parent.localName === "ol" || seen.has(parent)) {
      continue;
    }
    seen.add(parent);
    parents.push(parent);
  }

  for (const parent of parents) {
    let children = Array.from(parent.children);
    let index = 0;
    while (index < children.length) {
      if (children[index].localName !== "li") {
        index += 1;
        continue;
      }

      const firstIsOl = children[index].hasAttribute("data-deworder-ol");
      const run: Element[] = [];
      while (
        index < children.length &&
        children[index].localName === "li" &&
        children[index].hasAttribute("data-deworder-ol") === firstIsOl
      ) {
        run.push(children[index]);
        index += 1;
      }

      const wrapper = doc.createElement(firstIsOl ? "ol" : "ul");
      run[0].before(wrapper);
      for (const li of run) {
        li.removeAttribute("data-deworder-ol");
        wrapper.append(li);
      }

      children = Array.from(parent.children);
      index = children.indexOf(wrapper) + 1;
    }
  }
}

function handleTables(body: Element, tableMode: TableMode, doc: Document): void {
  const CELL_BLOCK_RE = /^(p|div|h[1-6]|blockquote|ul|ol|li)$/i;
  for (const table of [...body.querySelectorAll("table")]) {
    if (tableMode === "flatten") {
      const fragment = doc.createDocumentFragment();
      for (const cell of table.querySelectorAll("td, th")) {
        const blocks = [...cell.children].filter(el => CELL_BLOCK_RE.test(el.tagName));
        if (blocks.length) {
          blocks.forEach(b => fragment.appendChild(b));
        } else if (cell.textContent.trim()) {
          const p = doc.createElement("p");
          [...cell.childNodes].forEach(n => p.appendChild(n));
          fragment.appendChild(p);
        }
      }
      table.replaceWith(fragment);
    } else {
      table.querySelectorAll("colgroup, col, caption").forEach(el => el.remove());
    }
  }
}

function shouldStripAttr(attrName: string): boolean {
  const name = attrName.toLowerCase();
  return (
    STRIPPED_ATTRS.has(name)
    || name.startsWith("mso-")
    || name.startsWith("xmlns")
    || name.startsWith("on")
    || name === "v:shapes"
    || name === "o:spid"
  );
}

function collapseNested(root: Element, tagName: string): void {
  for (const element of elementsByTag(root, tagName)) {
    let parent = element.parentElement;
    while (parent && parent !== root) {
      if (parent.localName === tagName) {
        unwrapElement(element);
        break;
      }
      parent = parent.parentElement;
    }
  }
}

function removeEmptyElements(root: Element, tagNames: ReadonlySet<string>): void {
  for (const element of allElements(root).reverse()) {
    if (!tagNames.has(element.localName)) {
      continue;
    }
    if ((element.textContent || "").replaceAll("\u00a0", "").trim()) {
      continue;
    }
    element.remove();
  }
}

function serializeBodyFragment(body: Element): string {
  const pieces: string[] = [];
  for (const child of body.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent!.trim();
      if (text) {
        pieces.push(text);
      }
      continue;
    }

    if (child.nodeType === Node.ELEMENT_NODE) {
      const rendered = (child as Element).outerHTML.trim();
      if (rendered) {
        pieces.push(rendered);
      }
    }
  }
  return pieces.length ? `${pieces.join("\n")}\n` : "";
}

function compareStrings(a: string, b: string): number {
  if (a < b) {
    return -1;
  }
  if (a > b) {
    return 1;
  }
  return 0;
}
