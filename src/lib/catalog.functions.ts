import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ----- ORGS -----
export const listOrgs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("organizations")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data;
  });

export const updateOrgSquare = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        id: z.string().uuid(),
        square_location_id: z.string().max(64).optional().nullable(),
        square_enabled: z.boolean().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const patch: Record<string, unknown> = {};
    if (data.square_location_id !== undefined) patch.square_location_id = data.square_location_id;
    if (data.square_enabled !== undefined) patch.square_enabled = data.square_enabled;
    const { error } = await context.supabase.from("organizations").update(patch).eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// ----- SERVICES -----
export const listServices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ organization_id: z.string().uuid().optional() }).parse(i ?? {}))
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("services")
      .select("*, organizations(name, slug, kind)")
      .order("name", { ascending: true });
    if (data.organization_id) q = q.eq("organization_id", data.organization_id);
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows;
  });

// ----- PRICE CHANGE REQUESTS (approval queue) -----
export const listChangeRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("price_change_requests")
      .select("*, services(name, price_cents, currency), organizations(name, slug, kind)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return data;
  });

const CreateRequestSchema = z.object({
  organization_id: z.string().uuid(),
  service_id: z.string().uuid().optional().nullable(),
  change_type: z.enum(["create", "update", "delete", "price_only"]),
  payload: z.object({
    name: z.string().max(120).optional(),
    description: z.string().max(2000).optional().nullable(),
    price_cents: z.number().int().min(0).optional(),
    currency: z.string().length(3).optional(),
    duration_minutes: z.number().int().min(0).optional().nullable(),
    sku: z.string().max(64).optional().nullable(),
    active: z.boolean().optional(),
  }),
  reason: z.string().max(500).optional(),
});

export const createChangeRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => CreateRequestSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("price_change_requests")
      .insert({
        owner_id: context.userId,
        requested_by: context.userId,
        organization_id: data.organization_id,
        service_id: data.service_id ?? null,
        change_type: data.change_type,
        payload: data.payload,
        reason: data.reason ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return row;
  });

export const rejectChangeRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid(), reason: z.string().max(500).optional() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("price_change_requests")
      .update({
        status: "rejected",
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
        reason: data.reason ?? null,
      })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// approve + apply: writes to services table, optionally syncs to Square, logs propagation
export const approveChangeRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: req, error: reqErr } = await supabase
      .from("price_change_requests")
      .select("*")
      .eq("id", data.id)
      .single();
    if (reqErr || !req) throw new Error("Request not found");
    if (req.status !== "pending") throw new Error(`Already ${req.status}`);

    const payload = (req.payload ?? {}) as Record<string, any>;
    const log: any[] = [];
    let appliedServiceId: string | null = req.service_id;

    if (req.change_type === "create") {
      const { data: svc, error } = await supabase
        .from("services")
        .insert({
          owner_id: userId,
          organization_id: req.organization_id,
          name: payload.name ?? "Untitled service",
          description: payload.description ?? null,
          price_cents: payload.price_cents ?? 0,
          currency: payload.currency ?? "CAD",
          duration_minutes: payload.duration_minutes ?? null,
          sku: payload.sku ?? null,
          active: payload.active ?? true,
        })
        .select()
        .single();
      if (error) throw error;
      appliedServiceId = svc.id;
      log.push({ step: "service.created", id: svc.id });
    } else if (req.change_type === "delete" && req.service_id) {
      const { error } = await supabase.from("services").update({ active: false }).eq("id", req.service_id);
      if (error) throw error;
      log.push({ step: "service.deactivated", id: req.service_id });
    } else if ((req.change_type === "update" || req.change_type === "price_only") && req.service_id) {
      const patch: Record<string, any> = {};
      if (payload.name !== undefined) patch.name = payload.name;
      if (payload.description !== undefined) patch.description = payload.description;
      if (payload.price_cents !== undefined) patch.price_cents = payload.price_cents;
      if (payload.currency !== undefined) patch.currency = payload.currency;
      if (payload.duration_minutes !== undefined) patch.duration_minutes = payload.duration_minutes;
      if (payload.sku !== undefined) patch.sku = payload.sku;
      if (payload.active !== undefined) patch.active = payload.active;
      const { data: cur } = await supabase
        .from("services")
        .select("version")
        .eq("id", req.service_id)
        .single();
      patch.version = (cur?.version ?? 1) + 1;
      const { error } = await supabase.from("services").update(patch).eq("id", req.service_id);
      if (error) throw error;
      log.push({ step: "service.updated", id: req.service_id, patch });
    }

    // Square sync (best effort)
    let squareSynced = false;
    if (appliedServiceId) {
      try {
        const { syncServiceToSquareInternal } = await import("@/lib/square.server");
        const result = await syncServiceToSquareInternal({
          serviceId: appliedServiceId,
          organizationId: req.organization_id,
          ownerId: userId,
        });
        squareSynced = result.synced;
        log.push({ step: "square.sync", ...result });
      } catch (e) {
        log.push({ step: "square.sync.error", error: e instanceof Error ? e.message : String(e) });
      }
    }

    // Broadcast as event so linked projects see it via /api/public/catalog
    await supabase.from("events").insert({
      owner_id: userId,
      project_id: null,
      type: "catalog.updated",
      payload: { organization_id: req.organization_id, service_id: appliedServiceId, change_type: req.change_type },
    });

    const { error: updErr } = await supabase
      .from("price_change_requests")
      .update({
        status: "applied",
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
        applied_at: new Date().toISOString(),
        square_synced: squareSynced,
        propagation_log: log,
        service_id: appliedServiceId,
      })
      .eq("id", data.id);
    if (updErr) throw updErr;

    return { ok: true, log, squareSynced };
  });

// ----- BOOKINGS -----
export const listBookings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("bookings")
      .select("*, services(name, price_cents, currency), organizations(name, slug, kind)")
      .order("scheduled_at", { ascending: true });
    if (error) throw error;
    return data;
  });

export const createBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        organization_id: z.string().uuid(),
        service_id: z.string().uuid().optional().nullable(),
        customer_name: z.string().min(1).max(120),
        customer_email: z.string().email().optional().nullable().or(z.literal("")),
        customer_phone: z.string().max(40).optional().nullable(),
        scheduled_at: z.string(),
        duration_minutes: z.number().int().min(0).optional().nullable(),
        notes: z.string().max(1000).optional().nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("bookings")
      .insert({
        owner_id: context.userId,
        organization_id: data.organization_id,
        service_id: data.service_id ?? null,
        customer_name: data.customer_name,
        customer_email: data.customer_email || null,
        customer_phone: data.customer_phone ?? null,
        scheduled_at: data.scheduled_at,
        duration_minutes: data.duration_minutes ?? null,
        notes: data.notes ?? null,
        source: "manual",
      })
      .select()
      .single();
    if (error) throw error;
    return row;
  });

export const updateBookingStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["pending", "confirmed", "completed", "cancelled", "no_show"]),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("bookings").update({ status: data.status }).eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const listSquareLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("square_sync_log")
      .select("*, services(name)")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return data;
  });
