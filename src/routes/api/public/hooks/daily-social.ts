// Public cron hook — generates today's social drafts and stores them in activity_log.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/daily-social")({
  server: {
    handlers: {
      GET: async () => Response.json({ ok: true, note: "POST to generate today's social drafts" }),
      POST: async () => {
        try {
          const key = process.env.LOVABLE_API_KEY;
          if (!key) throw new Error("Missing LOVABLE_API_KEY");

          const system =
            "You write daily social media content for three businesses owned by the same person: " +
            "FeelBass (mobile DJ + party audio), Home Setup Solutions (TV mounting + smart-home), " +
            "and FeelBass POS. Friendly, confident, local. Return ONLY JSON.";
          const user =
            "Generate today's content as JSON: fb_post (2-4 sentences w/ CTA), fb_dm_warm (DM to past customer), " +
            "fb_dm_cold (cold outreach DM to a local business), caption_short, hashtags (array up to 8). " +
            "Pick ONE of the three businesses to lead with today; rotate naturally day to day.";

          const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [
                { role: "system", content: system },
                { role: "user", content: user },
              ],
              response_format: { type: "json_object" },
            }),
          });

          if (!aiRes.ok) {
            const body = await aiRes.text();
            return new Response(JSON.stringify({ ok: false, error: `AI ${aiRes.status}: ${body.slice(0, 200)}` }), {
              status: 502, headers: { "Content-Type": "application/json" },
            });
          }

          const ai = await aiRes.json();
          const content = ai?.choices?.[0]?.message?.content ?? "{}";
          let draft: Record<string, unknown> = {};
          try { draft = JSON.parse(content); } catch { /* ignore */ }

          // Drop one pending ai_action per user so it appears in the alien feed for review.
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: profiles } = await supabaseAdmin.from("profiles").select("id");
          const rows = (profiles ?? []).map((p: { id: string }) => ({
            owner_id: p.id,
            kind: "daily_social_draft",
            title: "Today's Facebook post + DM drafts ready",
            payload: draft as never,
            status: "pending",
            priority: 1,
          }));
          if (rows.length) {
            await supabaseAdmin.from("ai_actions").insert(rows);
          }

          return Response.json({ ok: true, recipients: rows.length, draft });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return new Response(JSON.stringify({ ok: false, error: msg }), {
            status: 500, headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
