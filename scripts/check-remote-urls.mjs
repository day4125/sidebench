// Fails the build if dist/ contains a remote URL that could be fetched at
// runtime. Strings that are identifiers rather than requests are allowed.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ALLOWED = [
  /^https?:\/\/www\.w3\.org\//, // XML/SVG namespaces
  /^https:\/\/react\.dev\/errors\//, // React's minified error messages
  // PDF.js
  /^http:\/\/www\.apache\.org\/licenses\/LICENSE-2\.0$/, // license comment
  /^http:\/\/www\.xfa\.org\/schema\//, // XFA namespaces
  /^http:\/\/ns\.adobe\.com\//, // XDP/XFDF/XMP namespaces
  /^http:\/\/example\.com$/, // dummy base for URL parsing
  /^https:\/\/foo\.bar$/, // dummy base for URL parsing
  /^http:\/\/\$\{e\}$/, // prefix added to a PDF's "www." link text
];

const files = readdirSync("dist", { recursive: true })
  .map((f) => join("dist", f))
  .filter((f) => /\.(html|js|mjs|css|json|svg|webmanifest)$/.test(f));

let bad = 0;
for (const file of files) {
  // License banners (/*! ... */) are comments, never fetched.
  const text = readFileSync(file, "utf8").replace(/\/\*![\s\S]*?\*\//g, "");
  for (const [url] of text.matchAll(/https?:\/\/[^\s"'`)<>\\]+/g)) {
    if (ALLOWED.some((re) => re.test(url))) continue;
    console.error(`${file}: ${url}`);
    bad++;
  }
}

if (bad) {
  console.error(`\n${bad} remote URL(s) in dist/. Remove them or, if they are never fetched, add them to ALLOWED in ${import.meta.filename}.`);
  process.exit(1);
}
console.log(`No remote URLs in ${files.length} files in dist/.`);
