import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/open-access";

export const listCalls = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("voice_calls")
      .select("*, organizations(name, slug, kind)")
      .order("started_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return data;
  });

export const approveCallBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: call, error } = await context.supabase
      .from("voice_calls")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error || !call) throw new Error("Call not found");

    const pb = (call.proposed_booking ?? {}) as Record<string, any>;
    if (!pb.scheduled_at || !pb.customer_name || !call.organization_id) {
      throw new Error("Proposed booking is incomplete");
    }

    const { data: booking, error: bErr } = await context.supabase
      .from("bookings")
      .insert({
        owner_id: context.userId,
        organization_id: call.organization_id,
        service_id: pb.service_id ?? null,
        customer_name: pb.customer_name,
        customer_email: pb.customer_email ?? null,
        customer_phone: pb.customer_phone ?? call.from_number ?? null,
        scheduled_at: pb.scheduled_at,
        duration_minutes: pb.duration_minutes ?? null,
        notes: pb.notes ?? call.ai_summary ?? null,
        source: "ai_call",
        status: "confirmed",
      })
      .select()
      .single();
    if (bErr) throw bErr;

    await context.supabase
      .from("voice_calls")
      .update({ status: "booked", booking_id: booking.id })
      .eq("id", data.id);

    return { ok: true, bookingId: booking.id };
  });

export const rejectCallBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("voice_calls")
      .update({ status: "rejected" })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });
