import { createFileRoute, Link,  } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { dashboardStats, listRecentEvents } from "@/lib/hub.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FolderKanban, Lightbulb, Users, Rss } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const statsFn = useServerFn(dashboardStats);
  const eventsFn = useServerFn(listRecentEvents);
  const { data: stats } = useQuery({ queryKey: ["stats"], queryFn: () => statsFn() });
  const { data: events } = useQuery({ queryKey: ["events", "recent"], queryFn: () => eventsFn() });

  const cards = [
    { label: "Linked projects", value: stats?.projects ?? 0, icon: FolderKanban, to: "/projects" },
    { label: "Events captured", value: stats?.events ?? 0, icon: Rss, to: "/feed" },
    { label: "Ideas", value: stats?.ideas ?? 0, icon: Lightbulb, to: "/ideas" },
    { label: "Leads", value: stats?.leads ?? 0, icon: Users, to: "/leads" },
  ];

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-3xl font-bold">Welcome back</h1>
        <p className="text-muted-foreground">
          Your hub. Every linked project's leads, ideas, and inventory flow in here.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map((c) => (
          <Link key={c.label} to={c.to}>
            <Card className="hover:border-primary/50 transition-colors">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {c.label}
                </CardTitle>
                <c.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{c.value}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Latest activity</CardTitle>
        </CardHeader>
        <CardContent>
          {!events?.length ? (
            <p className="text-sm text-muted-foreground">
              No events yet. Add a project on the Projects page to get a snippet you can paste into your other Lovable apps.
            </p>
          ) : (
            <ul className="divide-y">
              {events.slice(0, 8).map((e: any) => (
                <li key={e.id} className="py-2 flex items-center gap-3 text-sm">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: e.linked_projects?.color ?? "#999" }}
                  />
                  <span className="font-medium">{e.linked_projects?.name ?? "—"}</span>
                  <span className="text-muted-foreground">{e.type}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
