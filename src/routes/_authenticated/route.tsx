import { createFileRoute, Outlet, redirect, Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";
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
  SidebarFooter,
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
  LogOut,
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
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
  { title: "Connections", url: "/connections", icon: Plug },
  { title: "Projects", url: "/projects", icon: FolderKanban },
  { title: "Unified Feed", url: "/feed", icon: Rss },
  { title: "Ideas", url: "/ideas", icon: Lightbulb },
  { title: "Leads", url: "/leads", icon: Users },
  { title: "Customers", url: "/customers", icon: UserCircle2 },
  { title: "Inventory", url: "/inventory", icon: Boxes },
  { title: "Activity", url: "/activity", icon: ScrollText },
  { title: "Settings", url: "/settings", icon: Settings },
];

function AuthedShell() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") navigate({ to: "/auth", replace: true });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

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
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter>
            <Button variant="ghost" size="sm" onClick={signOut} className="justify-start">
              <LogOut className="h-4 w-4 mr-2" /> Sign out
            </Button>
          </SidebarFooter>
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
