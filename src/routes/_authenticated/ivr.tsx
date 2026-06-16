import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Copy, PhoneForwarded, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/ivr")({ component: IvrPage });

type Ext = { number: string; name: string; callerId: string };
type MenuOpt = { digit: string; label: string; ext: string };

const DEFAULT_EXTS: Ext[] = [
  { number: "100", name: "CALL NEW",           callerId: "18332302933" },
  { number: "101", name: "HSS Customer Service", callerId: "18332302933" },
  { number: "102", name: "Calgary Office",     callerId: "18332302933" },
  { number: "103", name: "HSS Field Tech",     callerId: "18332302933" },
  { number: "104", name: "FEELBASSVIP SYSTEM", callerId: "18447664226" },
  { number: "105", name: "FEELBASSVIP CONF",   callerId: "18447664226" },
  { number: "106", name: "AI",                 callerId: "18332302933" },
  { number: "107", name: "FEELBASSVIP Mobile", callerId: "18332302933" },
];

const DEFAULT_MENU: MenuOpt[] = [
  { digit: "1", label: "Customer Service", ext: "101" },
  { digit: "2", label: "Calgary Office",   ext: "102" },
  { digit: "3", label: "Field Tech",       ext: "103" },
  { digit: "4", label: "FeelBassVIP",      ext: "104" },
  { digit: "9", label: "Talk to AI",       ext: "106" },
  { digit: "0", label: "Anything else",    ext: "100" },
];

const DEFAULT_GREETING =
  "Thanks for calling HSS. For customer service press 1, for the Calgary office press 2, " +
  "for field tech press 3, for FeelBassVIP press 4, for our AI assistant press 9, " +
  "or stay on the line.";

const LS_KEY = "ivr.config.v1";

function IvrPage() {
  const [account, setAccount] = useState("17778140621");
  const [greeting, setGreeting] = useState(DEFAULT_GREETING);
  const [exts, setExts] = useState<Ext[]>(DEFAULT_EXTS);
  const [menu, setMenu] = useState<MenuOpt[]>(DEFAULT_MENU);
  const [timeoutExt, setTimeoutExt] = useState("100");
  const [timeoutSec, setTimeoutSec] = useState(8);

  // load
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const c = JSON.parse(raw);
        setAccount(c.account ?? "17778140621");
        setGreeting(c.greeting ?? DEFAULT_GREETING);
        setExts(c.exts ?? DEFAULT_EXTS);
        setMenu(c.menu ?? DEFAULT_MENU);
        setTimeoutExt(c.timeoutExt ?? "100");
        setTimeoutSec(c.timeoutSec ?? 8);
      }
    } catch { /* */ }
  }, []);

  // autosave
  useEffect(() => {
    try {
      localStorage.setItem(
        LS_KEY,
        JSON.stringify({ account, greeting, exts, menu, timeoutExt, timeoutSec })
      );
    } catch { /* */ }
  }, [account, greeting, exts, menu, timeoutExt, timeoutSec]);

  const forwardMap = useMemo(() => {
    const rows = menu.map((m) => `Digit ${m.digit} → ${account}*${m.ext}  (${m.label})`).join("\n");
    return (
      `# CallCentric IVR map for ${account}\n` +
      `# Paste this into CallCentric → IVR → Main Menu, or use it as a runbook for FreePBX.\n\n` +
      `Greeting:\n  "${greeting}"\n\n` +
      `Timeout: ${timeoutSec}s → ${account}*${timeoutExt}\n\n` +
      `Menu:\n${rows}\n\n` +
      `Extensions:\n` +
      exts.map((e) => `  ${e.number}  ${e.name.padEnd(28)} CID ${e.callerId}`).join("\n")
    );
  }, [account, greeting, exts, menu, timeoutExt, timeoutSec]);

  function updateExt(i: number, patch: Partial<Ext>) {
    setExts((arr) => arr.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  }
  function addExt() {
    const next = String(100 + exts.length);
    setExts((arr) => [...arr, { number: next, name: "New extension", callerId: "" }]);
  }
  function removeExt(i: number) { setExts((arr) => arr.filter((_, idx) => idx !== i)); }

  function updateOpt(i: number, patch: Partial<MenuOpt>) {
    setMenu((arr) => arr.map((m, idx) => (idx === i ? { ...m, ...patch } : m)));
  }
  function addOpt() {
    const used = new Set(menu.map((m) => m.digit));
    const digit = ["1","2","3","4","5","6","7","8","9","0"].find((d) => !used.has(d)) ?? "*";
    setMenu((arr) => [...arr, { digit, label: "New option", ext: exts[0]?.number ?? "100" }]);
  }
  function removeOpt(i: number) { setMenu((arr) => arr.filter((_, idx) => idx !== i)); }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <PhoneForwarded className="h-7 w-7 text-primary" />
        <h1 className="text-3xl font-bold">IVR Designer</h1>
        <Badge variant="outline">CallCentric · {account}</Badge>
      </div>

      <Card>
        <CardHeader><CardTitle>Greeting & timeout</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-3 gap-3">
          <div className="md:col-span-3 space-y-1">
            <Label className="text-xs">Greeting (what callers hear)</Label>
            <Textarea rows={3} value={greeting} onChange={(e) => setGreeting(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">CallCentric account #</Label>
            <Input value={account} onChange={(e) => setAccount(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">No-press timeout (sec)</Label>
            <Input type="number" value={timeoutSec} onChange={(e) => setTimeoutSec(Number(e.target.value) || 8)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Send timeouts to ext</Label>
            <Input value={timeoutExt} onChange={(e) => setTimeoutExt(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Menu (digit → extension)</CardTitle>
          <Button size="sm" variant="outline" onClick={addOpt}><Plus className="h-4 w-4 mr-1"/>Add option</Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {menu.map((m, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-end">
              <div className="col-span-2"><Label className="text-xs">Digit</Label><Input value={m.digit} onChange={(e) => updateOpt(i, { digit: e.target.value })} /></div>
              <div className="col-span-6"><Label className="text-xs">Label</Label><Input value={m.label} onChange={(e) => updateOpt(i, { label: e.target.value })} /></div>
              <div className="col-span-3"><Label className="text-xs">Route to ext</Label>
                <select className="w-full h-9 rounded-md border bg-background px-2 text-sm" value={m.ext} onChange={(e) => updateOpt(i, { ext: e.target.value })}>
                  {exts.map((e) => <option key={e.number} value={e.number}>{e.number} — {e.name}</option>)}
                </select>
              </div>
              <Button variant="ghost" size="icon" onClick={() => removeOpt(i)}><Trash2 className="h-4 w-4"/></Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Extensions</CardTitle>
          <Button size="sm" variant="outline" onClick={addExt}><Plus className="h-4 w-4 mr-1"/>Add extension</Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {exts.map((e, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-end">
              <div className="col-span-2"><Label className="text-xs">Ext</Label><Input value={e.number} onChange={(ev) => updateExt(i, { number: ev.target.value })} /></div>
              <div className="col-span-6"><Label className="text-xs">Name</Label><Input value={e.name} onChange={(ev) => updateExt(i, { name: ev.target.value })} /></div>
              <div className="col-span-3"><Label className="text-xs">Outbound Caller ID</Label><Input value={e.callerId} onChange={(ev) => updateExt(i, { callerId: ev.target.value })} /></div>
              <Button variant="ghost" size="icon" onClick={() => removeExt(i)}><Trash2 className="h-4 w-4"/></Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Generated routing map</CardTitle>
          <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(forwardMap); toast.success("Copied"); }}>
            <Copy className="h-4 w-4 mr-1"/>Copy
          </Button>
        </CardHeader>
        <CardContent>
          <pre className="text-xs font-mono whitespace-pre-wrap bg-muted/40 rounded p-3 border">{forwardMap}</pre>
          <p className="text-xs text-muted-foreground mt-3">
            Paste this into <b>CallCentric → Features → Call Treatments / IVR</b>, or hand it to
            FreePBX if you move off CallCentric. Every call still hits the Desk Phones CDR webhook,
            so the Alien sees and logs it regardless of which PBX answers.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
