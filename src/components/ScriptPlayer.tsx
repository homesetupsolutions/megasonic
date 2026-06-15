import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Play, PhoneCall, ArrowLeft, RotateCcw, CheckCircle2, XCircle } from "lucide-react";

type Script = {
  title: string;
  direction: "inbound" | "outbound";
  greeting: string;
  qualifying_questions: string;
  objection_handlers: string;
  closing: string;
  full_script?: string;
};

// ---------- parsing helpers ----------
function splitLines(s: string | null | undefined): string[] {
  return (s ?? "")
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*[-*•\d.)]+\s*/, "").trim())
    .filter(Boolean);
}

/** Parse objection_handlers into {objection, response} pairs.
 *  Accepts:  "Q: too pricey\nA: here's why..."  blocks separated by blank lines,
 *            "too pricey: here's why...",
 *            "too pricey => here's why...",
 *            "- too pricey -- here's why..."   */
function parseObjections(text: string): { objection: string; response: string }[] {
  if (!text?.trim()) return DEFAULT_OBJECTIONS;
  const blocks = text.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  const out: { objection: string; response: string }[] = [];
  for (const block of blocks) {
    // Q:/A: style
    const qa = block.match(/Q\s*[:\-)]\s*([\s\S]+?)\n\s*A\s*[:\-)]\s*([\s\S]+)/i);
    if (qa) { out.push({ objection: qa[1].trim(), response: qa[2].trim() }); continue; }
    // first separator on a single line
    const oneLine = block.replace(/\n/g, " ").trim();
    const sep = oneLine.match(/^(.{2,80}?)\s*(?:=>|->|—|--|::|:)\s*(.+)$/);
    if (sep) { out.push({ objection: sep[1].trim(), response: sep[2].trim() }); continue; }
    // fallback: first line = objection, rest = response
    const lines = block.split(/\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length >= 2) out.push({ objection: lines[0].replace(/^[-*•]\s*/, ""), response: lines.slice(1).join(" ") });
    else if (lines.length === 1) out.push({ objection: lines[0], response: "Got it — let me address that and circle back to booking." });
  }
  return out.length ? out : DEFAULT_OBJECTIONS;
}

const DEFAULT_OBJECTIONS: { objection: string; response: string }[] = [
  { objection: "Too expensive 💸", response: "I hear you — for context, our package includes everything end-to-end, so most clients save money vs. piecing things together. Want me to walk you through what's included?" },
  { objection: "Need to think about it 🤔", response: "Totally fair. What's the biggest thing on your mind — is it timing, price, or wanting to compare options?" },
  { objection: "Just send me info 📧", response: "Happy to. Quick — what's your event date so I include the right pricing? I'll text the info now and follow up tomorrow." },
  { objection: "Already talking to someone else 👀", response: "Smart to shop around. What matters most to you — price, experience, or vibe? We tend to win on that one." },
  { objection: "Not the right time ⏳", response: "No worries. When would be a better time to revisit — next week, next month? I'll set a reminder and reach out then." },
  { objection: "Not interested 🙅", response: "No problem, thanks for your time! Mind if I ask what made it a no — so I can serve folks better?" },
];

// ---------- step graph ----------
type StepKey = "greeting" | "qualify" | "objections" | "objectionReply" | "closing" | "booked" | "followup" | "voicemail" | "wrong" | "end";

type Choice = { label: string; next: StepKey; tone?: "good" | "bad" | "neutral"; payload?: string };

