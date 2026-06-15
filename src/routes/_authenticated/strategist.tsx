import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listAiRuns, listAiActions, setActionStatus, executeAction,
  triggerStrategistRun, getAiSettings, updateAiSettings,
} from "@/lib/strategist.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Brain, Play, CheckCircle2, XCircle, Zap, AlertCircle } from "lucide-react";
import { AlienHud } from "@/components/AlienHud";

export const Route = createFileRoute("/_authenticated/strategist")({
  component: StrategistPage,
});

function StrategistPage() {
  const qc = useQueryClient();
  const runsFn = useServerFn(listAiRuns);
  const actionsFn = useServerFn(listAiActions);
  const setStatusFn = useServerFn(setActionStatus);
  const executeFn = useServerFn(executeAction);
  const triggerFn = useServerFn(triggerStrategistRun);
  const settingsFn = useServerFn(getAiSettings);
  const updateSettingsFn = useServerFn(updateAiSettings);

  const runs = useQuery({ queryKey: ["ai_runs"], queryFn: () => runsFn(), refetchInterval: 10000 });
  const actions = useQuery({ queryKey: ["ai_actions"], queryFn: () => actionsFn({ data: {} }) });
  const settings = useQuery({ queryKey: ["ai_settings"], queryFn: () => settingsFn() });

  useEffect(() => {
    const ch = supabase.channel("strategist-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "ai_runs" },
        () => qc.invalidateQueries({ queryKey: ["ai_runs"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "ai_actions" },
        () => qc.invalidateQueries({ queryKey: ["ai_actions"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const trigger = useMutation({
    mutationFn: () => triggerFn({ data: {} }),
    onSuccess: (r) => { toast.success(`AI generated ${r.actions} new actions`); qc.invalidateQueries(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const setStatus = useMutation({
    mutationFn: (v: { id: string; status: "approved" | "rejected" }) => setStatusFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai_actions"] }),
  });

  const exec = useMutation({
    mutationFn: (id: string) => executeFn({ data: { id } }),
    onSuccess: () => { toast.success("Executed"); qc.invalidateQueries(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveSettings = useMutation({
    mutationFn: (v: { enabled?: boolean; cadence_minutes?: number; auto_run_on_new_lead?: boolean }) => updateSettingsFn({ data: v }),
    onSuccess: () => { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["ai_settings"] }); },
  });

  const pending = (actions.data ?? []).filter((a) => a.status === "pending");
  const approved = (actions.data ?? []).filter((a) => a.status === "approved");
  const done = (actions.data ?? []).filter((a) => a.status === "executed");

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><Brain className="h-7 w-7" /> Always-On Strategist</h1>
          <p className="text-muted-foreground">Your AI runs continuously across SonicFeel Inc + Home Setup Solutions, learning how to make you money.</p>
        </div>
        <Button onClick={() => trigger.mutate()} disabled={trigger.isPending}>
          <Play className="h-4 w-4 mr-2" /> Run Now
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Engine Settings</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap items-end gap-6">
          <div className="flex items-center gap-2">
            <Switch
              checked={settings.data?.enabled ?? true}
              onCheckedChange={(v) => saveSettings.mutate({ enabled: v })}
            />
            <Label>Engine enabled</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={settings.data?.auto_run_on_new_lead ?? true}
              onCheckedChange={(v) => saveSettings.mutate({ auto_run_on_new_lead: v })}
            />
            <Label>Auto-run on new lead</Label>
          </div>
          <div>
            <Label>Cadence (minutes)</Label>
            <Input
              type="number" min={1} max={1440}
              defaultValue={settings.data?.cadence_minutes ?? 15}
              onBlur={(e) => saveSettings.mutate({ cadence_minutes: parseInt(e.target.value, 10) })}
              className="w-32"
            />
          </div>
          <p className="text-xs text-muted-foreground">Last run: {settings.data?.last_run_at ? new Date(settings.data.last_run_at).toLocaleString() : "never"}</p>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-3 gap-6">
        <Section title={`Pending approval (${pending.length})`} icon={<AlertCircle className="h-5 w-5 text-amber-500" />}>
          {pending.length === 0 && <p className="text-sm text-muted-foreground">Nothing waiting.</p>}
          {pending.map((a) => (
            <ActionCard key={a.id} action={a}
              onApprove={() => setStatus.mutate({ id: a.id, status: "approved" })}
              onReject={() => setStatus.mutate({ id: a.id, status: "rejected" })}
            />
          ))}
        </Section>
        <Section title={`Approved (${approved.length})`} icon={<CheckCircle2 className="h-5 w-5 text-emerald-500" />}>
          {approved.map((a) => (
            <ActionCard key={a.id} action={a} onExecute={() => exec.mutate(a.id)} approved />
          ))}
        </Section>
        <Section title={`Executed (${done.length})`} icon={<Zap className="h-5 w-5 text-primary" />}>
          {done.slice(0, 12).map((a) => <ActionCard key={a.id} action={a} executed />)}
        </Section>
      </div>

      <Card>
        <CardHeader><CardTitle>Recent Runs</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {(runs.data ?? []).slice(0, 12).map((r) => (
            <div key={r.id} className="flex items-center justify-between text-sm border-b py-2">
              <div>
                <Badge variant={r.status === "error" ? "destructive" : r.status === "complete" ? "default" : "secondary"}>{r.status}</Badge>
                <span className="ml-2 font-medium">{(r as { organizations?: { name?: string } }).organizations?.name ?? "—"}</span>
                <span className="ml-2 text-muted-foreground">{r.summary?.slice(0, 120)}</span>
              </div>
              <div className="text-muted-foreground">{r.actions_count} actions · {new Date(r.started_at).toLocaleTimeString()}</div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2 text-lg">{icon}{title}</CardTitle></CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  );
}

type ActionRow = {
  id: string; kind: string; title: string; reasoning: string | null; priority: number;
  payload: unknown; organizations?: { name?: string } | null;
};

function ActionCard({ action, onApprove, onReject, onExecute, approved, executed }: {
  action: ActionRow; onApprove?: () => void; onReject?: () => void; onExecute?: () => void;
  approved?: boolean; executed?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border rounded-lg p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline">{action.kind}</Badge>
            <Badge>P{action.priority}</Badge>
            <span className="text-xs text-muted-foreground">{action.organizations?.name}</span>
          </div>
          <h3 className="font-semibold mt-1">{action.title}</h3>
          {action.reasoning && <p className="text-sm text-muted-foreground mt-1">{action.reasoning}</p>}
        </div>
      </div>
      <Button size="sm" variant="ghost" onClick={() => setOpen(!open)}>{open ? "Hide" : "Show"} details</Button>
      {open && (
        <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">{JSON.stringify(action.payload, null, 2)}</pre>
      )}
      <div className="flex gap-2">
        {!approved && !executed && onApprove && (
          <>
            <Button size="sm" onClick={onApprove}><CheckCircle2 className="h-4 w-4 mr-1" /> Approve</Button>
            <Button size="sm" variant="outline" onClick={onReject}><XCircle className="h-4 w-4 mr-1" /> Reject</Button>
          </>
        )}
        {approved && onExecute && (
          <Button size="sm" onClick={onExecute}><Zap className="h-4 w-4 mr-1" /> Execute</Button>
        )}
      </div>
    </div>
  );
}
