import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getBackupCounts, exportTable, exportAll } from "@/lib/backup.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Download, ShieldCheck, HardDriveDownload, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/backup")({
  head: () => ({
    meta: [
      { title: "Backup & Export | MegaSonic Command Center" },
      {
        name: "description",
        content:
          "Download a full backup of your bookings, customers, leads, scripts and phone setup as JSON or spreadsheet-ready CSV files.",
      },
      { property: "og:title", content: "Backup & Export | MegaSonic Command Center" },
      {
        property: "og:description",
        content: "One-tap download of every business record in your MegaSonic Command Center.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BackupPage,
});

type Group = { label: string; tables: string[]; blurb: string };

const GROUPS: Group[] = [
  { label: "Bookings", tables: ["bookings"], blurb: "Every appointment, status and card reference." },
  { label: "Customers", tables: ["customers"], blurb: "Names, phones, emails and notes." },
  { label: "Leads", tables: ["leads"], blurb: "Everything ET has hunted down for you." },
  { label: "Services & Inventory", tables: ["services", "inventory_items"], blurb: "Your catalog and stock." },
  { label: "Call Scripts", tables: ["call_scripts"], blurb: "Inbound and outbound scripts." },
  { label: "Phone Calls", tables: ["phone_calls", "voice_calls"], blurb: "Call history from desk phones and AI calls." },
  { label: "Phone Setup", tables: ["phone_devices", "sip_trunks"], blurb: "Desk phones and DID routing (passwords excluded)." },
  { label: "AI Settings & Runs", tables: ["ai_settings", "ai_actions", "ai_runs"], blurb: "ET's brain, queue and history." },
  { label: "Linked Projects", tables: ["linked_projects", "organizations"], blurb: "Your connected apps (API keys excluded)." },
  { label: "Money Hunting", tables: ["investors", "grants", "ideas"], blurb: "Investors, grants and idea pipeline." },
  { label: "Activity Log", tables: ["activity_log", "events"], blurb: "Full audit trail of what happened." },
  { label: "Price Approvals", tables: ["price_change_requests"], blurb: "Pending and past price changes." },
  { label: "Square & Knowledge", tables: ["square_locations", "knowledge_files"], blurb: "Locations and uploaded file records." },
];

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function toCsv(rows: any[]): string {
  if (!rows.length) return "";
  const cols = Array.from(rows.reduce<Set<string>>((s, r) => {
    Object.keys(r ?? {}).forEach((k) => s.add(k));
    return s;
  }, new Set<string>()));
  const esc = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r?.[c])).join(","))].join("\n");
}

const today = () => new Date().toISOString().slice(0, 10);

function BackupPage() {
  const counts = useServerFn(getBackupCounts);
  const one = useServerFn(exportTable);
  const all = useServerFn(exportAll);

  const [busy, setBusy] = useState<string | null>(null);
  const [lastBackup, setLastBackup] = useState<string | null>(null);

  useEffect(() => {
    setLastBackup(localStorage.getItem("megasonic:last-backup"));
  }, []);

  const { data: rowCounts, isLoading } = useQuery<Record<string, number>>({
    queryKey: ["backup-counts"],
    queryFn: () => counts() as any,
  });

  const markBackedUp = () => {
    const stamp = new Date().toLocaleString();
    localStorage.setItem("megasonic:last-backup", stamp);
    setLastBackup(stamp);
  };

  const handleAll = async () => {
    setBusy("__all__");
    try {
      const payload: any = await all({ data: undefined } as any);
      download(`megasonic-backup-${today()}.json`, JSON.stringify(payload, null, 2), "application/json");
      markBackedUp();
      toast.success("Full backup downloaded");
    } catch (e: any) {
      toast.error(e?.message ?? "Backup failed");
    } finally {
      setBusy(null);
    }
  };

  const handleGroup = async (group: Group, format: "csv" | "json") => {
    setBusy(`${group.label}:${format}`);
    try {
      const results = await Promise.all(group.tables.map((t) => one({ data: { table: t } } as any) as any));
      if (format === "json") {
        const obj: Record<string, any[]> = {};
        results.forEach((r: any) => (obj[r.table] = r.rows));
        download(
          `megasonic-${group.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${today()}.json`,
          JSON.stringify(obj, null, 2),
          "application/json",
        );
      } else {
        for (const r of results as any[]) {
          if (!r.rows.length) continue;
          download(`megasonic-${r.table}-${today()}.csv`, toCsv(r.rows), "text/csv");
        }
        if ((results as any[]).every((r) => !r.rows.length)) {
          toast.message("Nothing to export yet in this section");
          return;
        }
      }
      markBackedUp();
      toast.success(`${group.label} downloaded`);
    } catch (e: any) {
      toast.error(e?.message ?? "Export failed");
    } finally {
      setBusy(null);
    }
  };

  const total = rowCounts ? Object.values(rowCounts).reduce((a, b) => a + b, 0) : 0;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <HardDriveDownload /> Backup &amp; Export
        </h1>
        <p className="text-muted-foreground">
          Download your data any time. Files save straight to this device — keep them, email them, or drop them in
          Drive.
        </p>
      </div>

      <Card className="border-primary/40">
        <CardContent className="py-6 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <Button size="lg" onClick={handleAll} disabled={busy === "__all__"} className="text-base">
              {busy === "__all__" ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <Download className="mr-2 h-5 w-5" />
              )}
              Download Everything
            </Button>
            <div className="text-sm text-muted-foreground">
              {isLoading ? "Counting records…" : `${total.toLocaleString()} records across ${GROUPS.length} sections`}
            </div>
          </div>
          {lastBackup && <p className="text-xs text-muted-foreground">Last backup on this device: {lastBackup}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" /> What is not in the file
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-1">
          <p>• Card numbers — those live only in Square. Only reference IDs are included.</p>
          <p>• Passwords, API keys and access tokens are stripped out, so the file is safe to store.</p>
          <p>• Uploaded knowledge files are listed by name, not embedded.</p>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        {GROUPS.map((g) => {
          const n = g.tables.reduce((sum, t) => sum + (rowCounts?.[t] ?? 0), 0);
          return (
            <Card key={g.label}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  {g.label}
                  <Badge variant="secondary">{isLoading ? "…" : n.toLocaleString()}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">{g.blurb}</p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!!busy}
                    onClick={() => handleGroup(g, "csv")}
                  >
                    {busy === `${g.label}:csv` ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
                    CSV
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={!!busy}
                    onClick={() => handleGroup(g, "json")}
                  >
                    {busy === `${g.label}:json` ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
                    JSON
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
