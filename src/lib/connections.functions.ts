import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const KNOWN_PROVIDERS = [
  "gmail",
  "facebook_page",
  "gofundme",
  "callcentric",
  "twilio",
  "square",
  "stripe",
  "linkedin",
  "instagram",
  "x_twitter",
  "grants_gov",
  "custom",
] as const;

export const listConnections = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("external_connections")
      .select("*")
      .order("provider", { ascending: true });
    if (error) throw error;
    return data;
  });

const UpsertSchema = z.object({
  provider: z.string().min(1).max(48),
  label: z.string().max(120).optional().nullable(),
  config: z.record(z.string(), z.any()).optional(),
  status: z.enum(["pending", "connected", "error", "disconnected"]).optional(),
  notes: z.string().max(2000).optional().nullable(),
});

export const upsertConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => UpsertSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { data: existing } = await context.supabase
      .from("external_connections")
      .select("id")
      .eq("owner_id", context.userId)
      .eq("provider", data.provider)
      .maybeSingle();

    const patch = {
      owner_id: context.userId,
      provider: data.provider,
      label: data.label ?? null,
      config: data.config ?? {},
      status: data.status ?? "pending",
      notes: data.notes ?? null,
    };

    if (existing?.id) {
      const { error } = await context.supabase
        .from("external_connections")
        .update(patch as never)
        .eq("id", existing.id);
      if (error) throw error;
      return { ok: true, id: existing.id };
    }
    const { data: row, error } = await context.supabase
      .from("external_connections")
      .insert(patch as never)
      .select("id")
      .single();
    if (error) throw error;
    return { ok: true, id: row.id };
  });

export const deleteConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("external_connections").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// ---- Square pull (locations + catalog) ----
export const pullSquareData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { pullSquareForUser } = await import("@/lib/square-pull.server");
    return await pullSquareForUser({ userId: context.userId });
  });

export const listSquareLocations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("square_locations")
      .select("*, organizations(name, slug, kind)")
      .order("name", { ascending: true });
    if (error) throw error;
    return data;
  });
