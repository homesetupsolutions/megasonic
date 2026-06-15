// Yealink Action URL webhook.
// Configure in phone web UI → Features → Action URL with any of:
//   Incoming Call: https://.../api/public/hooks/yealink-cdr?event=incoming&mac=$mac&remote=$remote&display_remote=$display_remote&local=$local&active_user=$active_user
//   Outgoing Call: ?event=outgoing&...
//   Call Established: ?event=connected&...
//   Call Terminated: ?event=disconnected&...
//   Missed Call:     ?event=missed&...
// All variables are optional; the handler accepts both GET (query string) and POST (json or form).
import { createFileRoute } from "@tanstack/react-router";

function pick(obj: Record<string, any>, ...keys: string[]) {
  for (const k of keys) {
    const v = obj[k];
    if (v !== undefined && v !== null && String(v).length > 0) return String(v);
  }
  return null;
}

async function handle(request: Request) {
  const url = new URL(request.url);
  const q: Record<string, any> = Object.fromEntries(url.searchParams.entries());
  let body: Record<string, any> = {};
  if (request.method === "POST") {
    const ct = request.headers.get("content-type") || "";
    try {
      if (ct.includes("application/json")) body = await request.json();
      else if (ct.includes("form")) {
        const fd = await request.formData();
        fd.forEach((v, k) => (body[k] = v));
      } else {
        const t = await request.text();
        if (t.startsWith("{")) body = JSON.parse(t);
      }
    } catch {}
  }
  const data = { ...q, ...body };

  const mac = pick(data, "mac", "MAC", "mac_address")?.toLowerCase().replace(/[^a-f0-9]/g, "") ?? null;
  const event = (pick(data, "event", "type", "call_status") || "unknown").toLowerCase();
  const remote = pick(data, "remote", "from", "caller", "caller_number");
  const local = pick(data, "local", "to", "callee", "callee_number", "active_user");
  const displayRemote = pick(data, "display_remote", "caller_name", "from_name");
  const duration = Number(pick(data, "duration", "duration_seconds", "talk_time") || 0);

  const inboundEvents = ["incoming", "ringing", "missed", "rejected"];
  const outboundEvents = ["outgoing", "dialing", "established", "connected", "disconnected"];
  // direction defaults to inbound if event hints at incoming, else outbound if outgoing, else infer from numbers
  let direction: "inbound" | "outbound" = "inbound";
  if (outboundEvents.includes(event)) direction = "outbound";
  else if (inboundEvents.includes(event)) direction = "inbound";

  const answered = ["connected", "established", "answered"].includes(event);
  const missed = event === "missed";

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Resolve device + owner
    let ownerId: string | null = null;
    let deviceId: string | null = null;
    if (mac) {
      const { data: dev } = await supabaseAdmin
        .from("phone_devices")
        .select("id, owner_id")
        .eq("mac_address", mac)
        .maybeSingle();
      if (dev) {
        ownerId = dev.owner_id;
        deviceId = dev.id;
      }
    }
    if (!ownerId) {
      const { data: anyOrg } = await supabaseAdmin
        .from("organizations")
        .select("owner_id")
        .limit(1)
        .maybeSingle();
      ownerId = anyOrg?.owner_id ?? null;
    }
    if (!ownerId) {
      return Response.json({ ok: false, error: "No owner resolvable" }, { status: 400 });
    }

    // Try to link to an existing lead by phone. If new inbound caller, enrich via Square + create lead.
    let leadId: string | null = null;
    let squareCustomer: Awaited<ReturnType<typeof import("@/lib/square-customers.server").findSquareCustomerByPhone>> = null;
    const phoneToMatch = direction === "inbound" ? remote : local;
    if (phoneToMatch) {
      const { data: lead } = await supabaseAdmin
        .from("leads")
        .select("id")
        .eq("owner_id", ownerId)
        .eq("phone", phoneToMatch)
        .maybeSingle();
      if (lead) {
        leadId = lead.id;
      } else if (direction === "inbound" && (event === "incoming" || event === "missed")) {
        const { findSquareCustomerByPhone } = await import("@/lib/square-customers.server");
        squareCustomer = await findSquareCustomerByPhone(phoneToMatch);
        const { data: created } = await (supabaseAdmin.from("leads") as any)
          .insert({
            owner_id: ownerId,
            name: squareCustomer?.name || displayRemote || `Caller ${phoneToMatch}`,
            phone: phoneToMatch,
            email: squareCustomer?.email ?? null,
            source: squareCustomer ? "desk_phone+square" : "desk_phone",
            status: missed ? "missed_call" : "new",
            notes: squareCustomer
              ? `Matched Square customer ${squareCustomer.id}${squareCustomer.note ? ` — ${squareCustomer.note}` : ""}`
              : `Auto-created from ${missed ? "missed" : "incoming"} call on ${new Date().toISOString()}`,
          })
          .select("id")
          .single();
        leadId = created?.id ?? null;
      }
    }

    await (supabaseAdmin.from("phone_calls") as any).insert({
      owner_id: ownerId,
      device_id: deviceId,
      mac_address: mac,
      direction,
      event,
      caller_number: direction === "inbound" ? remote : local,
      caller_name: squareCustomer?.name || displayRemote,
      callee_number: direction === "inbound" ? local : remote,
      duration_seconds: duration,
      answered,
      missed,
      lead_id: leadId,
      started_at: new Date().toISOString(),
      ended_at: answered || event === "disconnected" ? new Date().toISOString() : null,
      raw: data,
    });

    // Surface in alien feed
    await (supabaseAdmin.from("ai_actions") as any).insert({
      owner_id: ownerId,
      kind: "phone_call",
      title: `${direction === "inbound" ? "📞 Incoming" : "📲 Outgoing"} ${event}: ${displayRemote || remote || local || "unknown"}`,
      payload: { event, remote, local, duration, mac },
      status: "logged",
      priority: missed ? 2 : 1,
    });

    return Response.json({ ok: true, lead_id: leadId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}

export const Route = createFileRoute("/api/public/hooks/yealink-cdr")({
  server: {
    handlers: {
      GET: async ({ request }) => handle(request),
      POST: async ({ request }) => handle(request),
    },
  },
});
