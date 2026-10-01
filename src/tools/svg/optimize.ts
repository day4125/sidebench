// The levers that run SVGO: metadata cleanup and optimization. Each runner
// holds one worker and one job; a new job stops the one before it (the
// worker is terminated, so a 5 s run doesn't finish for nothing).
import type { Config, PluginConfig } from "svgo/browser";
import type { OptimizeRequest, OptimizeResponse } from "./optimize.worker";

export interface CleanupItem {
  plugin: string;
  label: string;
  hint?: string;
  /** Off by default and marked: removing it can break something. */
  risky?: boolean;
}

export const CLEANUP: CleanupItem[] = [
  { plugin: "removeEditorsNSData", label: "Redigeringsdata", hint: "Inkscape, Illustrator, Sketch, Figma m.fl." },
  { plugin: "removeMetadata", label: "<metadata>" },
  { plugin: "removeComments", label: "Kommentarer" },
  { plugin: "removeXMLProcInst", label: "XML-deklaration" },
  { plugin: "removeDoctype", label: "Doctype" },
  { plugin: "removeUnusedNS", label: "Oanvända namnrymder" },
  { plugin: "removeTitle", label: "<title>", hint: "Skärmläsare läser titeln", risky: true },
  { plugin: "removeDesc", label: "<desc>", hint: "Skärmläsare läser beskrivningen", risky: true },
];

export const DEFAULT_CLEANUP = CLEANUP.filter((c) => !c.risky).map((c) => c.plugin);

export function cleanupConfig(plugins: string[]): Config {
  return {
    multipass: false,
    js2svg: { pretty: false },
    plugins: plugins.map((name) => ({ name }) as PluginConfig),
  };
}

export interface OptimizeOptions {
  /** Decimals kept in coordinates and numbers. */
  precision: number;
  /** Keep id names (minifying them can clash when several SVGs sit inline on one page). */
  keepIds: boolean;
}

export const DEFAULT_OPTIMIZE: OptimizeOptions = { precision: 3, keepIds: false };

export function optimizeConfig(o: OptimizeOptions): Config {
  return {
    multipass: true,
    floatPrecision: o.precision,
    js2svg: { pretty: false },
    plugins: [
      {
        name: "preset-default",
        params: { overrides: o.keepIds ? { cleanupIds: false } : {} },
      },
    ],
  };
}

export class SvgoRunner {
  private worker: Worker | null = null;
  private seq = 0;
  private pending: { id: number; resolve: (s: string) => void; reject: (e: Error) => void } | null = null;

  private spawn() {
    const w = new Worker(new URL("./optimize.worker.ts", import.meta.url), { type: "module" });
    w.onmessage = (e: MessageEvent<OptimizeResponse>) => {
      const p = this.pending;
      if (!p || p.id !== e.data.id) return;
      this.pending = null;
      if ("error" in e.data) p.reject(new Error(e.data.error));
      else p.resolve(e.data.data);
    };
    w.onerror = (e) => {
      const p = this.pending;
      this.pending = null;
      this.worker = null;
      p?.reject(new Error(e.message || "SVGO kraschade"));
    };
    return w;
  }

  run(svg: string, config: Config): Promise<string> {
    this.cancel();
    this.worker ??= this.spawn();
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      this.pending = { id, resolve, reject };
      this.worker!.postMessage({ id, svg, config } satisfies OptimizeRequest);
    });
  }

  /** Stops the running job; its promise rejects with AbortError. */
  cancel() {
    if (!this.pending) return;
    this.pending.reject(new DOMException("Avbrutet", "AbortError"));
    this.pending = null;
    this.worker?.terminate();
    this.worker = null;
  }

  dispose() {
    this.cancel();
    this.worker?.terminate();
    this.worker = null;
  }
}

export const isAbort = (e: unknown) => e instanceof DOMException && e.name === "AbortError";
