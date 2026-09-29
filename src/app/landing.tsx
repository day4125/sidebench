import { AppShell } from "@/app/AppShell";
import { BrandMark } from "@/app/BrandMark";
import { mount } from "@/app/mount";
import { ToolCard } from "@/app/ToolCard";
import { tools } from "@/tools/registry";

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

mount(<Landing />);
