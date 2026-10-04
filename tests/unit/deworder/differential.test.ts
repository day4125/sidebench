// Parity check: the untouched legacy engine (copied from the prodtools repo
// into ./legacy/) and the port run side by side in the same browser on the
// same inputs, and must agree exactly. Removed once the port has parity
// (see TODO.md, Cleanup).
import "./legacy/defaults.js";
import "./legacy/deworder.js";
import { describe, expect, test } from "vitest";
import * as port from "@/tools/deworder/engine/deworder";
import type { DeworderConfig } from "@/tools/deworder/engine/deworder";
import fixture from "./fixtures/verify-fixture.html?raw";
import fixtureUrl from "./fixtures/verify-fixture.html?url";
import wordBranches from "./fixtures/word-branches.html?raw";
import * as input from "./inputs";

const legacy = (window as unknown as { Toolbox: { deworder: typeof port } }).Toolbox.deworder;

const configs: Record<string, Partial<DeworderConfig>> = {
  default: {},
  "strip_all_classes off": { strip_all_classes: false },
  "table_mode keep": { table_mode: "keep" },
  "table_mode flatten": { table_mode: "flatten" },
  "strip/keep mapping": input.stripKeepConfig,
  "ol mapping": input.numListConfig,
  "other targets": {
    mapping: {
      NoKCitat: "blockquote",
      NoKIngress: "strip",
      NoKBildtext: "h6",
      NoKArbetsinfo: "ul",
      NoKBetoningFet: "keep",
      MsoNormal: "keep",
      Okand: "em",
    },
    strip_all_classes: false,
    table_mode: "flatten",
    disallowed_tags: ["script"],
  },
};

// word-branches.html has no expected output of its own: it reaches the
// branches the unit tests don't, and the legacy engine is the oracle.
const htmlInputs: Record<string, string> = {
  "verify-fixture.html": fixture,
  "word-branches.html": wordBranches,
};
for (const [name, value] of Object.entries(input)) {
  if (typeof value === "string") htmlInputs[name] = value;
}

// Real Word exports can't be committed (INTENT.md), but any dropped into
// tests/unit/deworder/local/ (gitignored) are compared too, bytes and all.
const localDocs = import.meta.glob<string>("./local/*.{html,htm}", {
  query: "?url",
  import: "default",
  eager: true,
});
const fromUrl = (url: string) => async () => (await fetch(url)).arrayBuffer();
const byteInputs: Record<string, () => Promise<ArrayBuffer>> = {
  "verify-fixture.html": fromUrl(fixtureUrl),
  "word-branches.html as windows-1252": async () => windows1252(wordBranches),
  ...Object.fromEntries(Object.entries(localDocs).map(([path, url]) => [path, fromUrl(url)])),
};

test("exports the same API and constants", () => {
  for (const key of Object.keys(legacy)) expect(port, key).toHaveProperty(key);
  expect(port.ALLOWED_TARGETS).toEqual(legacy.ALLOWED_TARGETS);
  expect(port.AUTO_STRIP_CLASSES).toEqual(legacy.AUTO_STRIP_CLASSES);
  expect(port.STRIPPED_ATTRS).toEqual(legacy.STRIPPED_ATTRS);
  expect(port.DEFAULT_CONFIG).toEqual(legacy.DEFAULT_CONFIG);
});

test.each(Object.entries(configs))("mergeConfig agrees: %s", (_name, config) => {
  expect(port.mergeConfig(config)).toEqual(legacy.mergeConfig(config));
});

describe.each(Object.entries(htmlInputs))("%s", (_name, html) => {
  test("detectClasses agrees", () => {
    expect(port.detectClasses(html)).toEqual(legacy.detectClasses(html));
  });

  test.each(Object.entries(configs))("clean agrees: %s", (_config, config) => {
    expect(port.clean(html, config)).toBe(legacy.clean(html, config));
  });
});

describe.each(Object.entries(byteInputs))("%s (from bytes)", (_name, load) => {
  test("decodeHtmlBytes, detectClasses and clean agree", async () => {
    const bytes = await load();
    const html = port.decodeHtmlBytes(bytes);
    expect(html).toBe(legacy.decodeHtmlBytes(bytes));
    expect(port.detectClasses(html)).toEqual(legacy.detectClasses(html));
    for (const config of Object.values(configs)) {
      expect(port.clean(html, config)).toBe(legacy.clean(html, config));
    }
  });
});

/** Encodes text as windows-1252, the charset Word declares in its exports. */
function windows1252(text: string): ArrayBuffer {
  const high = "€\u0081‚ƒ„…†‡ˆ‰Š‹Œ\u008DŽ\u008F\u0090‘’“”•–—˜™š›œ\u009DžŸ";
  const bytes = [...text].map((char) => {
    const index = high.indexOf(char);
    if (index >= 0) return 0x80 + index;
    const code = char.charCodeAt(0);
    if (code > 0xff) throw new Error(`not in windows-1252: ${char}`);
    return code;
  });
  return new Uint8Array(bytes).buffer;
}
