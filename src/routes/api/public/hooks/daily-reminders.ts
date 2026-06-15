// Daily appointment reminder runner. Called hourly by pg_cron.
// For each user whose reminder_hour matches the current UTC hour (and not yet sent today),
// finds all bookings in the next reminder_lead_hours window and queues a reminder
// for each — as a click-to-dial action, draft SMS, or draft email.
import { createFileRoute } from "@tanstack/react-router";

async function generateReminderText(args: {
  customerName: string;
  serviceName?: string | null;
  whenLocal: string;
  org: string;
  method: string;
}) {
  const fallback =
    args.method === "queue_call"
      ? `Hi ${args.customerName}, this is ${args.org} confirming your appointment${args.serviceName ? ` for ${args.serviceName}` : ""} at ${args.whenLocal}. See you then — call us back if you need to reschedule.`
      : `Hi ${args.customerName}! Reminder: your ${args.serviceName ?? "appointment"} with ${args.org} is at ${args.whenLocal}. Reply to confirm or reschedule. — ${args.org}`;
  if (!process.env.LOVABLE_API_KEY) return fallback;
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              args.method === "queue_call"
                ? "Write a 25-word friendly phone-call reminder script the staff can read out loud. Plain text, no greetings list."
                : "Write a 25-word friendly appointment reminder. Plain text, one paragraph.",
          },
          {
            role: "user",
            content: `Customer: ${args.customerName}. Service: ${args.serviceName ?? "appointment"}. When: ${args.whenLocal}. Business: ${args.org}.`,
          },
        ],
        max_tokens: 120,
      }),
    });
    const j = await res.json();
    return j?.choices?.[0]?.message?.content?.trim() || fallback;
  } catch {
    return fallback;
  }
}

async function runForOwner(ownerId: string, settings: any, today: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const now = new Date();
  const horizon = new Date(now.getTime() + settings.reminder_lead_hours * 3600 * 1000);

  const { data: bookings } = await supabaseAdmin
    .from("bookings")
    .select("id, customer_name, customer_phone, customer_email, scheduled_at, duration_minutes, status, service_id, organization_id, services(name), organizations(name)")
    .eq("owner_id", ownerId)
    .gte("scheduled_at", now.toISOString())
    .lte("scheduled_at", horizon.toISOString())
    .in("status", ["pending", "confirmed"]);

  if (!bookings || bookings.length === 0) {
    await supabaseAdmin.from("ai_settings").update({ last_reminders_date: today }).eq("user_id", ownerId);
    return { processed: 0 };
  }

  // Grab first registered desk phone for click-to-dial (Yealink HTTP API)
  const { data: device } = await supabaseAdmin
    .from("phone_devices")
    .select("mac_address, label, sip_username")
    .eq("owner_id", ownerId)
    .limit(1)
    .maybeSingle();

  let queued = 0;
  for (const b of bookings as any[]) {
    const orgName = b.organizations?.name ?? "your appointment";
    const serviceName = b.services?.name ?? null;
    const whenLocal = new Date(b.scheduled_at).toLocaleString("en-US", {
      weekday: "short",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    });
    const text = await generateReminderText({
      customerName: b.customer_name,
      serviceName,
      whenLocal,
      org: orgName,
      method: settings.reminder_method,
    });

    const kindMap: Record<string, string> = {
      queue_call: "call_reminder",
      draft_sms: "sms_reminder",
      draft_email: "email_reminder",
    };
    const kind = kindMap[settings.reminder_method] ?? "call_reminder";
    const iconMap: Record<string, string> = {
      queue_call: "☎️",
      draft_sms: "💬",
      draft_email: "✉️",
    };

    await (supabaseAdmin.from("ai_actions") as any).insert({
      owner_id: ownerId,
      kind,
      title: `${iconMap[settings.reminder_method] ?? "🔔"} Reminder: ${b.customer_name} @ ${whenLocal}`,
      payload: {
        booking_id: b.id,
        customer_name: b.customer_name,
        customer_phone: b.customer_phone,
        customer_email: b.customer_email,
        scheduled_at: b.scheduled_at,
        service: serviceName,
        script: text,
        click_to_dial_phone: b.customer_phone,
        from_device: device ? { mac: device.mac_address, label: device.label } : null,
      },
      status: "pending",
      priority: 2,
    });
    queued++;
  }

  await supabaseAdmin.from("ai_settings").update({ last_reminders_date: today }).eq("user_id", ownerId);
  return { processed: queued };
}

export const Route = createFileRoute("/api/public/hooks/daily-reminders")({
  server: {
    handlers: {
      GET: async () => Response.json({ ok: true, note: "POST to run reminder dispatch" }),
      POST: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const forceOwner = url.searchParams.get("owner_id");
          const force = url.searchParams.get("force") === "1";

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const nowHourUTC = new Date().getUTCHours();
          const today = new Date().toISOString().slice(0, 10);

          let query = supabaseAdmin
            .from("ai_settings")
            .select("user_id, reminder_enabled, reminder_hour, reminder_minute, reminder_method, reminder_lead_hours, last_reminders_date")
            .eq("reminder_enabled", true);
          if (forceOwner) query = query.eq("user_id", forceOwner);

          const { data: settingsRows } = await query;
          const results: any[] = [];
          for (const s of (settingsRows as any[]) ?? []) {
            const hourMatches = s.reminder_hour === nowHourUTC;
            const notYetToday = s.last_reminders_date !== today;
            if (force || (hourMatches && notYetToday)) {
              const r = await runForOwner(s.user_id, s, today);
              results.push({ owner_id: s.user_id, ...r });
            }
          }
          return Response.json({ ok: true, results });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return Response.json({ ok: false, error: msg }, { status: 500 });
        }
      },
    },
  },
});
