// Daily Facebook post + DM script generator.
// Runs once per day via cron. Produces draft content the user copies & posts manually.
import { createServerFn } from "@tanstack/react-start";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { generateText, Output } from "ai";
import { z } from "zod";

const SocialOutput = z.object({
  fb_post: z.string(),
  fb_dm_warm: z.string(),
  fb_dm_cold: z.string(),
  caption_short: z.string(),
  hashtags: z.array(z.string()).max(8),
});

export const generateDailySocialDraft = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ context: z.string().optional() }).parse(input ?? {}))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");
    const gateway = createLovableAiGatewayProvider(key);
    const { output } = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      output: Output.object({ schema: SocialOutput }),
      prompt: `You are the social media voice for FeelBass (mobile DJ/audio), Home Setup Solutions (TV mounting, smart-home), and FeelBass POS. Write today's content: 1 punchy Facebook post (2-4 sentences, casual, ends with a CTA), 1 warm follow-up DM for past customers, 1 cold outreach DM for a local business, 1 short caption, and up to 8 hashtags. Tone: friendly, confident, local. ${data.context ?? ""}`,
    });
    return output;
  });
