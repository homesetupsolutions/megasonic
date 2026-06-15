import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Zap, Mail, CalendarCheck, Search, DollarSign } from "lucide-react";

type Action = {
  id: string;
  kind: string;
  title: string;
  status: string;
  created_at: string;
};
type Run = { id: string; status: string; started_at: string; actions_count: number };

const HUNT_LINES = [
  { icon: Search,        text: "Hunting for leads on Facebook…" },
  { icon: Mail,          text: "Drafting a cold email to a hot lead…" },
  { icon: CalendarCheck, text: "Booking a slot on your calendar…" },
  { icon: DollarSign,    text: "Sniffing out a grant you qualify for…" },
  { icon: Zap,           text: "Following up on yesterday's quote…" },
  { icon: Search,        text: "Scanning Square for upsell opportunities…" },
  { icon: Mail,          text: "Writing a referral ask to a happy customer…" },
  { icon: DollarSign,    text: "Pricing a new FeelBass package…" },
  { icon: CalendarCheck, text: "Confirming a Home Setup appointment…" },
  { icon: Search,        text: "Reading reviews to find pain points…" },
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

  // cycling activity line
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), runningNow ? 1800 : 4500);
    return () => clearInterval(id);
  }, [runningNow]);
  const line = HUNT_LINES[tick % HUNT_LINES.length];
  const Icon = line.icon;

  // money/score counters
  const stats = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayActions = actions.filter((a) => new Date(a.created_at) >= today);
    return {
      pending:  actions.filter((a) => a.status === "pending").length,
      executed: actions.filter((a) => a.status === "executed").length,
      todayWins: todayActions.filter((a) => a.status === "executed").length,
      hunting:  todayActions.length,
    };
  }, [actions]);

  const lastTitle = actions[0]?.title;

  const [teach, setTeach] = useState("");

  return (
    <Card className="relative overflow-hidden border-primary/30 bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-950 text-white">
      {/* twinkly bg */}
      <div className="absolute inset-0 opacity-40 pointer-events-none">
        {Array.from({ length: 30 }).map((_, i) => (
          <span
            key={i}
            className="absolute rounded-full bg-white animate-pulse"
            style={{
              width: 2, height: 2,
              left: `${(i * 37) % 100}%`,
              top: `${(i * 53) % 100}%`,
              animationDelay: `${(i % 7) * 0.4}s`,
              animationDuration: `${2 + (i % 3)}s`,
            }}
          />
        ))}
      </div>

      <div className="relative flex flex-col md:flex-row items-center gap-6 p-6">
        {/* Alien */}
        <button
          type="button"
          onClick={onRun}
          title="Poke the alien to make him hunt right now"
          className="relative group shrink-0"
        >
          <div
            className={
              "relative h-32 w-32 " +
              (runningNow ? "animate-[alien-walk_1.2s_ease-in-out_infinite]" : "animate-[alien-bob_3s_ease-in-out_infinite]")
            }
          >
            <Alien busy={!!runningNow} />
          </div>
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-2 w-20 rounded-full bg-black/40 blur-sm" />
          <div className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition">
            <Badge variant="secondary"><Sparkles className="h-3 w-3 mr-1" /> poke</Badge>
          </div>
        </button>

        {/* Status */}
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={runningNow ? "bg-emerald-500 hover:bg-emerald-500" : "bg-slate-600 hover:bg-slate-600"}>
              {runningNow ? "● HUNTING NOW" : "○ idle — poke me"}
            </Badge>
            <span className="text-xs text-white/60">
              {latestRun ? `last run ${new Date(latestRun.started_at).toLocaleTimeString()}` : "no runs yet"}
            </span>
          </div>
          <div key={tick} className="flex items-center gap-2 text-lg font-medium animate-[fade-in_0.5s_ease-out]">
            <Icon className="h-5 w-5 text-emerald-300" />
            <span>{line.text}</span>
          </div>
          {lastTitle && (
            <p className="text-sm text-white/70 truncate">
              <span className="text-white/40">latest find →</span> {lastTitle}
            </p>
          )}

          {/* Score row */}
          <div className="grid grid-cols-4 gap-2 pt-2 text-center">
            <Stat label="hunting today" value={stats.hunting} />
            <Stat label="waiting on you" value={stats.pending} accent="text-amber-300" />
            <Stat label="wins today" value={stats.todayWins} accent="text-emerald-300" />
            <Stat label="all-time wins" value={stats.executed} />
          </div>
        </div>

        {/* Teach + Run */}
        <div className="w-full md:w-72 space-y-2">
          <Button size="lg" className="w-full h-12 bg-emerald-500 hover:bg-emerald-400 text-black font-bold" onClick={onRun} disabled={isRunning}>
            <Zap className="h-5 w-5 mr-2" /> {isRunning ? "Hunting…" : "HUNT FOR MONEY"}
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
              placeholder="Teach me… e.g. 'target seniors on FB'"
              className="flex-1 rounded-md bg-white/10 px-3 py-2 text-sm placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
            <Button type="submit" size="sm" variant="secondary">+</Button>
          </form>
          <p className="text-[10px] text-white/50 leading-tight">
            Anything you type here becomes a new rule for the alien. Keep me open in a tab — I'll keep filling your calendar.
          </p>
        </div>
      </div>

      <style>{`
        @keyframes alien-bob {
          0%,100% { transform: translateY(0) rotate(-2deg); }
          50%     { transform: translateY(-8px) rotate(2deg); }
        }
        @keyframes alien-walk {
          0%   { transform: translateX(-6px) translateY(0)  rotate(-4deg); }
          25%  { transform: translateX(0)    translateY(-6px) rotate(0deg); }
          50%  { transform: translateX(6px)  translateY(0)  rotate(4deg); }
          75%  { transform: translateX(0)    translateY(-6px) rotate(0deg); }
          100% { transform: translateX(-6px) translateY(0)  rotate(-4deg); }
        }
        @keyframes alien-blink {
          0%, 92%, 100% { transform: scaleY(1); }
          95%           { transform: scaleY(0.1); }
        }
        @keyframes antenna-wiggle {
          0%,100% { transform: rotate(-8deg); }
          50%     { transform: rotate(8deg); }
        }
      `}</style>
    </Card>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="rounded-md bg-white/5 px-2 py-1.5">
      <div className={"text-xl font-bold " + (accent ?? "text-white")}>{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-white/50">{label}</div>
    </div>
  );
}

