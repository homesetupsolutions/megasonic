import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listCalls, approveCallBooking, rejectCallBooking } from "@/lib/calls.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, X, PhoneCall } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/calls")({ component: CallsPage });

type Call = {
  id: string;
  from_number: string | null;
  to_number: string | null;
  started_at: string | null;
  duration_seconds: number | null;
  status: string;
  ai_summary: string | null;
  ai_intent: string | null;
  transcript: string | null;
  proposed_booking: Record<string, any> | null;
  organizations?: { name: string; kind: string };
};

export default function CallsPage() {
  return <Inner />;
}

function Inner() {
  const qc = useQueryClient();
  const listFn = useServerFn(listCalls);
  const approveFn = useServerFn(approveCallBooking);
  const rejectFn = useServerFn(rejectCallBooking);

  const { data: calls } = useQuery<Call[]>({ queryKey: ["calls"], queryFn: () => listFn() as any });

  const approve = useMutation({
    mutationFn: (id: string) => approveFn({ data: { id } }) as any,
    onSuccess: () => {
      toast.success("Booking confirmed");
      qc.invalidateQueries({ queryKey: ["calls"] });
      qc.invalidateQueries({ queryKey: ["bookings"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const reject = useMutation({
    mutationFn: (id: string) => rejectFn({ data: { id } }) as any,
    onSuccess: () => {
      toast.success("Rejected");
      qc.invalidateQueries({ queryKey: ["calls"] });
    },
  });

  const pending = calls?.filter((c) => c.proposed_booking && c.status !== "booked" && c.status !== "rejected") ?? [];
  const handled = calls?.filter((c) => !pending.includes(c)) ?? [];

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <PhoneCall className="h-7 w-7" /> AI Calls
        </h1>
        <p className="text-muted-foreground">
          Incoming calls handled by your AI. Review the proposed booking and approve or reject.
        </p>
      </div>

      <section>
        <h2 className="font-semibold mb-2">Awaiting your approval ({pending.length})</h2>
        <div className="grid gap-3">
          {pending.map((c) => (
            <CallCard
              key={c.id}
              call={c}
              onApprove={() => approve.mutate(c.id)}
              onReject={() => reject.mutate(c.id)}
              busy={approve.isPending || reject.isPending}
            />
          ))}
          {!pending.length && <p className="text-muted-foreground text-sm">Nothing waiting.</p>}
        </div>
      </section>

      <section>
        <h2 className="font-semibold mb-2">History</h2>
        <div className="grid gap-3">
          {handled.map((c) => (
            <CallCard key={c.id} call={c} />
          ))}
        </div>
      </section>
    </div>
  );
}

function CallCard({
  call,
  onApprove,
  onReject,
  busy,
}: {
  call: Call;
  onApprove?: () => void;
  onReject?: () => void;
  busy?: boolean;
}) {
  const pb = call.proposed_booking ?? {};
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between">
          <span>
            {call.from_number ?? "Unknown"} → {call.organizations?.name ?? "—"}
          </span>
          <Badge variant={call.status === "booked" ? "default" : "secondary"}>{call.status}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="text-sm space-y-2">
        {call.ai_intent && (
          <div>
            <span className="text-muted-foreground">Intent:</span> {call.ai_intent}
          </div>
        )}
        {call.ai_summary && <div className="text-muted-foreground">{call.ai_summary}</div>}
        {pb && Object.keys(pb).length > 0 && (
          <div className="bg-muted p-2 rounded text-xs">
            <div className="font-semibold mb-1">Proposed booking</div>
            <div>Customer: {pb.customer_name ?? "—"}</div>
            <div>When: {pb.scheduled_at ? new Date(pb.scheduled_at).toLocaleString() : "—"}</div>
            {pb.notes && <div>Notes: {pb.notes}</div>}
          </div>
        )}
        {onApprove && (
          <div className="flex gap-2 pt-2">
            <Button size="sm" onClick={onApprove} disabled={busy}>
              <Check className="h-4 w-4 mr-1" /> Approve & book
            </Button>
            <Button size="sm" variant="outline" onClick={onReject} disabled={busy}>
              <X className="h-4 w-4 mr-1" /> Reject
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
