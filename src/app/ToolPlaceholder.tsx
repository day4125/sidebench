import { AppShell } from "@/app/AppShell";

// Stand-in page until the tool is rebuilt (port-plan steps 5–6).
export function ToolPlaceholder({ slug }: { slug: string }) {
  return (
    <AppShell tool={slug}>
      <p className="text-muted-foreground">Under uppbyggnad.</p>
    </AppShell>
  );
}
