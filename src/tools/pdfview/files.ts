import type { DragEvent } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";

/** A: the original. B: the compressed copy. */
export type Side = "a" | "b";

export const SIDE_NAME: Record<Side, string> = { a: "Original", b: "Komprimerad" };

export interface PdfFile {
  doc: PDFDocumentProxy;
  name: string;
  /** File size in bytes. */
  size: number;
}

export interface Toast {
  id: number;
  text: string;
}

export function isPdf(file: File) {
  return /\.pdf$/i.test(file.name) || file.type === "application/pdf";
}

/** The first PDF among the dropped files, else the first file. */
export function firstFile(e: DragEvent) {
  const list = Array.from(e.dataTransfer.files);
  return list.find(isPdf) ?? list[0] ?? null;
}

export function hasFiles(e: DragEvent) {
  return Array.from(e.dataTransfer.types).includes("Files");
}
