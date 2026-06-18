import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listOrgs, listServices, createBooking } from "@/lib/catalog.functions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, ChevronLeft, Calendar, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { SquareCardOnFile } from "@/components/SquareCardOnFile";

export const Route = createFileRoute("/_authenticated/quick-book")({ component: QuickBookPage });

type Org = { id: string; name: string; slug: string; kind: string };
type Svc = { id: string; organization_id: string; name: string; price_cents: number; currency: string; duration_minutes: number | null; active: boolean };

const fmtPrice = (cents: number, c = "CAD") =>
  new Intl.NumberFormat("en-CA", { style: "currency", currency: c }).format(cents / 100);

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function buildTimeSlots(base: Date): { label: string; iso: string }[] {
  const slots: { label: string; iso: string }[] = [];
  const start = new Date(base);
  start.setHours(8, 0, 0, 0);
  for (let i = 0; i < 22; i++) {
    const d = new Date(start.getTime() + i * 30 * 60 * 1000);
    slots.push({
      label: d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
      iso: d.toISOString(),
    });
  }
  return slots;
}

function QuickBookPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const listOrgsFn = useServerFn(listOrgs);
  const listSvcFn = useServerFn(listServices);
  const createFn = useServerFn(createBooking);

  const { data: orgs } = useQuery<Org[]>({ queryKey: ["orgs"], queryFn: () => listOrgsFn() as any });
  const { data: services } = useQuery<Svc[]>({
    queryKey: ["services"],
    queryFn: () => listSvcFn({ data: {} }) as any,
  });

  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [svcId, setSvcId] = useState<string | null>(null);
  const [day, setDay] = useState<Date>(startOfDay(new Date()));
  const [slot, setSlot] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");

  const org = orgs?.find((o) => o.id === orgId);
  const svc = services?.find((s) => s.id === svcId);
  const orgServices = (services ?? []).filter((s) => s.organization_id === orgId && s.active);

  const create = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          organization_id: orgId!,
          service_id: svcId,
          customer_name: name,
          customer_phone: phone || null,
          scheduled_at: slot!,
          duration_minutes: svc?.duration_minutes ?? null,
          notes: notes || null,
        },
      }) as any,
    onSuccess: (row: any) => {
      toast.success("Booked! Now add card on file.");
      qc.invalidateQueries({ queryKey: ["bookings"] });
      setBookingId(row?.id ?? null);
      setStep(5);
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const big = "h-20 text-lg justify-start px-5";

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Sparkles className="h-7 w-7" /> Quick Book
        </h1>
        <p className="text-muted-foreground">Tap, tap, tap, done.</p>
      </div>

      <Stepper step={step} />

      {step === 1 && (
        <Card className="p-4 space-y-3">
          <h2 className="font-semibold text-lg">1. Which business?</h2>
          {(orgs ?? []).map((o) => (
            <Button
              key={o.id}
              variant={orgId === o.id ? "default" : "outline"}
              className={big + " w-full"}
              onClick={() => {
                setOrgId(o.id);
                setSvcId(null);
                setStep(2);
              }}
            >
              {o.name}
            </Button>
          ))}
        </Card>
      )}

      {step === 2 && (
        <Card className="p-4 space-y-3">
          <BackRow onBack={() => setStep(1)} label={org?.name ?? ""} />
          <h2 className="font-semibold text-lg">2. Which service?</h2>
          {orgServices.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No services yet for this business. Add one in Services & Pricing first.
            </p>
          )}
          {orgServices.map((s) => (
            <Button
              key={s.id}
              variant={svcId === s.id ? "default" : "outline"}
              className={big + " w-full flex-col items-start gap-0"}
              onClick={() => {
                setSvcId(s.id);
                setStep(3);
              }}
            >
              <span className="font-semibold">{s.name}</span>
              <span className="text-xs opacity-80">
                {fmtPrice(s.price_cents, s.currency)}
                {s.duration_minutes ? ` · ${s.duration_minutes} min` : ""}
              </span>
            </Button>
          ))}
        </Card>
      )}

      {step === 3 && (
        <Card className="p-4 space-y-3">
          <BackRow onBack={() => setStep(2)} label={svc?.name ?? ""} />
          <h2 className="font-semibold text-lg">3. When?</h2>
          <div className="flex gap-2 flex-wrap">
            {[0, 1, 2, 3, 4, 5, 6].map((offset) => {
              const d = new Date();
              d.setDate(d.getDate() + offset);
              const sod = startOfDay(d);
              const active = sod.getTime() === day.getTime();
              return (
                <Button
                  key={offset}
                  size="sm"
                  variant={active ? "default" : "outline"}
                  onClick={() => {
                    setDay(sod);
                    setSlot(null);
                  }}
                  className="min-h-11"
                >
                  {offset === 0 ? "Today" : offset === 1 ? "Tomorrow" : sod.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}
                </Button>
              );
            })}
          </div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {buildTimeSlots(day).map((t) => (
              <Button
                key={t.iso}
                variant={slot === t.iso ? "default" : "outline"}
                onClick={() => {
                  setSlot(t.iso);
                  setStep(4);
                }}
                className="min-h-11"
              >
                {t.label}
              </Button>
            ))}
          </div>
        </Card>
      )}

      {step === 4 && (
        <Card className="p-4 space-y-3">
          <BackRow onBack={() => setStep(3)} label={slot ? new Date(slot).toLocaleString() : ""} />
          <h2 className="font-semibold text-lg">4. Who?</h2>
          <div>
            <Label>Customer name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="h-12 text-base" placeholder="Jane Doe" />
          </div>
          <div>
            <Label>Phone number</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="h-12 text-base" placeholder="(555) 555-5555" />
          </div>
          <div>
            <Label>Notes (optional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything special?" />
          </div>

          <Card className="bg-muted/50 p-3 text-sm">
            <div className="font-semibold flex items-center gap-2 mb-1">
              <Calendar className="h-4 w-4" /> Summary
            </div>
            <div>Business: {org?.name}</div>
            <div>Service: {svc?.name} — {svc && fmtPrice(svc.price_cents, svc.currency)}</div>
            <div>When: {slot && new Date(slot).toLocaleString()}</div>
            <div>Customer: {name || "—"}</div>
          </Card>

          <Button
            size="lg"
            className="w-full h-14 text-lg"
            disabled={!name || !slot || !orgId || create.isPending}
            onClick={() => create.mutate()}
          >
            <CheckCircle2 className="h-5 w-5 mr-2" />
            {create.isPending ? "Booking…" : "Book it"}
          </Button>
        </Card>
      )}

      {step === 5 && bookingId && (
        <Card className="p-4 space-y-3">
          <h2 className="font-semibold text-lg">5. Card on file</h2>
          <p className="text-sm text-muted-foreground">
            Required to confirm booking. 24h notice or $45 fee applies.
          </p>
          <SquareCardOnFile
            bookingId={bookingId}
            cardholderName={name}
            feeText="24h notice required, otherwise a $45 fee will be charged"
            onSaved={() => setTimeout(() => navigate({ to: "/bookings" }), 800)}
          />
          <Button variant="ghost" className="w-full" onClick={() => navigate({ to: "/bookings" })}>
            Skip for now
          </Button>
        </Card>
      )}
    </div>
  );
}

function BackRow({ onBack, label }: { onBack: () => void; label: string }) {
  return (
    <button onClick={onBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
      <ChevronLeft className="h-4 w-4" /> {label}
    </button>
  );
}

  const labels = ["Business", "Service", "Time", "Customer", "Card"];
  return (
    <div className="flex gap-2">
      {labels.map((l, i) => {
        const n = i + 1;
        const active = step === n;
        const done = step > n;
        return (
          <div
            key={l}
            className={`flex-1 text-xs py-2 px-3 rounded border text-center ${
              active ? "bg-primary text-primary-foreground border-primary" : done ? "bg-muted" : "bg-background"
            }`}
          >
            {n}. {l}
          </div>
        );
      })}
    </div>
  );
}
