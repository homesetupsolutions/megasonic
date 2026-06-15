import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listOrgs, listServices, createChangeRequest } from "@/lib/catalog.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, DollarSign } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/services")({ component: ServicesPage });

type Org = { id: string; name: string; slug: string; kind: string };
type Svc = {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  price_cents: number;
  currency: string;
  duration_minutes: number | null;
  sku: string | null;
  active: boolean;
  version: number;
};

const fmtPrice = (cents: number, currency = "CAD") =>
  new Intl.NumberFormat("en-CA", { style: "currency", currency }).format(cents / 100);

function ServicesPage() {
  const listOrgsFn = useServerFn(listOrgs);
  const listServicesFn = useServerFn(listServices);
  const { data: orgs } = useQuery<Org[]>({ queryKey: ["orgs"], queryFn: () => listOrgsFn() as any });
  const { data: services } = useQuery<Svc[]>({
    queryKey: ["services"],
    queryFn: () => listServicesFn({ data: {} }) as any,
  });

  const feelbass = orgs?.find((o) => o.kind === "feelbass" || o.kind === "sonicfeel");
  const hss = orgs?.find((o) => o.kind === "hss" || o.kind === "homesetup");

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-3xl font-bold">Services & Pricing</h1>
        <p className="text-muted-foreground">
          Master catalog. Every add / edit / price change goes through Approvals before going live and syncing to Square.
        </p>
      </div>

      <Tabs defaultValue="feelbass">
        <TabsList>
          <TabsTrigger value="feelbass">FeelBass</TabsTrigger>
          <TabsTrigger value="hss">HSS</TabsTrigger>
        </TabsList>
        <TabsContent value="feelbass" className="mt-4">
          <OrgSection org={feelbass} services={services?.filter((s) => s.organization_id === feelbass?.id) ?? []} />
        </TabsContent>
        <TabsContent value="hss" className="mt-4">
          <OrgSection org={hss} services={services?.filter((s) => s.organization_id === hss?.id) ?? []} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function OrgSection({ org, services }: { org: Org | undefined; services: Svc[] }) {
  if (!org) return <p className="text-muted-foreground text-sm">Organization not ready yet.</p>;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{services.length} service(s)</p>
        <ServiceDialog orgId={org.id} mode="create" />
      </div>
      <div className="grid gap-3">
        {services.map((s) => (
          <Card key={s.id}>
            <CardHeader className="flex flex-row items-start justify-between pb-2">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  {s.name}
                  {!s.active && <Badge variant="secondary">inactive</Badge>}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {fmtPrice(s.price_cents, s.currency)}
                  {s.duration_minutes ? ` · ${s.duration_minutes} min` : ""}
                  {s.sku ? ` · SKU ${s.sku}` : ""}
                  {` · v${s.version}`}
                </p>
                {s.description && <p className="text-sm mt-2">{s.description}</p>}
              </div>
              <div className="flex gap-1">
                <ServiceDialog orgId={org.id} mode="price" service={s}>
                  <Button variant="ghost" size="sm" title="Request price change">
                    <DollarSign className="h-4 w-4" />
                  </Button>
                </ServiceDialog>
                <ServiceDialog orgId={org.id} mode="update" service={s}>
                  <Button variant="ghost" size="sm" title="Request edit">
                    <Pencil className="h-4 w-4" />
                  </Button>
                </ServiceDialog>
                <ServiceDialog orgId={org.id} mode="delete" service={s}>
                  <Button variant="ghost" size="sm" title="Request deactivate">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </ServiceDialog>
              </div>
            </CardHeader>
          </Card>
        ))}
        {!services.length && (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">No services yet.</CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function ServiceDialog({
  orgId,
  mode,
  service,
  children,
}: {
  orgId: string;
  mode: "create" | "update" | "price" | "delete";
  service?: Svc;
  children?: React.ReactNode;
}) {
  const qc = useQueryClient();
  const fn = useServerFn(createChangeRequest);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(service?.name ?? "");
  const [description, setDescription] = useState(service?.description ?? "");
  const [priceDollars, setPriceDollars] = useState(((service?.price_cents ?? 0) / 100).toString());
  const [duration, setDuration] = useState(service?.duration_minutes?.toString() ?? "");
  const [sku, setSku] = useState(service?.sku ?? "");
  const [reason, setReason] = useState("");

  const submit = useMutation({
    mutationFn: () => {
      const payload: any = {};
      if (mode === "create" || mode === "update") {
        payload.name = name;
        payload.description = description || null;
        payload.price_cents = Math.round(parseFloat(priceDollars || "0") * 100);
        payload.duration_minutes = duration ? parseInt(duration) : null;
        payload.sku = sku || null;
      } else if (mode === "price") {
        payload.price_cents = Math.round(parseFloat(priceDollars || "0") * 100);
      } else if (mode === "delete") {
        payload.active = false;
      }
      return fn({
        data: {
          organization_id: orgId,
          service_id: service?.id,
          change_type: mode === "price" ? "price_only" : mode === "delete" ? "delete" : mode,
          payload,
          reason,
        },
      });
    },
    onSuccess: () => {
      toast.success("Sent to Approvals");
      qc.invalidateQueries({ queryKey: ["change-requests"] });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const trigger = children ?? (
    <Button size="sm"><Plus className="h-4 w-4 mr-2" /> New service</Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "create" && "Request: add service"}
            {mode === "update" && `Request: edit ${service?.name}`}
            {mode === "price" && `Request: change price of ${service?.name}`}
            {mode === "delete" && `Request: deactivate ${service?.name}`}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {(mode === "create" || mode === "update") && (
            <>
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={description ?? ""} onChange={(e) => setDescription(e.target.value)} rows={2} />
              </div>
            </>
          )}
          {(mode === "create" || mode === "update" || mode === "price") && (
            <div className="space-y-2">
              <Label>Price (in {service?.currency ?? "CAD"})</Label>
              <Input
                type="number"
                step="0.01"
                value={priceDollars}
                onChange={(e) => setPriceDollars(e.target.value)}
              />
            </div>
          )}
          {(mode === "create" || mode === "update") && (
            <>
              <div className="space-y-2">
                <Label>Duration (minutes, optional)</Label>
                <Input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>SKU (optional)</Label>
                <Input value={sku ?? ""} onChange={(e) => setSku(e.target.value)} />
              </div>
            </>
          )}
          <div className="space-y-2">
            <Label>Reason / notes (optional)</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button disabled={submit.isPending} onClick={() => submit.mutate()}>
            Send to Approvals
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
