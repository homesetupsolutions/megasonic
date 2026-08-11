// Server functions for attaching a card-on-file to a booking and charging a cancellation fee.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/open-access";

// Publishable Square config exposed to the booking page for the Web Payments SDK.
export const getSquarePublicConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    return {
      applicationId: process.env.SQUARE_APPLICATION_ID || "",
      locationId: process.env.SQUARE_LOCATION_ID || "",
      environment: (process.env.SQUARE_ENV ?? "production") === "sandbox" ? "sandbox" : "production",
    };
  });

export const attachCardToBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        bookingId: z.string().uuid(),
        sourceId: z.string().min(4).max(2048),
        verificationToken: z.string().max(2048).optional().nullable(),
        cardholderName: z.string().min(1).max(120),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: booking, error } = await supabase
      .from("bookings")
      .select("id, owner_id, customer_name, customer_email, customer_phone, square_customer_id")
      .eq("id", data.bookingId)
      .single();
    if (error || !booking) throw new Error("Booking not found");
    if (booking.owner_id !== userId) throw new Error("Forbidden");

    const { findOrCreateCustomer, attachCardToCustomer } = await import("@/lib/square-cards.server");

    const customerId =
      booking.square_customer_id ||
      (await findOrCreateCustomer({
        name: booking.customer_name,
        email: booking.customer_email,
        phone: booking.customer_phone,
      }));

    const card = await attachCardToCustomer({
      customerId,
      sourceId: data.sourceId,
      cardholderName: data.cardholderName,
      verificationToken: data.verificationToken,
    });

    const { error: updErr } = await supabase
      .from("bookings")
      .update({
        square_customer_id: customerId,
        square_card_id: card.cardId,
        card_brand: card.brand,
        card_last4: card.last4,
      } as never)
      .eq("id", data.bookingId);
    if (updErr) throw updErr;

    return { ok: true, brand: card.brand, last4: card.last4 };
  });

// Charges the cancellation fee if cancelled within 24h or no_show.
// Returns { charged: boolean, reason?: string, paymentId?: string }
export const chargeCancellationFee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ bookingId: z.string().uuid(), force: z.boolean().optional() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: b, error } = await supabase
      .from("bookings")
      .select(
        "id, owner_id, scheduled_at, status, square_customer_id, square_card_id, cancellation_fee_cents, cancellation_fee_charged_at, cancellation_payment_id",
      )
      .eq("id", data.bookingId)
      .single();
    if (error || !b) throw new Error("Booking not found");
    if (b.owner_id !== userId) throw new Error("Forbidden");
    if (b.cancellation_fee_charged_at)
      return { charged: false, reason: "already_charged", paymentId: b.cancellation_payment_id };
    if (!b.square_customer_id || !b.square_card_id)
      return { charged: false, reason: "no_card_on_file" };

    const scheduled = new Date(b.scheduled_at).getTime();
    const hoursUntil = (scheduled - Date.now()) / (1000 * 60 * 60);
    const withinWindow = hoursUntil < 24;
    const isNoShow = b.status === "no_show";
    if (!data.force && !withinWindow && !isNoShow) {
      return { charged: false, reason: "outside_window", hoursUntil };
    }

    const amount = b.cancellation_fee_cents ?? 4500;
    const { chargeSavedCard } = await import("@/lib/square-cards.server");
    const result = await chargeSavedCard({
      customerId: b.square_customer_id,
      cardId: b.square_card_id,
      amountCents: amount,
      note: `Cancellation fee for booking ${b.id}`,
      idempotencyKey: `cancel-${b.id}`,
    });

    await supabase
      .from("bookings")
      .update({
        cancellation_fee_charged_at: new Date().toISOString(),
        cancellation_payment_id: result.paymentId,
      } as never)
      .eq("id", b.id);

    return { charged: true, paymentId: result.paymentId, status: result.status, amount };
  });
