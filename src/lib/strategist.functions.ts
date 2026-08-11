import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/open-access";

export const triggerStrategistRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ organization_id: z.string().uuid().optional() }).parse(i ?? {}))
  .handler(async ({ data, context }) => {
    const { runStrategistForUser } = await import("@/lib/strategist.server");
    return runStrategistForUser({
      userId: context.userId,
      trigger: "manual",
      organizationId: data.organization_id ?? null,
    });
  });

export const listAiRuns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("ai_runs")
      .select("*, organizations(name, slug)")
      .order("started_at", { ascending: false })
      .limit(40);
    if (error) throw error;
    return data;
  });

export const listAiActions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ status: z.string().optional() }).parse(i ?? {}))
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("ai_actions")
      .select("*, organizations(name, slug)")
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(100);
    if (data.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows;
  });

export const setActionStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    id: z.string().uuid(),
    status: z.enum(["approved", "rejected", "pending"]),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const patch: { status: string; approved_at?: string | null } = { status: data.status };
    if (data.status === "approved") patch.approved_at = new Date().toISOString();
    if (data.status === "rejected" || data.status === "pending") patch.approved_at = null;
    const { error } = await context.supabase.from("ai_actions").update(patch as never).eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const executeAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { executeApprovedAction } = await import("@/lib/strategist.server");
    const result = await executeApprovedAction(data.id, context.userId);
    return { ok: true, result: JSON.parse(JSON.stringify(result)) };
  });

export const getAiSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("ai_settings").select("*").eq("user_id", context.userId).maybeSingle();
    if (error) throw error;
    if (data) return data;
    const { data: created, error: e2 } = await context.supabase
      .from("ai_settings").insert({ user_id: context.userId } as never).select().single();
    if (e2) throw e2;
    return created;
  });

export const updateAiSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    enabled: z.boolean().optional(),
    cadence_minutes: z.number().int().min(1).max(1440).optional(),
    auto_run_on_new_lead: z.boolean().optional(),
    guidance: z.string().max(10000).optional(),
    reminder_enabled: z.boolean().optional(),
    reminder_hour: z.number().int().min(0).max(23).optional(),
    reminder_minute: z.number().int().min(0).max(59).optional(),
    reminder_method: z.enum(["queue_call", "draft_sms", "draft_email"]).optional(),
    reminder_lead_hours: z.number().int().min(1).max(168).optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("ai_settings").update(data as never).eq("user_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

export const runRemindersNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const url = `${process.env.SUPABASE_URL?.replace("supabase.co", "lovable.app") ?? ""}`;
    // call the hook directly with force flag
    const base = typeof globalThis !== "undefined" && (globalThis as any).location?.origin
      ? (globalThis as any).location.origin
      : "https://project--9b78cea6-667a-48ea-9a20-df47d8f6cc28.lovable.app";
    await fetch(`${base}/api/public/hooks/daily-reminders?force=1&owner_id=${context.userId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    return { ok: true };
  });
