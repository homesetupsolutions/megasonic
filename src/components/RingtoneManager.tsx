import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Bell, Plus, Play, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Tone = { id: string; name: string; url: string };
type Did = { number: string; label: string; toneId: string };

const LS_TONES = "phones.tones.v1";
const LS_DIDS = "phones.dids.v1";

const DEFAULT_TONES: Tone[] = [
  { id: "classic",  name: "Classic ring",  url: "" },
  { id: "marimba",  name: "Marimba",       url: "" },
  { id: "alien",    name: "Alien chirp",   url: "" },
  { id: "sonar",    name: "Sonar ping",    url: "" },
  { id: "urgent",   name: "Urgent alert",  url: "" },
];

const DEFAULT_DIDS: Did[] = [
  { number: "18332302933", label: "IVR: HSS",            toneId: "classic" },
  { number: "15876045128", label: "IVR: SonicFeel",      toneId: "marimba" },
  { number: "15876045127", label: "IVR: HSS",            toneId: "classic" },
  { number: "15876045129", label: "(587) 803-4112",      toneId: "sonar"   },
  { number: "18447664226", label: "IVR: SonicFeel",      toneId: "marimba" },
];

export function RingtoneManager() {
  const [tones, setTones] = useState<Tone[]>(DEFAULT_TONES);
  const [dids, setDids] = useState<Did[]>(DEFAULT_DIDS);

  useEffect(() => {
    try {
      const t = localStorage.getItem(LS_TONES); if (t) setTones(JSON.parse(t));
      const d = localStorage.getItem(LS_DIDS);  if (d) setDids(JSON.parse(d));
    } catch { /* */ }
  }, []);
  useEffect(() => { try { localStorage.setItem(LS_TONES, JSON.stringify(tones)); } catch { /* */ } }, [tones]);
  useEffect(() => { try { localStorage.setItem(LS_DIDS,  JSON.stringify(dids));  } catch { /* */ } }, [dids]);

  function preview(url: string) {
    if (!url) return toast.error("No URL set for this ringtone");
    try { new Audio(url).play(); } catch { toast.error("Could not play"); }
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2"><Bell className="h-4 w-4"/>Ringtone library</CardTitle>
          <Button size="sm" variant="outline" onClick={() => setTones([...tones, { id: `tone${tones.length+1}`, name: "New tone", url: "" }])}>
            <Plus className="h-4 w-4 mr-1"/>Add tone
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Drop in any <code>.wav</code> URL (Yealink requires 8kHz mono PCM .wav · Grandstream accepts .wav or .mp3).
            Each tone can be mapped to a different incoming number below so you can tell which line is ringing by ear.
          </p>
          {tones.map((t, i) => (
            <div key={t.id} className="grid grid-cols-12 gap-2 items-end">
              <div className="col-span-3"><Label className="text-xs">Name</Label>
                <Input value={t.name} onChange={(e) => setTones(tones.map((x, idx) => idx === i ? { ...x, name: e.target.value } : x))}/>
              </div>
              <div className="col-span-8"><Label className="text-xs">.wav URL</Label>
                <Input value={t.url} placeholder="https://your-cdn/tone.wav" onChange={(e) => setTones(tones.map((x, idx) => idx === i ? { ...x, url: e.target.value } : x))}/>
              </div>
              <div className="col-span-1 flex gap-1">
                <Button variant="outline" size="icon" onClick={() => preview(t.url)}><Play className="h-4 w-4"/></Button>
                <Button variant="ghost" size="icon" onClick={() => setTones(tones.filter((_, idx) => idx !== i))}><Trash2 className="h-4 w-4"/></Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Incoming numbers → ringtone</CardTitle>
          <Button size="sm" variant="outline" onClick={() => setDids([...dids, { number: "", label: "", toneId: tones[0]?.id ?? "" }])}>
            <Plus className="h-4 w-4 mr-1"/>Add DID
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground">
            On Yealink set <b>Features → Distinctive Ring</b> with each DID's caller-ID pattern;
            on Grandstream use <b>Account → Call Settings → Match Incoming Caller ID</b>. Paste the matching URL from above.
          </p>
          {dids.map((d, i) => {
            const tone = tones.find((t) => t.id === d.toneId);
            return (
              <div key={i} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-3"><Label className="text-xs">DID number</Label>
                  <Input value={d.number} onChange={(e) => setDids(dids.map((x, idx) => idx === i ? { ...x, number: e.target.value } : x))}/>
                </div>
                <div className="col-span-4"><Label className="text-xs">Label / route</Label>
                  <Input value={d.label} onChange={(e) => setDids(dids.map((x, idx) => idx === i ? { ...x, label: e.target.value } : x))}/>
                </div>
                <div className="col-span-4"><Label className="text-xs">Ringtone</Label>
                  <select className="w-full h-9 rounded-md border bg-background px-2 text-sm" value={d.toneId}
                    onChange={(e) => setDids(dids.map((x, idx) => idx === i ? { ...x, toneId: e.target.value } : x))}>
                    {tones.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div className="col-span-1 flex gap-1">
                  <Button variant="outline" size="icon" onClick={() => preview(tone?.url ?? "")}><Play className="h-4 w-4"/></Button>
                  <Button variant="ghost" size="icon" onClick={() => setDids(dids.filter((_, idx) => idx !== i))}><Trash2 className="h-4 w-4"/></Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </>
  );
}
