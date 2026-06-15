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

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Linked Projects</h1>
          <p className="text-muted-foreground">
            Each linked Lovable project gets a key. Drop the snippet into the project and it streams events to the hub.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> New project</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Link a project</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="FeelBass POS" />
              </div>
              <div className="space-y-2">
                <Label>URL (optional)</Label>
                <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://feelbasspos.lovable.app" />
              </div>
            </div>
            <DialogFooter>
              <Button disabled={!name || create.isPending} onClick={() => create.mutate({ name, url })}>
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

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
              <div className="flex gap-1">
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
  const snippet = `// hub-client.ts — paste into any Lovable project to stream events to the hub
const HUB = "${origin}/api/public/ingest";
const HUB_KEY = "${data.key}"; // keep this secret-ish (it's per-project, you can rotate from the hub)

export const hub = {
  emit: (type: string, payload: Record<string, any> = {}) =>
    fetch(HUB, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_key: HUB_KEY, type, payload }),
    }).catch(() => {}),
  lead: (p: { name: string; email?: string; phone?: string; source?: string; notes?: string }) =>
    hub.emit("lead", p),
  idea: (p: { title: string; body?: string }) => hub.emit("idea", p),
  customer: (p: { name: string; email?: string; phone?: string; notes?: string }) =>
    hub.emit("customer", p),
  inventory: (p: { name: string; sku?: string; quantity?: number; location?: string; status?: string }) =>
    hub.emit("inventory", p),
};
`;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Snippet for {data.name}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Save this in your other Lovable project as <code>src/lib/hub-client.ts</code>. Then call
          <code> hub.lead(&#123;...&#125;)</code>, <code>hub.idea(&#123;...&#125;)</code>, etc. The key is shown ONCE — copy it now.
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
