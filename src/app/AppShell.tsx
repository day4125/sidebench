import type { ReactNode } from "react";
import { AppSidebar } from "@/app/AppSidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getTool } from "@/tools/registry";

/**
 * Every page's frame: the tool sidebar (a top strip on phones) and, on a
 * tool page (`tool` set), a header with that tool's name and tagline from
 * the registry; its nav link is marked current.
 */
export function AppShell({ tool, children }: { tool?: string; children: ReactNode }) {
  const current = tool ? getTool(tool) : undefined;
  const Icon = current?.icon;
  return (
    <TooltipProvider>
      {/* Column below md, where the sidebar is a strip across the top. */}
      <SidebarProvider className="flex-col md:flex-row">
        <AppSidebar active={tool} />
        <SidebarInset>
          {current && Icon && (
            <header className="flex min-h-14 shrink-0 items-center gap-2 border-b px-4 py-2">
              <Icon aria-hidden="true" className="size-4 shrink-0 text-primary" />
              <div className="flex min-w-0 flex-wrap items-baseline gap-x-3">
                <h1 className="font-semibold tracking-tight">{current.name}</h1>
                <p className="truncate text-sm text-muted-foreground">{current.tagline}</p>
              </div>
            </header>
          )}
          <div className="flex-1 p-4 md:p-6">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
