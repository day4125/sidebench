import type { ReactNode } from "react";
import { AppSidebar } from "@/app/AppSidebar";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getTool } from "@/tools/registry";

/**
 * Every page's frame: the tool sidebar, and a header with the sidebar
 * toggle. On a tool page (`tool` set) the header shows that tool's name and
 * tagline from the registry and its nav link is marked current.
 */
export function AppShell({ tool, children }: { tool?: string; children: ReactNode }) {
  const current = tool ? getTool(tool) : undefined;
  const Icon = current?.icon;
  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar active={tool} />
        <SidebarInset>
          <header className="flex min-h-14 shrink-0 items-center gap-2 border-b px-4 py-2">
            <SidebarTrigger className="-ml-1" />
            {current && Icon && (
              <>
                <Separator orientation="vertical" className="mr-2 data-vertical:h-4 data-vertical:self-center" />
                <Icon aria-hidden="true" className="size-4 shrink-0 text-primary" />
                <div className="flex min-w-0 flex-wrap items-baseline gap-x-3">
                  <h1 className="font-semibold tracking-tight">{current.name}</h1>
                  <p className="truncate text-sm text-muted-foreground">{current.tagline}</p>
                </div>
              </>
            )}
          </header>
          <div className="flex-1 p-4 md:p-6">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
