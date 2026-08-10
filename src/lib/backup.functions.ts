// Backup / export server functions. RLS scopes every read to the signed-in owner.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Allow-list of exportable tables. Anything not here cannot be requested.
export const EXPORTABLE_TABLES = [
  "bookings",
  "customers",
  "leads",
  "services",
  "inventory_items",
  "call_scripts",
  "phone_calls",
  "voice_calls",
  "phone_devices",
  "sip_trunks",
  "ai_settings",
  "ai_actions",
  "ai_runs",
  "linked_projects",
  "organizations",
  "investors",
  "grants",
  "ideas",
  "activity_log",
  "price_change_requests",
  "square_locations",
  "knowledge_files",
  "events",
] as const;

export type ExportableTable = (typeof EXPORTABLE_TABLES)[number];

// Columns stripped from every export so a backup file is safe to store/share.
const SENSITIVE_COLUMNS = new Set([
  "sip_password",
  "api_key",
  "access_token",
  "refresh_token",
  "client_secret",
  "password",
  "secret",
]);

function scrub(rows: any[]): any[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => {
    if (!row || typeof row !== "object") return row;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) {
      if (SENSITIVE_COLUMNS.has(k)) continue;
      out[k] = v;
    }
    return out;
  });
}

export const getBackupCounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const counts: Record<string, number> = {};
    await Promise.all(
      EXPORTABLE_TABLES.map(async (t) => {
        const { count, error } = await (context.supabase.from(t as never) as any).select("*", {
          count: "exact",
          head: true,
        });
        counts[t] = error ? 0 : (count ?? 0);
      }),
    );
    return counts;
  });

export const exportTable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ table: z.enum(EXPORTABLE_TABLES) }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await (context.supabase.from(data.table as never) as any).select("*");
    if (error) throw new Error(error.message);
    return { table: data.table, rows: scrub(rows ?? []) };
  });

export const exportAll = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const out: Record<string, any[]> = {};
    await Promise.all(
      EXPORTABLE_TABLES.map(async (t) => {
        const { data: rows, error } = await (context.supabase.from(t as never) as any).select("*");
        out[t] = error ? [] : scrub(rows ?? []);
      }),
    );
    return {
      exported_at: new Date().toISOString(),
      app: "MegaSonic Command Center",
      note: "Card numbers live only in Square. Secrets and API keys are intentionally excluded.",
      tables: out,
    };
  });
