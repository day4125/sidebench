// Builds small PDFs in memory for the viewer tests, one page per entry in
// `sizes` (points). Each page shows its label and number in Helvetica, and a
// black bar 10 pt wide per page number, so a test can tell pages apart by
// their pixels. Same structure as scripts/make-pdf-fixture.mjs.

export type PageSize = [number, number];

export const A4: PageSize = [595, 842];
export const A4_LANDSCAPE: PageSize = [842, 595];

export function makePdf(label: string, sizes: PageSize[]): Buffer {
  const text = (s: string) => Buffer.from(s, "latin1");
  const stream = (data: string) => text(`<< /Length ${data.length} >>\nstream\n${data}\nendstream`);

  const n = sizes.length;
  // 1 catalog, 2 pages, 3 font, then per page: page object, content stream.
  const pageId = (i: number) => 4 + 2 * i;
  const objects: Buffer[] = [
    text("<< /Type /Catalog /Pages 2 0 R >>"),
    text(`<< /Type /Pages /Kids [${sizes.map((_, i) => `${pageId(i)} 0 R`).join(" ")}] /Count ${n} >>`),
    text("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"),
  ];
  sizes.forEach(([w, h], i) => {
    objects.push(
      text(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Contents ${pageId(i) + 1} 0 R ` +
          "/Resources << /Font << /F1 3 0 R >> >> >>",
      ),
    );
    objects.push(
      stream(`BT /F1 48 Tf 40 ${h - 90} Td (${label} ${i + 1}) Tj ET\n0 g 40 40 ${10 * (i + 1)} 20 re f\n`),
    );
  });

  const parts = [text("%PDF-1.7\n%\xE2\xE3\xCF\xD3\n")];
  const offsets: number[] = [];
  let length = parts[0].length;
  objects.forEach((body, i) => {
    offsets.push(length);
    const obj = Buffer.concat([text(`${i + 1} 0 obj\n`), body, text("\nendobj\n")]);
    parts.push(obj);
    length += obj.length;
  });
  parts.push(
    text(
      `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` +
        offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("") +
        `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${length}\n%%EOF\n`,
    ),
  );
  return Buffer.concat(parts);
}

/** As a Playwright file payload. */
export function pdfFile(name: string, label: string, sizes: PageSize[]) {
  return { name, mimeType: "application/pdf", buffer: makePdf(label, sizes) };
}

export const pages = (n: number, size: PageSize = A4): PageSize[] => Array.from({ length: n }, () => size);
