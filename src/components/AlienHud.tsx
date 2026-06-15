import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Zap, Mail, CalendarCheck, Search, DollarSign, Heart, Crown, Gem, Music, VolumeX, Volume2 } from "lucide-react";

type Action = {
  id: string;
  kind: string;
  title: string;
  status: string;
  created_at: string;
};
type Run = { id: string; status: string; started_at: string; actions_count: number };

const HUNT_LINES = [
  { icon: Search,        text: "Hunting for leads on Facebook…", emoji: "🔍" },
  { icon: Mail,          text: "Drafting a fabulous cold email…", emoji: "💌" },
  { icon: CalendarCheck, text: "Slotting a booking into your calendar…", emoji: "📅" },
  { icon: DollarSign,    text: "Sniffing out a grant you qualify for…", emoji: "💰" },
  { icon: Zap,           text: "Following up on yesterday's quote…", emoji: "⚡" },
  { icon: Search,        text: "Scanning Square for upsell magic…", emoji: "✨" },
  { icon: Mail,          text: "Writing a referral ask…", emoji: "🌈" },
  { icon: DollarSign,    text: "Pricing a new FeelBass package…", emoji: "💸" },
  { icon: CalendarCheck, text: "Confirming a Home Setup appointment…", emoji: "🛋️" },
  { icon: Heart,         text: "Spreading good vibes to a happy customer…", emoji: "💖" },
];

const QUIPS = [
  "Boop! 👽",
  "Feed me leads, not lies! 🌈",
  "I sparkle when you click me ✨",
  "Press H to hunt!",
  "Pet me, I'm shy 💕",
  "I dream in $$$",
  "Your calendar called — it wants MORE",
  "Tap tap! I love attention 💖",
  "I just emailed someone. Probably.",
  "WOOHOO! 🎉",
];

const HATS = ["none", "crown", "party", "halo", "cap"] as const;
type Hat = typeof HATS[number];

// tiny WebAudio chime
function useChime(enabled: boolean) {
  const ctxRef = useRef<AudioContext | null>(null);
  return useCallback((freq = 600, dur = 0.12) => {
    if (!enabled) return;
    try {
      if (!ctxRef.current) ctxRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const ctx = ctxRef.current;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "triangle"; o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
      o.connect(g); g.connect(ctx.destination);
      o.start(); o.stop(ctx.currentTime + dur);
    } catch { /* ignore */ }
  }, [enabled]);
}

