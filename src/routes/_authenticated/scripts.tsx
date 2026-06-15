import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listScripts, upsertScript, deleteScript } from "@/lib/scripts.functions";
import { listOrgs } from "@/lib/catalog.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Phone, Copy, CheckCircle2 } from "lucide-react";
import { ScriptPlayer } from "@/components/ScriptPlayer";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/scripts")({ component: ScriptsPage });

type Org = { id: string; name: string; slug: string; kind: string };
type Script = {
  id: string;
  organization_id: string;
  service_id: string | null;
  title: string;
  direction: "inbound" | "outbound";
  greeting: string;
  qualifying_questions: string;
  objection_handlers: string;
  closing: string;
  full_script: string;
  is_default: boolean;
  organizations?: { name: string; kind: string };
  services?: { name: string } | null;
};

function ScriptsPage() {
  const listFn = useServerFn(listScripts);
  const listOrgsFn = useServerFn(listOrgs);
  const { data: scripts } = useQuery<Script[]>({ queryKey: ["scripts"], queryFn: () => listFn() as any });
  const { data: orgs } = useQuery<Org[]>({ queryKey: ["orgs"], queryFn: () => listOrgsFn() as any });

  const inbound = (scripts ?? []).filter((s) => s.direction === "inbound");
  const outbound = (scripts ?? []).filter((s) => s.direction === "outbound");

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Phone className="h-7 w-7" /> Call Scripts
          </h1>
          <p className="text-muted-foreground">
            What you (or the AI) say on every call. Tagged <strong>Inbound</strong> (calls coming to you)
            or <strong>Outbound</strong> (calls you make out). Edit anything — the AI follows these word-for-word.
          </p>
        </div>
        <ScriptDialog orgs={orgs ?? []} mode="create" />
      </div>

      <Tabs defaultValue="inbound">
        <TabsList>
          <TabsTrigger value="inbound">📞 Inbound ({inbound.length})</TabsTrigger>
          <TabsTrigger value="outbound">☎️ Outbound ({outbound.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="inbound" className="mt-4 grid gap-4">
          {inbound.map((s) => <ScriptCard key={s.id} script={s} orgs={orgs ?? []} />)}
          {!inbound.length && <EmptyState label="No inbound scripts yet." />}
        </TabsContent>
        <TabsContent value="outbound" className="mt-4 grid gap-4">
          {outbound.map((s) => <ScriptCard key={s.id} script={s} orgs={orgs ?? []} />)}
          {!outbound.length && <EmptyState label="No outbound scripts yet." />}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <Card>
      <CardContent className="py-10 text-center text-muted-foreground">{label}</CardContent>
    </Card>
  );
}

function ScriptCard({ script, orgs }: { script: Script; orgs: Org[] }) {
  const qc = useQueryClient();
  const delFn = useServerFn(deleteScript);
  const del = useMutation({
    mutationFn: () => delFn({ data: { id: script.id } }) as any,
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["scripts"] });
    },
  });

  const copyAll = () => {
    const text = [
      `### ${script.title}`,
      "",
      "GREETING:",
      script.greeting,
      "",
      "QUALIFYING QUESTIONS:",
      script.qualifying_questions,
      "",
      "OBJECTION HANDLERS:",
      script.objection_handlers,
      "",
      "CLOSING:",
      script.closing,
      script.full_script ? "\nFULL SCRIPT:\n" + script.full_script : "",
    ].join("\n");
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
        <div className="min-w-0">
          <CardTitle className="text-lg flex flex-wrap items-center gap-2">
            {script.title}
            <Badge variant={script.direction === "inbound" ? "default" : "outline"}>
              {script.direction === "inbound" ? "📞 Inbound" : "☎️ Outbound"}
            </Badge>
            {script.is_default && <Badge>Default</Badge>}
            <Badge variant="secondary">{script.organizations?.name ?? "—"}</Badge>
            {script.services?.name && <Badge variant="outline">{script.services.name}</Badge>}
          </CardTitle>
        </div>
        <div className="flex gap-1 shrink-0 items-center">
          <ScriptPlayer script={script} />
          <Button variant="ghost" size="sm" onClick={copyAll} aria-label="Copy script">
            <Copy className="h-4 w-4" />
          </Button>
          <ScriptDialog orgs={orgs} mode="edit" script={script}>
            <Button variant="ghost" size="sm" aria-label="Edit script">
              <Pencil className="h-4 w-4" />
            </Button>
          </ScriptDialog>
          <Button variant="ghost" size="sm" onClick={() => del.mutate()} aria-label="Delete script">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="text-sm space-y-3">
        <Section label="Greeting" body={script.greeting} />
        <Section label="Qualifying questions" body={script.qualifying_questions} />
        <Section label="Objection handlers" body={script.objection_handlers} />
        <Section label="Closing" body={script.closing} />
        {script.full_script && <Section label="Full script (optional)" body={script.full_script} />}
      </CardContent>
    </Card>
  );
}

function Section({ label, body }: { label: string; body: string }) {
  if (!body?.trim()) return null;
  return (
    <div>
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
        <CheckCircle2 className="h-3 w-3" /> {label}
      </div>
      <pre className="whitespace-pre-wrap font-sans bg-muted/40 rounded p-2 mt-1 text-sm">{body}</pre>
    </div>
  );
}

function ScriptDialog({
  orgs,
  mode,
  script,
  children,
}: {
  orgs: Org[];
  mode: "create" | "edit";
  script?: Script;
  children?: React.ReactNode;
}) {
  const qc = useQueryClient();
  const upsertFn = useServerFn(upsertScript);
  const [open, setOpen] = useState(false);
  const [orgId, setOrgId] = useState(script?.organization_id ?? orgs[0]?.id ?? "");
  const [direction, setDirection] = useState<"inbound" | "outbound">(script?.direction ?? "inbound");
  const [title, setTitle] = useState(script?.title ?? "");
  const [greeting, setGreeting] = useState(script?.greeting ?? "");
  const [qq, setQq] = useState(script?.qualifying_questions ?? "");
  const [obj, setObj] = useState(script?.objection_handlers ?? "");
  const [closing, setClosing] = useState(script?.closing ?? "");
  const [full, setFull] = useState(script?.full_script ?? "");
  const [isDefault, setIsDefault] = useState(script?.is_default ?? false);

  const m = useMutation({
    mutationFn: () =>
      upsertFn({
        data: {
          id: script?.id,
          organization_id: orgId,
          title,
          direction,
          greeting,
          qualifying_questions: qq,
          objection_handlers: obj,
          closing,
          full_script: full,
          is_default: isDefault,
        },
      }) as any,
    onSuccess: () => {
      toast.success("Saved");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["scripts"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children ?? (
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" /> Add script
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "edit" ? "Edit script" : "New call script"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Business</Label>
            <select
              className="w-full border rounded px-2 py-1 text-sm bg-background"
              value={orgId}
              onChange={(e) => setOrgId(e.target.value)}
            >
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Direction</Label>
            <div className="flex gap-2 mt-1">
              <Button
                type="button"
                variant={direction === "inbound" ? "default" : "outline"}
                size="sm"
                onClick={() => setDirection("inbound")}
              >
                📞 Inbound
              </Button>
              <Button
                type="button"
                variant={direction === "outbound" ? "default" : "outline"}
                size="sm"
                onClick={() => setDirection("outbound")}
              >
                ☎️ Outbound
              </Button>
            </div>
          </div>
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Wedding inquiry script" />
          </div>
          <div>
            <Label>Greeting — first thing the AI says</Label>
            <Textarea rows={2} value={greeting} onChange={(e) => setGreeting(e.target.value)} />
          </div>
          <div>
            <Label>Qualifying questions — what to ask</Label>
            <Textarea rows={5} value={qq} onChange={(e) => setQq(e.target.value)} />
          </div>
          <div>
            <Label>Objection handlers — what to say when they push back</Label>
            <Textarea rows={5} value={obj} onChange={(e) => setObj(e.target.value)} />
          </div>
          <div>
            <Label>Closing — how to lock in the booking</Label>
            <Textarea rows={3} value={closing} onChange={(e) => setClosing(e.target.value)} />
          </div>
          <div>
            <Label>Full script (optional, overrides everything above)</Label>
            <Textarea rows={5} value={full} onChange={(e) => setFull(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
            Use this as the default script for this business
          </label>
        </div>
        <DialogFooter>
          <Button onClick={() => m.mutate()} disabled={m.isPending || !title || !orgId}>
            {m.isPending ? "Saving…" : "Save script"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
