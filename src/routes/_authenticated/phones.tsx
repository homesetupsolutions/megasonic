import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listPhoneDevices,
  savePhoneDevice,
  deletePhoneDevice,
  listPhoneCalls,
} from "@/lib/phones.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Copy, Phone, Plus, Trash2, PhoneIncoming, PhoneOutgoing, PhoneMissed } from "lucide-react";
import { toast } from "sonner";
import { useMemo, useState } from "react";
import { RingtoneManager } from "@/components/RingtoneManager";

export const Route = createFileRoute("/_authenticated/phones")({ component: PhonesPage });

type Device = {
  id: string;
  mac_address: string;
  label: string | null;
  model: string | null;
  sip_username: string | null;
  sip_password: string | null;
  sip_server: string | null;
  sip_port: number | null;
  ringtone_url: string | null;
  provision_token: string;
  last_provisioned_at: string | null;
};

type Call = {
  id: string;
  direction: "inbound" | "outbound";
  event: string;
  caller_number: string | null;
  caller_name: string | null;
  callee_number: string | null;
  duration_seconds: number | null;
  missed: boolean;
  started_at: string | null;
  lead_id: string | null;
};

export default function PhonesPage() {
  const qc = useQueryClient();
  const listDevsFn = useServerFn(listPhoneDevices);
  const listCallsFn = useServerFn(listPhoneCalls);
  const saveFn = useServerFn(savePhoneDevice);
  const delFn = useServerFn(deletePhoneDevice);

  const { data: devData } = useQuery({ queryKey: ["phone-devices"], queryFn: () => listDevsFn() as any });
  const { data: callData } = useQuery({
    queryKey: ["phone-calls"],
    queryFn: () => listCallsFn() as any,
    refetchInterval: 5000,
  });
  const devices: Device[] = devData?.devices ?? [];
  const calls: Call[] = callData?.calls ?? [];

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const cdrUrl = `${origin}/api/public/hooks/yealink-cdr`;

  const [form, setForm] = useState({
    mac_address: "",
    label: "",
    model: "Yealink",
    sip_username: "",
    sip_password: "",
    sip_server: "",
    sip_port: 5060,
    ringtone_url: "",
  });

  const save = useMutation({
    mutationFn: (data: any) => saveFn({ data }) as any,
    onSuccess: () => {
      toast.success("Phone saved");
      setForm({ ...form, mac_address: "", sip_username: "", sip_password: "" });
      qc.invalidateQueries({ queryKey: ["phone-devices"] });
    },
    onError: (e: any) => toast.error(e?.message || "Save failed"),
  });
  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }) as any,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["phone-devices"] }),
  });

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Phone className="h-7 w-7 text-primary" />
        <h1 className="text-3xl font-bold">PoE Desk Phones</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>How it works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            <b>Any IP phone works</b> — Yealink, Grandstream, Cisco, Polycom, Fanvil, Snom. Register the
            phone below and you'll get three provisioning URLs (Yealink <code>.cfg</code>, Grandstream{" "}
            <code>.xml</code>, plain-text for anything else).
          </p>
          <p>
            Inbound caller IDs are <b>auto-matched against your Square customer list</b>. Known
            customers get linked instantly; unknown numbers create a new lead tagged{" "}
            <code>source: desk_phone</code>.
          </p>
          <UrlRow label="Universal CDR webhook (works for every brand)" value={cdrUrl} />
          <UrlRow label="Provisioning server (point your phone's Auto-Provision URL here)" value={`${origin}/api/public/provision/`} />
          <p className="pt-2 text-xs">
            <b>Note on FTPS:</b> Lovable Cloud serves provisioning over <b>HTTPS</b> (which Yealink,
            Grandstream, Cisco, Polycom and CallCentric-supplied phones all support natively and is
            more secure than FTPS). Set your phone's Auto-Provision <i>Server URL</i> to the link
            above plus your device-specific file (shown on each phone card below).
          </p>
          <p className="text-xs">
            <b>CallCentric setup:</b> SIP server <code>sip.callcentric.com</code> · port{" "}
            <code>5060</code> · username = your <b>1777xxxxxxx</b> account number · password = your
            CallCentric SIP password. Click <b>CallCentric preset</b> in the form below to autofill.
          </p>
        </CardContent>
      </Card>


      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-4 w-4" /> Register a phone
          </CardTitle>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-3">
          <Field label="MAC address (12 hex chars, no colons)">
            <Input
              value={form.mac_address}
              onChange={(e) => setForm({ ...form, mac_address: e.target.value })}
              placeholder="805e0c1a2b3c"
            />
          </Field>
          <Field label="Label / extension name">
            <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Front desk" />
          </Field>
          <Field label="SIP server">
            <Input value={form.sip_server} onChange={(e) => setForm({ ...form, sip_server: e.target.value })} placeholder="sip.callcentric.com" />
          </Field>
          <Field label="SIP port">
            <Input
              type="number"
              value={form.sip_port}
              onChange={(e) => setForm({ ...form, sip_port: Number(e.target.value) || 5060 })}
            />
          </Field>
          <Field label="SIP username / extension">
            <Input value={form.sip_username} onChange={(e) => setForm({ ...form, sip_username: e.target.value })} />
          </Field>
          <Field label="SIP password">
            <Input
              type="password"
              value={form.sip_password}
              onChange={(e) => setForm({ ...form, sip_password: e.target.value })}
            />
          </Field>
          <Field label="Ringtone URL (.wav, optional)">
            <Input
              value={form.ringtone_url}
              onChange={(e) => setForm({ ...form, ringtone_url: e.target.value })}
              placeholder="https://your-bucket/ring.wav"
            />
          </Field>
          <div className="md:col-span-2 flex gap-2">
            <Button onClick={() => save.mutate(form)} disabled={save.isPending || !form.mac_address}>
              {save.isPending ? "Saving…" : "Save phone"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setForm({ ...form, sip_server: "sip.callcentric.com", sip_port: 5060 })
              }
            >
              CallCentric preset
            </Button>
          </div>

        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        {devices.map((d) => {
          const yealink = `${origin}/api/public/provision/${d.mac_address}.cfg?token=${d.provision_token}`;
          const grandstream = `${origin}/api/public/provision/cfg${d.mac_address}.xml?token=${d.provision_token}`;
          const generic = `${origin}/api/public/provision/${d.mac_address}.txt?token=${d.provision_token}`;
          return (
            <Card key={d.id}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">
                  {d.label || d.mac_address} <span className="text-muted-foreground text-xs">· {d.model}</span>
                </CardTitle>
                <Button variant="ghost" size="icon" onClick={() => del.mutate(d.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div><b>MAC:</b> <code>{d.mac_address}</code></div>
                <div><b>SIP:</b> {d.sip_username}@{d.sip_server}:{d.sip_port}</div>
                <UrlRow label="Yealink provisioning URL" value={yealink} />
                <UrlRow label="Grandstream provisioning URL" value={grandstream} />
                <UrlRow label="Other brands — plain-text setup" value={generic} />
                <div className="text-xs text-muted-foreground">
                  Last fetched: {d.last_provisioned_at ? new Date(d.last_provisioned_at).toLocaleString() : "never"}
                </div>
              </CardContent>
            </Card>
          );
        })}
        {devices.length === 0 && (
          <p className="text-muted-foreground text-sm">No phones registered yet.</p>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent calls (live)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {calls.length === 0 && <p className="text-muted-foreground text-sm">No calls yet.</p>}
          {calls.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded border p-2 text-sm">
              <div className="flex items-center gap-2">
                {c.missed ? (
                  <PhoneMissed className="h-4 w-4 text-destructive" />
                ) : c.direction === "inbound" ? (
                  <PhoneIncoming className="h-4 w-4 text-green-500" />
                ) : (
                  <PhoneOutgoing className="h-4 w-4 text-blue-500" />
                )}
                <span className="font-medium">{c.caller_name || c.caller_number || c.callee_number || "unknown"}</span>
                <Badge variant="outline">{c.event}</Badge>
                {c.duration_seconds ? <span className="text-muted-foreground">{c.duration_seconds}s</span> : null}
              </div>
              <span className="text-muted-foreground text-xs">
                {c.started_at ? new Date(c.started_at).toLocaleString() : ""}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function UrlRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <div className="flex gap-2">
        <Input readOnly value={value} className="font-mono text-xs" />
        <Button
          variant="outline"
          size="icon"
          onClick={() => {
            navigator.clipboard.writeText(value);
            toast.success("Copied");
          }}
        >
          <Copy className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
