// Renders Square Web Payments SDK card form, tokenizes the card, and attaches it
// to the given booking via attachCardToBooking server fn. Card data NEVER touches our server in raw form.
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CreditCard, ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { attachCardToBooking, getSquarePublicConfig } from "@/lib/bookings-card.functions";

declare global {
  interface Window {
    Square?: any;
  }
}

const SDK_PROD = "https://web.squarecdn.com/v1/square.js";
const SDK_SANDBOX = "https://sandbox.web.squarecdn.com/v1/square.js";

function loadSdk(env: "production" | "sandbox") {
  return new Promise<void>((resolve, reject) => {
    if (window.Square) return resolve();
    const src = env === "sandbox" ? SDK_SANDBOX : SDK_PROD;
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Square SDK failed to load")));
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Square SDK failed to load"));
    document.head.appendChild(s);
  });
}

export function SquareCardOnFile({
  bookingId,
  cardholderName,
  feeText = "$45 cancellation fee if within 24 hours or no-show",
  onSaved,
}: {
  bookingId: string;
  cardholderName: string;
  feeText?: string;
  onSaved?: (info: { brand: string; last4: string }) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cardRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [name, setName] = useState(cardholderName);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ brand: string; last4: string } | null>(null);

  const getCfg = useServerFn(getSquarePublicConfig);
  const attach = useServerFn(attachCardToBooking);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cfg = await getCfg();
        if (!cfg.applicationId || !cfg.locationId) {
          toast.error("Square not configured");
          return;
        }
        await loadSdk(cfg.environment as any);
        if (cancelled) return;
        const payments = window.Square.payments(cfg.applicationId, cfg.locationId);
        const card = await payments.card();
        await card.attach(containerRef.current!);
        cardRef.current = card;
        setReady(true);
      } catch (e: any) {
        console.error(e);
        toast.error(e?.message || "Square card form failed to load");
      }
    })();
    return () => {
      cancelled = true;
      try {
        cardRef.current?.destroy?.();
      } catch {}
    };
  }, [getCfg]);

  async function handleSave() {
    if (!cardRef.current) return;
    setSubmitting(true);
    try {
      const result = await cardRef.current.tokenize();
      if (result.status !== "OK") {
        const msg = result.errors?.[0]?.message || "Card tokenization failed";
        throw new Error(msg);
      }
      const res = await attach({
        data: {
          bookingId,
          sourceId: result.token,
          cardholderName: name || cardholderName || "Guest",
        },
      });
      setDone({ brand: res.brand, last4: res.last4 });
      toast.success(`Card on file: ${res.brand} •••• ${res.last4}`);
      onSaved?.({ brand: res.brand, last4: res.last4 });
    } catch (e: any) {
      toast.error(e?.message || "Could not save card");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-md border border-border bg-card p-3 text-sm flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-green-500" />
        Card on file: <span className="font-medium">{done.brand} •••• {done.last4}</span>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-md border border-border bg-card/50 p-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        <CreditCard className="h-4 w-4" /> Card on file (required)
      </div>
      <p className="text-xs text-muted-foreground">{feeText}. Card is stored securely in Square — not on our servers.</p>
      <div>
        <Label htmlFor="cardholder" className="text-xs">Cardholder name</Label>
        <Input id="cardholder" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name on card" />
      </div>
      <div ref={containerRef} className="min-h-[56px] rounded-md bg-background p-2" />
      <Button onClick={handleSave} disabled={!ready || submitting} className="w-full">
        {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
        Save card on file
      </Button>
    </div>
  );
}
