import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("ai_settings").update(data as never).eq("user_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });
