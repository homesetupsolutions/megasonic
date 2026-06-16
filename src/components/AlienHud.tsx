import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Zap, Mail, CalendarCheck, Search, DollarSign, Heart, Crown, Gem, Music, VolumeX, Volume2, Maximize2, Minimize2, Egg } from "lucide-react";

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
  "...hi 👽",
  "feed me leads 🌈",
  "i grow when you click me ✨",
  "press H to hunt…",
  "pet me 💕",
  "i dream in $$$",
  "more wins = bigger me",
  "tap tap 💖",
  "i'm learning…",
  "woohoo 🎉",
];

const HATS = ["none", "crown", "party", "halo", "cap"] as const;
type Hat = typeof HATS[number];

// ----- ALIEN TYPES (new species each monthly rebirth) -----
type AlienType = {
  id: string;
  name: string;
  emoji: string;
  palette: [string, string, string, string, string]; // 5 stops for body gradient
  eyeColor: string;
  antennaTip: string;
};
const ALIEN_TYPES: AlienType[] = [
  { id: "cosmic",  name: "Cosmic",   emoji: "🌌", palette: ["#ff5cf2","#fde047","#4ade80","#22d3ee","#a78bfa"], eyeColor: "#0f172a", antennaTip: "#ff5cf2" },
  { id: "lava",    name: "Lava",     emoji: "🔥", palette: ["#fde047","#fb923c","#f97316","#ef4444","#7c2d12"], eyeColor: "#0f172a", antennaTip: "#fb923c" },
  { id: "ocean",   name: "Ocean",    emoji: "🌊", palette: ["#a5f3fc","#67e8f9","#22d3ee","#0ea5e9","#1e40af"], eyeColor: "#082f49", antennaTip: "#22d3ee" },
  { id: "forest",  name: "Forest",   emoji: "🌿", palette: ["#bbf7d0","#86efac","#4ade80","#16a34a","#14532d"], eyeColor: "#052e16", antennaTip: "#84cc16" },
  { id: "candy",   name: "Candy",    emoji: "🍬", palette: ["#fbcfe8","#f9a8d4","#f472b6","#e879f9","#c084fc"], eyeColor: "#831843", antennaTip: "#f472b6" },
  { id: "shadow",  name: "Shadow",   emoji: "🌑", palette: ["#a78bfa","#8b5cf6","#6366f1","#4338ca","#1e1b4b"], eyeColor: "#fde047", antennaTip: "#a78bfa" },
  { id: "sunset",  name: "Sunset",   emoji: "🌅", palette: ["#fef08a","#fdba74","#fb7185","#e11d48","#7e22ce"], eyeColor: "#0f172a", antennaTip: "#fb7185" },
  { id: "mint",    name: "Mint",     emoji: "🍃", palette: ["#ccfbf1","#5eead4","#2dd4bf","#0d9488","#134e4a"], eyeColor: "#042f2e", antennaTip: "#2dd4bf" },
  { id: "ghost",   name: "Ghost",    emoji: "👻", palette: ["#ffffff","#e5e7eb","#cbd5e1","#94a3b8","#475569"], eyeColor: "#0f172a", antennaTip: "#c4b5fd" },
  { id: "ember",   name: "Ember",    emoji: "✨", palette: ["#fef9c3","#fde047","#facc15","#ea580c","#7c2d12"], eyeColor: "#1c1917", antennaTip: "#facc15" },
];
function getMonthEpoch(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function randomType(exceptId?: string): AlienType {
  const pool = exceptId ? ALIEN_TYPES.filter((t) => t.id !== exceptId) : ALIEN_TYPES;
  return pool[Math.floor(Math.random() * pool.length)];
}

// ----- PET GROWTH STAGES -----
type Stage = {
  key: string;
  name: string;
  emoji: string;
  // visual params
  scale: number;          // body scale
  antennas: 1 | 2 | 3;
  bodyHue: string;        // 'rainbow' | tailwind-friendly
  hasWings: boolean;
  hasAura: boolean;
  hasSparkleTrail: boolean;
  minXp: number;
};

const STAGES: Stage[] = [
  { key: "egg",     name: "Egg",          emoji: "🥚", scale: 0.55, antennas: 1, bodyHue: "soft",    hasWings: false, hasAura: false, hasSparkleTrail: false, minXp: 0  },
  { key: "hatch",   name: "Hatchling",    emoji: "🐣", scale: 0.7,  antennas: 1, bodyHue: "soft",    hasWings: false, hasAura: false, hasSparkleTrail: false, minXp: 3  },
  { key: "baby",    name: "Baby Alien",   emoji: "👶", scale: 0.82, antennas: 2, bodyHue: "pastel",  hasWings: false, hasAura: false, hasSparkleTrail: false, minXp: 8  },
  { key: "kid",     name: "Kid Alien",    emoji: "🧒", scale: 0.92, antennas: 2, bodyHue: "rainbow", hasWings: false, hasAura: false, hasSparkleTrail: false, minXp: 15 },
  { key: "teen",    name: "Teen Alien",   emoji: "🎧", scale: 1.0,  antennas: 2, bodyHue: "rainbow", hasWings: false, hasAura: true,  hasSparkleTrail: false, minXp: 25 },
  { key: "adult",   name: "Adult Alien",  emoji: "👽", scale: 1.08, antennas: 2, bodyHue: "rainbow", hasWings: true,  hasAura: true,  hasSparkleTrail: false, minXp: 40 },
  { key: "cosmic",  name: "Cosmic Form",  emoji: "🌌", scale: 1.15, antennas: 3, bodyHue: "rainbow", hasWings: true,  hasAura: true,  hasSparkleTrail: true,  minXp: 65 },
  { key: "deity",   name: "Money Deity",  emoji: "💎", scale: 1.22, antennas: 3, bodyHue: "rainbow", hasWings: true,  hasAura: true,  hasSparkleTrail: true,  minXp: 100 },
];

function stageFor(xp: number): { stage: Stage; next?: Stage; toNext: number; progress: number } {
  let current = STAGES[0];
  for (const s of STAGES) if (xp >= s.minXp) current = s;
  const idx = STAGES.indexOf(current);
  const next = STAGES[idx + 1];
  const toNext = next ? Math.max(0, next.minXp - xp) : 0;
  const span = next ? next.minXp - current.minXp : 1;
  const progress = next ? Math.min(1, (xp - current.minXp) / span) : 1;
  return { stage: current, next, toNext, progress };
}

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
      g.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.02);
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
  expanded = false,
  onToggleExpand,
}: {
  actions: Action[];
  runs: Run[];
  isRunning: boolean;
  onRun: () => void;
  onTeach: (note: string) => void;
  expanded?: boolean;
  onToggleExpand?: () => void;
}) {
  const latestRun = runs[0];
  const runningNow =
    isRunning ||
    (latestRun && latestRun.status === "running") ||
    (latestRun && Date.now() - new Date(latestRun.started_at).getTime() < 30_000);

  // slower tick rotation for hunt lines
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), runningNow ? 4500 : 9000);
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
    };
  }, [actions]);

  // persistent XP: real wins + manual "treat" pets, stored locally so growth persists
  const [bonusXp, setBonusXp] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    return Number(localStorage.getItem("alien.bonusXp") || 0);
  });
  // baseline = stats.executed at last rebirth; subtract so each life starts at 0 wins
  const [baseline, setBaseline] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    return Number(localStorage.getItem("alien.baseline") || 0);
  });
  // alien species (rerolled each monthly rebirth)
  const [typeId, setTypeId] = useState<string>(() => {
    if (typeof window === "undefined") return ALIEN_TYPES[0].id;
    return localStorage.getItem("alien.typeId") || ALIEN_TYPES[0].id;
  });
  const alienType = useMemo(
    () => ALIEN_TYPES.find((t) => t.id === typeId) ?? ALIEN_TYPES[0],
    [typeId]
  );

  const xp = Math.max(0, stats.executed - baseline) + bonusXp;
  const { stage, next, toNext, progress } = stageFor(xp);

  const [petName, setPetName] = useState<string>(() => {
    if (typeof window === "undefined") return "ET";
    return localStorage.getItem("alien.name") || "ET";
  });
  const [editingName, setEditingName] = useState(false);

  useEffect(() => { try { localStorage.setItem("alien.name", petName); } catch { /* */ } }, [petName]);
  useEffect(() => { try { localStorage.setItem("alien.bonusXp", String(bonusXp)); } catch { /* */ } }, [bonusXp]);
  useEffect(() => { try { localStorage.setItem("alien.baseline", String(baseline)); } catch { /* */ } }, [baseline]);
  useEffect(() => { try { localStorage.setItem("alien.typeId", typeId); } catch { /* */ } }, [typeId]);

  // floating popups
  const [pops, setPops] = useState<Array<{ id: number; left: number; top?: number; text: string }>>([]);
  const lastExec = useRef(stats.executed);
  const lastStage = useRef(stage.key);
  const addPop = useCallback((text: string, left = 30 + Math.random() * 40, top?: number) => {
    const id = Date.now() + Math.random();
    setPops((p) => [...p, { id, left, top, text }]);
    setTimeout(() => setPops((p) => p.filter((x) => x.id !== id)), 2400);
  }, []);
  useEffect(() => {
    if (stats.executed > lastExec.current) {
      const diff = stats.executed - lastExec.current;
      for (let i = 0; i < Math.min(diff, 3); i++) {
        addPop(["+1 win 🌈", "cha-ching 💸", "slay 💅", "booked 📅"][i % 4]);
      }
    }
    lastExec.current = stats.executed;
  }, [stats.executed, addPop]);

  // Evolution celebration
  const [evolveBurst, setEvolveBurst] = useState(false);
  useEffect(() => {
    if (stage.key !== lastStage.current) {
      lastStage.current = stage.key;
      setEvolveBurst(true);
      addPop(`EVOLVED → ${stage.name}!`, 50);
      for (let i = 0; i < 10; i++) setTimeout(() => addPop("✨", Math.random() * 90, 30 + Math.random()*30), i * 120);
      setTimeout(() => setEvolveBurst(false), 4500);
    }
  }, [stage, addPop]);

  // Monthly rebirth — on the 1st of each month the alien becomes an egg
  // again with a brand-new randomly-chosen species. Checked on mount + hourly.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const check = () => {
      const epoch = getMonthEpoch();
      const stored = localStorage.getItem("alien.epoch");
      if (!stored) {
        localStorage.setItem("alien.epoch", epoch);
        if (!localStorage.getItem("alien.typeId")) {
          const t = randomType();
          localStorage.setItem("alien.typeId", t.id);
          setTypeId(t.id);
        }
        return;
      }
      if (stored !== epoch) {
        // REBIRTH! Reset xp baseline + bonus, reroll species, drop to egg
        localStorage.setItem("alien.epoch", epoch);
        const t = randomType(localStorage.getItem("alien.typeId") || undefined);
        setBaseline(stats.executed);
        setBonusXp(0);
        setTypeId(t.id);
        addPop(`🥚 REBIRTH → ${t.name} ${t.emoji}!`, 50);
        for (let i = 0; i < 14; i++) {
          setTimeout(() => addPop(["✨","🌈","🥚","💫"][i % 4], Math.random() * 90, Math.random() * 60), i * 120);
        }
      }
    };
    check();
    const id = setInterval(check, 60 * 60 * 1000);
    return () => clearInterval(id);
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

  // Eyes follow cursor (smoothed)
  useEffect(() => {
    let raf = 0;
    let target = { x: 0, y: 0 };
    let current = { x: 0, y: 0 };
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
      target = { x: (dx / dist) * Math.min(max, dist / 60), y: (dy / dist) * Math.min(max, dist / 60) };
    };
    const loop = () => {
      // ease toward target so eyes drift slowly
      current.x += (target.x - current.x) * 0.08;
      current.y += (target.y - current.y) * 0.08;
      setEye({ x: current.x, y: current.y });
      raf = requestAnimationFrame(loop);
    };
    window.addEventListener("mousemove", onMove);
    raf = requestAnimationFrame(loop);
    return () => { window.removeEventListener("mousemove", onMove); cancelAnimationFrame(raf); };
  }, []);

  const showQuip = useCallback((q?: string) => {
    setQuip(q ?? QUIPS[Math.floor(Math.random() * QUIPS.length)]);
    setTimeout(() => setQuip(null), 3200);
  }, []);

  const pokeAlien = useCallback(() => {
    setPoked((n) => n + 1);
    const moves: Array<"spin" | "shake" | "jump"> = ["spin", "shake", "jump"];
    setDanceMode(moves[Math.floor(Math.random() * moves.length)]);
    setTimeout(() => setDanceMode("none"), 1100);
    showQuip();
    chime(440 + Math.random() * 400, 0.12);
    addPop(["💖", "✨", "🌈", "👽", "💫"][Math.floor(Math.random() * 5)]);
  }, [chime, showQuip, addPop]);

  const onAlienClick = () => {
    pokeAlien();
    // every 8th poke triggers a real hunt (less frantic)
    if ((poked + 1) % 8 === 0) {
      addPop("HUNT TIME! 🚀", 50);
      onRun();
    }
  };

  const onAlienRightClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const idx = HATS.indexOf(hat);
    setHat(HATS[(idx + 1) % HATS.length]);
    chime(800, 0.1);
    showQuip("fashion 👑");
  };

  // pet drag = sprinkle hearts (throttled)
  const lastPet = useRef(0);
  const onPetMove = (e: React.MouseEvent) => {
    if (e.buttons !== 1) return;
    const now = Date.now();
    if (now - lastPet.current < 120) return;
    lastPet.current = now;
    const el = alienBoxRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setHearts((h) => [
      ...h.slice(-8),
      { id: now + Math.random(), x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 },
    ]);
  };
  useEffect(() => {
    if (!hearts.length) return;
    const t = setTimeout(() => setHearts((h) => h.slice(1)), 1300);
    return () => clearTimeout(t);
  }, [hearts]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if (typing) return;
      if (e.key.toLowerCase() === "h") { onRun(); chime(700, 0.12); addPop("HUNT! 🚀", 50); }
      else if (e.key.toLowerCase() === "p") { pokeAlien(); }
      else if (e.key.toLowerCase() === "c") { onAlienRightClick({ preventDefault() {} } as React.MouseEvent); }
      const seq = ["ArrowUp","ArrowUp","ArrowDown","ArrowDown","ArrowLeft","ArrowRight","ArrowLeft","ArrowRight","b","a"];
      const nxt = [...konami, e.key].slice(-10);
      setKonami(nxt);
      if (nxt.join(",") === seq.join(",")) {
        setRave(true);
        for (let i = 0; i < 12; i++) setTimeout(() => addPop("🌈", Math.random() * 90, Math.random() * 70), i * 120);
        chime(1200, 0.25);
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
    danceMode === "spin" ? "animate-[alien-spin_1.1s_ease-out]" :
    danceMode === "shake" ? "animate-[alien-shake_0.9s_ease-in-out_1]" :
    danceMode === "jump" ? "animate-[alien-jump_1s_ease-out]" :
    runningNow ? "animate-[alien-walk_2.8s_ease-in-out_infinite]" :
    mood === "sleepy" ? "animate-[alien-breathe_6s_ease-in-out_infinite]" :
    "animate-[alien-bob_6s_ease-in-out_infinite]";

  return (
    <Card className={"relative overflow-hidden border-0 text-white " + (rave ? "ring-4 ring-pink-400/70" : "")}>
      <div className={"absolute inset-0 bg-gradient-to-br from-fuchsia-700 via-purple-800 to-indigo-950 " + (rave ? "animate-[hue-shift_3s_linear_infinite]" : "animate-[hue-shift_40s_linear_infinite]")} />
      <div className="absolute inset-0 bg-[linear-gradient(115deg,#ff0080_0%,#ff8c00_20%,#ffd700_40%,#00d26a_55%,#00b4ff_72%,#7a5cff_88%,#ff5cf2_100%)] opacity-20 animate-[hue-shift_60s_linear_infinite]" />
      {/* stars */}
      <div className="absolute inset-0 pointer-events-none">
        {Array.from({ length: 28 }).map((_, i) => (
          <span
            key={i}
            className="absolute rounded-full bg-white"
            style={{
              width: 2 + (i % 3), height: 2 + (i % 3),
              left: `${(i * 37) % 100}%`, top: `${(i * 53) % 100}%`,
              opacity: 0.35 + ((i % 3) * 0.15),
            }}
          />
        ))}
      </div>

      {/* popups */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {pops.map((p) => (
          <div
            key={p.id}
            className="absolute text-xl font-black drop-shadow-[0_0_8px_rgba(255,255,255,0.6)] animate-[pop-up_2.3s_ease-out_forwards]"
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
            <div className="absolute -top-2 left-1/2 -translate-x-1/2 -translate-y-full z-20 whitespace-nowrap bg-white text-slate-900 text-xs font-bold px-3 py-1.5 rounded-2xl shadow-lg animate-[fade-in_0.4s_ease-out]">
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
            title="Click to poke • Right-click for hats • Drag to pet • H=hunt, P=poke, C=hat"
            className="relative group select-none"
          >
            {/* aura (only later stages) */}
            {stage.hasAura && (
              <div className={"absolute inset-0 -m-3 rounded-full bg-[conic-gradient(from_0deg,#ff5cf2,#fde047,#4ade80,#22d3ee,#a78bfa,#ff5cf2)] blur-xl opacity-50 animate-[spin_20s_linear_infinite] " + (evolveBurst ? "opacity-80" : "")} />
            )}
            <div className={"relative transition-all duration-700 ease-out " + (expanded ? "h-72 w-72 md:h-96 md:w-96" : "h-40 w-40") + " " + danceClass} style={{ transform: `scale(${stage.scale * (expanded ? 1.15 : 1)})` }}>
              <Alien busy={!!runningNow} mood={mood} eye={eye} hat={hat} stage={stage} palette={alienType.palette} eyeColor={alienType.eyeColor} antennaTip={alienType.antennaTip} />
            </div>
            {/* heart sprinkles */}
            <div className="absolute inset-0 pointer-events-none">
              {hearts.map((h) => (
                <span
                  key={h.id}
                  className="absolute text-lg animate-[heart-rise_1.2s_ease-out_forwards]"
                  style={{ left: `${h.x}%`, top: `${h.y}%` }}
                >💖</span>
              ))}
            </div>
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-2 w-24 rounded-full bg-black/40 blur-sm" />
          </button>
          {/* mini action row */}
          <div className="mt-3 flex items-center justify-center gap-1 flex-wrap">
            <button onClick={() => { const i = HATS.indexOf(hat); setHat(HATS[(i+1)%HATS.length]); chime(800,0.08); }}
              className="text-[10px] px-2 py-0.5 rounded-full bg-white/15 hover:bg-white/25 border border-white/20" title="Change hat (C)">
              <Crown className="inline h-3 w-3 mr-1" />{hat}
            </button>
            <button onClick={() => setSound((s) => !s)}
              className="text-[10px] px-2 py-0.5 rounded-full bg-white/15 hover:bg-white/25 border border-white/20" title="Toggle sound">
              {sound ? <Volume2 className="h-3 w-3" /> : <VolumeX className="h-3 w-3" />}
            </button>
            <button onClick={() => { for (let i = 0; i < 5; i++) setTimeout(() => { chime(400 + i*80, 0.1); addPop("🎵", Math.random()*80); }, i*180); }}
              className="text-[10px] px-2 py-0.5 rounded-full bg-white/15 hover:bg-white/25 border border-white/20" title="Sing!">
              <Music className="h-3 w-3" />
            </button>
            <button onClick={() => { addPop("💎+1xp", 50); chime(900,0.18); showQuip("nom 🤤"); setBonusXp((x) => x + 1); }}
              className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-400/30 hover:bg-yellow-400/50 border border-yellow-200/40" title="Feed treat (+1 XP)">
              <Gem className="h-3 w-3 inline mr-1" />feed
            </button>
          </div>
        </div>

        {/* Status */}
        <div className="flex-1 min-w-0 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            {editingName ? (
              <input
                autoFocus
                value={petName}
                onChange={(e) => setPetName(e.target.value.slice(0, 20))}
                onBlur={() => setEditingName(false)}
                onKeyDown={(e) => { if (e.key === "Enter") setEditingName(false); }}
                className="bg-white/20 text-white font-bold rounded px-2 py-0.5 text-sm w-32"
              />
            ) : (
              <button onClick={() => setEditingName(true)} className="text-base font-black tracking-wide hover:underline" title="Rename your pet">
                {petName}
              </button>
            )}
            <Badge className="border-0 bg-gradient-to-r from-pink-500 via-yellow-400 to-cyan-400 text-black font-bold">
              {stage.emoji} {stage.name}
            </Badge>
            <Badge className="border-0 bg-white/20 text-white font-bold" title="Species — rerolled on the 1st of each month">
              {alienType.emoji} {alienType.name}
            </Badge>
            <Badge className={"border-0 font-bold " + (runningNow
              ? "bg-emerald-400 text-black animate-pulse"
              : "bg-white/20 text-white")}>
              {runningNow ? "● hunting" : "○ resting"}
            </Badge>
            <Badge className="border-0 bg-white/15 text-white text-[10px]">mood: {mood}</Badge>
            {onToggleExpand && (
              <button
                onClick={onToggleExpand}
                title={expanded ? "Collapse — show all windows" : "Expand — hide windows & make alien bigger"}
                className="ml-auto inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full bg-white/15 hover:bg-white/30 border border-white/25 font-bold uppercase tracking-wider"
              >
                {expanded ? <><Minimize2 className="h-3 w-3" /> collapse</> : <><Maximize2 className="h-3 w-3" /> expand</>}
              </button>
            )}
          </div>

          <div className="space-y-1">
            <div className="h-3 w-full rounded-full bg-black/40 overflow-hidden border border-white/20">
              <div
                className="h-full bg-[linear-gradient(90deg,#ff5cf2,#fde047,#4ade80,#22d3ee,#a78bfa)] bg-[length:200%_100%] animate-[hue-shift_10s_linear_infinite] transition-all duration-700"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
            <div className="text-[10px] text-white/70 uppercase tracking-wider">
              {next ? <>xp {xp} • {toNext} more wins until <b>{next.name}</b> {next.emoji}</> : <>maxed out — pure cosmic energy ✨</>}
              <span className="text-white/40"> • H=hunt P=poke C=hat</span>
            </div>
          </div>

          <div key={tick} className="flex items-center gap-2 text-base font-bold animate-[fade-in_0.8s_ease-out]">
            <span className="text-xl">{line.emoji}</span>
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
            className="w-full h-14 text-black font-black text-base border-0 bg-[linear-gradient(90deg,#ff5cf2,#fde047,#4ade80,#22d3ee,#a78bfa)] bg-[length:300%_100%] animate-[hue-shift_10s_linear_infinite] hover:scale-[1.02] transition shadow-[0_0_30px_rgba(255,92,242,0.5)]"
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
              showQuip("learned it 🧠");
              chime(1000, 0.18);
              setBonusXp((x) => x + 2);
              setTeach("");
            }}
          >
            <input
              value={teach}
              onChange={(e) => setTeach(e.target.value)}
              placeholder="Teach me a trick… (+2 xp)"
              className="flex-1 rounded-md bg-white/15 backdrop-blur px-3 py-2 text-sm placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-pink-400 border border-white/20"
            />
            <Button type="submit" size="sm" className="bg-gradient-to-r from-pink-500 to-fuchsia-500 hover:from-pink-400 hover:to-fuchsia-400 border-0">
              <Heart className="h-4 w-4" />
            </Button>
          </form>
          <p className="text-[10px] text-white/60 leading-tight">
            {petName} grows every time a hunt scores a win. feed treats or teach tricks to help them level up. 🌈
          </p>
        </div>
      </div>

      <style>{`
        @keyframes alien-breathe { 0%,100% { transform: translateY(0) scale(1); } 50% { transform: translateY(-2px) scale(1.02); } }
        @keyframes alien-bob { 0%,100% { transform: translateY(0) rotate(-2deg); } 50% { transform: translateY(-6px) rotate(2deg); } }
        @keyframes alien-walk {
          0% { transform: translateX(-4px) translateY(0) rotate(-3deg); }
          50% { transform: translateX(4px) translateY(-6px) rotate(3deg); }
          100% { transform: translateX(-4px) translateY(0) rotate(-3deg); }
        }
        @keyframes alien-spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }
        @keyframes alien-shake { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-6px) rotate(-5deg); } 75% { transform: translateX(6px) rotate(5deg); } }
        @keyframes alien-jump { 0% { transform: translateY(0); } 50% { transform: translateY(-20px) scale(1.08); } 100% { transform: translateY(0); } }
        @keyframes alien-blink { 0%, 94%, 100% { transform: scaleY(1); } 97% { transform: scaleY(0.1); } }
        @keyframes antenna-wiggle { 0%,100% { transform: rotate(-6deg); } 50% { transform: rotate(6deg); } }
        @keyframes hue-shift { 0% { background-position: 0% 50%; } 100% { background-position: 200% 50%; } }
        @keyframes pop-up { 0% { transform: translateY(0) scale(0.6); opacity: 0; } 15% { transform: translateY(-10px) scale(1.15); opacity: 1; } 100% { transform: translateY(-70px) scale(1); opacity: 0; } }
        @keyframes heart-rise { 0% { transform: translateY(0) scale(0.5); opacity: 0; } 30% { opacity: 1; } 100% { transform: translateY(-30px) scale(1.1); opacity: 0; } }
        @keyframes wing-flap { 0%,100% { transform: scaleX(1) rotate(0deg); } 50% { transform: scaleX(0.85) rotate(-6deg); } }
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

function Alien({ busy, mood, eye, hat, stage, palette, eyeColor, antennaTip }: { busy: boolean; mood: "happy"|"focused"|"excited"|"sleepy"; eye: {x:number;y:number}; hat: Hat; stage: Stage; palette: [string,string,string,string,string]; eyeColor: string; antennaTip: string }) {
  // EGG stage: render an egg tinted with the current species palette
  if (stage.key === "egg") {
    return (
      <svg viewBox="0 0 120 120" className="h-full w-full drop-shadow-[0_0_18px_rgba(255,92,242,0.5)]">
        <defs>
          <linearGradient id="egg-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={palette[0]} />
            <stop offset="100%" stopColor={palette[2]} />
          </linearGradient>
        </defs>
        <ellipse cx="60" cy="68" rx="32" ry="40" fill="url(#egg-grad)" stroke={palette[3]} strokeWidth="1.5" />
        <circle cx="50" cy="55" r="3" fill={palette[3]} opacity="0.7" />
        <circle cx="70" cy="78" r="2.5" fill={palette[4]} opacity="0.7" />
        <circle cx="62" cy="40" r="2" fill={palette[1]} opacity="0.7" />
        <ellipse cx="50" cy="48" rx="8" ry="3" fill="#ffffff" opacity="0.6" />
      </svg>
    );
  }

  const fillBody = "url(#alien-body-rainbow)";

  const mouth =
    busy ? <ellipse cx="60" cy="76" rx="6" ry="5" fill="#0f172a"><animate attributeName="ry" values="2;6;2" dur="1.2s" repeatCount="indefinite" /></ellipse>
    : mood === "excited" ? <path d="M 48 72 Q 60 86 72 72 Z" fill="#0f172a" />
    : mood === "sleepy" ? <line x1="52" y1="78" x2="68" y2="78" stroke="#0f172a" strokeWidth="3" strokeLinecap="round" />
    : <path d="M 50 74 Q 60 82 70 74" stroke="#0f172a" strokeWidth="3" fill="none" strokeLinecap="round" />;

  return (
    <svg viewBox="0 0 120 120" className="h-full w-full drop-shadow-[0_0_20px_rgba(255,92,242,0.6)]">
      <defs>
        <linearGradient id="alien-body-rainbow" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={palette[0]} /><stop offset="25%" stopColor={palette[1]} />
          <stop offset="50%" stopColor={palette[2]} /><stop offset="75%" stopColor={palette[3]} />
          <stop offset="100%" stopColor={palette[4]} />
        </linearGradient>
        <linearGradient id="alien-shine" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" /><stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* WINGS (adult+) */}
      {stage.hasWings && (
        <g style={{ transformOrigin: "60px 60px", animation: "wing-flap 2.6s ease-in-out infinite" }}>
          <ellipse cx="22" cy="60" rx="14" ry="22" fill={fillBody} opacity="0.55" />
          <ellipse cx="98" cy="60" rx="14" ry="22" fill={fillBody} opacity="0.55" />
        </g>
      )}

      {/* ANTENNAS */}
      {Array.from({ length: stage.antennas }).map((_, i) => {
        const offset = stage.antennas === 1 ? 0 : (i - (stage.antennas - 1) / 2) * 12;
        return (
          <g key={i} style={{ transformOrigin: `${60 + offset}px 30px`, animation: `antenna-wiggle ${2.4 + i * 0.3}s ease-in-out infinite` }}>
            <line x1={60 + offset} y1="30" x2={60 + offset} y2="12" stroke={palette[1]} strokeWidth="2.5" />
            <circle cx={60 + offset} cy="10" r="4.5" fill={antennaTip}>
              <animate attributeName="r" values="3.5;5.5;3.5" dur="2.4s" repeatCount="indefinite" />
              <animate attributeName="fill" values={`${palette[0]};${palette[1]};${palette[2]};${palette[3]};${palette[4]};${palette[0]}`} dur="8s" repeatCount="indefinite" />
            </circle>
          </g>
        );
      })}

      <ellipse cx="60" cy="55" rx="36" ry="32" fill={fillBody} />
      <ellipse cx="60" cy="48" rx="32" ry="22" fill="url(#alien-shine)" />
      <circle cx="34" cy="68" r="6" fill={palette[0]} opacity="0.45" />
      <circle cx="86" cy="68" r="6" fill={palette[0]} opacity="0.45" />

      {/* eyes */}
      <g style={{ transformOrigin: "48px 55px", animation: mood === "sleepy" ? undefined : "alien-blink 6s infinite" }}>
        <ellipse cx="48" cy="55" rx="9" ry={mood === "sleepy" ? 2 : 11} fill={eyeColor} />
        {mood !== "sleepy" && <circle cx={51 + eye.x} cy={51 + eye.y} r="3.5" fill="#fff" />}
      </g>
      <g style={{ transformOrigin: "72px 55px", animation: mood === "sleepy" ? undefined : "alien-blink 6s infinite" }}>
        <ellipse cx="72" cy="55" rx="9" ry={mood === "sleepy" ? 2 : 11} fill={eyeColor} />
        {mood !== "sleepy" && <circle cx={75 + eye.x} cy={51 + eye.y} r="3.5" fill="#fff" />}
      </g>
      {mouth}

      <path d="M 36 84 Q 60 100 84 84 L 84 104 Q 60 112 36 104 Z" fill={fillBody} />
      <path d="M 60 96 l -3 -3 a 2 2 0 1 1 3 -3 a 2 2 0 1 1 3 3 z" fill="#fff" opacity="0.9" />
      {busy && (
        <>
          <rect x="44" y="94" width="32" height="14" rx="2" fill="#1e293b" />
          <rect x="46" y="96" width="28" height="10" fill="#22d3ee">
            <animate attributeName="fill" values="#22d3ee;#ff5cf2;#fde047;#4ade80;#22d3ee" dur="2.8s" repeatCount="indefinite" />
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
          <animate attributeName="stroke" values="#fde047;#ff5cf2;#22d3ee;#4ade80;#fde047" dur="8s" repeatCount="indefinite" />
        </ellipse>
      )}
      {hat === "cap" && (
        <g>
          <path d="M 30 30 Q 60 12 90 30 L 90 36 L 30 36 Z" fill="#0ea5e9" />
          <path d="M 30 34 L 100 40 L 90 36 Z" fill="#0369a1" />
        </g>
      )}

      {/* sparkle trail for cosmic+ */}
      {stage.hasSparkleTrail && (
        <g>
          <circle cx="20" cy="100" r="2" fill="#fde047"><animate attributeName="opacity" values="0;1;0" dur="2s" repeatCount="indefinite" /></circle>
          <circle cx="100" cy="105" r="2" fill="#22d3ee"><animate attributeName="opacity" values="0;1;0" dur="2.4s" repeatCount="indefinite" /></circle>
          <circle cx="60" cy="115" r="2" fill="#ff5cf2"><animate attributeName="opacity" values="0;1;0" dur="2.8s" repeatCount="indefinite" /></circle>
        </g>
      )}
    </svg>
  );
}
