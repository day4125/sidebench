import { Badge } from "@/components/ui/badge";
import type { Tool } from "@/tools/registry";

/** A tool on the landing grid: a link when live, a dashed card when not. */
export function ToolCard({ tool }: { tool: Tool }) {
  const Icon = tool.icon;
  const body = (
    <>
      <div className="flex items-center gap-3">
        <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary group-data-soon:bg-muted group-data-soon:text-muted-foreground">
          <Icon aria-hidden="true" className="size-5" />
        </span>
        <h3 className="font-medium">{tool.name}</h3>
        {!tool.href && (
          <Badge variant="secondary" className="ml-auto">
            snart
          </Badge>
        )}
      </div>
      <p className="mt-3 text-sm text-pretty text-muted-foreground">{tool.desc}</p>
    </>
  );
  const card = "group block h-full rounded-xl border bg-card p-5 text-card-foreground";
  return (
    <li>
      {tool.href ? (
        <a
          href={tool.href}
          className={`${card} transition-colors hover:border-primary/50 hover:bg-accent/40 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none`}
        >
          {body}
        </a>
      ) : (
        <div data-soon="" className={`${card} border-dashed`}>
          {body}
        </div>
      )}
    </li>
  );
}
