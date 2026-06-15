import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listGrants, upsertGrant, deleteGrant } from "@/lib/knowledge.functions";
import { listOrgs } from "@/lib/catalog.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Award, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/grants")({
  component: GrantsPage,
});

function GrantsPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listGrants);
  const upsertFn = useServerFn(upsertGrant);
  const delFn = useServerFn(deleteGrant);
  const orgsFn = useServerFn(listOrgs);

  const list = useQuery({ queryKey: ["grants"], queryFn: () => listFn() });
  const orgs = useQuery({ queryKey: ["orgs"], queryFn: () => orgsFn() });
  const [form, setForm] = useState({ name: "", provider: "", amount: "", deadline: "", url: "", organization_id: "" });

  const save = useMutation({
    mutationFn: () => upsertFn({ data: {
      ...form,
      deadline: form.deadline || null,
      organization_id: form.organization_id || null,
    } }),
    onSuccess: () => { toast.success("Saved"); setForm({ name: "", provider: "", amount: "", deadline: "", url: "", organization_id: "" }); qc.invalidateQueries({ queryKey: ["grants"] }); },
  });
  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["grants"] }),
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2"><Award className="h-7 w-7" /> Grants & Applications</h1>
        <p className="text-muted-foreground">AI hunts grants and writes the application drafts. You approve, you send.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Add grant</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-3 gap-3">
          <Input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input placeholder="Provider" value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} />
          <Input placeholder="Amount" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          <Input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
          <Input placeholder="URL" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
          <Select value={form.organization_id} onValueChange={(v) => setForm({ ...form, organization_id: v })}>
            <SelectTrigger><SelectValue placeholder="Organization" /></SelectTrigger>
            <SelectContent>
              {(orgs.data ?? []).map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="md:col-span-3">
            <Button onClick={() => save.mutate()} disabled={!form.name}><Plus className="h-4 w-4 mr-2" /> Add</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        {(list.data ?? []).map((g) => (
          <Card key={g.id}>
            <CardContent className="pt-6 space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold">{g.name}</h3>
                  <p className="text-sm text-muted-foreground">{g.provider}</p>
                </div>
                <Badge>{g.status}</Badge>
              </div>
              {g.amount && <p className="text-sm">Amount: {g.amount}</p>}
              {g.deadline && <p className="text-sm">Deadline: {g.deadline}</p>}
              {g.url && <a href={g.url} target="_blank" rel="noreferrer" className="text-sm text-primary underline">Open</a>}
              {g.draft_application && (
                <Textarea readOnly value={g.draft_application} rows={5} className="text-xs" />
              )}
              <Button size="sm" variant="ghost" onClick={() => del.mutate(g.id)}><Trash2 className="h-4 w-4" /></Button>
            </CardContent>
          </Card>
        ))}
        {!list.data?.length && <p className="text-sm text-muted-foreground">No grants yet — the AI will start suggesting them.</p>}
      </div>
    </div>
  );
}
