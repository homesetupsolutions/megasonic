import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/open-access";

export const listKnowledge = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("knowledge_files").select("*, organizations(name, slug)")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  });

export const registerKnowledgeFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    storage_path: z.string(),
    filename: z.string(),
    mime_type: z.string().optional(),
    size_bytes: z.number().int().optional(),
    organization_id: z.string().uuid().optional().nullable(),
    tags: z.array(z.string()).optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("knowledge_files").insert({
      owner_id: context.userId,
      storage_path: data.storage_path,
      filename: data.filename,
      mime_type: data.mime_type ?? null,
      size_bytes: data.size_bytes ?? null,
      organization_id: data.organization_id ?? null,
      tags: data.tags ?? [],
    } as never);
    if (error) throw error;
    return { ok: true };
  });

export const deleteKnowledgeFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("knowledge_files").select("storage_path").eq("id", data.id).single();
    if (row?.storage_path) {
      await context.supabase.storage.from("knowledge").remove([row.storage_path]);
    }
    const { error } = await context.supabase.from("knowledge_files").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// --- Investors ---
export const listInvestors = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("investors").select("*, organizations(name, slug)")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  });

export const upsertInvestor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    id: z.string().uuid().optional(),
    organization_id: z.string().uuid().optional().nullable(),
    name: z.string().min(1),
    firm: z.string().optional().nullable(),
    email: z.string().optional().nullable(),
    linkedin: z.string().optional().nullable(),
    focus: z.string().optional().nullable(),
    check_size: z.string().optional().nullable(),
    stage: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
    status: z.string().optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    if (data.id) {
      const { id, ...patch } = data;
      const { error } = await context.supabase.from("investors").update(patch as never).eq("id", id);
      if (error) throw error;
    } else {
      const { error } = await context.supabase.from("investors").insert({ ...data, owner_id: context.userId } as never);
      if (error) throw error;
    }
    return { ok: true };
  });

export const deleteInvestor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("investors").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// --- Grants ---
export const listGrants = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("grants").select("*, organizations(name, slug)")
      .order("deadline", { ascending: true, nullsFirst: false });
    if (error) throw error;
    return data;
  });

export const upsertGrant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    id: z.string().uuid().optional(),
    organization_id: z.string().uuid().optional().nullable(),
    name: z.string().min(1),
    provider: z.string().optional().nullable(),
    url: z.string().optional().nullable(),
    amount: z.string().optional().nullable(),
    deadline: z.string().optional().nullable(),
    eligibility: z.string().optional().nullable(),
    draft_application: z.string().optional().nullable(),
    status: z.string().optional(),
    notes: z.string().optional().nullable(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    if (data.id) {
      const { id, ...patch } = data;
      const { error } = await context.supabase.from("grants").update(patch as never).eq("id", id);
      if (error) throw error;
    } else {
      const { error } = await context.supabase.from("grants").insert({ ...data, owner_id: context.userId } as never);
      if (error) throw error;
    }
    return { ok: true };
  });

export const deleteGrant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("grants").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });
