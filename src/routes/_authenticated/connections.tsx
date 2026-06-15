import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  listConnections,
  upsertConnection,
  deleteConnection,
  pullSquareData,
  listSquareLocations,
  KNOWN_PROVIDERS,
} from "@/lib/connections.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/connections")({ component: ConnectionsPage });

type Conn = {
  id: string;
  provider: string;
  label: string | null;
  status: string;
  notes: string | null;
  last_synced_at: string | null;
  config: Record<string, any>;
};

const PROVIDER_LABELS: Record<string, string> = {
  gmail: "Gmail (cold outreach + replies)",
  facebook_page: "Facebook Page (messages + posts)",
  gofundme: "GoFundMe (campaign updates)",
  callcentric: "Callcentric (AI call reception)",
  twilio: "Twilio (SMS + voice)",
  square: "Square POS (catalog + locations)",
  stripe: "Stripe (payments)",
  linkedin: "LinkedIn",
  instagram: "Instagram",
  x_twitter: "X / Twitter",
  grants_gov: "Grants.gov / portals",
  custom: "Custom service",
};

function ConnectionsPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listConnections);
  const pullFn = useServerFn(pullSquareData);
  const listLocFn = useServerFn(listSquareLocations);
  const delFn = useServerFn(deleteConnection);

  const { data: conns } = useQuery<Conn[]>({ queryKey: ["connections"], queryFn: () => listFn() as any });
  const { data: locations } = useQuery<any[]>({ queryKey: ["square_locations"], queryFn: () => listLocFn() as any });

  const pull = useMutation({
    mutationFn: () => pullFn() as any,
    onSuccess: (r: any) => {
      if (r?.ok) toast.success(`Pulled ${r.locations} locations · ${r.services} services from Square`);
      else toast.error(r?.error ?? "Pull failed");
      qc.invalidateQueries({ queryKey: ["connections"] });
      qc.invalidateQueries({ queryKey: ["square_locations"] });
      qc.invalidateQueries({ queryKey: ["services"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Pull failed"),
  });

  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }) as any,
    onSuccess: () => {
      toast.success("Disconnected");
      qc.invalidateQueries({ queryKey: ["connections"] });
    },
  });

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-3xl font-bold">Connections</h1>
        <p className="text-muted-foreground">
          Everything the AI plugs into. Square is wired and ready — pull your locations and catalog with one click.
          Other services store credentials securely so the AI can act on your behalf.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Square POS</CardTitle>
          <Button onClick={() => pull.mutate()} disabled={pull.isPending}>
            <RefreshCw className={`h-4 w-4 mr-2 ${pull.isPending ? "animate-spin" : ""}`} />
            {pull.isPending ? "Pulling…" : "Pull locations & catalog"}
          </Button>
        </CardHeader>
        <CardContent>
          {locations?.length ? (
            <ul className="space-y-2 text-sm">
              {locations.map((l: any) => (
                <li key={l.id} className="flex items-center justify-between border-b pb-2">
                  <div>
                    <div className="font-medium">{l.name}</div>
                    <div className="text-muted-foreground text-xs">
                      {l.address ?? "—"} · {l.currency ?? ""} · {(l as any).organizations?.name ?? "unassigned"}
                    </div>
                  </div>
                  <Badge variant={l.status === "ACTIVE" ? "default" : "secondary"}>{l.status ?? "—"}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">No locations pulled yet. Click the button above.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>All connections</CardTitle>
          <UpsertDialog />
        </CardHeader>
        <CardContent>
          <div className="grid gap-3">
            {(conns ?? []).map((c) => (
              <div key={c.id} className="flex items-start justify-between border rounded p-3">
                <div>
                  <div className="font-medium flex items-center gap-2">
                    {PROVIDER_LABELS[c.provider] ?? c.provider}
                    <Badge variant={c.status === "connected" ? "default" : "secondary"}>{c.status}</Badge>
                  </div>
                  {c.label && <div className="text-xs text-muted-foreground">{c.label}</div>}
                  {c.notes && <div className="text-xs mt-1">{c.notes}</div>}
                  {c.last_synced_at && (
                    <div className="text-xs text-muted-foreground mt-1">
                      Last synced {new Date(c.last_synced_at).toLocaleString()}
                    </div>
                  )}
                </div>
                <Button variant="ghost" size="sm" onClick={() => del.mutate(c.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {!conns?.length && <p className="text-muted-foreground text-sm">No connections yet.</p>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>AI call reception webhook</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <p className="text-muted-foreground">
            Point Callcentric / Twilio / any voice provider at this URL. The AI transcribes, summarizes,
            and proposes a booking that lands in <strong>AI Calls</strong> for your approval.
          </p>
          <code className="block bg-muted p-2 rounded text-xs break-all">
            {typeof window !== "undefined" ? window.location.origin : ""}/api/public/hooks/voice-call
          </code>
        </CardContent>
      </Card>
    </div>
  );
}

function UpsertDialog() {
  const qc = useQueryClient();
  const upsertFn = useServerFn(upsertConnection);
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState<string>("gmail");
  const [label, setLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [creds, setCreds] = useState("");

  const m = useMutation({
    mutationFn: () =>
      upsertFn({
        data: {
          provider,
          label: label || null,
          notes: notes || null,
          status: "pending",
          config: creds ? { credentials_note: creds } : {},
        },
      }) as any,
    onSuccess: () => {
      toast.success("Saved");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["connections"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-2" /> Add connection
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add or update a connection</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Service</Label>
            <select
              className="w-full border rounded px-2 py-1 text-sm bg-background"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
            >
              {KNOWN_PROVIDERS.map((p) => (
                <option key={p} value={p}>
                  {PROVIDER_LABELS[p] ?? p}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Label</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. john@feelbass.com" />
          </div>
          <div>
            <Label>Notes / setup steps</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What still needs to be done to finish connecting this?"
            />
          </div>
          <div>
            <Label>Credential note (NOT a secret)</Label>
            <Input
              value={creds}
              onChange={(e) => setCreds(e.target.value)}
              placeholder="Where the actual key is stored, e.g. Lovable secret name"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Actual API keys go into Lovable secrets — never paste raw keys here.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => m.mutate()} disabled={m.isPending}>
            {m.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
