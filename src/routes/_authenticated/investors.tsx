import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listInvestors, upsertInvestor, deleteInvestor } from "@/lib/knowledge.functions";
import { listOrgs } from "@/lib/catalog.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, TrendingUp, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/investors")({
  component: InvestorsPage,
});

function InvestorsPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listInvestors);
  const upsertFn = useServerFn(upsertInvestor);
  const delFn = useServerFn(deleteInvestor);
  const orgsFn = useServerFn(listOrgs);

  const list = useQuery({ queryKey: ["investors"], queryFn: () => listFn() });
  const orgs = useQuery({ queryKey: ["orgs"], queryFn: () => orgsFn() });
  const [form, setForm] = useState({ name: "", firm: "", email: "", focus: "", check_size: "", organization_id: "" });

  const save = useMutation({
    mutationFn: () => upsertFn({ data: { ...form, organization_id: form.organization_id || null } }),
    onSuccess: () => { toast.success("Saved"); setForm({ name: "", firm: "", email: "", focus: "", check_size: "", organization_id: "" }); qc.invalidateQueries({ queryKey: ["investors"] }); },
  });
  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["investors"] }),
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2"><TrendingUp className="h-7 w-7" /> Investor Pipeline</h1>
        <p className="text-muted-foreground">Pre-seed target list. AI will draft personalized outreach for each one.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Add investor</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-3 gap-3">
          <Input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input placeholder="Firm" value={form.firm} onChange={(e) => setForm({ ...form, firm: e.target.value })} />
          <Input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input placeholder="Focus (e.g. consumer, music tech)" value={form.focus} onChange={(e) => setForm({ ...form, focus: e.target.value })} />
          <Input placeholder="Check size" value={form.check_size} onChange={(e) => setForm({ ...form, check_size: e.target.value })} />
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
        {(list.data ?? []).map((i) => (
          <Card key={i.id}>
            <CardContent className="pt-6 space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold">{i.name}</h3>
                  <p className="text-sm text-muted-foreground">{i.firm}</p>
                </div>
                <Badge>{i.status}</Badge>
              </div>
              {i.email && <p className="text-sm">{i.email}</p>}
              {i.focus && <p className="text-xs text-muted-foreground">Focus: {i.focus}</p>}
              {i.check_size && <p className="text-xs text-muted-foreground">Check: {i.check_size}</p>}
              {i.notes && <Textarea readOnly value={i.notes} className="text-xs" />}
              <Button size="sm" variant="ghost" onClick={() => del.mutate(i.id)}><Trash2 className="h-4 w-4" /></Button>
            </CardContent>
          </Card>
        ))}
        {!list.data?.length && <p className="text-sm text-muted-foreground">No investors yet — the AI strategist will start suggesting targets.</p>}
      </div>
    </div>
  );
}
