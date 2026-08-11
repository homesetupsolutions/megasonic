import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/open-access";

const TrunkSchema = z.object({
  id: z.string().uuid().optional(),
  did: z.string().min(7).max(20),
  label: z.string().max(80).optional().nullable(),
  provider: z.string().max(40).default("callcentric"),
  sip_username: z.string().max(80).optional().nullable(),
  sip_password: z.string().max(120).optional().nullable(),
  sip_server: z.string().max(120).default("sip.callcentric.com"),
  sip_port: z.number().int().min(1).max(65535).default(5060),
  inbound_route: z.enum(["ivr", "et", "extension", "voicemail"]).default("ivr"),
  inbound_extension: z.string().max(20).optional().nullable(),
  voice: z.string().max(40).default("alloy"),
  enabled: z.boolean().default(true),
});

export const listSipTrunks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("sip_trunks" as never)
      .select("*")
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data as any[];
  });

export const upsertSipTrunk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => TrunkSchema.parse(i))
  .handler(async ({ data, context }) => {
    const row = { ...data, owner_id: context.userId };
    const { data: out, error } = await (context.supabase.from("sip_trunks" as never) as any)
      .upsert(row, { onConflict: "owner_id,did" })
      .select()
      .single();
    if (error) throw error;
    return out;
  });

export const deleteSipTrunk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("sip_trunks" as never).delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

const IvrSchema = z.object({
  ivr_voice: z.string().max(40).optional(),
  ivr_greeting: z.string().max(2000).optional(),
  auto_approve_under_cents: z.number().int().min(0).max(100000).optional(),
});

export const getIvrSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("ai_settings")
      .select("ivr_voice, ivr_greeting, auto_approve_under_cents")
      .eq("user_id", context.userId)
      .maybeSingle();
    return data ?? { ivr_voice: "alloy", ivr_greeting: "", auto_approve_under_cents: 0 };
  });

export const saveIvrSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => IvrSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase.from("ai_settings") as any)
      .upsert({ user_id: context.userId, ...data }, { onConflict: "user_id" });
    if (error) throw error;
    return { ok: true };
  });
