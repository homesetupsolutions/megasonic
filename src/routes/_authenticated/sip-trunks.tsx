import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  listSipTrunks,
  upsertSipTrunk,
  deleteSipTrunk,
  getIvrSettings,
  saveIvrSettings,
} from "@/lib/sip-trunks.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Trash2, Plus, PhoneCall } from "lucide-react";

export const Route = createFileRoute("/_authenticated/sip-trunks")({ component: SipTrunksPage });

const VOICES = [
  { id: "alloy", label: "Alloy — neutral" },
  { id: "echo", label: "Echo — calm male" },
  { id: "fable", label: "Fable — warm UK" },
  { id: "onyx", label: "Onyx — deep male" },
  { id: "nova", label: "Nova — friendly female" },
  { id: "shimmer", label: "Shimmer — bright female" },
  { id: "verse", label: "Verse — expressive" },
];

const BLANK = {
  did: "",
  label: "",
  provider: "callcentric",
  sip_username: "",
  sip_password: "",
  sip_server: "sip.callcentric.com",
  sip_port: 5060,
  inbound_route: "ivr" as const,
  inbound_extension: "",
  voice: "alloy",
  enabled: true,
};

function SipTrunksPage() {
  const qc = useQueryClient();
  const list = useServerFn(listSipTrunks);
  const upsert = useServerFn(upsertSipTrunk);
  const del = useServerFn(deleteSipTrunk);
  const getIvr = useServerFn(getIvrSettings);
  const saveIvr = useServerFn(saveIvrSettings);

  const { data: trunks } = useQuery<any[]>({ queryKey: ["sip-trunks"], queryFn: () => list() as any });
  const { data: ivr } = useQuery<any>({ queryKey: ["ivr"], queryFn: () => getIvr() as any });

  const [form, setForm] = useState<any>(BLANK);
  const [voice, setVoice] = useState(ivr?.ivr_voice ?? "alloy");
  const [greeting, setGreeting] = useState(ivr?.ivr_greeting ?? "");

  const save = useMutation({
    mutationFn: () => upsert({ data: form }) as any,
    onSuccess: () => {
      toast.success("Saved");
      setForm(BLANK);
      qc.invalidateQueries({ queryKey: ["sip-trunks"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => del({ data: { id } }) as any,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sip-trunks"] }),
  });

  const saveIvrM = useMutation({
    mutationFn: () => saveIvr({ data: { ivr_voice: voice, ivr_greeting: greeting } }) as any,
    onSuccess: () => toast.success("IVR voice + greeting saved"),
  });

  const hookUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/api/public/hooks/callcentric-sip`;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2"><PhoneCall /> SIP Trunks</h1>
        <p className="text-muted-foreground">Route each CallCentric DID to IVR, ET (AI), an extension, or voicemail. Per-DID voice override supported.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Global IVR voice &amp; greeting</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Voice</Label>
              <Select value={voice} onValueChange={setVoice}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {VOICES.map((v) => <SelectItem key={v.id} value={v.id}>{v.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Greeting (spoken on pickup)</Label>
              <Textarea rows={3} value={greeting} onChange={(e) => setGreeting(e.target.value)}
                placeholder="Thanks for calling SonicFeel. Press 1 for HSS, 2 for FeelBass, 9 for ET our AI." />
            </div>
          </div>
          <Button onClick={() => saveIvrM.mutate()} disabled={saveIvrM.isPending}>Save IVR voice</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Webhook URL for CallCentric / SIP bridge</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <code className="block text-xs bg-muted p-2 rounded select-all">{hookUrl}</code>
          <p className="text-xs text-muted-foreground">POST <code>{`{ did, from, call_id }`}</code> on inbound. Returns JSON with route + voice + greeting.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Plus className="h-4 w-4" />Add / edit a trunk</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-2"><Label>DID (the phone number)</Label>
            <Input value={form.did} onChange={(e) => setForm({ ...form, did: e.target.value })} placeholder="17778140621" />
          </div>
          <div className="space-y-2"><Label>Label</Label>
            <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="HSS main" />
          </div>
          <div className="space-y-2"><Label>SIP username</Label>
            <Input value={form.sip_username} onChange={(e) => setForm({ ...form, sip_username: e.target.value })} placeholder="17788XXXXXX" />
          </div>
          <div className="space-y-2"><Label>SIP password</Label>
            <Input type="password" value={form.sip_password} onChange={(e) => setForm({ ...form, sip_password: e.target.value })} />
          </div>
          <div className="space-y-2"><Label>SIP server</Label>
            <Input value={form.sip_server} onChange={(e) => setForm({ ...form, sip_server: e.target.value })} />
          </div>
          <div className="space-y-2"><Label>SIP port</Label>
            <Input type="number" value={form.sip_port} onChange={(e) => setForm({ ...form, sip_port: Number(e.target.value) })} />
          </div>
          <div className="space-y-2"><Label>Inbound route</Label>
            <Select value={form.inbound_route} onValueChange={(v) => setForm({ ...form, inbound_route: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ivr">IVR menu</SelectItem>
                <SelectItem value="et">Straight to ET (AI)</SelectItem>
                <SelectItem value="extension">Ring extension</SelectItem>
                <SelectItem value="voicemail">Voicemail</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label>Extension (if Ring extension)</Label>
            <Input value={form.inbound_extension} onChange={(e) => setForm({ ...form, inbound_extension: e.target.value })} placeholder="100" />
          </div>
          <div className="space-y-2"><Label>Voice (this DID)</Label>
            <Select value={form.voice} onValueChange={(v) => setForm({ ...form, voice: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{VOICES.map((v) => <SelectItem key={v.id} value={v.id}>{v.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex items-end gap-3">
            <div className="flex items-center gap-2">
              <Switch checked={form.enabled} onCheckedChange={(v) => setForm({ ...form, enabled: v })} />
              <Label>Enabled</Label>
            </div>
            <Button onClick={() => save.mutate()} disabled={!form.did || save.isPending}>Save trunk</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3">
        {trunks?.map((t: any) => (
          <Card key={t.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  {t.label || t.did}
                  <Badge variant="outline">{t.did}</Badge>
                  <Badge>{t.inbound_route}{t.inbound_extension ? ` → ${t.inbound_extension}` : ""}</Badge>
                  <Badge variant="secondary">{t.voice}</Badge>
                  {!t.enabled && <Badge variant="destructive">disabled</Badge>}
                </CardTitle>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setForm({ ...t })}>Edit</Button>
                  <Button size="sm" variant="ghost" onClick={() => remove.mutate(t.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            </CardHeader>
          </Card>
        ))}
        {!trunks?.length && (
          <Card><CardContent className="py-10 text-center text-muted-foreground">No SIP trunks yet. Add your CallCentric DIDs above.</CardContent></Card>
        )}
      </div>
    </div>
  );
}
