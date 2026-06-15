import { createFileRoute,  } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listRecentEvents } from "@/lib/hub.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/feed")({
  component: FeedPage,
});

function FeedPage() {
  const qc = useQueryClient();
  const fn = useServerFn(listRecentEvents);
  const { data: events } = useQuery({ queryKey: ["events", "recent"], queryFn: () => fn() });

  useEffect(() => {
    const ch = supabase
      .channel("hub-events")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "events" }, () => {
        qc.invalidateQueries({ queryKey: ["events", "recent"] });
        qc.invalidateQueries({ queryKey: ["stats"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold">Unified Feed</h1>
        <p className="text-muted-foreground">Live stream of every event from every linked project.</p>
      </div>

      {!events?.length ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">Nothing yet. Trigger an event from a linked project.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {events.map((e: any) => (
            <Card key={e.id}>
              <CardContent className="py-3 flex items-center gap-3">
                <span className="h-2 w-2 rounded-full shrink-0" style={{ background: e.linked_projects?.color ?? "#999" }} />
                <Badge variant="outline">{e.type}</Badge>
                <span className="text-sm font-medium">{e.linked_projects?.name ?? "—"}</span>
                <span className="text-xs text-muted-foreground truncate flex-1">
                  {Object.entries(e.payload ?? {}).slice(0, 3).map(([k, v]) => `${k}: ${String(v)}`).join(" · ")}
                </span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
