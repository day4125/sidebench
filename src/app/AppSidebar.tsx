import { Moon, Sun } from "lucide-react";
import { BrandMark } from "@/app/BrandMark";
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
} from "@/components/ui/sidebar";
import { useTheme } from "@/lib/theme";
import { tools, type Tool } from "@/tools/registry";

const live = tools.filter((t) => t.status === "live");
const soon = tools.filter((t) => t.status === "soon");

export function AppSidebar({ active }: { active?: string }) {
  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild tooltip="sidebench – start">
              <a href="./">
                <span className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <BrandMark className="size-5!" />
                </span>
                <span className="text-base font-semibold tracking-tight">sidebench</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Verktyg</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {live.map((tool) => (
                <ToolLink key={tool.slug} tool={tool} active={tool.slug === active} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Kommer snart</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {soon.map((tool) => (
                <ToolLink key={tool.slug} tool={tool} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
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
