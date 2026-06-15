// Daily Facebook post + DM script generator.
// Runs once per day via cron. Produces draft content the user copies & posts manually.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

export type SocialDraft = {
  fb_post: string;
  fb_dm_warm: string;
  fb_dm_cold: string;
  caption_short: string;
  hashtags: string[];
};

export const generateDailySocialDraft = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ context: z.string().max(1000).optional() }).parse(i ?? {}))
  .handler(async ({ data }): Promise<SocialDraft> => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const system =
      "You write daily social media content for three local businesses owned by the same person: " +
      "FeelBass (mobile DJ + party audio), Home Setup Solutions (TV mounting, smart-home setup), " +
      "and FeelBass POS (point-of-sale for small businesses). Tone: friendly, confident, local, " +
      "no emojis spam. Return ONLY JSON matching the schema, no prose.";

    const user =
      `Generate today's social content as strict JSON with keys: fb_post (2-4 sentences ending with a CTA), ` +
      `fb_dm_warm (one short message to a past customer asking for a referral or repeat booking), ` +
      `fb_dm_cold (one short outreach to a local business that could use audio/AV/POS help), ` +
      `caption_short (one line), hashtags (array of up to 8 strings starting with #). ` +
      `Vary which of the three businesses is the focus day-to-day; today, pick one and lean into it. ` +
      `Extra context: ${data.context ?? "none"}`;

    const res = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`AI gateway ${res.status}: ${body.slice(0, 300)}`);
    }
    const json = await res.json();
    const content = json?.choices?.[0]?.message?.content ?? "{}";
    let parsed: unknown;
    try { parsed = JSON.parse(content); } catch { parsed = {}; }
    const p = parsed as Partial<SocialDraft>;
    return {
      fb_post: String(p.fb_post ?? ""),
      fb_dm_warm: String(p.fb_dm_warm ?? ""),
      fb_dm_cold: String(p.fb_dm_cold ?? ""),
      caption_short: String(p.caption_short ?? ""),
      hashtags: Array.isArray(p.hashtags) ? p.hashtags.map(String).slice(0, 8) : [],
    };
  });
