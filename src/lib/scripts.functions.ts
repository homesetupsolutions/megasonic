import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/open-access";

export const listScripts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("call_scripts")
      .select("*, organizations(name, slug, kind), services(name)")
      .order("direction", { ascending: true })
      .order("is_default", { ascending: false })
      .order("title", { ascending: true });
    if (error) throw error;
    return data;
  });

const UpsertSchema = z.object({
  id: z.string().uuid().optional(),
  organization_id: z.string().uuid(),
  service_id: z.string().uuid().optional().nullable(),
  title: z.string().min(1).max(200),
  direction: z.enum(["inbound", "outbound"]).default("inbound"),
  greeting: z.string().max(4000).default(""),
  qualifying_questions: z.string().max(4000).default(""),
  objection_handlers: z.string().max(4000).default(""),
  closing: z.string().max(4000).default(""),
  full_script: z.string().max(8000).default(""),
  is_default: z.boolean().optional(),
});

export const upsertScript = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => UpsertSchema.parse(i))
  .handler(async ({ data, context }) => {
    const patch = {
      owner_id: context.userId,
      organization_id: data.organization_id,
      service_id: data.service_id ?? null,
      title: data.title,
      direction: data.direction,
      greeting: data.greeting,
      qualifying_questions: data.qualifying_questions,
      objection_handlers: data.objection_handlers,
      closing: data.closing,
      full_script: data.full_script,
      is_default: data.is_default ?? false,
    };
    if (data.id) {
      const { error } = await context.supabase
        .from("call_scripts")
        .update(patch as never)
        .eq("id", data.id);
      if (error) throw error;
      return { ok: true, id: data.id };
    }
    const { data: row, error } = await context.supabase
      .from("call_scripts")
      .insert(patch as never)
      .select("id")
      .single();
    if (error) throw error;
    return { ok: true, id: row.id };
  });

export const deleteScript = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("call_scripts").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });
