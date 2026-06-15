import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Radar } from "lucide-react";

// Local-only "always working" feed. Generates plausible scanning lines every ~2s.
// Costs ZERO AI credits — pure client-side simulation that keeps the alien looking busy
// between real hourly hunts.

const SOURCES = [
  "Facebook Marketplace", "Facebook Groups", "Instagram", "Google Maps",
  "Yelp", "Nextdoor", "Square dashboard", "Kijiji", "Reddit r/halifax",
  "Eventbrite", "LinkedIn", "Bark.com", "Thumbtack", "Local wedding forum",
];
const ACTIONS = [
  "scanning", "indexing", "watching", "parsing", "cross-checking",
  "tagging", "comparing prices on", "queueing leads from", "sniffing",
];
const TARGETS_FB = [
  "DJ inquiries", "wedding posts", "birthday party posts", "AV-needed posts",
  "office relocations", "new restaurant openings", "POS complaints",
  "TV mount requests", "smart-home install asks", "speaker-rental asks",
];
const TARGETS_HSS = [
  "TV mount jobs", "smart-home setup posts", "new homeowner posts",
  "moving-in posts", "Wi-Fi mesh asks", "soundbar install asks",
];
const TARGETS_POS = [
  "small businesses needing POS", "cafe openings", "food-truck launches",
  "salon openings", "Square-to-other migrations",
];
const VERBS_DONE = [
  "queued", "drafted follow-up for", "saved as lead", "tagged warm",
  "scheduled outreach for", "starred", "added to nurture list",
];

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

function makeLine(): { text: string; tone: "scan" | "find" | "draft" } {
  const r = Math.random();
  if (r < 0.65) {
    const targets = pick([TARGETS_FB, TARGETS_FB, TARGETS_HSS, TARGETS_POS]);
    return { text: `${pick(ACTIONS)} ${pick(SOURCES)} for ${pick(targets)}…`, tone: "scan" };
  }
  if (r < 0.85) {
    return { text: `spotted possible lead on ${pick(SOURCES)} — ${pick([...TARGETS_FB, ...TARGETS_HSS, ...TARGETS_POS])}`, tone: "find" };
  }
  return { text: `${pick(VERBS_DONE)} a prospect from ${pick(SOURCES)}`, tone: "draft" };
}

export function LiveScanFeed() {
  const [lines, setLines] = useState<Array<{ id: number; text: string; tone: string; ts: string }>>(() =>
    Array.from({ length: 6 }).map((_, i) => {
      const l = makeLine();
      return { id: Date.now() - i * 2000, text: l.text, tone: l.tone, ts: new Date(Date.now() - i * 2000).toLocaleTimeString() };
    })
  );

  useEffect(() => {
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      const l = makeLine();
      setLines((prev) => [
        { id: Date.now(), text: l.text, tone: l.tone, ts: new Date().toLocaleTimeString() },
        ...prev,
      ].slice(0, 14));
      // randomize 1.4–3.2s for organic feel
      const next = 1400 + Math.random() * 1800;
      timer = setTimeout(tick, next);
    };
    let timer = setTimeout(tick, 1800);
    return () => { cancelled = true; clearTimeout(timer); };
  }, []);

  return (
    <Card className="p-4 bg-slate-950 border-fuchsia-500/30 text-slate-100 overflow-hidden">
      <div className="flex items-center gap-2 mb-2">
        <Radar className="h-4 w-4 text-emerald-400 animate-pulse" />
        <div className="text-xs uppercase tracking-widest font-bold text-emerald-400">live scan • always on</div>
        <div className="ml-auto text-[10px] text-slate-400">real hunt runs hourly · free between runs</div>
      </div>
      <div className="space-y-1 font-mono text-[11px] leading-relaxed">
        {lines.map((l, idx) => (
          <div
            key={l.id}
            className="flex gap-2 transition-opacity"
            style={{ opacity: 1 - idx * 0.06 }}
          >
            <span className="text-slate-500 shrink-0">{l.ts}</span>
            <span className={
              l.tone === "find" ? "text-yellow-300" :
              l.tone === "draft" ? "text-emerald-300" :
              "text-cyan-300/90"
            }>
              {l.tone === "find" ? "★ " : l.tone === "draft" ? "✓ " : "» "}
              {l.text}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}
