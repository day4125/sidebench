// Re-encoding embedded raster images with the browser's own canvas: no
// library, nothing leaves the page.
import { parseXml, serialize, type EmbeddedImage } from "./engine";

export type ImageFormat = "image/webp" | "image/jpeg";

export interface ImageOptions {
  format: ImageFormat;
  /** 0–1. */
  quality: number;
  /** Longest side in pixels; 0 keeps the size. */
  maxSide: number;
}

export const DEFAULT_IMAGES: ImageOptions = { format: "image/webp", quality: 0.8, maxSide: 0 };

export const MAX_SIDES = [0, 3000, 2000, 1500, 1000, 600];

export interface ImageInfo {
  width: number;
  height: number;
  alpha: boolean;
}

function dataUriToBlob(uri: string): Blob {
  const comma = uri.indexOf(",");
  const head = uri.slice(5, comma);
  const mime = head.split(";")[0] || "application/octet-stream";
  const body = uri.slice(comma + 1);
  if (/;base64/i.test(head)) {
    const bin = atob(body.replace(/\s+/g, ""));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }
  return new Blob([decodeURIComponent(body)], { type: mime });
}

async function blobToDataUri(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let s = "";
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return `data:${blob.type};base64,${btoa(s)}`;
}

/** Any pixel not fully opaque (sampled on a grid for big images). */
function hasAlpha(ctx: OffscreenCanvasRenderingContext2D, w: number, h: number): boolean {
  const data = ctx.getImageData(0, 0, w, h).data;
  const step = Math.max(1, Math.floor((w * h) / 250_000)) * 4;
  for (let i = 3; i < data.length; i += step) if (data[i] < 255) return true;
  return false;
}

export async function inspect(img: EmbeddedImage): Promise<ImageInfo | null> {
  try {
    const bmp = await createImageBitmap(dataUriToBlob(img.href));
    const c = new OffscreenCanvas(bmp.width, bmp.height);
    const ctx = c.getContext("2d")!;
    ctx.drawImage(bmp, 0, 0);
    const info = { width: bmp.width, height: bmp.height, alpha: hasAlpha(ctx, bmp.width, bmp.height) };
    bmp.close();
    return info;
  } catch {
    return null;
  }
}

/**
 * The image re-encoded, or null when the result isn't smaller (or the
 * image can't be decoded, e.g. an SVG inside the SVG). JPEG has no alpha:
 * transparent pixels go white.
 */
export async function recompress(img: EmbeddedImage, o: ImageOptions): Promise<string | null> {
  try {
    const bmp = await createImageBitmap(dataUriToBlob(img.href));
    const long = Math.max(bmp.width, bmp.height);
    const k = o.maxSide && long > o.maxSide ? o.maxSide / long : 1;
    const w = Math.max(1, Math.round(bmp.width * k));
    const h = Math.max(1, Math.round(bmp.height * k));
    const c = new OffscreenCanvas(w, h);
    const ctx = c.getContext("2d")!;
    if (o.format === "image/jpeg") {
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, w, h);
    }
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close();
    const blob = await c.convertToBlob({ type: o.format, quality: o.quality });
    // A browser without the encoder hands back PNG.
    if (blob.type !== o.format) return null;
    const uri = await blobToDataUri(blob);
    return uri.length < img.href.length ? uri : null;
  } catch {
    return null;
  }
}

/** Every image re-encoded with the same options; node index → new href (smaller ones only). */
export async function recompressAll(images: EmbeddedImage[], o: ImageOptions): Promise<Map<number, string>> {
  const out = new Map<number, string>();
  for (const img of images) {
    const uri = await recompress(img, o);
    if (uri) out.set(img.node, uri);
  }
  return out;
}

/**
 * Re-encodes every embedded image in an SVG text (used by "Nå budget",
 * after SVGO has rewritten the structure). Returns the new text and how
 * many images got smaller.
 */
export async function recompressText(text: string, o: ImageOptions): Promise<{ text: string; changed: number }> {
  const doc = parseXml(text);
  let changed = 0;
  for (const el of doc.getElementsByTagNameNS("http://www.w3.org/2000/svg", "image")) {
    const xlink = el.getAttributeNS("http://www.w3.org/1999/xlink", "href");
    const href = el.getAttribute("href") ?? xlink;
    if (!href || !/^data:image\//i.test(href)) continue;
    const uri = await recompress({ node: -1, mime: "", bytes: href.length, href }, o);
    if (!uri) continue;
    if (el.hasAttribute("href")) el.setAttribute("href", uri);
    if (xlink != null) el.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", uri);
    changed++;
  }
  return { text: changed ? serialize(doc) : text, changed };
}
