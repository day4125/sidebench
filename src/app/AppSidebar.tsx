import { Menu, Moon, Sun, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { BrandMark } from "@/app/BrandMark";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { useTheme } from "@/lib/theme";
import { tools, type Tool } from "@/tools/registry";

const live = tools.filter((t) => t.status === "live");
const soon = tools.filter((t) => t.status === "soon");

// Collapsed, shadcn slides each group label up out of the way (-mt-8), which
// moves every icon below it. Keep the label's height and only fade it, so the
// icons hold the same position open and collapsed.
const keepLabelSpace = "group-data-[collapsible=icon]:mt-0";

export function AppSidebar({ active }: { active?: string }) {
  return (
    <>
      <MobileNav active={active} />
      <Sidebar variant="inset" collapsible="icon">
        {/* py-1 makes it 56px tall like the tool page's header, so the brand
            row and the tool name share a centre line. */}
        <SidebarHeader className="py-1">
          <BrandRow>
            <SidebarTrigger className="group-data-[collapsible=icon]:hidden" />
          </BrandRow>
        </SidebarHeader>
        <SidebarContent>
          <ToolGroups active={active} />
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <ThemeToggle />
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
    </>
  );
}

/**
 * Below md the sidebar becomes a strip across the top of the page: the logo
 * and a menu button, which opens the tool list and theme toggle below it.
 * Shown and hidden by CSS rather than useIsMobile, so a phone never paints
 * a frame of the desktop rail first. (shadcn's Sidebar still renders its
 * mobile sheet, but nothing opens it.)
 */
function MobileNav({ active }: { active?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <nav aria-label="Verktyg" className="border-b bg-sidebar p-2 text-sidebar-foreground md:hidden">
      {/* p-2 as in SidebarHeader, so the mark centres on the icons below */}
      <div className="p-2">
        <BrandRow mobile>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "Stäng menyn" : "Öppna menyn"}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <X /> : <Menu />}
          </Button>
        </BrandRow>
      </div>
      {open && (
        <div id="mobile-menu">
          <ToolGroups active={active} />
          <div className="mt-2 border-t p-2 pt-4">
            <SidebarMenu>
              <SidebarMenuItem>
                <ThemeToggle />
              </SidebarMenuItem>
            </SidebarMenu>
          </div>
        </div>
      )}
    </nav>
  );
}

/** The logo, with a control (sidebar toggle or menu button) on its right. */
function BrandRow({ mobile = false, children }: { mobile?: boolean; children: ReactNode }) {
  return (
    <div className="flex items-center gap-1">
      <SidebarMenu className="min-w-0 flex-1">
        <SidebarMenuItem>
          <Brand mobile={mobile} />
        </SidebarMenuItem>
      </SidebarMenu>
      {children}
    </div>
  );
}

function ToolGroups({ active }: { active?: string }) {
  return (
    <>
      <SidebarGroup>
        <SidebarGroupLabel className={keepLabelSpace}>Verktyg</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {live.map((tool) => (
              <ToolLink key={tool.slug} tool={tool} active={tool.slug === active} />
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
      <SidebarGroup>
        <SidebarGroupLabel className={keepLabelSpace}>Kommer snart</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {soon.map((tool) => (
              <ToolLink key={tool.slug} tool={tool} />
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </>
  );
}

/**
 * The logo row. Open, it links to the start page and the toggle sits beside
 * it; collapsed, the toggle is hidden and the logo itself opens the sidebar.
 */
function Brand({ mobile }: { mobile: boolean }) {
  const { state, setOpen } = useSidebar();
  // The top strip never collapses, whatever the saved desktop state says.
  const collapsed = state === "collapsed" && !mobile;
  const content = (
    <>
      <span className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
        <BrandMark className="size-5!" />
      </span>
      <span className="text-base font-semibold tracking-tight">sidebench</span>
    </>
  );
  return (
    // px-0 puts the 32px mark's centre on the tool icons' centre line; h-12
    // keeps the row's height when collapsed (shadcn shrinks it to size-8),
    // so nothing below it moves up.
    <SidebarMenuButton
      size="lg"
      asChild={!collapsed}
      aria-label={collapsed ? "Visa sidopanel" : undefined}
      onClick={collapsed ? () => setOpen(true) : undefined}
      className="px-0 group-data-[collapsible=icon]:h-12!"
    >
      {collapsed ? content : <a href="./">{content}</a>}
    </SidebarMenuButton>
  );
}

function ToolLink({ tool, active = false }: { tool: Tool; active?: boolean }) {
  const Icon = tool.icon;
  if (!tool.href) {
    // Planned tools are listed but can't be opened.
    return (
      <SidebarMenuItem>
        <SidebarMenuButton disabled tooltip={`${tool.name} (kommer snart)`}>
          <Icon />
          <span>{tool.name}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={active} tooltip={tool.name}>
        <a href={tool.href} aria-current={active ? "page" : undefined}>
          <Icon />
          <span>{tool.name}</span>
        </a>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const dark = theme === "dark";
  const label = dark ? "Ljust läge" : "Mörkt läge";
  return (
    <SidebarMenuButton tooltip={label} onClick={() => setTheme(dark ? "light" : "dark")}>
      {dark ? <Sun /> : <Moon />}
      <span>{label}</span>
    </SidebarMenuButton>
  );
}
