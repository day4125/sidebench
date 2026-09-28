// The mapping form (step 2) and the configs built from it. Mirrors
// renderMappingTable(), collectMappingConfig() and downloadConfig() in
// prodtools' static/deworder-app.js.

import {
  ALLOWED_TARGETS,
  type DetectedClass,
  type DeworderConfig,
  type TableMode,
  type Target,
} from "./engine/deworder";

/** The user's choices in step 2. Content-derived: React state only. */
export interface MappingForm {
  /** Target per detected class, in table order. */
  mapping: Record<string, Target>;
  strip_all_classes: boolean;
  table_mode: TableMode;
}

/**
 * The form as the table shows it for a config. A class the config doesn't
 * map starts as "keep". A target outside ALLOWED_TARGETS shows as the first
 * option, as the legacy <select> did when no option matched.
 *
 * Rows are per tag and class, so a class can appear on several rows; they
 * share one value. (Legacy gave each row its own <select> and the last one
 * won, silently dropping an edit to an earlier row.)
 */
export function formFromConfig(config: DeworderConfig, rows: DetectedClass[]): MappingForm {
  const mapping: Record<string, Target> = {};
  for (const row of rows) {
    const target = config.mapping[row.class_name] || "keep";
    mapping[row.class_name] = isTarget(target) ? target : ALLOWED_TARGETS[0];
  }
  return {
    mapping,
    strip_all_classes: config.strip_all_classes !== false,
    // The engine treats anything but "flatten" as "keep".
    table_mode: config.table_mode === "flatten" ? "flatten" : "keep",
  };
}

/** What clean() gets: only the detected classes' mappings. */
export function cleanConfig(form: MappingForm, config: DeworderConfig): DeworderConfig {
  return {
    mapping: { ...form.mapping },
    strip_all_classes: form.strip_all_classes,
    table_mode: form.table_mode,
    disallowed_tags: config.disallowed_tags,
  };
}

/** The downloaded config.json: the loaded config with the form on top. */
export function configFile(form: MappingForm, config: DeworderConfig): string {
  const saved = {
    mapping: { ...config.mapping, ...form.mapping },
    strip_all_classes: form.strip_all_classes,
    table_mode: form.table_mode,
    disallowed_tags: config.disallowed_tags,
  };
  return JSON.stringify(saved, null, 2);
}

/** Classes mapped to h1–h6, to find the "before" pane's headings. */
export function headingClasses(config: DeworderConfig): string[] {
  return Object.entries(config.mapping)
    .filter(([, target]) => /^h[1-6]$/.test(target))
    .map(([name]) => name);
}

function isTarget(value: string): value is Target {
  return (ALLOWED_TARGETS as readonly string[]).includes(value);
}
