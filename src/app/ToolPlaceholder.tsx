import { getTool } from "@/tools/registry";

// Stand-in page until the tool is rebuilt (port-plan steps 5–6).
export function ToolPlaceholder({ slug }: { slug: string }) {
  const tool = getTool(slug);
  return (
    <main className="mx-auto max-w-3xl p-8">
      <a href="./" className="text-sm text-muted-foreground hover:underline">
        ← sidebench
      </a>
      <h1 className="mt-4 text-2xl font-semibold">{tool.name}</h1>
      <p className="mt-1 text-muted-foreground">{tool.tagline}</p>
      <p className="mt-6">Under uppbyggnad.</p>
    </main>
  );
}
