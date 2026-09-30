// Prototype only: pretend every tool in the registry is built, so the
// landing sketches (and the sidebar next to them) show no "kommer snart".
// Import this first in a prototype entry, before AppShell, so the sidebar's
// module-level live/soon split runs after the change.
import { tools } from "@/tools/registry";

for (const tool of tools) {
  tool.status = "live";
  tool.href ??= "#";
}

export { tools };
