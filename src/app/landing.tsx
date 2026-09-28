import { mount } from "@/app/mount";
import { tools } from "@/tools/registry";

function Landing() {
  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-2xl font-semibold">sidebench</h1>
      <p className="mt-1 text-muted-foreground">
        Små verktyg för innehållsproduktion. Allt körs i webbläsaren.
      </p>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2">
        {tools.map((tool) => (
          <li key={tool.slug} className="rounded-lg border p-4">
            <h2 className="font-medium">
              {tool.href ? <a href={tool.href} className="hover:underline">{tool.name}</a> : tool.name}
              {tool.status === "soon" && (
                <span className="ml-2 text-xs text-muted-foreground">snart</span>
              )}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{tool.desc}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}

mount(<Landing />);
