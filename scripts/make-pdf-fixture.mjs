// Builds tests/e2e/fixtures/features.pdf: one small page per PDF.js support
// file that the CSP setup must serve without the network
// (src/tools/pdfview/pdfjs.ts). Needs opj_compress (OpenJPEG) for the
// JPEG 2000 image. The output is committed; rerun only to change it.
//   page 1: non-embedded standard fonts → bundled standard font data
//   page 2: Japanese text with a predefined CMap → bundled CMap data
//   page 3: a JPEG 2000 image → the pure-JS decoder in pdfjs/wasm/
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// 64×64 RGB gradient, encoded as JPEG 2000.
const size = 64;
const pixels = Buffer.alloc(size * size * 3);
for (let y = 0; y < size; y++) {
  for (let x = 0; x < size; x++) {
    pixels.set([x * 4, 80, y * 4], (y * size + x) * 3);
  }
}
const tmp = mkdtempSync(join(tmpdir(), "pdf-fixture-"));
writeFileSync(join(tmp, "in.ppm"), Buffer.concat([Buffer.from(`P6\n${size} ${size}\n255\n`), pixels]));
execFileSync("opj_compress", ["-i", join(tmp, "in.ppm"), "-o", join(tmp, "out.jp2")], { stdio: "ignore" });
const jp2 = readFileSync(join(tmp, "out.jp2"));

const stream = (dict, data) =>
  Buffer.concat([Buffer.from(`<< ${dict} /Length ${data.length} >>\nstream\n`, "latin1"), data, Buffer.from("\nendstream")]);
const text = (s) => Buffer.from(s, "latin1");

const objects = [
  /* 1 */ text("<< /Type /Catalog /Pages 2 0 R >>"),
  /* 2 */ text("<< /Type /Pages /Kids [3 0 R 4 0 R 5 0 R] /Count 3 >>"),
  /* 3 */ text("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 420 297] /Contents 6 0 R /Resources << /Font << /F1 9 0 R /F2 10 0 R /F3 11 0 R >> >> >>"),
  /* 4 */ text("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 420 297] /Contents 7 0 R /Resources << /Font << /F1 9 0 R /F4 12 0 R >> >> >>"),
  /* 5 */ text("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 420 297] /Contents 8 0 R /Resources << /Font << /F1 9 0 R >> /XObject << /Im1 15 0 R >> >> >>"),
  /* 6 */ stream("", text(
    "BT /F1 24 Tf 30 240 Td (Helvetica: R\xE4ksm\xF6rg\xE5s \xC5\xC4\xD6) Tj ET\n" +
    "BT /F2 24 Tf 30 190 Td (Times-Bold: Standardtypsnitt) Tj ET\n" +
    "BT /F3 20 Tf 30 140 Td (Courier: 0123456789) Tj ET\n")),
  /* 7 */ stream("", text(
    "BT /F1 18 Tf 30 240 Td (Predefined CMap: UniJIS-UCS2-H) Tj ET\n" +
    "BT /F4 36 Tf 30 170 Td <65E5672C8A9E30C630AD30B930C8> Tj ET\n")),
  /* 8 */ stream("", text(
    "BT /F1 18 Tf 30 250 Td (JPEG 2000 image:) Tj ET\n" +
    "q 200 0 0 200 30 30 cm /Im1 Do Q\n")),
  /* 9 */ text("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"),
  /* 10 */ text("<< /Type /Font /Subtype /Type1 /BaseFont /Times-Bold /Encoding /WinAnsiEncoding >>"),
  /* 11 */ text("<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>"),
  /* 12 */ text("<< /Type /Font /Subtype /Type0 /BaseFont /KozMinPr6N-Regular /Encoding /UniJIS-UCS2-H /DescendantFonts [13 0 R] >>"),
  /* 13 */ text("<< /Type /Font /Subtype /CIDFontType0 /BaseFont /KozMinPr6N-Regular /CIDSystemInfo << /Registry (Adobe) /Ordering (Japan1) /Supplement 6 >> /FontDescriptor 14 0 R /DW 1000 >>"),
  /* 14 */ text("<< /Type /FontDescriptor /FontName /KozMinPr6N-Regular /Flags 6 /FontBBox [-437 -340 1147 1317] /ItalicAngle 0 /Ascent 880 /Descent -120 /CapHeight 742 /StemV 80 >>"),
  /* 15 */ stream(`/Type /XObject /Subtype /Image /Width ${size} /Height ${size} /Filter /JPXDecode`, jp2),
];

const parts = [Buffer.from("%PDF-1.7\n%\xE2\xE3\xCF\xD3\n", "latin1")];
const offsets = [];
let length = parts[0].length;
objects.forEach((body, i) => {
  offsets.push(length);
  const obj = Buffer.concat([text(`${i + 1} 0 obj\n`), body, text("\nendobj\n")]);
  parts.push(obj);
  length += obj.length;
});
const xref =
  `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` +
  offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("") +
  `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${length}\n%%EOF\n`;
parts.push(text(xref));

const out = "tests/e2e/fixtures/features.pdf";
writeFileSync(out, Buffer.concat(parts));
console.log(`Wrote ${out}`);
