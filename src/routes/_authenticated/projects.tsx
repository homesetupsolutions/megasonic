import { createFileRoute,  } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  createProject,
  deleteProject,
  listProjects,
  rotateProjectKey,
  assignProjectOrg,
} from "@/lib/hub.functions";
import { listOrgs } from "@/lib/catalog.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Copy, Plus, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/projects")({
  component: ProjectsPage,
});

function ProjectsPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listProjects);
  const createFn = useServerFn(createProject);
  const rotateFn = useServerFn(rotateProjectKey);
  const deleteFn = useServerFn(deleteProject);
  const assignFn = useServerFn(assignProjectOrg);
  const orgsFn = useServerFn(listOrgs);

  const { data: projects } = useQuery({ queryKey: ["projects"], queryFn: () => listFn() });
  const { data: orgs } = useQuery<any[]>({ queryKey: ["orgs"], queryFn: () => orgsFn() as any });
  const [newKey, setNewKey] = useState<{ name: string; key: string } | null>(null);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [open, setOpen] = useState(false);

  const create = useMutation({
    mutationFn: (input: { name: string; url?: string }) => createFn({ data: input }),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      setNewKey({ name: res.project.name, key: res.apiKey });
      setName("");
      setUrl("");
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const rotate = useMutation({
    mutationFn: (id: string) => rotateFn({ data: { id } }),
    onSuccess: (res: any, id) => {
      const p = (projects as any[] | undefined)?.find((x) => x.id === id);
      setNewKey({ name: p?.name ?? "Project", key: res.apiKey });
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });

  const assign = useMutation({
    mutationFn: ({ id, organization_id }: { id: string; organization_id: string | null }) =>
      assignFn({ data: { id, organization_id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold">Linked Projects</h1>
          <p className="text-muted-foreground">
            Plug your other Lovable apps into this hub so they all share leads, bookings, customers,
            services, and call scripts. Three steps below.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="lg" className="h-12"><Plus className="h-5 w-5 mr-2" /> Link a project</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Link a Lovable project</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Project name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="FeelBass POS" />
              </div>
              <div className="space-y-2">
                <Label>URL (optional, helps me find it later)</Label>
                <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://feelbasspos.lovable.app" />
              </div>
            </div>
            <DialogFooter>
              <Button disabled={!name || create.isPending} onClick={() => create.mutate({ name, url })}>
                Generate key
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="bg-muted/40">
        <CardContent className="py-4 text-sm space-y-1">
          <div className="font-semibold">How to link a project (1 minute)</div>
          <div>1. Click <strong>Link a project</strong>, name it, and copy the snippet.</div>
          <div>2. In the other Lovable project, save the snippet as <code>src/lib/magasonic-client.ts</code>.</div>
          <div>3. Back here, assign it to a business (FeelBass or HSS). Done — data flows both ways.</div>
        </CardContent>
      </Card>

      <div className="grid gap-3">
        {projects?.map((p: any) => (
          <Card key={p.id}>
            <CardHeader className="flex flex-row items-start justify-between pb-2">
              <div className="flex items-center gap-3">
                <span className="h-3 w-3 rounded-full" style={{ background: p.color }} />
                <div>
                  <CardTitle className="text-lg">{p.name}</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {p.url ? <a href={p.url} target="_blank" rel="noreferrer" className="hover:underline">{p.url}</a> : "no url"}
                    {" · "}key {p.api_key_prefix}…
                    {" · "}{p.event_count} events
                    {p.last_seen_at && ` · last seen ${formatDistanceToNow(new Date(p.last_seen_at), { addSuffix: true })}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Select
                  value={p.organization_id ?? "none"}
                  onValueChange={(v) =>
                    assign.mutate({ id: p.id, organization_id: v === "none" ? null : v })
                  }
                >
                  <SelectTrigger className="h-8 w-44 text-xs"><SelectValue placeholder="Org" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {orgs?.map((o) => (
                      <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="sm" onClick={() => rotate.mutate(p.id)} title="Rotate key">
                  <RefreshCw className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (confirm(`Delete ${p.name}? Events stay linked but the key stops working.`)) del.mutate(p.id);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
          </Card>
        ))}
        {!projects?.length && (
          <Card><CardContent className="py-10 text-center text-muted-foreground">No projects linked yet.</CardContent></Card>
        )}
      </div>

      <KeyModal data={newKey} onClose={() => setNewKey(null)} />
    </div>
  );
}

function KeyModal({ data, onClose }: { data: { name: string; key: string } | null; onClose: () => void }) {
  if (!data) return null;
  const origin = typeof window !== "undefined" ? window.location.origin : "https://your-hub.lovable.app";
  const snippet = `// magasonic-client.ts — paste into any Lovable project to link with MagaSonic
const HUB = "${origin}";
const HUB_KEY = "${data.key}"; // shown once. Rotate from MagaSonic → Projects.

export const magasonic = {
  // Send something INTO the hub
  emit: (type: string, payload: Record<string, any> = {}) =>
    fetch(HUB + "/api/public/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_key: HUB_KEY, type, payload }),
    }).catch(() => {}),
  lead: (p: { name: string; email?: string; phone?: string; source?: string; notes?: string }) =>
    magasonic.emit("lead", p),
  idea: (p: { title: string; body?: string }) => magasonic.emit("idea", p),
  customer: (p: { name: string; email?: string; phone?: string; notes?: string }) =>
    magasonic.emit("customer", p),
  inventory: (p: { name: string; sku?: string; quantity?: number; location?: string; status?: string }) =>
    magasonic.emit("inventory", p),
  booking: (p: { customer_name: string; service_id?: string; scheduled_at: string; customer_email?: string; customer_phone?: string; notes?: string }) =>
    magasonic.emit("booking", p),

  // PULL everything from the hub (services + bookings + leads + customers + ideas + call scripts)
  // include: comma-separated list. Default = all.
  all: async (include?: string) => {
    const q = new URLSearchParams({ key: HUB_KEY });
    if (include) q.set("include", include);
    const r = await fetch(HUB + "/api/public/all?" + q.toString(), { cache: "no-store" });
    if (!r.ok) throw new Error("all: " + r.status);
    return await r.json() as {
      project_id: string; organization_id: string | null; fetched_at: string;
      services?: any[]; bookings?: any[]; leads?: any[]; customers?: any[]; ideas?: any[]; scripts?: any[];
    };
  },

  // Just the live catalog (services + prices). Call on app start + when "catalog.updated" is broadcast.
  catalog: async () => {
    const r = await fetch(HUB + "/api/public/catalog?key=" + encodeURIComponent(HUB_KEY), { cache: "no-store" });
    if (!r.ok) throw new Error("catalog: " + r.status);
    return (await r.json()).services as Array<{
      id: string; name: string; description: string | null; price_cents: number;
      currency: string; duration_minutes: number | null; sku: string | null;
      active: boolean; version: number; updated_at: string;
    }>;
  },
};
`;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Snippet for {data.name}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Paste into your other Lovable project as <code>src/lib/magasonic-client.ts</code>. Then call{" "}
          <code>magasonic.all()</code> to pull every business asset, or <code>magasonic.lead(&#123;...&#125;)</code> /{" "}
          <code>magasonic.booking(&#123;...&#125;)</code> to push data back. The key shows ONCE — copy it now.
        </p>
        <pre className="bg-muted text-xs rounded p-3 overflow-auto max-h-96"><code>{snippet}</code></pre>
        <DialogFooter>
          <Button
            onClick={() => {
              navigator.clipboard.writeText(snippet);
              toast.success("Copied to clipboard");
            }}
          >
            <Copy className="h-4 w-4 mr-2" /> Copy snippet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
