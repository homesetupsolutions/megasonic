import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listOrgs, listServices } from "@/lib/catalog.functions";
import { listBookings, createBooking, updateBookingStatus } from "@/lib/catalog.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Calendar } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/bookings")({ component: BookingsPage });

function BookingsPage() {
  const qc = useQueryClient();
  const listOrgsFn = useServerFn(listOrgs);
  const listServicesFn = useServerFn(listServices);
  const listFn = useServerFn(listBookings);
  const createFn = useServerFn(createBooking);
  const updateFn = useServerFn(updateBookingStatus);

  const { data: orgs } = useQuery<any[]>({ queryKey: ["orgs"], queryFn: () => listOrgsFn() as any });
  const { data: services } = useQuery<any[]>({
    queryKey: ["services"],
    queryFn: () => listServicesFn({ data: {} }) as any,
  });
  const { data: bookings } = useQuery<any[]>({ queryKey: ["bookings"], queryFn: () => listFn() as any });

  const [open, setOpen] = useState(false);
  const [orgId, setOrgId] = useState<string>("");
  const [serviceId, setServiceId] = useState<string>("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [when, setWhen] = useState("");
  const [notes, setNotes] = useState("");

  const create = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          organization_id: orgId,
          service_id: serviceId || null,
          customer_name: name,
          customer_email: email || null,
          customer_phone: phone || null,
          scheduled_at: new Date(when).toISOString(),
          notes: notes || null,
          duration_minutes: services?.find((s) => s.id === serviceId)?.duration_minutes ?? null,
        },
      }),
    onSuccess: () => {
      toast.success("Booking created");
      qc.invalidateQueries({ queryKey: ["bookings"] });
      setOpen(false);
      setName(""); setEmail(""); setPhone(""); setWhen(""); setNotes(""); setServiceId("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: ({ id, status }: { id: string; status: any }) => updateFn({ data: { id, status } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bookings"] }),
  });

  const orgServices = services?.filter((s) => s.organization_id === orgId) ?? [];

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Bookings</h1>
          <p className="text-muted-foreground">Schedule customers against your master catalog.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> New booking</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New booking</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Organization</Label>
                <Select value={orgId} onValueChange={(v) => { setOrgId(v); setServiceId(""); }}>
                  <SelectTrigger><SelectValue placeholder="Pick org" /></SelectTrigger>
                  <SelectContent>
                    {orgs?.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Service</Label>
                <Select value={serviceId} onValueChange={setServiceId} disabled={!orgId}>
                  <SelectTrigger><SelectValue placeholder="Pick service" /></SelectTrigger>
                  <SelectContent>
                    {orgServices.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} — ${(s.price_cents / 100).toFixed(2)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Customer name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
                <div className="space-y-2"><Label>When</Label><Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} /></div>
                <div className="space-y-2"><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                <div className="space-y-2"><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
              </div>
              <div className="space-y-2"><Label>Notes</Label><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
            </div>
            <DialogFooter>
              <Button disabled={!orgId || !name || !when || create.isPending} onClick={() => create.mutate()}>
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-3">
        {bookings?.map((b) => (
          <Card key={b.id}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {b.customer_name}
                    <Badge variant="outline">{b.organizations?.name}</Badge>
                    {b.services?.name && <span className="text-muted-foreground text-sm">· {b.services.name}</span>}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    {format(new Date(b.scheduled_at), "PPpp")}
                    {b.duration_minutes ? ` · ${b.duration_minutes} min` : ""}
                    {b.customer_email && ` · ${b.customer_email}`}
                    {b.customer_phone && ` · ${b.customer_phone}`}
                  </p>
                  {b.notes && <p className="text-sm mt-2">{b.notes}</p>}
                </div>
                <Select value={b.status} onValueChange={(v) => update.mutate({ id: b.id, status: v })}>
                  <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                    <SelectItem value="no_show">No-show</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
          </Card>
        ))}
        {!bookings?.length && (
          <Card><CardContent className="py-10 text-center text-muted-foreground">No bookings yet.</CardContent></Card>
        )}
      </div>
    </div>
  );
}
