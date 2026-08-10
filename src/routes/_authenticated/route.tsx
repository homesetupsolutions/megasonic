import { createFileRoute, Outlet, Link, useRouterState } from "@tanstack/react-router";
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  FolderKanban,
  Rss,
  Lightbulb,
  Users,
  UserCircle2,
  Boxes,
  ScrollText,
  Settings,
  Tags,
  CheckSquare,
  Calendar,
  Brain,
  FolderOpen,
  TrendingUp,
  Award,
  Plug,
  PhoneCall,
  Phone,
  Sparkles,
  BookOpen,
  Radio,
  HardDriveDownload,
} from "lucide-react";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthedShell,
});

const items = [
  { title: "🛸 Alien", url: "/alien", icon: Sparkles },
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "AI Strategist", url: "/strategist", icon: Brain },
  { title: "Knowledge Vault", url: "/knowledge", icon: FolderOpen },
  { title: "Investors", url: "/investors", icon: TrendingUp },
  { title: "Grants", url: "/grants", icon: Award },
  { title: "Services & Pricing", url: "/services", icon: Tags },
  { title: "Quick Book", url: "/quick-book", icon: Sparkles },
  { title: "Approvals", url: "/approvals", icon: CheckSquare },
  { title: "Bookings", url: "/bookings", icon: Calendar },
  { title: "AI Calls", url: "/calls", icon: PhoneCall },
  { title: "Call Scripts", url: "/scripts", icon: Phone },
  { title: "Desk Phones", url: "/phones", icon: Phone },
  { title: "IVR Designer", url: "/ivr", icon: PhoneCall },
  { title: "SIP Trunks", url: "/sip-trunks", icon: Radio },
  { title: "Connections", url: "/connections", icon: Plug },
  { title: "Projects", url: "/projects", icon: FolderKanban },
  { title: "How-to Manual", url: "/manual", icon: BookOpen },
  { title: "Unified Feed", url: "/feed", icon: Rss },
  { title: "Ideas", url: "/ideas", icon: Lightbulb },
  { title: "Leads", url: "/leads", icon: Users },
  { title: "Customers", url: "/customers", icon: UserCircle2 },
  { title: "Inventory", url: "/inventory", icon: Boxes },
  { title: "Activity", url: "/activity", icon: ScrollText },
  { title: "Backup & Export", url: "/backup", icon: HardDriveDownload },
  { title: "Settings", url: "/settings", icon: Settings },
];

function AuthedShell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <Sidebar collapsible="icon">
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel className="px-2 py-3 text-sm font-semibold text-foreground">
                MagaSonic
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {items.map((item) => (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton asChild isActive={pathname === item.url}>
                        <Link to={item.url} className="flex items-center gap-2">
                          <item.icon className="h-4 w-4" />
                          {item.title}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>

        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-12 flex items-center border-b px-3 gap-2 sticky top-0 bg-background/80 backdrop-blur z-10">
            <SidebarTrigger />
            <div className="font-medium text-sm text-muted-foreground">MagaSonic — FeelBass &amp; HSS</div>
          </header>
          <main className="flex-1 p-6 overflow-auto">
            <Outlet />
          </main>
        </div>
        <Toaster />
      </div>
    </SidebarProvider>
  );
}
