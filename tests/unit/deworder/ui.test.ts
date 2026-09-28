// The deworder UI's pure parts: the mapping form and the configs built from
// it (legacy renderMappingTable/collectMappingConfig/downloadConfig), and
// the source highlighter.
import { describe, expect, test } from "vitest";
import { DEFAULT_CONFIG, detectClasses, mergeConfig } from "@/tools/deworder/engine/deworder";
import { highlightHtml } from "@/tools/deworder/highlight";
import { cleanConfig, configFile, formFromConfig, headingClasses } from "@/tools/deworder/mapping";
import fixture from "./fixtures/verify-fixture.html?raw";
import fixtureCleaned from "./fixtures/verify-fixture.cleaned.html?raw";
import wordBranches from "./fixtures/word-branches.html?raw";

const rows = (...classes: string[]) => classes.map((c) => ({ tag_name: "p", class_name: c, count: 1 }));

describe("formFromConfig", () => {
  test("takes each detected class's target from the config, else keep", () => {
    const form = formFromConfig(mergeConfig(DEFAULT_CONFIG), detectClasses(fixture));
    expect(form).toEqual({
      mapping: {
        MsoNormal: "p",
        NoKPunktlista: "li",
        NoKRubrik1: "h1",
        NoKRubrik2: "h2",
        NoKRubrik3: "h3",
        NoKText: "p",
        NoKBetoningKursiv: "em",
      },
      strip_all_classes: true,
      table_mode: "keep",
    });
    expect(formFromConfig(mergeConfig(), rows("Okand")).mapping).toEqual({ Okand: "keep" });
  });

  test("shows a target outside the list as the first option, like legacy's <select>", () => {
    const config = mergeConfig({ mapping: { A: "div", B: "" } });
    expect(formFromConfig(config, rows("A", "B")).mapping).toEqual({ A: "h1", B: "keep" });
  });

  test("reads the options, with anything but flatten as keep", () => {
    const off = mergeConfig({ strip_all_classes: false, table_mode: "flatten" });
    expect(formFromConfig(off, [])).toMatchObject({ strip_all_classes: false, table_mode: "flatten" });
    const odd = mergeConfig({ table_mode: "nonsense" as never });
    expect(formFromConfig(odd, []).table_mode).toBe("keep");
  });

  test("a class on several tags gets one entry", () => {
    const form = formFromConfig(mergeConfig(), [
      { tag_name: "p", class_name: "X", count: 1 },
      { tag_name: "span", class_name: "X", count: 2 },
    ]);
    expect(form.mapping).toEqual({ X: "keep" });
  });
});

describe("configs from the form", () => {
  const config = mergeConfig({ mapping: { Extra: "em" }, disallowed_tags: ["img"] });
  const form = { mapping: { NoKRubrik1: "h2" as const, New: "strip" as const }, strip_all_classes: false, table_mode: "flatten" as const };

  test("clean() gets only the table's mappings", () => {
    expect(cleanConfig(form, config)).toEqual({
      mapping: { NoKRubrik1: "h2", New: "strip" },
      strip_all_classes: false,
      table_mode: "flatten",
      disallowed_tags: ["img"],
    });
  });

  test("config.json is the loaded config with the table on top, in legacy's format", () => {
    const text = configFile(form, config);
    const saved = JSON.parse(text);
    expect(Object.keys(saved)).toEqual(["mapping", "strip_all_classes", "table_mode", "disallowed_tags"]);
    expect(Object.keys(saved.mapping)).toEqual([...Object.keys(config.mapping), "New"]);
    expect(saved.mapping.NoKRubrik1).toBe("h2");
    expect(saved.mapping.Extra).toBe("em");
    expect(text).toBe(JSON.stringify(saved, null, 2));
  });

  test("a downloaded config loads back to the same form", () => {
    const again = mergeConfig(JSON.parse(configFile(form, config)));
    expect(formFromConfig(again, rows("NoKRubrik1", "New"))).toEqual(form);
  });

  test("heading classes are those mapped to h1–h6", () => {
    expect(headingClasses(cleanConfig(form, config))).toEqual(["NoKRubrik1"]);
  });
});

describe("highlightHtml", () => {
  test.each([
    ["the cleaned fixture", fixtureCleaned],
    ["a Word export", wordBranches],
    ["broken markup", `<p a=1 b='2' c="3" d>x &amp; y &nbsp;</p><!-- c --><!doctype html><a<b>< p>`],
  ])("loses nothing: %s", (_, source) => {
    expect(highlightHtml(source).map((t) => t.text).join("")).toBe(source);
  });

  test("marks tags, attributes, values and entities", () => {
    expect(highlightHtml(`<a href="x">&amp;</a>`)).toEqual([
      { kind: "punc", text: "<" },
      { kind: "tag", text: "a" },
      { text: " " },
      { kind: "attr", text: "href" },
      { kind: "punc", text: "=" },
      { kind: "val", text: '"x"' },
      { kind: "punc", text: ">" },
      { kind: "ent", text: "&amp;" },
      { kind: "punc", text: "</" },
      { kind: "tag", text: "a" },
      { kind: "punc", text: ">" },
    ]);
  });
});
