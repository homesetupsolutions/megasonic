import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Phone, Send, Sparkles, Search, BellRing, ScrollText, Zap, X,
  Mic, MicOff, Volume2, VolumeX, Copy, PhoneCall, MessageSquare,
} from "lucide-react";
import { AlienHud } from "@/components/AlienHud";
import { LiveScanFeed } from "@/components/LiveScanFeed";
import { askAlien, lookupByPhone, alienNotifications } from "@/lib/alien.functions";
import {
  triggerStrategistRun, listAiRuns, listAiActions,
  getAiSettings, updateAiSettings,
} from "@/lib/strategist.functions";

export const Route = createFileRoute("/_authenticated/alien")({
  component: AlienCommandCenter,
});

type Msg = { role: "user" | "assistant"; content: string };

function AlienCommandCenter() {
  const ask = useServerFn(askAlien);
  const lookup = useServerFn(lookupByPhone);
  const notif = useServerFn(alienNotifications);
  const runStrategist = useServerFn(triggerStrategistRun);
  const runsFn = useServerFn(listAiRuns);
  const actionsFn = useServerFn(listAiActions);
  const settingsFn = useServerFn(getAiSettings);
  const updateSettings = useServerFn(updateAiSettings);

  const [expanded, setExpanded] = useState(false);
  const [phone, setPhone] = useState("");
  const [phoneData, setPhoneData] = useState<Awaited<ReturnType<typeof lookup>> | null>(null);
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "🛸 Hi! I'm your Alien. Type a phone number to pull up a customer, ask me ANYTHING about the business, or click a Quick Question below." },
  ]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [running, setRunning] = useState(false);
  const [runs, setRuns] = useState<Awaited<ReturnType<typeof runsFn>>>([]);
  const [actions, setActions] = useState<Awaited<ReturnType<typeof actionsFn>>>([]);
  const [notifs, setNotifs] = useState<Awaited<ReturnType<typeof notif>> | null>(null);
  const [activeScript, setActiveScript] = useState<{ title: string; body: string } | null>(null);
  const [listening, setListening] = useState(false);
  const [speakReplies, setSpeakReplies] = useState(false);
  const recogRef = useRef<unknown>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  // initial + polling
  useEffect(() => {
    const load = async () => {
      try {
        const [r, a, n] = await Promise.all([
          runsFn({ data: undefined as never }),
          actionsFn({ data: {} }),
          notif({ data: undefined as never }),
        ]);
        setRuns(r); setActions(a); setNotifs(n);
      } catch (e) { console.error(e); }
    };
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [runsFn, actionsFn, notif]);

  // auto scroll chat
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);

  const speak = (text: string) => {
    if (!speakReplies || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    try {
      const u = new SpeechSynthesisUtterance(text.replace(/[*_#`>-]/g, "").slice(0, 600));
      u.rate = 1.05; u.pitch = 1.25;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } catch { /* noop */ }
  };

  const send = async (override?: string) => {
    const text = (override ?? input).trim();
    if (!text || thinking) return;
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setThinking(true);
    try {
      const res = await ask({ data: { messages: next, phone: phone || null } });
      setMessages((m) => [...m, { role: "assistant", content: res.reply }]);
      speak(res.reply);
    } catch (e: unknown) {
      const err = e as Error;
      toast.error(err?.message ?? "Alien hiccup");
      setMessages((m) => [...m, { role: "assistant", content: "😵 I tripped over a wire. Try again?" }]);
    } finally {
      setThinking(false);
    }
  };

  const toggleMic = () => {
    const w = window as unknown as { SpeechRecognition?: new () => unknown; webkitSpeechRecognition?: new () => unknown };
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) { toast.error("Voice input not supported in this browser"); return; }
    if (listening) {
      try { (recogRef.current as { stop?: () => void } | null)?.stop?.(); } catch { /* noop */ }
      setListening(false); return;
    }
    const rec = new SR() as { lang: string; interimResults: boolean; onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void; onend: () => void; onerror: () => void; start: () => void; stop: () => void };
    rec.lang = "en-US"; rec.interimResults = false;
    rec.onresult = (e) => {
      const t = Array.from(e.results).map((r) => r[0].transcript).join(" ");
      setInput((v) => (v ? v + " " : "") + t);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recogRef.current = rec;
    try { rec.start(); setListening(true); } catch { setListening(false); }
  };

  const copyMsg = async (text: string) => {
    try { await navigator.clipboard.writeText(text); toast.success("Copied!"); } catch { toast.error("Copy failed"); }
  };
  const callPhone = () => {
    if (!phone.trim()) { toast.error("Enter a phone number first"); return; }
    window.location.href = `tel:${phone.replace(/[^\d+]/g, "")}`;
  };
  const textPhone = () => {
    if (!phone.trim()) { toast.error("Enter a phone number first"); return; }
    window.location.href = `sms:${phone.replace(/[^\d+]/g, "")}`;
  };

  const doLookup = async () => {
    if (!phone.trim()) return;
    try {
      const data = await lookup({ data: { phone } });
      setPhoneData(data);
      const summary = `📞 **${phone}** → ${data.customers.length} customer(s), ${data.leads.length} lead(s), ${data.bookings.length} booking(s), ${data.calls.length} call(s).`;
      setMessages((m) => [...m, { role: "assistant", content: summary }]);
      toast.success("Pulled up everything for that number");
    } catch (e: unknown) {
      toast.error((e as Error)?.message ?? "Lookup failed");
    }
  };

  const onHunt = async () => {
    setRunning(true);
    try {
      await runStrategist({ data: {} });
      toast.success("🛸 Alien is hunting!");
      const [r, a] = await Promise.all([runsFn({ data: undefined as never }), actionsFn({ data: {} })]);
      setRuns(r); setActions(a);
    } catch (e: unknown) { toast.error((e as Error)?.message ?? "Hunt failed"); }
    finally { setRunning(false); }
  };

  const onTeach = async (note: string) => {
    try {
      const s = await settingsFn({ data: undefined as never });
      const prev = s?.guidance ?? "";
      await updateSettings({ data: { guidance: (prev ? prev + "\n" : "") + "• " + note } });
      toast.success("Learned it! 🧠");
    } catch (e: unknown) { toast.error((e as Error)?.message ?? "Could not learn"); }
  };

  const quickQuestions = [
    "Who should I call RIGHT NOW to make money today?",
    "Read me the best inbound script for FeelBass.",
    "What grants can I apply for this week?",
    "Draft a follow-up text for my newest lead.",
    "What's my calendar look like?",
    "Suggest a price bump that won't lose customers.",
  ];

  const scripts = phoneData?.scripts ?? [];

  const callCount = useMemo(
    () => (notifs?.calls?.length ?? 0) + (notifs?.bookings?.length ?? 0) + (notifs?.leads?.length ?? 0),
    [notifs]
  );

  return (
    <div className="-m-6 min-h-[calc(100vh-3rem)] bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 text-white p-4 md:p-6 space-y-4">
      <AlienHud actions={actions as never} runs={runs as never} isRunning={running} onRun={onHunt} onTeach={onTeach} expanded={expanded} onToggleExpand={() => setExpanded((v) => !v)} />
      {!expanded && <LiveScanFeed />}


      <div className={"grid grid-cols-1 gap-4 " + (expanded ? "" : "lg:grid-cols-3")}>
        {/* LEFT — Phone + Scripts + Notifications */}
        <div className="space-y-4">
          <Card className="bg-black/40 border-white/10 backdrop-blur p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-pink-300">
              <Phone className="h-4 w-4" /> Phone Lookup
            </div>
            <div className="flex gap-2">
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") doLookup(); }}
                placeholder="(555) 123-4567"
                className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
              />
              <Button onClick={doLookup} className="bg-gradient-to-r from-pink-500 to-fuchsia-500">
                <Search className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <Button size="sm" variant="outline" onClick={callPhone} className="bg-white/5 border-white/20 hover:bg-emerald-500/30 text-xs"><PhoneCall className="h-3 w-3 mr-1" />Call</Button>
              <Button size="sm" variant="outline" onClick={textPhone} className="bg-white/5 border-white/20 hover:bg-cyan-500/30 text-xs"><MessageSquare className="h-3 w-3 mr-1" />Text</Button>
              <Button size="sm" variant="outline" onClick={() => send(`Draft a warm follow-up message for ${phone || "this lead"}.`)} className="bg-white/5 border-white/20 hover:bg-pink-500/30 text-xs"><Sparkles className="h-3 w-3 mr-1" />Draft</Button>
            </div>
            {phoneData && (
              <div className="text-xs space-y-2 max-h-60 overflow-auto">
                {phoneData.customers.length > 0 && (
                  <Section title="Customers">
                    {phoneData.customers.map((c: { id: string; name?: string | null; phone?: string | null }) => (
                      <Row key={c.id} label={c.name ?? "(no name)"} sub={c.phone ?? ""} />
                    ))}
                  </Section>
                )}
                {phoneData.leads.length > 0 && (
                  <Section title="Leads">
                    {phoneData.leads.map((c: { id: string; name?: string | null; status?: string | null }) => (
                      <Row key={c.id} label={c.name ?? "(no name)"} sub={c.status ?? ""} />
                    ))}
                  </Section>
                )}
                {phoneData.bookings.length > 0 && (
                  <Section title="Bookings">
                    {phoneData.bookings.map((b: { id: string; customer_name?: string | null; starts_at?: string | null }) => (
                      <Row key={b.id} label={b.customer_name ?? ""} sub={b.starts_at ? new Date(b.starts_at).toLocaleString() : ""} />
                    ))}
                  </Section>
                )}
                {phoneData.calls.length > 0 && (
                  <Section title="Recent Calls">
                    {phoneData.calls.map((c: { id: string; from_number?: string | null; status?: string | null }) => (
                      <Row key={c.id} label={c.from_number ?? ""} sub={c.status ?? ""} />
                    ))}
                  </Section>
                )}
                {phoneData.customers.length + phoneData.leads.length + phoneData.bookings.length + phoneData.calls.length === 0 && (
                  <div className="text-white/50 italic">No match — ask the alien to draft a cold outreach for this number!</div>
                )}
              </div>
            )}
          </Card>

          <Card className="bg-black/40 border-white/10 backdrop-blur p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-cyan-300">
              <ScrollText className="h-4 w-4" /> Call Scripts
            </div>
            <ScrollArea className="h-56 pr-2">
              <div className="space-y-2">
                {scripts.length === 0 && (
                  <div className="text-xs text-white/50 italic">Look up a phone number to see scripts, or click below.</div>
                )}
                {scripts.map((s: {
                  id: string; title: string; direction: string;
                  greeting?: string; qualifying_questions?: string; objection_handlers?: string;
                  closing?: string; full_script?: string;
                  organizations?: { name?: string } | null; services?: { name?: string } | null;
                }) => (
                  <button
                    key={s.id}
                    onClick={() => setActiveScript({
                      title: s.title,
                      body: s.full_script?.trim() || [
                        s.greeting && `### Greeting\n${s.greeting}`,
                        s.qualifying_questions && `### Qualify\n${s.qualifying_questions}`,
                        s.objection_handlers && `### Objections\n${s.objection_handlers}`,
                        s.closing && `### Close\n${s.closing}`,
                      ].filter(Boolean).join("\n\n"),
                    })}
                    className="w-full text-left rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 p-2 transition"
                  >
                    <div className="flex items-center gap-2">
                      <Badge className="bg-cyan-500/30 text-cyan-100 border-0 text-[10px]">{s.direction}</Badge>
                      <span className="text-sm font-semibold truncate">{s.title}</span>
                    </div>
                    <div className="text-[10px] text-white/50 mt-1">
                      {s.organizations?.name}{s.services?.name ? ` • ${s.services.name}` : ""}
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
            <Button
              variant="outline"
              size="sm"
              className="w-full bg-white/5 border-white/20 hover:bg-white/15"
              onClick={() => send("Show me ALL my call scripts and tell me which one to use right now.")}
            >
              Ask Alien which script to use
            </Button>
          </Card>

          <Card className="bg-black/40 border-white/10 backdrop-blur p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-yellow-300">
                <BellRing className="h-4 w-4" /> Notifications
              </div>
              <Badge className="bg-yellow-400 text-black border-0">{callCount}</Badge>
            </div>
            <ScrollArea className="h-44 pr-2">
              <div className="space-y-1 text-xs">
                {notifs?.actions?.slice(0, 5).map((a) => (
                  <NotifRow key={`a-${a.id}`} icon="⚡" text={a.title} status={a.status ?? ""} when={a.created_at} />
                ))}
                {notifs?.leads?.slice(0, 5).map((l) => (
                  <NotifRow key={`l-${l.id}`} icon="🧲" text={`New lead: ${l.name ?? l.phone}`} when={l.created_at} />
                ))}
                {notifs?.calls?.slice(0, 5).map((c) => (
                  <NotifRow key={`c-${c.id}`} icon="📞" text={`Call ${c.from_number ?? c.to_number}`} status={c.status ?? ""} when={c.created_at} />
                ))}
                {notifs?.bookings?.slice(0, 5).map((b) => (
                  <NotifRow key={`b-${b.id}`} icon="📅" text={`Booking ${b.customer_name ?? ""}`} when={b.scheduled_at} />
                ))}
                {!notifs?.actions?.length && !notifs?.leads?.length && !notifs?.calls?.length && !notifs?.bookings?.length && (
                  <div className="text-white/50 italic">Quiet… Hit HUNT FOR MONEY!</div>
                )}
              </div>
            </ScrollArea>
          </Card>
        </div>

        {/* RIGHT — Chat (spans 2 cols) */}
        <Card className="lg:col-span-2 bg-black/40 border-white/10 backdrop-blur p-4 flex flex-col" style={{ minHeight: 600 }}>
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-pink-300" />
            <div className="text-sm font-bold uppercase tracking-wider text-pink-300">Ask the Alien — anything</div>
          </div>

          <div className="flex flex-wrap gap-1.5 mb-3">
            {quickQuestions.map((q) => (
              <button
                key={q}
                onClick={() => send(q)}
                disabled={thinking}
                className="text-[11px] rounded-full px-2.5 py-1 bg-white/10 hover:bg-white/20 border border-white/15 transition disabled:opacity-50"
              >
                {q}
              </button>
            ))}
          </div>

          <div ref={scrollRef} className="flex-1 overflow-auto space-y-3 pr-2 min-h-0">
            {messages.map((m, i) => (
              <div key={i} className={"flex group " + (m.role === "user" ? "justify-end" : "justify-start")}>
                <div
                  className={
                    "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap leading-relaxed relative " +
                    (m.role === "user"
                      ? "bg-gradient-to-br from-pink-500 to-fuchsia-600 text-white"
                      : "bg-white/10 border border-white/15 text-white")
                  }
                >
                  {m.content}
                  {m.role === "assistant" && (
                    <div className="mt-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                      <button onClick={() => copyMsg(m.content)} className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/25 inline-flex items-center gap-1"><Copy className="h-2.5 w-2.5" />copy</button>
                      <button onClick={() => speak(m.content)} className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/25 inline-flex items-center gap-1"><Volume2 className="h-2.5 w-2.5" />speak</button>
                      <button onClick={() => send(`Expand on: "${m.content.slice(0, 120)}"`)} className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/25">↻ more</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {thinking && (
              <div className="flex justify-start">
                <div className="bg-white/10 border border-white/15 rounded-2xl px-4 py-2.5 text-sm text-white/70">
                  🛸 thinking…
                </div>
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => { e.preventDefault(); send(); }}
            className="mt-3 flex gap-2"
          >
            <Button type="button" onClick={toggleMic} title="Voice input" className={(listening ? "bg-red-500 hover:bg-red-400 animate-pulse" : "bg-white/10 hover:bg-white/20") + " border border-white/20 h-auto"}>
              {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </Button>
            <Button type="button" onClick={() => setSpeakReplies((s) => !s)} title="Read replies aloud" className={(speakReplies ? "bg-emerald-500 hover:bg-emerald-400" : "bg-white/10 hover:bg-white/20") + " border border-white/20 h-auto"}>
              {speakReplies ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </Button>
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
              }}
              placeholder={listening ? "🎤 listening… speak now" : "Type, paste a number, or hit 🎤 (Enter to send)"}
              className="bg-white/10 border-white/20 text-white placeholder:text-white/40 resize-none min-h-[48px] max-h-32"
              rows={1}
            />
            <Button type="submit" disabled={thinking} className="bg-gradient-to-r from-pink-500 to-fuchsia-500 hover:from-pink-400 hover:to-fuchsia-400 h-auto">
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </Card>
      </div>

      {/* Script overlay */}
      {activeScript && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur flex items-center justify-center p-4"
          onClick={() => setActiveScript(null)}
        >
          <Card
            className="max-w-2xl w-full max-h-[80vh] overflow-auto bg-gradient-to-br from-slate-900 to-purple-950 border-pink-500/30 p-6 text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-black bg-gradient-to-r from-pink-400 to-cyan-400 bg-clip-text text-transparent">
                <Zap className="inline h-5 w-5 mr-1 text-yellow-300" />
                {activeScript.title}
              </h2>
              <Button variant="ghost" size="icon" onClick={() => setActiveScript(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <pre className="whitespace-pre-wrap text-sm leading-relaxed font-sans">{activeScript.body || "(empty script)"}</pre>
            <Button
              className="mt-4 w-full bg-gradient-to-r from-pink-500 to-fuchsia-500"
              onClick={() => { send(`Coach me through this script step-by-step:\n\n${activeScript.body}`); setActiveScript(null); }}
            >
              Have Alien coach me through it
            </Button>
          </Card>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-white/50 mb-1">{title}</div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}
function Row({ label, sub }: { label: string; sub?: string }) {
  return (
    <div className="rounded bg-white/5 px-2 py-1 flex items-center justify-between">
      <span className="truncate font-medium">{label}</span>
      {sub && <span className="text-white/50 text-[10px] truncate ml-2">{sub}</span>}
    </div>
  );
}
function NotifRow({ icon, text, status, when }: { icon: string; text: string; status?: string; when?: string | null }) {
  return (
    <div className="flex items-center gap-2 rounded bg-white/5 px-2 py-1">
      <span>{icon}</span>
      <span className="flex-1 truncate">{text}</span>
      {status && <Badge className="bg-white/10 text-white/80 border-0 text-[10px]">{status}</Badge>}
      {when && <span className="text-[10px] text-white/40">{new Date(when).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>}
    </div>
  );
}
