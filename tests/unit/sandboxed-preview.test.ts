// What preparePreview() takes out of user HTML before it goes in a srcdoc.
// The e2e test (tests/e2e/deworder.spec.ts) checks the rendered result
// under the real CSP.
import { expect, test } from "vitest";
import { preparePreview } from "@/lib/sandboxed-preview";

const parse = (srcdoc: string) => new DOMParser().parseFromString(srcdoc, "text/html");

test("moves styles out of the markup", () => {
  const { srcdoc, sheets } = preparePreview(
    `<style>p{color:red}</style><p style="margin:0">a</p><style><!-- b{} --></style>`,
  );
  expect(sheets).toEqual(["p{color:red}", "<!-- b{} -->"]);
  const doc = parse(srcdoc);
  expect(doc.querySelectorAll("style, [style]")).toHaveLength(0);
  expect(doc.querySelector("p")!.getAttribute("data-sidebench-style")).toBe("margin:0");
});

test("removes what loads, navigates or runs", () => {
  const { srcdoc } = preparePreview(`<head><meta http-equiv="refresh" content="0;url=https://x.test"><link rel=stylesheet href=a.css><base href="https://x.test/"></head>
    <body background="bg.png" onload="x()"><img src="i.png" srcset="i2.png 2x" alt="bild"><script src="s.js"></script>
    <iframe src="f.html"></iframe><object data="o"></object><video poster="p.png"><source src="v.mp4"></video>
    <p onclick="y()">text</p><a href="https://x.test">länk</a></body>`);
  const doc = parse(srcdoc);
  expect(doc.querySelectorAll("script, link, base, iframe, object, video, source")).toHaveLength(0);
  expect(doc.querySelectorAll("[src], [srcset], [background], [poster], [onload], [onclick]")).toHaveLength(0);
  expect(doc.querySelector("img")!.alt).toBe("bild");
  // Links stay (clicks are cancelled at load); only our CSP meta remains.
  expect(doc.querySelector("a")!.href).toBe("https://x.test/");
  const metas = doc.querySelectorAll("meta[http-equiv]");
  expect(metas).toHaveLength(1);
  expect(metas[0].getAttribute("content")).toBe("default-src 'none'; img-src data:");
  expect(doc.head.firstElementChild).toBe(metas[0]);
});

test("keeps the doctype, or its absence", () => {
  expect(preparePreview("<p>x</p>").srcdoc).toMatch(/^<html>/);
  expect(preparePreview("<!DOCTYPE html><p>x</p>").srcdoc).toMatch(/^<!DOCTYPE html><html>/);
  const legacy = `<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN" "http://www.w3.org/TR/html4/loose.dtd"><p>x</p>`;
  expect(preparePreview(legacy).srcdoc).toMatch(/^<!DOCTYPE html PUBLIC "-\/\/W3C\/\/DTD HTML 4.01 Transitional\/\/EN" "http:\/\/www.w3.org\/TR\/html4\/loose.dtd"><html>/);
});
