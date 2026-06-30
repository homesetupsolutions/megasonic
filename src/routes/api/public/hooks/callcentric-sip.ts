// CallCentric SIP-trunk inbound hook.
// Configure your CallCentric "Call Treatment → URL" or use any SIP→HTTP bridge
// (e.g. FreePBX, Asterisk dialplan System() call, Zapier) to POST here when a call rings.
//
// POST body:  { did: "17778140621", from?: "...", call_id?: "..." }
// Returns a JSON routing instruction:
//   { route: "ivr"|"et"|"extension"|"voicemail",
//     extension?: "100", voice: "alloy",
//     greeting: "<text to speak>", say_extensions: true }
//
// Your bridge plays `greeting` with TTS using `voice`, then dials `extension`
// or transfers to your AI (`et`).
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/callcentric-sip")({
  server: {
    handlers: {
      GET: async () =>
        Response.json({
          ok: true,
          note: "POST {did, from, call_id} to get routing JSON for this inbound call.",
        }),
      POST: async ({ request }) => {
        try {
          const body = (await request.json().catch(() => ({}))) as Record<string, any>;
          const did = String(body.did ?? "").replace(/[^\d+]/g, "");
          if (!did) return Response.json({ ok: false, error: "missing did" }, { status: 400 });

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: trunk } = await (supabaseAdmin.from("sip_trunks" as never) as any)
            .select("*")
            .eq("did", did)
            .eq("enabled", true)
            .maybeSingle();

          if (!trunk) {
            return Response.json({
              ok: true,
              route: "voicemail",
              voice: "alloy",
              greeting: "Sorry, this line is not configured. Please leave a message.",
            });
          }

          const { data: settings } = await (supabaseAdmin.from("ai_settings") as any)
            .select("ivr_voice, ivr_greeting")
            .eq("user_id", trunk.owner_id)
            .maybeSingle();

          const voice = trunk.voice || settings?.ivr_voice || "alloy";
          const greeting =
            trunk.inbound_route === "ivr"
              ? settings?.ivr_greeting ||
                "Thanks for calling. Press 1 for HSS, 2 for FeelBass, 9 for our AI assistant ET."
              : trunk.inbound_route === "et"
                ? "Hi! You've reached ET, the AI assistant. How can I help?"
                : trunk.inbound_route === "extension"
                  ? `Connecting you to extension ${trunk.inbound_extension}.`
                  : "Please leave a message after the tone.";

          // Log the call
          await (supabaseAdmin.from("phone_calls" as never) as any).insert({
            owner_id: trunk.owner_id,
            direction: "inbound",
            from_number: body.from ?? null,
            to_number: did,
            started_at: new Date().toISOString(),
            raw: body,
          });

          return Response.json({
            ok: true,
            route: trunk.inbound_route,
            extension: trunk.inbound_extension,
            voice,
            greeting,
            say_extensions: trunk.inbound_route === "ivr",
          });
        } catch (e) {
          return Response.json(
            { ok: false, error: e instanceof Error ? e.message : String(e) },
            { status: 500 },
          );
        }
      },
    },
  },
});
