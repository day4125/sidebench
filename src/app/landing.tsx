import { AppShell } from "@/app/AppShell";
import { BrandMark } from "@/app/BrandMark";
import { mount } from "@/app/mount";
import { Badge } from "@/components/ui/badge";
import { tools, type Tool } from "@/tools/registry";

const live = tools.filter((t) => t.status === "live");
const soon = tools.filter((t) => t.status === "soon");

function Landing() {
  return (
    <AppShell>
      <div className="mx-auto max-w-5xl py-4 md:py-8">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <BrandMark className="size-7" />
          </span>
          <h1 className="text-3xl font-semibold tracking-tight">sidebench</h1>
        </div>
        <p className="mt-4 max-w-2xl text-lg text-pretty">
          Små verktyg för innehållsproduktion.
        </p>
        <p className="mt-2 max-w-2xl text-pretty text-muted-foreground">
          Allt körs lokalt i webbläsaren: inga nätverksanrop, inga cookies och
          inga externa servrar. Materialet du arbetar med lämnar aldrig din
          dator.
        </p>

        <h2 className="sr-only">Verktyg</h2>
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {live.map((tool) => (
            <ToolCard key={tool.slug} tool={tool} />
          ))}
        </ul>

        <h2 className="mt-12 text-sm font-medium text-muted-foreground">Kommer snart</h2>
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {soon.map((tool) => (
            <ToolCard key={tool.slug} tool={tool} />
          ))}
        </ul>
      </div>
    </AppShell>
  );
}

function ToolCard({ tool }: { tool: Tool }) {
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

mount(<Landing />);
