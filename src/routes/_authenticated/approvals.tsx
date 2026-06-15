import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listChangeRequests,
  approveChangeRequest,
  rejectChangeRequest,
} from "@/lib/catalog.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/approvals")({ component: ApprovalsPage });

const fmtPrice = (cents: number, currency = "CAD") =>
  new Intl.NumberFormat("en-CA", { style: "currency", currency }).format(cents / 100);

function ApprovalsPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listChangeRequests);
  const approveFn = useServerFn(approveChangeRequest);
  const rejectFn = useServerFn(rejectChangeRequest);

  const { data } = useQuery<any[]>({ queryKey: ["change-requests"], queryFn: () => listFn() as any });

  const approve = useMutation({
    mutationFn: (id: string) => approveFn({ data: { id } }),
    onSuccess: (res: any) => {
      toast.success(res.squareSynced ? "Applied & synced to Square" : "Applied (Square skipped)");
      qc.invalidateQueries({ queryKey: ["change-requests"] });
      qc.invalidateQueries({ queryKey: ["services"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const reject = useMutation({
    mutationFn: (id: string) => rejectFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["change-requests"] }),
  });

  const pending = data?.filter((r) => r.status === "pending") ?? [];
  const history = data?.filter((r) => r.status !== "pending") ?? [];

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-3xl font-bold">Approvals</h1>
        <p className="text-muted-foreground">
          Review every catalog change before it goes live. Approving updates the master catalog, pushes to Square, and notifies linked projects.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Pending ({pending.length})</h2>
        {pending.map((r) => (
          <Card key={r.id}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Badge>{r.change_type}</Badge>
                    {r.organizations?.name}
                    {r.services?.name && <span className="text-muted-foreground">· {r.services.name}</span>}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                    {r.reason && ` · ${r.reason}`}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => reject.mutate(r.id)}>
                    <X className="h-4 w-4 mr-1" /> Reject
                  </Button>
                  <Button size="sm" disabled={approve.isPending} onClick={() => approve.mutate(r.id)}>
                    <Check className="h-4 w-4 mr-1" /> Approve & apply
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Diff current={r.services} payload={r.payload} type={r.change_type} />
            </CardContent>
          </Card>
        ))}
        {!pending.length && (
          <Card><CardContent className="py-8 text-center text-muted-foreground">No pending requests.</CardContent></Card>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">History</h2>
        {history.slice(0, 30).map((r) => (
          <Card key={r.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Badge variant={r.status === "applied" ? "default" : "secondary"}>{r.status}</Badge>
                    <span>{r.change_type}</span>
                    <span className="text-muted-foreground">
                      {r.organizations?.name}{r.services?.name && ` · ${r.services.name}`}
                    </span>
                    {r.square_synced && <Badge variant="outline">Square ✓</Badge>}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    {r.applied_at
                      ? `Applied ${formatDistanceToNow(new Date(r.applied_at), { addSuffix: true })}`
                      : formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
            </CardHeader>
          </Card>
        ))}
      </section>
    </div>
  );
}

function Diff({
  current,
  payload,
  type,
}: {
  current: { name?: string; price_cents?: number; currency?: string } | null;
  payload: Record<string, any>;
  type: string;
}) {
  if (type === "delete") return <p className="text-sm">Will be deactivated.</p>;
  return (
    <div className="text-sm grid grid-cols-2 gap-x-6 gap-y-1">
      {payload.name !== undefined && (
        <>
          <span className="text-muted-foreground">Name</span>
          <span>
            {current?.name ? <s className="text-muted-foreground">{current.name}</s> : null} {payload.name}
          </span>
        </>
      )}
      {payload.price_cents !== undefined && (
        <>
          <span className="text-muted-foreground">Price</span>
          <span>
            {current?.price_cents !== undefined && (
              <s className="text-muted-foreground mr-2">
                {fmtPrice(current.price_cents, current.currency ?? "CAD")}
              </s>
            )}
            {fmtPrice(payload.price_cents, payload.currency ?? current?.currency ?? "CAD")}
          </span>
        </>
      )}
      {payload.duration_minutes !== undefined && (
        <>
          <span className="text-muted-foreground">Duration</span>
          <span>{payload.duration_minutes ?? "—"} min</span>
        </>
      )}
      {payload.sku !== undefined && (
        <>
          <span className="text-muted-foreground">SKU</span>
          <span>{payload.sku ?? "—"}</span>
        </>
      )}
      {payload.description !== undefined && (
        <>
          <span className="text-muted-foreground">Description</span>
          <span className="whitespace-pre-wrap">{payload.description ?? "—"}</span>
        </>
      )}
    </div>
  );
}