export function AlienHud({
  actions,
  runs,
  isRunning,
  onRun,
  onTeach,
}: {
  actions: Action[];
  runs: Run[];
  isRunning: boolean;
  onRun: () => void;
  onTeach: (note: string) => void;
}) {
  const latestRun = runs[0];
  const runningNow =
    isRunning ||
    (latestRun && latestRun.status === "running") ||
    (latestRun && Date.now() - new Date(latestRun.started_at).getTime() < 30_000);

  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), runningNow ? 1600 : 4000);
    return () => clearInterval(id);
  }, [runningNow]);
  const line = HUNT_LINES[tick % HUNT_LINES.length];
  const Icon = line.icon;

  const stats = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayActions = actions.filter((a) => new Date(a.created_at) >= today);
    const executed = actions.filter((a) => a.status === "executed").length;
    return {
      pending: actions.filter((a) => a.status === "pending").length,
      executed,
      todayWins: todayActions.filter((a) => a.status === "executed").length,
      hunting: todayActions.length,
      level: Math.floor(executed / 5) + 1,
      xpInLevel: executed % 5,
    };
  }, [actions]);

  // floating popups
  const [pops, setPops] = useState<Array<{ id: number; left: number; top?: number; text: string }>>([]);
  const lastExec = useRef(stats.executed);
  const addPop = useCallback((text: string, left = 30 + Math.random() * 40, top?: number) => {
    const id = Date.now() + Math.random();
    setPops((p) => [...p, { id, left, top, text }]);
    setTimeout(() => setPops((p) => p.filter((x) => x.id !== id)), 1900);
  }, []);
  useEffect(() => {
    if (stats.executed > lastExec.current) {
      const diff = stats.executed - lastExec.current;
      for (let i = 0; i < Math.min(diff, 4); i++) {
        addPop(["+1 WIN! 🌈", "CHA-CHING 💸", "SLAY 💅", "BOOKED! 📅"][i % 4]);
      }
    }
    lastExec.current = stats.executed;
  }, [stats.executed, addPop]);

  const lastTitle = actions[0]?.title;
  const [teach, setTeach] = useState("");

  // INTERACTIVITY ============================================
  const [sound, setSound] = useState(true);
  const chime = useChime(sound);
  const alienBoxRef = useRef<HTMLButtonElement>(null);
  const [eye, setEye] = useState({ x: 0, y: 0 });
  const [quip, setQuip] = useState<string | null>(null);
  const [poked, setPoked] = useState(0);
  const [danceMode, setDanceMode] = useState<"none" | "spin" | "shake" | "jump">("none");
  const [hat, setHat] = useState<Hat>("none");
  const [hearts, setHearts] = useState<Array<{ id: number; x: number; y: number }>>([]);
  const [konami, setKonami] = useState<string[]>([]);
  const [rave, setRave] = useState(false);

  // Eyes follow cursor
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const el = alienBoxRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.hypot(dx, dy) || 1;
      const max = 2.5;
      setEye({ x: (dx / dist) * Math.min(max, dist / 40), y: (dy / dist) * Math.min(max, dist / 40) });
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  const showQuip = useCallback((q?: string) => {
    setQuip(q ?? QUIPS[Math.floor(Math.random() * QUIPS.length)]);
    setTimeout(() => setQuip(null), 2200);
  }, []);

  const pokeAlien = useCallback(() => {
    setPoked((n) => n + 1);
    const moves: Array<"spin" | "shake" | "jump"> = ["spin", "shake", "jump"];
    setDanceMode(moves[Math.floor(Math.random() * moves.length)]);
    setTimeout(() => setDanceMode("none"), 700);
    showQuip();
    chime(440 + Math.random() * 400, 0.1);
    addPop(["💖", "✨", "🌈", "👽", "💫"][Math.floor(Math.random() * 5)]);
  }, [chime, showQuip, addPop]);

  const onAlienClick = () => {
    pokeAlien();
    // every 5th poke triggers a real hunt
    if ((poked + 1) % 5 === 0) {
      addPop("HUNT TIME! 🚀", 50);
      onRun();
    }
  };

  const onAlienRightClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const idx = HATS.indexOf(hat);
    setHat(HATS[(idx + 1) % HATS.length]);
    chime(800, 0.08);
    showQuip("Fashion! 👑");
  };

  // pet drag = sprinkle hearts
  const onPetMove = (e: React.MouseEvent) => {
    if (e.buttons !== 1) return;
    const el = alienBoxRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setHearts((h) => [
      ...h.slice(-12),
      { id: Date.now() + Math.random(), x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 },
    ]);
  };
  useEffect(() => {
    if (!hearts.length) return;
    const t = setTimeout(() => setHearts((h) => h.slice(1)), 900);
    return () => clearTimeout(t);
  }, [hearts]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if (typing) return;
      if (e.key.toLowerCase() === "h") { onRun(); chime(700, 0.1); addPop("HUNT! 🚀", 50); }
      else if (e.key.toLowerCase() === "p") { pokeAlien(); }
      else if (e.key.toLowerCase() === "c") { onAlienRightClick({ preventDefault() {} } as React.MouseEvent); }
      // konami: ↑↑↓↓←→←→ba
      const seq = ["ArrowUp","ArrowUp","ArrowDown","ArrowDown","ArrowLeft","ArrowRight","ArrowLeft","ArrowRight","b","a"];
      const next = [...konami, e.key].slice(-10);
      setKonami(next);
      if (next.join(",") === seq.join(",")) {
        setRave(true);
        for (let i = 0; i < 12; i++) setTimeout(() => addPop("🌈", Math.random() * 90, Math.random() * 70), i * 80);
        chime(1200, 0.2);
        setTimeout(() => setRave(false), 6000);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [konami, onRun]);

  // Mood
  const mood: "happy" | "focused" | "excited" | "sleepy" =
    runningNow ? "focused" : stats.todayWins > 3 ? "excited" : stats.todayWins > 0 ? "happy" : "sleepy";

  const danceClass =
    danceMode === "spin" ? "animate-[alien-spin_0.7s_ease-out]" :
    danceMode === "shake" ? "animate-[alien-shake_0.5s_ease-in-out_2]" :
    danceMode === "jump" ? "animate-[alien-jump_0.6s_ease-out]" :
    runningNow ? "animate-[alien-walk_1.1s_ease-in-out_infinite]" :
    "animate-[alien-bob_3s_ease-in-out_infinite]";

  return (
    <Card className={"relative overflow-hidden border-0 text-white " + (rave ? "ring-4 ring-pink-400/70" : "")}>
      <div className={"absolute inset-0 bg-gradient-to-br from-fuchsia-600 via-purple-700 to-indigo-900 " + (rave ? "animate-[hue-shift_2s_linear_infinite]" : "animate-[hue-shift_12s_linear_infinite]")} />
      <div className="absolute inset-0 bg-[linear-gradient(115deg,#ff0080_0%,#ff8c00_20%,#ffd700_40%,#00d26a_55%,#00b4ff_72%,#7a5cff_88%,#ff5cf2_100%)] opacity-30 animate-[hue-shift_18s_linear_infinite]" />
      {/* stars */}
      <div className="absolute inset-0 pointer-events-none">
        {Array.from({ length: 40 }).map((_, i) => (
          <span
            key={i}
            className="absolute rounded-full bg-white animate-pulse"
            style={{
              width: 2 + (i % 3), height: 2 + (i % 3),
              left: `${(i * 37) % 100}%`, top: `${(i * 53) % 100}%`,
              animationDelay: `${(i % 7) * 0.4}s`, animationDuration: `${1.5 + (i % 3)}s`,
              opacity: 0.6,
            }}
          />
        ))}
      </div>

      {/* +1 popups */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {pops.map((p) => (
          <div
            key={p.id}
            className="absolute text-2xl font-black drop-shadow-[0_0_8px_rgba(255,255,255,0.6)] animate-[pop-up_1.9s_ease-out_forwards]"
            style={{
              left: `${p.left}%`,
              bottom: p.top == null ? "2.5rem" : undefined,
              top: p.top != null ? `${p.top}%` : undefined,
              backgroundImage: "linear-gradient(90deg,#ff5cf2,#fde047,#4ade80,#22d3ee,#a78bfa)",
              backgroundClip: "text",
              WebkitBackgroundClip: "text",
              color: "transparent",
            }}
          >
            {p.text}
          </div>
        ))}
      </div>

      <div className="relative flex flex-col md:flex-row items-center gap-6 p-6">
        {/* Alien */}
        <div className="relative shrink-0">
          {/* speech bubble */}
          {quip && (
            <div className="absolute -top-2 left-1/2 -translate-x-1/2 -translate-y-full z-20 whitespace-nowrap bg-white text-slate-900 text-xs font-bold px-3 py-1.5 rounded-2xl shadow-lg animate-[fade-in_0.2s_ease-out]">
              {quip}
              <span className="absolute left-1/2 -bottom-1 -translate-x-1/2 w-2 h-2 bg-white rotate-45" />
            </div>
          )}
          <button
            type="button"
            ref={alienBoxRef}
            onClick={onAlienClick}
            onContextMenu={onAlienRightClick}
            onMouseMove={onPetMove}
            title="Click to poke • Right-click for hats • Drag across to pet • H=hunt, P=poke, C=hat"
            className="relative group select-none"
          >
            {/* rainbow halo */}
            <div className="absolute inset-0 -m-3 rounded-full bg-[conic-gradient(from_0deg,#ff5cf2,#fde047,#4ade80,#22d3ee,#a78bfa,#ff5cf2)] blur-xl opacity-70 animate-[spin_8s_linear_infinite]" />
            <div className={"relative h-36 w-36 " + danceClass}>
              <Alien busy={!!runningNow} mood={mood} eye={eye} hat={hat} />
            </div>
            {/* heart sprinkles */}
            <div className="absolute inset-0 pointer-events-none">
              {hearts.map((h) => (
                <span
                  key={h.id}
                  className="absolute text-lg animate-[heart-rise_0.9s_ease-out_forwards]"
                  style={{ left: `${h.x}%`, top: `${h.y}%` }}
                >💖</span>
              ))}
            </div>
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-2 w-24 rounded-full bg-black/40 blur-sm" />
            <div className="absolute -top-3 -right-2 opacity-0 group-hover:opacity-100 transition">
              <Badge className="bg-pink-500 hover:bg-pink-500 border-0">
                <Sparkles className="h-3 w-3 mr-1" /> poke
              </Badge>
            </div>
          </button>
          {/* mini action row */}
          <div className="mt-2 flex items-center justify-center gap-1">
            <button onClick={() => { const i = HATS.indexOf(hat); setHat(HATS[(i+1)%HATS.length]); chime(800,0.08); }}
              className="text-[10px] px-2 py-0.5 rounded-full bg-white/15 hover:bg-white/25 border border-white/20" title="Change hat (C)">
              <Crown className="inline h-3 w-3 mr-1" />{hat}
            </button>
            <button onClick={() => setSound((s) => !s)}
              className="text-[10px] px-2 py-0.5 rounded-full bg-white/15 hover:bg-white/25 border border-white/20" title="Toggle sound">
              {sound ? <Volume2 className="h-3 w-3" /> : <VolumeX className="h-3 w-3" />}
            </button>
            <button onClick={() => { for (let i = 0; i < 8; i++) setTimeout(() => { chime(400 + i*60, 0.08); addPop("🎵", Math.random()*80); }, i*90); }}
              className="text-[10px] px-2 py-0.5 rounded-full bg-white/15 hover:bg-white/25 border border-white/20" title="Sing!">
              <Music className="h-3 w-3" />
            </button>
            <button onClick={() => { addPop("💎", 50); chime(900,0.15); showQuip("Treat received! 🤤"); }}
              className="text-[10px] px-2 py-0.5 rounded-full bg-white/15 hover:bg-white/25 border border-white/20" title="Feed treat">
              <Gem className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* Status */}
        <div className="flex-1 min-w-0 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={"border-0 font-bold " + (runningNow
              ? "bg-emerald-400 text-black animate-pulse"
              : "bg-white/20 text-white")}>
              {runningNow ? "● HUNTING NOW" : "○ idle — POKE ME"}
            </Badge>
            <Badge className="border-0 bg-gradient-to-r from-pink-500 via-yellow-400 to-cyan-400 text-black font-bold">
              LVL {stats.level}
            </Badge>
            <Badge className="border-0 bg-white/15 text-white text-[10px]">pokes: {poked}</Badge>
            <Badge className="border-0 bg-white/15 text-white text-[10px]">mood: {mood}</Badge>
            <span className="text-xs text-white/70">
              {latestRun ? `last run ${new Date(latestRun.started_at).toLocaleTimeString()}` : "no runs yet"}
            </span>
          </div>

          <div className="space-y-1">
            <div className="h-3 w-full rounded-full bg-black/40 overflow-hidden border border-white/20">
              <div
                className="h-full bg-[linear-gradient(90deg,#ff5cf2,#fde047,#4ade80,#22d3ee,#a78bfa)] bg-[length:200%_100%] animate-[hue-shift_4s_linear_infinite] transition-all"
                style={{ width: `${(stats.xpInLevel / 5) * 100}%` }}
              />
            </div>
            <div className="text-[10px] text-white/60 uppercase tracking-wider">
              {stats.xpInLevel} / 5 wins to next level • shortcuts: H=hunt P=poke C=hat • try ↑↑↓↓←→←→ba
            </div>
          </div>

          <div key={tick} className="flex items-center gap-2 text-lg font-bold animate-[fade-in_0.5s_ease-out]">
            <span className="text-2xl">{line.emoji}</span>
            <Icon className="h-5 w-5 text-yellow-300" />
            <span className="drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">{line.text}</span>
          </div>
          {lastTitle && (
            <p className="text-sm text-white/80 truncate">
              <span className="text-white/50">latest find →</span> {lastTitle}
            </p>
          )}

          <div className="grid grid-cols-4 gap-2 pt-1 text-center">
            <Stat label="hunting" value={stats.hunting}  color="from-cyan-400 to-blue-500" />
            <Stat label="waiting" value={stats.pending}  color="from-yellow-300 to-orange-500" />
            <Stat label="today"   value={stats.todayWins} color="from-emerald-300 to-green-500" />
            <Stat label="total"   value={stats.executed}  color="from-pink-400 to-fuchsia-600" />
          </div>
        </div>

        {/* Teach + Run */}
        <div className="w-full md:w-72 space-y-2">
          <Button
            size="lg"
            className="w-full h-14 text-black font-black text-base border-0 bg-[linear-gradient(90deg,#ff5cf2,#fde047,#4ade80,#22d3ee,#a78bfa)] bg-[length:300%_100%] animate-[hue-shift_3s_linear_infinite] hover:scale-105 transition shadow-[0_0_30px_rgba(255,92,242,0.6)]"
            onClick={() => { onRun(); chime(700,0.12); addPop("HUNT! 🚀", 50); }}
            disabled={isRunning}
          >
            <Zap className="h-5 w-5 mr-2" /> {isRunning ? "HUNTING…" : "HUNT FOR MONEY (H)"}
          </Button>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!teach.trim()) return;
              onTeach(teach.trim());
              showQuip("Learned it! 🧠");
              chime(1000, 0.15);
              setTeach("");
            }}
          >
            <input
              value={teach}
              onChange={(e) => setTeach(e.target.value)}
              placeholder="Teach me a trick…"
              className="flex-1 rounded-md bg-white/15 backdrop-blur px-3 py-2 text-sm placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-pink-400 border border-white/20"
            />
            <Button type="submit" size="sm" className="bg-gradient-to-r from-pink-500 to-fuchsia-500 hover:from-pink-400 hover:to-fuchsia-400 border-0">
              <Heart className="h-4 w-4" />
            </Button>
          </form>
          <p className="text-[10px] text-white/60 leading-tight">
            Click me, right-click for hats, drag to pet, press H to hunt! 🌈
          </p>
        </div>
      </div>

      <style>{`
        @keyframes alien-bob { 0%,100% { transform: translateY(0) rotate(-3deg); } 50% { transform: translateY(-10px) rotate(3deg); } }
        @keyframes alien-walk {
          0% { transform: translateX(-8px) translateY(0) rotate(-6deg) scale(1); }
          25% { transform: translateX(0) translateY(-10px) rotate(0deg) scale(1.05); }
          50% { transform: translateX(8px) translateY(0) rotate(6deg) scale(1); }
          75% { transform: translateX(0) translateY(-10px) rotate(0deg) scale(1.05); }
          100% { transform: translateX(-8px) translateY(0) rotate(-6deg) scale(1); }
        }
        @keyframes alien-spin { from { transform: rotate(0); } to { transform: rotate(360deg) scale(1.1); } }
        @keyframes alien-shake { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-10px) rotate(-10deg); } 75% { transform: translateX(10px) rotate(10deg); } }
        @keyframes alien-jump { 0% { transform: translateY(0) scale(1); } 50% { transform: translateY(-30px) scale(1.15); } 100% { transform: translateY(0) scale(1); } }
        @keyframes alien-blink { 0%, 92%, 100% { transform: scaleY(1); } 95% { transform: scaleY(0.1); } }
        @keyframes antenna-wiggle { 0%,100% { transform: rotate(-12deg); } 50% { transform: rotate(12deg); } }
        @keyframes hue-shift { 0% { background-position: 0% 50%; filter: hue-rotate(0deg); } 100% { background-position: 200% 50%; filter: hue-rotate(360deg); } }
        @keyframes pop-up { 0% { transform: translateY(0) scale(0.6); opacity: 0; } 15% { transform: translateY(-10px) scale(1.2); opacity: 1; } 100% { transform: translateY(-90px) scale(1); opacity: 0; } }
        @keyframes heart-rise { 0% { transform: translateY(0) scale(0.5); opacity: 0; } 30% { opacity: 1; } 100% { transform: translateY(-40px) scale(1.2); opacity: 0; } }
      `}</style>
    </Card>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-lg bg-black/30 backdrop-blur px-2 py-1.5 border border-white/10">
      <div className={`text-2xl font-black bg-gradient-to-br ${color} bg-clip-text text-transparent`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-white/60 font-semibold">{label}</div>
    </div>
  );
}

function Alien({ busy, mood, eye, hat }: { busy: boolean; mood: "happy"|"focused"|"excited"|"sleepy"; eye: {x:number;y:number}; hat: Hat }) {
  const mouth =
    busy ? <ellipse cx="60" cy="76" rx="6" ry="5" fill="#0f172a"><animate attributeName="ry" values="2;6;2" dur="0.5s" repeatCount="indefinite" /></ellipse>
    : mood === "excited" ? <path d="M 48 72 Q 60 88 72 72 Z" fill="#0f172a" />
    : mood === "sleepy" ? <line x1="52" y1="78" x2="68" y2="78" stroke="#0f172a" strokeWidth="3" strokeLinecap="round" />
    : <path d="M 50 74 Q 60 84 70 74" stroke="#0f172a" strokeWidth="3" fill="#ff5cf2" strokeLinecap="round" />;

  return (
    <svg viewBox="0 0 120 120" className="h-full w-full drop-shadow-[0_0_20px_rgba(255,92,242,0.7)]">
      <defs>
        <linearGradient id="alien-body" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ff5cf2" /><stop offset="25%" stopColor="#fde047" />
          <stop offset="50%" stopColor="#4ade80" /><stop offset="75%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#a78bfa" />
        </linearGradient>
        <linearGradient id="alien-shine" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.6" /><stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g style={{ transformOrigin: "60px 28px", animation: "antenna-wiggle 1s ease-in-out infinite" }}>
        <line x1="60" y1="30" x2="60" y2="10" stroke="#fde047" strokeWidth="2.5" />
        <circle cx="60" cy="8" r="5" fill="#ff5cf2">
          <animate attributeName="r" values="4;7;4" dur="1s" repeatCount="indefinite" />
          <animate attributeName="fill" values="#ff5cf2;#fde047;#4ade80;#22d3ee;#a78bfa;#ff5cf2" dur="3s" repeatCount="indefinite" />
        </circle>
      </g>
      <ellipse cx="60" cy="55" rx="36" ry="32" fill="url(#alien-body)" />
      <ellipse cx="60" cy="48" rx="32" ry="22" fill="url(#alien-shine)" />
      <circle cx="34" cy="68" r="6" fill="#ff5cf2" opacity="0.55" />
      <circle cx="86" cy="68" r="6" fill="#ff5cf2" opacity="0.55" />
      {/* eyes that follow cursor */}
      <g style={{ transformOrigin: "48px 55px", animation: mood === "sleepy" ? undefined : "alien-blink 4s infinite" }}>
        <ellipse cx="48" cy="55" rx="9" ry={mood === "sleepy" ? 2 : 11} fill="#0f172a" />
        {mood !== "sleepy" && <circle cx={51 + eye.x} cy={51 + eye.y} r="3.5" fill="#fff" />}
      </g>
      <g style={{ transformOrigin: "72px 55px", animation: mood === "sleepy" ? undefined : "alien-blink 4s infinite" }}>
        <ellipse cx="72" cy="55" rx="9" ry={mood === "sleepy" ? 2 : 11} fill="#0f172a" />
        {mood !== "sleepy" && <circle cx={75 + eye.x} cy={51 + eye.y} r="3.5" fill="#fff" />}
      </g>
      {mouth}
      <path d="M 36 84 Q 60 100 84 84 L 84 104 Q 60 112 36 104 Z" fill="url(#alien-body)" />
      <path d="M 60 96 l -3 -3 a 2 2 0 1 1 3 -3 a 2 2 0 1 1 3 3 z" fill="#fff" opacity="0.9" />
      {busy && (
        <>
          <rect x="44" y="94" width="32" height="14" rx="2" fill="#1e293b" />
          <rect x="46" y="96" width="28" height="10" fill="#22d3ee">
            <animate attributeName="fill" values="#22d3ee;#ff5cf2;#fde047;#4ade80;#22d3ee" dur="1s" repeatCount="indefinite" />
          </rect>
        </>
      )}
      {/* HATS */}
      {hat === "crown" && (
        <g>
          <path d="M 36 28 L 44 14 L 52 24 L 60 10 L 68 24 L 76 14 L 84 28 Z" fill="#fde047" stroke="#b45309" strokeWidth="1.5" />
          <circle cx="60" cy="20" r="2" fill="#ef4444" /><circle cx="46" cy="22" r="1.5" fill="#22d3ee" /><circle cx="74" cy="22" r="1.5" fill="#4ade80" />
        </g>
      )}
      {hat === "party" && (
        <g>
          <path d="M 60 0 L 44 30 L 76 30 Z" fill="#ff5cf2" stroke="#9d174d" strokeWidth="1" />
          <circle cx="52" cy="14" r="1.5" fill="#fde047" /><circle cx="64" cy="20" r="1.5" fill="#22d3ee" /><circle cx="60" cy="0" r="3" fill="#fde047" />
        </g>
      )}
      {hat === "halo" && (
        <ellipse cx="60" cy="22" rx="26" ry="5" fill="none" stroke="#fde047" strokeWidth="3" opacity="0.95">
          <animate attributeName="stroke" values="#fde047;#ff5cf2;#22d3ee;#4ade80;#fde047" dur="3s" repeatCount="indefinite" />
        </ellipse>
      )}
      {hat === "cap" && (
        <g>
          <path d="M 30 30 Q 60 12 90 30 L 90 36 L 30 36 Z" fill="#0ea5e9" />
          <path d="M 30 34 L 100 40 L 90 36 Z" fill="#0369a1" />
        </g>
      )}
    </svg>
  );
}
