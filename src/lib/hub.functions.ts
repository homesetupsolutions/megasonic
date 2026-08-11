import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/open-access";

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40) || "project";

export const listProjects = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("linked_projects")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  });

export const createProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        name: z.string().min(1).max(80),
        url: z.string().url().optional().or(z.literal("")),
        color: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { generateApiKey } = await import("@/lib/api-key.server");
    const key = generateApiKey();
    const slug = slugify(data.name);
    const { data: row, error } = await context.supabase
      .from("linked_projects")
      .insert({
        owner_id: context.userId,
        name: data.name,
        slug,
        url: data.url || null,
        color: data.color || "#8b5cf6",
        api_key_hash: key.hash,
        api_key_prefix: key.prefix,
      })
      .select()
      .single();
    if (error) throw error;
    return { project: row, apiKey: key.raw };
  });

export const rotateProjectKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { generateApiKey } = await import("@/lib/api-key.server");
    const key = generateApiKey();
    const { error } = await context.supabase
      .from("linked_projects")
      .update({ api_key_hash: key.hash, api_key_prefix: key.prefix })
      .eq("id", data.id);
    if (error) throw error;
    return { apiKey: key.raw };
  });

export const deleteProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("linked_projects").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const assignProjectOrg = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ id: z.string().uuid(), organization_id: z.string().uuid().nullable() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("linked_projects")
      .update({ organization_id: data.organization_id })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const listRecentEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("events")
      .select("id, type, payload, created_at, project_id, linked_projects(name, color)")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return data;
  });

export const listIdeas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("ideas")
      .select("*, linked_projects(name, color)")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  });

export const createIdea = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        title: z.string().min(1).max(200),
        body: z.string().max(2000).optional(),
        project_id: z.string().uuid().optional().nullable(),
        priority: z.number().int().min(1).max(5).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("ideas")
      .insert({
        owner_id: context.userId,
        title: data.title,
        body: data.body || null,
        project_id: data.project_id || null,
        priority: data.priority ?? 3,
      })
      .select()
      .single();
    if (error) throw error;
    return row;
  });

export const updateIdeaStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ id: z.string().uuid(), stage: z.string().max(40) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("ideas")
      .update({ stage: data.stage })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const deleteIdea = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("ideas").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const dashboardStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [projects, events, ideas, leads] = await Promise.all([
      context.supabase.from("linked_projects").select("id", { count: "exact", head: true }),
      context.supabase.from("events").select("id", { count: "exact", head: true }),
      context.supabase.from("ideas").select("id", { count: "exact", head: true }),
      context.supabase.from("leads").select("id", { count: "exact", head: true }),
    ]);
    return {
      projects: projects.count ?? 0,
      events: events.count ?? 0,
      ideas: ideas.count ?? 0,
      leads: leads.count ?? 0,
    };
  });
