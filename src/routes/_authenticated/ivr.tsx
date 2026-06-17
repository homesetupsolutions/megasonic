import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Copy, PhoneForwarded, Trash2, Plus, Clock, Megaphone, Wifi, Headphones,
  Voicemail, Music, CalendarDays, Image as ImageIcon, KeyRound, PhoneCall,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/ivr")({ component: IvrPage });

type Ext = {
  number: string;
  name: string;
  callerId: string;
  voicemail: boolean;
  recording: boolean;
  forwardOnBusy: string;
  forwardOnNoAnswer: string;
  ringSeconds: number;
};
type MenuOpt = { digit: string; label: string; target: string }; // target: ext:101 | menu:after_hours | page:all | vm:101
type SubMenu = { id: string; name: string; greeting: string; options: MenuOpt[]; timeoutTarget: string };
type Schedule = { name: string; days: number[]; start: string; end: string; menuId: string };
type Holiday = { date: string; label: string; menuId: string };
type PageGroup = { id: string; name: string; members: string[]; multicastIp: string; codec: "PCMU" | "PCMA" | "OPUS" };
type BlfKey = { label: string; ext: string; type: "blf" | "speed" | "park" | "page" };
type ReceptionProfile = {
  deviceModel: string;
  logoUrl: string;
  wallpaperUrl: string;
  screensaverText: string;
  blfKeys: BlfKey[];
  showQueueStats: boolean;
  autoAnswer: boolean;
  headsetMode: boolean;
};
type WifiProfile = {
  ssid: string;
  psk: string;
  security: "wpa2-psk" | "wpa3-psk" | "open";
  band: "auto" | "2.4" | "5";
  roamingAggressive: boolean;
  handsetModel: string;
  dndAfterHours: boolean;
  vibrate: boolean;
  ringVolume: number;
};

const DEFAULT_EXTS: Ext[] = [
  { number: "100", name: "CALL NEW",             callerId: "18332302933", voicemail: true,  recording: false, forwardOnBusy: "vm", forwardOnNoAnswer: "vm", ringSeconds: 25 },
  { number: "101", name: "HSS Customer Service", callerId: "18332302933", voicemail: true,  recording: true,  forwardOnBusy: "vm", forwardOnNoAnswer: "100", ringSeconds: 25 },
  { number: "102", name: "Calgary Office",       callerId: "18332302933", voicemail: true,  recording: false, forwardOnBusy: "vm", forwardOnNoAnswer: "100", ringSeconds: 25 },
  { number: "103", name: "HSS Field Tech",       callerId: "18332302933", voicemail: true,  recording: false, forwardOnBusy: "107", forwardOnNoAnswer: "vm", ringSeconds: 30 },
  { number: "104", name: "FEELBASSVIP SYSTEM",   callerId: "18447664226", voicemail: true,  recording: false, forwardOnBusy: "vm", forwardOnNoAnswer: "vm", ringSeconds: 25 },
  { number: "105", name: "FEELBASSVIP CONF",     callerId: "18447664226", voicemail: false, recording: true,  forwardOnBusy: "vm", forwardOnNoAnswer: "vm", ringSeconds: 60 },
  { number: "106", name: "AI (ET Assistant)",    callerId: "18332302933", voicemail: false, recording: true,  forwardOnBusy: "100", forwardOnNoAnswer: "100", ringSeconds: 15 },
  { number: "107", name: "FEELBASSVIP Mobile",   callerId: "18332302933", voicemail: true,  recording: false, forwardOnBusy: "vm", forwardOnNoAnswer: "vm", ringSeconds: 30 },
];

const DEFAULT_MENUS: SubMenu[] = [
  {
    id: "main",
    name: "Main Menu (business hours)",
    greeting:
      "Thanks for calling HSS. For customer service press 1, for the Calgary office press 2, " +
      "for field tech press 3, for FeelBassVIP press 4, for our AI assistant ET press 9, " +
      "to page everyone press 8, or stay on the line for reception.",
    options: [
      { digit: "1", label: "Customer Service", target: "ext:101" },
      { digit: "2", label: "Calgary Office",   target: "ext:102" },
      { digit: "3", label: "Field Tech",       target: "ext:103" },
      { digit: "4", label: "FeelBassVIP",      target: "menu:feelbass" },
      { digit: "8", label: "Overhead Page",    target: "page:all" },
      { digit: "9", label: "Talk to ET (AI)",  target: "ext:106" },
      { digit: "0", label: "Reception",        target: "ext:100" },
    ],
    timeoutTarget: "ext:100",
  },
  {
    id: "after_hours",
    name: "After-Hours Menu",
    greeting:
      "You've reached HSS after hours. Press 1 to leave a message for customer service, " +
      "press 9 for our AI assistant ET, or press 0 for the on-call field tech.",
    options: [
      { digit: "1", label: "VM: Customer Service", target: "vm:101" },
      { digit: "9", label: "ET (AI 24/7)",         target: "ext:106" },
      { digit: "0", label: "On-call Tech",         target: "ext:107" },
    ],
    timeoutTarget: "vm:100",
  },
  {
    id: "feelbass",
    name: "FeelBassVIP Sub-Menu",
    greeting: "FeelBassVIP — press 1 for system support, 2 to join the conference bridge, 3 for mobile.",
    options: [
      { digit: "1", label: "System Support",  target: "ext:104" },
      { digit: "2", label: "Conference",      target: "ext:105" },
      { digit: "3", label: "Mobile",          target: "ext:107" },
    ],
    timeoutTarget: "ext:104",
  },
];

const DEFAULT_SCHEDULES: Schedule[] = [
  { name: "Business Hours", days: [1, 2, 3, 4, 5], start: "08:00", end: "17:00", menuId: "main" },
  { name: "Saturday",       days: [6],             start: "10:00", end: "14:00", menuId: "main" },
];

const DEFAULT_HOLIDAYS: Holiday[] = [
  { date: "2026-12-25", label: "Christmas Day",  menuId: "after_hours" },
  { date: "2026-01-01", label: "New Year's Day", menuId: "after_hours" },
];

const DEFAULT_PAGES: PageGroup[] = [
  { id: "all",     name: "All Phones",       members: ["100","101","102","103","104","106"], multicastIp: "224.0.1.116:5004", codec: "PCMU" },
  { id: "office",  name: "Calgary Office",   members: ["100","101","102"],                   multicastIp: "224.0.1.117:5004", codec: "PCMU" },
  { id: "field",   name: "Field Techs",      members: ["103","107"],                         multicastIp: "224.0.1.118:5004", codec: "OPUS" },
];

const DEFAULT_RECEPTION: ReceptionProfile = {
  deviceModel: "Yealink T54W",
  logoUrl: "",
  wallpaperUrl: "",
  screensaverText: "HSS — How can we help?",
  showQueueStats: true,
  autoAnswer: false,
  headsetMode: true,
  blfKeys: [
    { label: "CS Line",    ext: "101", type: "blf" },
    { label: "Calgary",    ext: "102", type: "blf" },
    { label: "Field",      ext: "103", type: "blf" },
    { label: "VIP Sys",    ext: "104", type: "blf" },
    { label: "VIP Conf",   ext: "105", type: "blf" },
    { label: "ET AI",      ext: "106", type: "blf" },
    { label: "Mobile",     ext: "107", type: "blf" },
    { label: "Page All",   ext: "*88", type: "page" },
    { label: "Page Office",ext: "*89", type: "page" },
    { label: "Park 1",     ext: "*85", type: "park" },
    { label: "Park 2",     ext: "*86", type: "park" },
    { label: "Voicemail",  ext: "*97", type: "speed" },
  ],
};

const DEFAULT_WIFI: WifiProfile = {
  ssid: "HSS-Voice",
  psk: "",
  security: "wpa2-psk",
  band: "5",
  roamingAggressive: true,
  handsetModel: "Yealink W73P (or Grandstream WP822)",
  dndAfterHours: true,
  vibrate: true,
  ringVolume: 7,
};

const LS_KEY = "ivr.config.v2";

type Config = {
  account: string;
  exts: Ext[];
  menus: SubMenu[];
  schedules: Schedule[];
  holidays: Holiday[];
  pages: PageGroup[];
  reception: ReceptionProfile;
  wifi: WifiProfile;
  recordAllCalls: boolean;
  moh: string;
  vmEmail: string;
};

const DEFAULT_CONFIG: Config = {
  account: "17778140621",
  exts: DEFAULT_EXTS,
  menus: DEFAULT_MENUS,
  schedules: DEFAULT_SCHEDULES,
  holidays: DEFAULT_HOLIDAYS,
  pages: DEFAULT_PAGES,
  reception: DEFAULT_RECEPTION,
  wifi: DEFAULT_WIFI,
  recordAllCalls: false,
  moh: "https://example.com/hold-music.wav",
  vmEmail: "voicemail@hss.example",
};

function IvrPage() {
  const [cfg, setCfg] = useState<Config>(DEFAULT_CONFIG);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) setCfg({ ...DEFAULT_CONFIG, ...JSON.parse(raw) });
    } catch { /* */ }
  }, []);
  useEffect(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(cfg)); } catch { /* */ }
  }, [cfg]);

  const patch = (p: Partial<Config>) => setCfg((c) => ({ ...c, ...p }));

  const targetLabel = (t: string) => {
    const [kind, val] = t.split(":");
    if (kind === "ext") return `Ext ${val}`;
    if (kind === "menu") return `Menu → ${cfg.menus.find((m) => m.id === val)?.name ?? val}`;
    if (kind === "vm") return `Voicemail ${val}`;
    if (kind === "page") return `Page group → ${cfg.pages.find((p) => p.id === val)?.name ?? val}`;
    return t;
  };
  const allTargets = useMemo(() => [
    ...cfg.exts.map((e) => ({ value: `ext:${e.number}`, label: `Ext ${e.number} — ${e.name}` })),
    ...cfg.menus.map((m) => ({ value: `menu:${m.id}`, label: `Menu: ${m.name}` })),
    ...cfg.exts.map((e) => ({ value: `vm:${e.number}`, label: `Voicemail ${e.number}` })),
    ...cfg.pages.map((p) => ({ value: `page:${p.id}`, label: `Page: ${p.name}` })),
  ], [cfg.exts, cfg.menus, cfg.pages]);

  const routingMap = useMemo(() => {
    const lines: string[] = [
      `# HSS / CallCentric IVR map — account ${cfg.account}`,
      `# Generated ${new Date().toISOString()}`,
      ``,
      `## Schedules`,
      ...cfg.schedules.map((s) => `  ${s.name.padEnd(20)} days=[${s.days.join(",")}] ${s.start}-${s.end} → menu ${s.menuId}`),
      `  (any other time) → menu after_hours`,
      ``,
      `## Holidays`,
      ...cfg.holidays.map((h) => `  ${h.date}  ${h.label.padEnd(24)} → menu ${h.menuId}`),
      ``,
    ];
    for (const m of cfg.menus) {
      lines.push(`## Menu: ${m.name}  (id=${m.id})`);
      lines.push(`   Greeting: "${m.greeting}"`);
      for (const o of m.options) {
        lines.push(`   Digit ${o.digit} → ${targetLabel(o.target).padEnd(28)} (${o.label})`);
      }
      lines.push(`   Timeout → ${targetLabel(m.timeoutTarget)}`);
      lines.push(``);
    }
    lines.push(`## Page Groups (multicast)`);
    for (const p of cfg.pages) {
      lines.push(`   ${p.name.padEnd(18)} ${p.multicastIp.padEnd(20)} codec=${p.codec}  members=${p.members.join(",")}`);
    }
    lines.push(``);
    lines.push(`## Extensions`);
    for (const e of cfg.exts) {
      lines.push(`   ${e.number}  ${e.name.padEnd(26)} CID ${e.callerId}  ring=${e.ringSeconds}s  vm=${e.voicemail?"on":"off"} rec=${e.recording?"on":"off"}  busy→${e.forwardOnBusy} noans→${e.forwardOnNoAnswer}`);
    }
    return lines.join("\n");
  }, [cfg]);

  const copy = (text: string) => { navigator.clipboard.writeText(text); toast.success("Copied"); };

  // ===== Helpers =====
  const updateExt = (i: number, p: Partial<Ext>) =>
    patch({ exts: cfg.exts.map((e, idx) => (idx === i ? { ...e, ...p } : e)) });
  const addExt = () => patch({ exts: [...cfg.exts, { number: String(100 + cfg.exts.length), name: "New ext", callerId: cfg.account, voicemail: true, recording: false, forwardOnBusy: "vm", forwardOnNoAnswer: "vm", ringSeconds: 25 }] });
  const removeExt = (i: number) => patch({ exts: cfg.exts.filter((_, idx) => idx !== i) });

  const updateMenu = (mi: number, p: Partial<SubMenu>) =>
    patch({ menus: cfg.menus.map((m, idx) => (idx === mi ? { ...m, ...p } : m)) });
  const addMenu = () => patch({ menus: [...cfg.menus, { id: `menu_${cfg.menus.length+1}`, name: "New menu", greeting: "New menu greeting", options: [], timeoutTarget: "ext:100" }] });
  const removeMenu = (mi: number) => patch({ menus: cfg.menus.filter((_, idx) => idx !== mi) });
  const addOpt = (mi: number) => updateMenu(mi, { options: [...cfg.menus[mi].options, { digit: "0", label: "New option", target: "ext:100" }] });
  const updateOpt = (mi: number, oi: number, p: Partial<MenuOpt>) =>
    updateMenu(mi, { options: cfg.menus[mi].options.map((o, idx) => (idx === oi ? { ...o, ...p } : o)) });
  const removeOpt = (mi: number, oi: number) =>
    updateMenu(mi, { options: cfg.menus[mi].options.filter((_, idx) => idx !== oi) });

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <PhoneForwarded className="h-7 w-7 text-primary" />
        <h1 className="text-3xl font-bold">IVR & Phone System</h1>
        <Badge variant="outline">CallCentric · {cfg.account}</Badge>
        <Badge variant="secondary">{cfg.menus.length} menus</Badge>
        <Badge variant="secondary">{cfg.exts.length} ext</Badge>
        <Badge variant="secondary">{cfg.pages.length} page groups</Badge>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" onClick={() => copy(routingMap)}>
            <Copy className="h-4 w-4 mr-1"/>Copy full map
          </Button>
        </div>
      </div>

      <Tabs defaultValue="menus" className="space-y-4">
        <TabsList className="grid grid-cols-3 md:grid-cols-7 w-full">
          <TabsTrigger value="menus"><PhoneForwarded className="h-4 w-4 mr-1"/>Menus</TabsTrigger>
          <TabsTrigger value="exts"><Headphones className="h-4 w-4 mr-1"/>Extensions</TabsTrigger>
          <TabsTrigger value="schedule"><Clock className="h-4 w-4 mr-1"/>Schedule</TabsTrigger>
          <TabsTrigger value="paging"><Megaphone className="h-4 w-4 mr-1"/>Paging</TabsTrigger>
          <TabsTrigger value="reception"><KeyRound className="h-4 w-4 mr-1"/>Reception</TabsTrigger>
          <TabsTrigger value="wifi"><Wifi className="h-4 w-4 mr-1"/>WiFi Handset</TabsTrigger>
          <TabsTrigger value="output"><Copy className="h-4 w-4 mr-1"/>Output</TabsTrigger>
        </TabsList>

        {/* ============ MENUS ============ */}
        <TabsContent value="menus" className="space-y-4">
          {cfg.menus.map((m, mi) => (
            <Card key={m.id}>
              <CardHeader className="flex flex-row items-center justify-between">
                <div className="flex items-center gap-2 flex-wrap">
                  <Input className="w-56 h-8" value={m.name} onChange={(e) => updateMenu(mi, { name: e.target.value })} />
                  <Badge variant="outline">id: {m.id}</Badge>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => addOpt(mi)}><Plus className="h-4 w-4 mr-1"/>Option</Button>
                  {cfg.menus.length > 1 && (
                    <Button size="sm" variant="ghost" onClick={() => removeMenu(mi)}><Trash2 className="h-4 w-4"/></Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-xs">Greeting</Label>
                  <Textarea rows={2} value={m.greeting} onChange={(e) => updateMenu(mi, { greeting: e.target.value })} />
                </div>
                <div className="space-y-2">
                  {m.options.map((o, oi) => (
                    <div key={oi} className="grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-1"><Label className="text-xs">Key</Label><Input value={o.digit} onChange={(e) => updateOpt(mi, oi, { digit: e.target.value })} /></div>
                      <div className="col-span-5"><Label className="text-xs">Label</Label><Input value={o.label} onChange={(e) => updateOpt(mi, oi, { label: e.target.value })} /></div>
                      <div className="col-span-5"><Label className="text-xs">Route to</Label>
                        <select className="w-full h-9 rounded-md border bg-background px-2 text-sm" value={o.target} onChange={(e) => updateOpt(mi, oi, { target: e.target.value })}>
                          {allTargets.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => removeOpt(mi, oi)}><Trash2 className="h-4 w-4"/></Button>
                    </div>
                  ))}
                </div>
                <div className="pt-2 border-t">
                  <Label className="text-xs">No-input timeout routes to</Label>
                  <select className="w-full md:w-1/2 h-9 rounded-md border bg-background px-2 text-sm" value={m.timeoutTarget} onChange={(e) => updateMenu(mi, { timeoutTarget: e.target.value })}>
                    {allTargets.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
              </CardContent>
            </Card>
          ))}
          <Button variant="outline" onClick={addMenu}><Plus className="h-4 w-4 mr-1"/>Add sub-menu (multi-level IVR)</Button>
        </TabsContent>

        {/* ============ EXTENSIONS ============ */}
        <TabsContent value="exts" className="space-y-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Extensions</CardTitle>
              <Button size="sm" variant="outline" onClick={addExt}><Plus className="h-4 w-4 mr-1"/>Add ext</Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {cfg.exts.map((e, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-end p-2 rounded-md border bg-card/40">
                  <div className="col-span-1"><Label className="text-xs">Ext</Label><Input value={e.number} onChange={(ev) => updateExt(i, { number: ev.target.value })} /></div>
                  <div className="col-span-3"><Label className="text-xs">Name</Label><Input value={e.name} onChange={(ev) => updateExt(i, { name: ev.target.value })} /></div>
                  <div className="col-span-2"><Label className="text-xs">Caller ID</Label><Input value={e.callerId} onChange={(ev) => updateExt(i, { callerId: ev.target.value })} /></div>
                  <div className="col-span-1"><Label className="text-xs">Ring s</Label><Input type="number" value={e.ringSeconds} onChange={(ev) => updateExt(i, { ringSeconds: Number(ev.target.value)||25 })} /></div>
                  <div className="col-span-1 flex flex-col items-center"><Label className="text-xs">VM</Label><Switch checked={e.voicemail} onCheckedChange={(v) => updateExt(i, { voicemail: v })} /></div>
                  <div className="col-span-1 flex flex-col items-center"><Label className="text-xs">Rec</Label><Switch checked={e.recording} onCheckedChange={(v) => updateExt(i, { recording: v })} /></div>
                  <div className="col-span-1"><Label className="text-xs">Busy→</Label><Input value={e.forwardOnBusy} onChange={(ev) => updateExt(i, { forwardOnBusy: ev.target.value })} /></div>
                  <div className="col-span-1"><Label className="text-xs">NoAns→</Label><Input value={e.forwardOnNoAnswer} onChange={(ev) => updateExt(i, { forwardOnNoAnswer: ev.target.value })} /></div>
                  <Button variant="ghost" size="icon" onClick={() => removeExt(i)}><Trash2 className="h-4 w-4"/></Button>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Voicemail className="h-5 w-5"/>System defaults</CardTitle></CardHeader>
            <CardContent className="grid md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">CallCentric account</Label>
                <Input value={cfg.account} onChange={(e) => patch({ account: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Voicemail email</Label>
                <Input value={cfg.vmEmail} onChange={(e) => patch({ vmEmail: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1"><Music className="h-3 w-3"/>Hold music URL</Label>
                <Input value={cfg.moh} onChange={(e) => patch({ moh: e.target.value })} />
              </div>
              <div className="md:col-span-3 flex items-center gap-3">
                <Switch checked={cfg.recordAllCalls} onCheckedChange={(v) => patch({ recordAllCalls: v })} />
                <Label className="text-sm">Record ALL calls (overrides per-extension setting)</Label>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ SCHEDULE ============ */}
        <TabsContent value="schedule" className="space-y-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5"/>Business hours</CardTitle>
              <Button size="sm" variant="outline" onClick={() => patch({ schedules: [...cfg.schedules, { name: "New rule", days: [1,2,3,4,5], start: "09:00", end: "17:00", menuId: cfg.menus[0]?.id ?? "main" }] })}>
                <Plus className="h-4 w-4 mr-1"/>Rule
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {cfg.schedules.map((s, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-end p-2 border rounded">
                  <div className="col-span-3"><Label className="text-xs">Name</Label><Input value={s.name} onChange={(e) => patch({ schedules: cfg.schedules.map((x, idx) => idx===i?{...x, name: e.target.value}:x) })} /></div>
                  <div className="col-span-3"><Label className="text-xs">Days (0=Sun..6=Sat)</Label><Input value={s.days.join(",")} onChange={(e) => patch({ schedules: cfg.schedules.map((x, idx) => idx===i?{...x, days: e.target.value.split(",").map(d=>Number(d.trim())).filter(d=>!isNaN(d))}:x) })} /></div>
                  <div className="col-span-2"><Label className="text-xs">Start</Label><Input type="time" value={s.start} onChange={(e) => patch({ schedules: cfg.schedules.map((x, idx) => idx===i?{...x, start: e.target.value}:x) })} /></div>
                  <div className="col-span-2"><Label className="text-xs">End</Label><Input type="time" value={s.end} onChange={(e) => patch({ schedules: cfg.schedules.map((x, idx) => idx===i?{...x, end: e.target.value}:x) })} /></div>
                  <div className="col-span-1"><Label className="text-xs">Menu</Label>
                    <select className="w-full h-9 rounded-md border bg-background px-2 text-sm" value={s.menuId} onChange={(e) => patch({ schedules: cfg.schedules.map((x, idx) => idx===i?{...x, menuId: e.target.value}:x) })}>
                      {cfg.menus.map((m) => <option key={m.id} value={m.id}>{m.id}</option>)}
                    </select>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => patch({ schedules: cfg.schedules.filter((_, idx) => idx !== i) })}><Trash2 className="h-4 w-4"/></Button>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">Outside any rule, callers hit the <b>after_hours</b> menu automatically.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2"><CalendarDays className="h-5 w-5"/>Holidays</CardTitle>
              <Button size="sm" variant="outline" onClick={() => patch({ holidays: [...cfg.holidays, { date: new Date().toISOString().slice(0,10), label: "New holiday", menuId: "after_hours" }] })}>
                <Plus className="h-4 w-4 mr-1"/>Holiday
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {cfg.holidays.map((h, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-end p-2 border rounded">
                  <div className="col-span-3"><Label className="text-xs">Date</Label><Input type="date" value={h.date} onChange={(e) => patch({ holidays: cfg.holidays.map((x, idx) => idx===i?{...x, date: e.target.value}:x) })} /></div>
                  <div className="col-span-6"><Label className="text-xs">Label</Label><Input value={h.label} onChange={(e) => patch({ holidays: cfg.holidays.map((x, idx) => idx===i?{...x, label: e.target.value}:x) })} /></div>
                  <div className="col-span-2"><Label className="text-xs">Menu</Label>
                    <select className="w-full h-9 rounded-md border bg-background px-2 text-sm" value={h.menuId} onChange={(e) => patch({ holidays: cfg.holidays.map((x, idx) => idx===i?{...x, menuId: e.target.value}:x) })}>
                      {cfg.menus.map((m) => <option key={m.id} value={m.id}>{m.id}</option>)}
                    </select>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => patch({ holidays: cfg.holidays.filter((_, idx) => idx !== i) })}><Trash2 className="h-4 w-4"/></Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ PAGING ============ */}
        <TabsContent value="paging" className="space-y-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2"><Megaphone className="h-5 w-5"/>Multi-Page / Intercom Groups</CardTitle>
              <Button size="sm" variant="outline" onClick={() => patch({ pages: [...cfg.pages, { id: `pg_${cfg.pages.length+1}`, name: "New group", members: [], multicastIp: `224.0.1.${120 + cfg.pages.length}:5004`, codec: "PCMU" }] })}>
                <Plus className="h-4 w-4 mr-1"/>Group
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {cfg.pages.map((p, i) => (
                <div key={p.id} className="p-3 border rounded space-y-2">
                  <div className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-3"><Label className="text-xs">Name</Label><Input value={p.name} onChange={(e) => patch({ pages: cfg.pages.map((x, idx) => idx===i?{...x, name: e.target.value}:x) })} /></div>
                    <div className="col-span-3"><Label className="text-xs">Multicast IP:port</Label><Input value={p.multicastIp} onChange={(e) => patch({ pages: cfg.pages.map((x, idx) => idx===i?{...x, multicastIp: e.target.value}:x) })} /></div>
                    <div className="col-span-2"><Label className="text-xs">Codec</Label>
                      <select className="w-full h-9 rounded-md border bg-background px-2 text-sm" value={p.codec} onChange={(e) => patch({ pages: cfg.pages.map((x, idx) => idx===i?{...x, codec: e.target.value as PageGroup["codec"]}:x) })}>
                        <option>PCMU</option><option>PCMA</option><option>OPUS</option>
                      </select>
                    </div>
                    <div className="col-span-3"><Label className="text-xs">Members (ext, comma)</Label><Input value={p.members.join(",")} onChange={(e) => patch({ pages: cfg.pages.map((x, idx) => idx===i?{...x, members: e.target.value.split(",").map(s=>s.trim()).filter(Boolean)}:x) })} /></div>
                    <Button variant="ghost" size="icon" onClick={() => patch({ pages: cfg.pages.filter((_, idx) => idx !== i) })}><Trash2 className="h-4 w-4"/></Button>
                  </div>
                </div>
              ))}
              <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
                <p><b>How phones join a page:</b> Yealink → Features → General → Multicast Listening; Grandstream → Account → SIP → Multicast Paging. Paste the same IP:port into every member's slot, in priority order (low priority is overridden by high).</p>
                <p><b>Trigger a page:</b> a menu option with target <code>page:&lt;id&gt;</code>, a BLF key of type <code>page</code>, or dial the group's feature code (we suggest *88 / *89 / *90).</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ RECEPTION ============ */}
        <TabsContent value="reception" className="space-y-3">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5"/>Reception desk phone</CardTitle></CardHeader>
            <CardContent className="grid md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Device model</Label>
                <Input value={cfg.reception.deviceModel} onChange={(e) => patch({ reception: { ...cfg.reception, deviceModel: e.target.value } })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1"><ImageIcon className="h-3 w-3"/>Logo URL (boot screen)</Label>
                <Input placeholder="https://…/logo.png  (BMP/PNG, &lt;200KB, 320×160 recommended)" value={cfg.reception.logoUrl} onChange={(e) => patch({ reception: { ...cfg.reception, logoUrl: e.target.value } })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1"><ImageIcon className="h-3 w-3"/>Wallpaper URL</Label>
                <Input placeholder="https://…/wallpaper.jpg  (480×272 for T54W)" value={cfg.reception.wallpaperUrl} onChange={(e) => patch({ reception: { ...cfg.reception, wallpaperUrl: e.target.value } })} />
              </div>
              <div className="md:col-span-3 space-y-1">
                <Label className="text-xs">Screensaver text</Label>
                <Input value={cfg.reception.screensaverText} onChange={(e) => patch({ reception: { ...cfg.reception, screensaverText: e.target.value } })} />
              </div>
              <div className="flex items-center gap-2"><Switch checked={cfg.reception.showQueueStats} onCheckedChange={(v) => patch({ reception: { ...cfg.reception, showQueueStats: v } })} /><Label className="text-sm">Show live queue stats</Label></div>
              <div className="flex items-center gap-2"><Switch checked={cfg.reception.autoAnswer} onCheckedChange={(v) => patch({ reception: { ...cfg.reception, autoAnswer: v } })} /><Label className="text-sm">Auto-answer (intercom)</Label></div>
              <div className="flex items-center gap-2"><Switch checked={cfg.reception.headsetMode} onCheckedChange={(v) => patch({ reception: { ...cfg.reception, headsetMode: v } })} /><Label className="text-sm">Headset mode on by default</Label></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Programmable keys (BLF / Speed / Park / Page)</CardTitle>
              <Button size="sm" variant="outline" onClick={() => patch({ reception: { ...cfg.reception, blfKeys: [...cfg.reception.blfKeys, { label: "Key", ext: "100", type: "blf" }] } })}>
                <Plus className="h-4 w-4 mr-1"/>Key
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {cfg.reception.blfKeys.map((k, i) => (
                  <div key={i} className="p-2 border rounded bg-card/40 space-y-1">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-[10px]">#{i+1}</Badge>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => patch({ reception: { ...cfg.reception, blfKeys: cfg.reception.blfKeys.filter((_, idx) => idx !== i) } })}><Trash2 className="h-3 w-3"/></Button>
                    </div>
                    <Input className="h-7 text-xs" value={k.label} onChange={(e) => patch({ reception: { ...cfg.reception, blfKeys: cfg.reception.blfKeys.map((x, idx) => idx===i?{...x, label: e.target.value}:x) } })} />
                    <Input className="h-7 text-xs" value={k.ext} onChange={(e) => patch({ reception: { ...cfg.reception, blfKeys: cfg.reception.blfKeys.map((x, idx) => idx===i?{...x, ext: e.target.value}:x) } })} />
                    <select className="w-full h-7 rounded-md border bg-background px-1 text-xs" value={k.type} onChange={(e) => patch({ reception: { ...cfg.reception, blfKeys: cfg.reception.blfKeys.map((x, idx) => idx===i?{...x, type: e.target.value as BlfKey["type"]}:x) } })}>
                      <option value="blf">BLF (busy lamp)</option>
                      <option value="speed">Speed dial</option>
                      <option value="park">Call park</option>
                      <option value="page">Page</option>
                    </select>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                These keys auto-populate the Yealink T54W's 27 line-keys (10 physical + expansion pages). Drag-reorder on the phone with <b>Menu → Features → DSS Keys</b>, or push via provisioning.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ WIFI ============ */}
        <TabsContent value="wifi" className="space-y-3">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Wifi className="h-5 w-5"/>Portable WiFi handset (on-the-go)</CardTitle></CardHeader>
            <CardContent className="grid md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Handset model</Label>
                <Input value={cfg.wifi.handsetModel} onChange={(e) => patch({ wifi: { ...cfg.wifi, handsetModel: e.target.value } })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">WiFi SSID</Label>
                <Input value={cfg.wifi.ssid} onChange={(e) => patch({ wifi: { ...cfg.wifi, ssid: e.target.value } })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">WiFi password</Label>
                <Input type="password" value={cfg.wifi.psk} onChange={(e) => patch({ wifi: { ...cfg.wifi, psk: e.target.value } })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Security</Label>
                <select className="w-full h-9 rounded-md border bg-background px-2 text-sm" value={cfg.wifi.security} onChange={(e) => patch({ wifi: { ...cfg.wifi, security: e.target.value as WifiProfile["security"] } })}>
                  <option value="wpa2-psk">WPA2-PSK</option>
                  <option value="wpa3-psk">WPA3-PSK</option>
                  <option value="open">Open</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Band</Label>
                <select className="w-full h-9 rounded-md border bg-background px-2 text-sm" value={cfg.wifi.band} onChange={(e) => patch({ wifi: { ...cfg.wifi, band: e.target.value as WifiProfile["band"] } })}>
                  <option value="auto">Auto</option>
                  <option value="2.4">2.4 GHz (longer range)</option>
                  <option value="5">5 GHz (less interference)</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Ring volume (0–10)</Label>
                <Input type="number" min={0} max={10} value={cfg.wifi.ringVolume} onChange={(e) => patch({ wifi: { ...cfg.wifi, ringVolume: Number(e.target.value)||7 } })} />
              </div>
              <div className="flex items-center gap-2"><Switch checked={cfg.wifi.roamingAggressive} onCheckedChange={(v) => patch({ wifi: { ...cfg.wifi, roamingAggressive: v } })} /><Label className="text-sm">Aggressive AP roaming</Label></div>
              <div className="flex items-center gap-2"><Switch checked={cfg.wifi.dndAfterHours} onCheckedChange={(v) => patch({ wifi: { ...cfg.wifi, dndAfterHours: v } })} /><Label className="text-sm">Auto-DND after hours</Label></div>
              <div className="flex items-center gap-2"><Switch checked={cfg.wifi.vibrate} onCheckedChange={(v) => patch({ wifi: { ...cfg.wifi, vibrate: v } })} /><Label className="text-sm">Vibrate on ring</Label></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">QR code pairing (scan from handset)</CardTitle></CardHeader>
            <CardContent className="flex flex-col md:flex-row gap-4 items-center">
              <img
                alt="WiFi QR"
                className="border rounded bg-white p-2"
                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(`WIFI:T:${cfg.wifi.security === "open" ? "nopass" : "WPA"};S:${cfg.wifi.ssid};P:${cfg.wifi.psk};;`)}`}
              />
              <div className="text-sm text-muted-foreground space-y-1">
                <p>Most Yealink W-series and Grandstream WP handsets accept a WiFi QR from <b>Menu → Settings → Wi-Fi → Add → Scan QR</b>.</p>
                <p>For SIP pairing, point the handset's auto-provision URL at the same provisioning server used by the desk phones (Phones page → provisioning info card).</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ OUTPUT ============ */}
        <TabsContent value="output" className="space-y-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2"><PhoneCall className="h-5 w-5"/>Generated routing map</CardTitle>
              <Button size="sm" variant="outline" onClick={() => copy(routingMap)}><Copy className="h-4 w-4 mr-1"/>Copy</Button>
            </CardHeader>
            <CardContent>
              <pre className="text-xs font-mono whitespace-pre-wrap bg-muted/40 rounded p-3 border max-h-[60vh] overflow-auto">{routingMap}</pre>
              <p className="text-xs text-muted-foreground mt-3">
                Paste this into <b>CallCentric → Features → Call Treatments / IVR</b>, or feed it to FreePBX / 3CX. Every call still hits the Desk Phones CDR webhook so ET sees and logs it regardless of which PBX answers.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Full JSON config (backup / restore)</CardTitle></CardHeader>
            <CardContent>
              <Textarea rows={10} className="font-mono text-xs" value={JSON.stringify(cfg, null, 2)} onChange={(e) => { try { setCfg(JSON.parse(e.target.value)); } catch { /* ignore */ } }} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
