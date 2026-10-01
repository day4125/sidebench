// SVGO off the main thread: a 20 MB file takes seconds.
import { optimize, type Config } from "svgo/browser";

export interface OptimizeRequest {
  id: number;
  svg: string;
  config: Config;
}

export type OptimizeResponse = { id: number; data: string } | { id: number; error: string };

self.onmessage = (e: MessageEvent<OptimizeRequest>) => {
  const { id, svg, config } = e.data;
  try {
    const out = optimize(svg, config);
    self.postMessage({ id, data: out.data } satisfies OptimizeResponse);
  } catch (err) {
    self.postMessage({ id, error: err instanceof Error ? err.message : String(err) } satisfies OptimizeResponse);
  }
};
