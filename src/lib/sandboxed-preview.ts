// Renders user HTML in a sandboxed iframe (INTENT.md: sandbox
// "allow-same-origin" only, so no scripts, forms or popups).
//
// A srcdoc iframe inherits the page's CSP, which has no 'unsafe-inline' for
// styles: Word's <style> blocks and style="" attributes would be blocked
// (each with a console error) and the preview would lose the look it's
// there to show. So they're taken out of the markup and applied through
// CSSOM after load, which CSP doesn't restrict (as in style-singleton.ts).
//
// The page's CSP still lets the frame load from our own origin, so a
// relative <img src="image001.png"> would send a file name from the
// document to the host. The preview gets a stricter policy of its own
// (policies combine, so it can only tighten), and the usual loaders are
// removed up front so they don't fill the console with CSP errors, as are
// event handler attributes.
// Navigation isn't covered by CSP: <meta http-equiv> (refresh) is removed
// and link clicks are cancelled.

const STYLE_ATTR = "data-sidebench-style";
const FRAME_CSP = "default-src 'none'; img-src data:";
const REMOVED = "script, link, base, meta[http-equiv], iframe, frame, object, embed, applet, video, audio, source, track";
// Attributes that load something, and event handlers (the sandbox blocks
// those, but logs an error each time one fires).
const DROPPED_ATTR = /^(src|srcset|background|poster|on.*)$/i;

export interface PreparedPreview {
  /** The markup for the iframe's srcdoc, without inline styles. */
  srcdoc: string;
  /** The text of each <style> element, in document order. */
  sheets: string[];
}

export function preparePreview(html: string): PreparedPreview {
  const doc = new DOMParser().parseFromString(html, "text/html");

  const sheets: string[] = [];
  for (const style of doc.querySelectorAll("style")) {
    sheets.push(style.textContent ?? "");
    style.remove();
  }
  for (const el of doc.querySelectorAll("[style]")) {
    el.setAttribute(STYLE_ATTR, el.getAttribute("style")!);
    el.removeAttribute("style");
  }
  for (const el of doc.querySelectorAll(REMOVED)) el.remove();
  for (const el of doc.querySelectorAll("*")) {
    for (const { name } of [...el.attributes]) {
      if (DROPPED_ATTR.test(name)) el.removeAttribute(name);
    }
  }

  const meta = doc.createElement("meta");
  meta.httpEquiv = "Content-Security-Policy";
  meta.content = FRAME_CSP;
  doc.head.prepend(meta);

  return { srcdoc: doctype(doc) + doc.documentElement.outerHTML, sheets };
}

/** Call from the iframe's load event: applies the styles taken out. */
export function applyPreview(iframe: HTMLIFrameElement, prepared: PreparedPreview) {
  const win = iframe.contentWindow as (Window & typeof globalThis) | null;
  const doc = iframe.contentDocument;
  if (!win || !doc) return;

  // Sheets must be built with the frame's own constructor to be adopted.
  doc.adoptedStyleSheets = prepared.sheets.map((css) => {
    const sheet = new win.CSSStyleSheet();
    sheet.replaceSync(css);
    return sheet;
  });
  for (const el of doc.querySelectorAll<HTMLElement>(`[${STYLE_ATTR}]`)) {
    el.style.cssText = el.getAttribute(STYLE_ATTR)!;
    el.removeAttribute(STYLE_ATTR);
  }
  doc.addEventListener("click", (event) => {
    if ((event.target as Element).closest?.("a, area")) event.preventDefault();
  });
}

// Kept so the preview renders in the same (quirks or standards) mode as
// the original: Word's exports often have no doctype.
function doctype(doc: Document) {
  const dt = doc.doctype;
  if (!dt) return "";
  let out = `<!DOCTYPE ${dt.name}`;
  if (dt.publicId) out += ` PUBLIC "${dt.publicId}"`;
  if (dt.systemId) out += `${dt.publicId ? "" : " SYSTEM"} "${dt.systemId}"`;
  return out + ">";
}
