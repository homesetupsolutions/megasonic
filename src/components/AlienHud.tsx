import { useEffect, useMemo, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Zap, Mail, CalendarCheck, Search, DollarSign, Heart } from "lucide-react";

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

  // floating "+1!" popups when executed count goes up
  const [pops, setPops] = useState<Array<{ id: number; left: number; text: string }>>([]);
  const lastExec = useRef(stats.executed);
  useEffect(() => {
    if (stats.executed > lastExec.current) {
      const diff = stats.executed - lastExec.current;
      const newPops = Array.from({ length: Math.min(diff, 4) }).map((_, i) => ({
        id: Date.now() + i,
        left: 30 + Math.random() * 40,
        text: ["+1 WIN! 🌈", "CHA-CHING 💸", "SLAY 💅", "BOOKED! 📅"][i % 4],
      }));
      setPops((p) => [...p, ...newPops]);
      setTimeout(() => setPops((p) => p.slice(newPops.length)), 2000);
    }
    lastExec.current = stats.executed;
  }, [stats.executed]);

  const lastTitle = actions[0]?.title;
  const [teach, setTeach] = useState("");

  return (
    <Card className="relative overflow-hidden border-0 text-white">
      {/* Rainbow animated background */}
      <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-600 via-purple-700 to-indigo-900 animate-[hue-shift_12s_linear_infinite]" />
      <div className="absolute inset-0 bg-[linear-gradient(115deg,#ff0080_0%,#ff8c00_20%,#ffd700_40%,#00d26a_55%,#00b4ff_72%,#7a5cff_88%,#ff5cf2_100%)] opacity-30 animate-[hue-shift_18s_linear_infinite]" />
      {/* stars */}
      <div className="absolute inset-0 pointer-events-none">
        {Array.from({ length: 40 }).map((_, i) => (
          <span
            key={i}
            className="absolute rounded-full bg-white animate-pulse"
            style={{
              width: 2 + (i % 3),
              height: 2 + (i % 3),
              left: `${(i * 37) % 100}%`,
              top: `${(i * 53) % 100}%`,
              animationDelay: `${(i % 7) * 0.4}s`,
              animationDuration: `${1.5 + (i % 3)}s`,
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
            className="absolute bottom-10 text-2xl font-black drop-shadow-[0_0_8px_rgba(255,255,255,0.6)] animate-[pop-up_2s_ease-out_forwards]"
            style={{
              left: `${p.left}%`,
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
        <button
          type="button"
          onClick={onRun}
          title="Poke the alien — he loves it"
          className="relative group shrink-0"
        >
          {/* rainbow halo */}
          <div className="absolute inset-0 -m-3 rounded-full bg-[conic-gradient(from_0deg,#ff5cf2,#fde047,#4ade80,#22d3ee,#a78bfa,#ff5cf2)] blur-xl opacity-70 animate-[spin_8s_linear_infinite]" />
          <div
            className={
              "relative h-36 w-36 " +
              (runningNow
                ? "animate-[alien-walk_1.1s_ease-in-out_infinite]"
                : "animate-[alien-bob_3s_ease-in-out_infinite]")
            }
          >
            <Alien busy={!!runningNow} />
          </div>
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-2 w-24 rounded-full bg-black/40 blur-sm" />
          <div className="absolute -top-3 -right-2 opacity-0 group-hover:opacity-100 transition">
            <Badge className="bg-pink-500 hover:bg-pink-500 border-0">
              <Sparkles className="h-3 w-3 mr-1" /> poke
            </Badge>
          </div>
        </button>

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
            <span className="text-xs text-white/70">
              {latestRun ? `last run ${new Date(latestRun.started_at).toLocaleTimeString()}` : "no runs yet"}
            </span>
          </div>

          {/* XP bar */}
          <div className="space-y-1">
            <div className="h-3 w-full rounded-full bg-black/40 overflow-hidden border border-white/20">
              <div
                className="h-full bg-[linear-gradient(90deg,#ff5cf2,#fde047,#4ade80,#22d3ee,#a78bfa)] bg-[length:200%_100%] animate-[hue-shift_4s_linear_infinite] transition-all"
                style={{ width: `${(stats.xpInLevel / 5) * 100}%` }}
              />
            </div>
            <div className="text-[10px] text-white/60 uppercase tracking-wider">
              {stats.xpInLevel} / 5 wins to next level
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
            onClick={onRun}
            disabled={isRunning}
          >
            <Zap className="h-5 w-5 mr-2" /> {isRunning ? "HUNTING…" : "HUNT FOR MONEY"}
          </Button>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!teach.trim()) return;
              onTeach(teach.trim());
              setTeach("");
            }}
          >
            <input
              value={teach}
              onChange={(e) => setTeach(e.target.value)}
              placeholder="Teach me a trick…"
              className="flex-1 rounded-md bg-white/15 backdrop-blur px-3 py-2 text-sm placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-pink-400 border border-white/20"
            />
            <Button
              type="submit"
              size="sm"
              className="bg-gradient-to-r from-pink-500 to-fuchsia-500 hover:from-pink-400 hover:to-fuchsia-400 border-0"
            >
              <Heart className="h-4 w-4" />
            </Button>
          </form>
          <p className="text-[10px] text-white/60 leading-tight">
            Keep me open in a tab — I'll keep filling your calendar with rainbows 🌈
          </p>
        </div>
      </div>

      <style>{`
        @keyframes alien-bob {
          0%,100% { transform: translateY(0) rotate(-3deg); }
          50%     { transform: translateY(-10px) rotate(3deg); }
        }
        @keyframes alien-walk {
          0%   { transform: translateX(-8px) translateY(0)   rotate(-6deg) scale(1); }
          25%  { transform: translateX(0)    translateY(-10px) rotate(0deg) scale(1.05); }
          50%  { transform: translateX(8px)  translateY(0)   rotate(6deg)  scale(1); }
          75%  { transform: translateX(0)    translateY(-10px) rotate(0deg) scale(1.05); }
          100% { transform: translateX(-8px) translateY(0)   rotate(-6deg) scale(1); }
        }
        @keyframes alien-blink {
          0%, 92%, 100% { transform: scaleY(1); }
          95%           { transform: scaleY(0.1); }
        }
        @keyframes antenna-wiggle {
          0%,100% { transform: rotate(-12deg); }
          50%     { transform: rotate(12deg); }
        }
        @keyframes hue-shift {
          0%   { background-position: 0% 50%; filter: hue-rotate(0deg); }
          100% { background-position: 200% 50%; filter: hue-rotate(360deg); }
        }
        @keyframes pop-up {
          0%   { transform: translateY(0) scale(0.6); opacity: 0; }
          15%  { transform: translateY(-10px) scale(1.2); opacity: 1; }
          100% { transform: translateY(-90px) scale(1); opacity: 0; }
        }
      `}</style>
    </Card>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-lg bg-black/30 backdrop-blur px-2 py-1.5 border border-white/10">
      <div className={`text-2xl font-black bg-gradient-to-br ${color} bg-clip-text text-transparent`}>
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-wide text-white/60 font-semibold">{label}</div>
    </div>
  );
}

function Alien({ busy }: { busy: boolean }) {
  return (
    <svg viewBox="0 0 120 120" className="h-full w-full drop-shadow-[0_0_20px_rgba(255,92,242,0.7)]">
      <defs>
        <linearGradient id="alien-body" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   stopColor="#ff5cf2" />
          <stop offset="25%"  stopColor="#fde047" />
          <stop offset="50%"  stopColor="#4ade80" />
          <stop offset="75%"  stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#a78bfa" />
        </linearGradient>
        <linearGradient id="alien-shine" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* antenna */}
      <g style={{ transformOrigin: "60px 28px", animation: "antenna-wiggle 1s ease-in-out infinite" }}>
        <line x1="60" y1="30" x2="60" y2="10" stroke="#fde047" strokeWidth="2.5" />
        <circle cx="60" cy="8" r="5" fill="#ff5cf2">
          <animate attributeName="r" values="4;7;4" dur="1s" repeatCount="indefinite" />
          <animate attributeName="fill" values="#ff5cf2;#fde047;#4ade80;#22d3ee;#a78bfa;#ff5cf2" dur="3s" repeatCount="indefinite" />
        </circle>
      </g>
      {/* head */}
      <ellipse cx="60" cy="55" rx="36" ry="32" fill="url(#alien-body)" />
      <ellipse cx="60" cy="48" rx="32" ry="22" fill="url(#alien-shine)" />
      {/* cheek blush */}
      <circle cx="34" cy="68" r="6" fill="#ff5cf2" opacity="0.55" />
      <circle cx="86" cy="68" r="6" fill="#ff5cf2" opacity="0.55" />
      {/* eyes */}
      <g style={{ transformOrigin: "48px 55px", animation: "alien-blink 4s infinite" }}>
        <ellipse cx="48" cy="55" rx="9" ry="11" fill="#0f172a" />
        <circle cx="51" cy="51" r="3.5" fill="#fff" />
        <circle cx="46" cy="58" r="1.5" fill="#fff" opacity="0.7" />
      </g>
      <g style={{ transformOrigin: "72px 55px", animation: "alien-blink 4s infinite" }}>
        <ellipse cx="72" cy="55" rx="9" ry="11" fill="#0f172a" />
        <circle cx="75" cy="51" r="3.5" fill="#fff" />
        <circle cx="70" cy="58" r="1.5" fill="#fff" opacity="0.7" />
      </g>
      {/* mouth */}
      {busy ? (
        <ellipse cx="60" cy="76" rx="6" ry="5" fill="#0f172a">
          <animate attributeName="ry" values="2;6;2" dur="0.5s" repeatCount="indefinite" />
        </ellipse>
      ) : (
        <path d="M 50 74 Q 60 84 70 74" stroke="#0f172a" strokeWidth="3" fill="#ff5cf2" strokeLinecap="round" />
      )}
      {/* body */}
      <path d="M 36 84 Q 60 100 84 84 L 84 104 Q 60 112 36 104 Z" fill="url(#alien-body)" />
      {/* tiny heart on chest */}
      <path d="M 60 96 l -3 -3 a 2 2 0 1 1 3 -3 a 2 2 0 1 1 3 3 z" fill="#fff" opacity="0.9" />
      {/* laptop when busy */}
      {busy && (
        <>
          <rect x="44" y="94" width="32" height="14" rx="2" fill="#1e293b" />
          <rect x="46" y="96" width="28" height="10" fill="#22d3ee">
            <animate attributeName="fill" values="#22d3ee;#ff5cf2;#fde047;#4ade80;#22d3ee" dur="1s" repeatCount="indefinite" />
          </rect>
        </>
      )}
    </svg>
  );
}