export function ScriptPlayer({ script }: { script: Script }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<StepKey>("greeting");
  const [history, setHistory] = useState<StepKey[]>([]);
  const [activeObjection, setActiveObjection] = useState<{ objection: string; response: string } | null>(null);

  const objections = useMemo(() => parseObjections(script.objection_handlers), [script.objection_handlers]);
  const questions = useMemo(() => splitLines(script.qualifying_questions), [script.qualifying_questions]);

  const reset = () => { setStep("greeting"); setHistory([]); setActiveObjection(null); };
  const go = (next: StepKey) => { setHistory((h) => [...h, step]); setStep(next); };
  const back = () => {
    setHistory((h) => {
      if (!h.length) return h;
      const prev = h[h.length - 1];
      setStep(prev);
      return h.slice(0, -1);
    });
    setActiveObjection(null);
  };

  // Build content for each step
  let weSay = "";
  let title = "";
  let choices: Choice[] = [];
  let badge = "";

  if (step === "greeting") {
    title = "Greeting";
    badge = script.direction === "inbound" ? "📞 they called" : "☎️ you're dialing";
    weSay = script.greeting?.trim() || (script.direction === "inbound"
      ? "Thanks for calling! How can I help you today?"
      : "Hey, this is [you] — got a sec? I'm calling about [reason].");
    choices = [
      { label: "They engaged — keep going ✅", next: "qualify", tone: "good" },
      { label: "Voicemail 📭", next: "voicemail" },
      { label: "Wrong number / not interested 👋", next: "wrong", tone: "bad" },
    ];
  } else if (step === "qualify") {
    title = "Qualify them";
    weSay = questions.length
      ? "Ask the right questions to qualify:\n\n• " + questions.join("\n• ")
      : "What's the event date?\nWhat's the venue or location?\nHow many people?\nWhat's the vibe / budget you have in mind?";
    choices = [
      { label: "Got the info — pitch the close 🎯", next: "closing", tone: "good" },
      { label: "They pushed back / had an objection 🙅", next: "objections" },
      { label: "Not a fit — politely end 👋", next: "end" },
    ];
  } else if (step === "objections") {
    title = "Handle the objection";
    weSay = "What did they push back with? Tap one:";
    choices = objections.map((o) => ({ label: o.objection, next: "objectionReply", payload: JSON.stringify(o) }));
    choices.push({ label: "← Resolved, move to closing", next: "closing", tone: "good" });
  } else if (step === "objectionReply" && activeObjection) {
    title = `Objection: ${activeObjection.objection}`;
    weSay = activeObjection.response;
    choices = [
      { label: "That worked — close them 🎉", next: "closing", tone: "good" },
      { label: "Another objection 🌀", next: "objections" },
      { label: "They're a hard no 🚫", next: "end", tone: "bad" },
    ];
  } else if (step === "closing") {
    title = "Lock it in";
    weSay = script.closing?.trim() || "Sounds great — let's lock it in. I can hold the date right now with a 25% deposit. Want me to send the booking link by text?";
    choices = [
      { label: "BOOKED 🎉", next: "booked", tone: "good" },
      { label: "Maybe later — follow up 📆", next: "followup" },
      { label: "Hit me with another objection 🌀", next: "objections" },
      { label: "Final no 🙅", next: "end", tone: "bad" },
    ];
  } else if (step === "voicemail") {
    title = "Voicemail";
    weSay = `Hey, this is [you] following up on ${script.title}. Best way to reach me is a quick text back to this number. Talk soon!`;
    choices = [{ label: "Logged ✅", next: "end", tone: "good" }];
  } else if (step === "wrong") {
    title = "Polite exit";
    weSay = "No worries — sorry to bother you. Have a great day!";
    choices = [{ label: "Logged & hang up", next: "end" }];
  } else if (step === "followup") {
    title = "Schedule the follow-up";
    weSay = "Totally — when's a better time? I'll text you a quick reminder the day before so it doesn't slip.";
    choices = [
      { label: "Reminder set ✅", next: "end", tone: "good" },
      { label: "They committed now — go close 🎯", next: "closing" },
    ];
  } else if (step === "booked") {
    title = "🎉 Booked!";
    weSay = "Perfect — sending the booking link & deposit invoice right now. You'll get a confirmation text. Anything else I can answer?";
    choices = [{ label: "Done — log the win", next: "end", tone: "good" }];
  } else if (step === "end") {
    title = "Call ended";
    weSay = "Nice work. Log notes in the customer record so the alien can follow up.";
    choices = [];
  }

  return (
    <>
      <Button variant="default" size="sm" onClick={() => { reset(); setOpen(true); }}>
        <Play className="h-4 w-4 mr-1" /> Practice
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 flex-wrap">
              <PhoneCall className="h-5 w-5" /> {script.title}
              <Badge variant="outline">{badge || title}</Badge>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <Card className="bg-primary/5 border-primary/30">
              <CardContent className="pt-4">
                <div className="text-[11px] uppercase tracking-wider font-bold text-primary mb-2">
                  {step === "objections" ? "Their move" : "What you say"}
                </div>
                <p className="whitespace-pre-wrap text-base leading-relaxed">{weSay}</p>
              </CardContent>
            </Card>

            {choices.length > 0 && (
              <div>
                <div className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground mb-2">
                  Their possible response — tap one
                </div>
                <div className="grid gap-2">
                  {choices.map((c, i) => (
                    <Button
                      key={i}
                      variant={c.tone === "good" ? "default" : c.tone === "bad" ? "destructive" : "outline"}
                      className="justify-start h-auto py-2 text-left whitespace-normal"
                      onClick={() => {
                        if (c.payload) {
                          try { setActiveObjection(JSON.parse(c.payload)); } catch { /* */ }
                        }
                        go(c.next);
                      }}
                    >
                      {c.tone === "good" && <CheckCircle2 className="h-4 w-4 mr-2 shrink-0" />}
                      {c.tone === "bad" && <XCircle className="h-4 w-4 mr-2 shrink-0" />}
                      <span>{c.label}</span>
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t">
              <Button variant="ghost" size="sm" onClick={back} disabled={!history.length}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <Button variant="ghost" size="sm" onClick={reset}>
                <RotateCcw className="h-4 w-4 mr-1" /> Start over
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
