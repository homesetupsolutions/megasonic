// Public webhook for AI call reception (Callcentric, Twilio, etc.).
// Accepts a flexible payload, runs Lovable AI to extract intent + proposed booking,
// and stores a voice_calls row that the owner can approve in /calls.
//
// Payload shape (any combination works):
// {
//   owner_email?: string,           // OR owner_id — used to attribute the call
//   organization_slug?: string,     // "feelbass" | "hss"
//   from?: string, to?: string,
//   transcript?: string,
//   recording_url?: string,
//   started_at?: string,
//   duration_seconds?: number,
//   raw?: any
// }
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/voice-call")({
  server: {
    handlers: {
      GET: async () =>
        Response.json({ ok: true, note: "POST a JSON call payload to record an AI call." }),
      POST: async ({ request }) => {
        try {
          const body = (await request.json().catch(() => ({}))) as Record<string, any>;
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          // Resolve owner_id
          let ownerId: string | null = body.owner_id ?? null;
          if (!ownerId && body.owner_email) {
            const { data: prof } = await supabaseAdmin
              .from("profiles")
              .select("id")
              .ilike("display_name", body.owner_email)
              .maybeSingle();
            ownerId = prof?.id ?? null;
          }
          if (!ownerId) {
            // fall back to first user with an org (single-tenant friendly)
            const { data: anyOrg } = await supabaseAdmin
              .from("organizations")
              .select("owner_id")
              .limit(1)
              .maybeSingle();
            ownerId = anyOrg?.owner_id ?? null;
          }
          if (!ownerId) {
            return new Response(JSON.stringify({ ok: false, error: "No owner resolvable" }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          // Resolve organization
          let orgId: string | null = null;
          if (body.organization_slug) {
            const { data: org } = await supabaseAdmin
              .from("organizations")
              .select("id")
              .eq("owner_id", ownerId)
              .eq("slug", body.organization_slug)
              .maybeSingle();
            orgId = org?.id ?? null;
          }
          if (!orgId) {
            const { data: org } = await supabaseAdmin
              .from("organizations")
              .select("id")
              .eq("owner_id", ownerId)
              .limit(1)
              .maybeSingle();
            orgId = org?.id ?? null;
          }

          // Load this org's default call script (if any) so the AI speaks the owner's words
          let scriptBlock = "";
          if (orgId) {
            const { data: scriptRow } = await supabaseAdmin
              .from("call_scripts")
              .select("title, greeting, qualifying_questions, objection_handlers, closing, full_script")
              .eq("owner_id", ownerId)
              .eq("organization_id", orgId)
              .eq("direction", "inbound")
              .eq("is_default", true)
              .maybeSingle();
            if (scriptRow) {
              scriptBlock = scriptRow.full_script?.trim()
                ? `\n\nUSE THIS FULL SCRIPT VERBATIM:\n${scriptRow.full_script}`
                : `\n\nFOLLOW THIS SCRIPT:\nGREETING: ${scriptRow.greeting}\nQUESTIONS: ${scriptRow.qualifying_questions}\nOBJECTIONS: ${scriptRow.objection_handlers}\nCLOSING: ${scriptRow.closing}`;
            }
          }

          // Ask AI to extract intent + proposed booking
          let ai_summary = "";
          let ai_intent = "";
          let proposed_booking: Record<string, any> = {};
          const transcript: string = body.transcript ?? "";
          if (transcript && process.env.LOVABLE_API_KEY) {
            try {
              const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
                        "You are an AI receptionist for FeelBass and HSS. From a call transcript, return STRICT JSON: {intent, summary, proposed_booking:{customer_name,customer_phone,customer_email,scheduled_at(ISO8601),duration_minutes,notes}}. Omit fields you don't know. Use today's date if caller says relative times." +
                        scriptBlock,
                    },
                    { role: "user", content: transcript },
                  ],
                  response_format: { type: "json_object" },
                }),
              });
              const aiJson = await aiRes.json().catch(() => ({}));
              const content = aiJson?.choices?.[0]?.message?.content;
              if (content) {
                const parsed = JSON.parse(content);
                ai_intent = parsed.intent ?? "";
                ai_summary = parsed.summary ?? "";
                proposed_booking = parsed.proposed_booking ?? {};
                if (!proposed_booking.customer_phone && body.from) {
                  proposed_booking.customer_phone = body.from;
                }
              }
            } catch (e) {
              ai_summary = `AI parse error: ${e instanceof Error ? e.message : String(e)}`;
            }
          }

          const { data: row, error } = await (supabaseAdmin.from("voice_calls") as any)
            .insert({
              owner_id: ownerId,
              organization_id: orgId,
              from_number: body.from ?? null,
              to_number: body.to ?? null,
              started_at: body.started_at ?? new Date().toISOString(),
              duration_seconds: body.duration_seconds ?? null,
              transcript: transcript || null,
              recording_url: body.recording_url ?? null,
              ai_summary,
              ai_intent,
              proposed_booking,
              status: proposed_booking?.scheduled_at ? "pending_approval" : "logged",
              raw: body.raw ?? body,
            })
            .select("id")
            .single();
          if (error) throw error;

          return Response.json({ ok: true, id: row.id });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return new Response(JSON.stringify({ ok: false, error: msg }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