function Alien({ busy }: { busy: boolean }) {
  return (
    <svg viewBox="0 0 120 120" className="h-full w-full drop-shadow-[0_0_15px_rgba(74,222,128,0.5)]">
      {/* antenna */}
      <g style={{ transformOrigin: "60px 28px", animation: "antenna-wiggle 1.2s ease-in-out infinite" }}>
        <line x1="60" y1="30" x2="60" y2="12" stroke="#86efac" strokeWidth="2" />
        <circle cx="60" cy="10" r="4" fill="#fde047">
          <animate attributeName="r" values="3;5;3" dur="1s" repeatCount="indefinite" />
        </circle>
      </g>
      {/* head */}
      <ellipse cx="60" cy="55" rx="34" ry="30" fill="#4ade80" />
      <ellipse cx="60" cy="48" rx="30" ry="22" fill="#86efac" opacity="0.5" />
      {/* eyes */}
      <g style={{ transformOrigin: "48px 55px", animation: "alien-blink 4s infinite" }}>
        <ellipse cx="48" cy="55" rx="8" ry="10" fill="#0f172a" />
        <circle cx="50" cy="52" r="3" fill="#fff" />
      </g>
      <g style={{ transformOrigin: "72px 55px", animation: "alien-blink 4s infinite" }}>
        <ellipse cx="72" cy="55" rx="8" ry="10" fill="#0f172a" />
        <circle cx="74" cy="52" r="3" fill="#fff" />
      </g>
      {/* mouth */}
      {busy ? (
        <ellipse cx="60" cy="74" rx="5" ry="4" fill="#0f172a">
          <animate attributeName="ry" values="2;5;2" dur="0.6s" repeatCount="indefinite" />
        </ellipse>
      ) : (
        <path d="M 52 74 Q 60 80 68 74" stroke="#0f172a" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      )}
      {/* body */}
      <path d="M 38 82 Q 60 96 82 82 L 82 100 Q 60 108 38 100 Z" fill="#4ade80" />
      {/* arms holding "laptop" when busy */}
      {busy && (
        <>
          <rect x="46" y="92" width="28" height="12" rx="2" fill="#1e293b" />
          <rect x="48" y="94" width="24" height="8" fill="#22d3ee">
            <animate attributeName="opacity" values="1;0.3;1" dur="0.4s" repeatCount="indefinite" />
          </rect>
        </>
      )}
    </svg>
  );
}
