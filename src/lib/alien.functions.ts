import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

// ---------------- Phone lookup ----------------
function normalizePhone(p: string) {
  return p.replace(/[^\d+]/g, "");
}

export const lookupByPhone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ phone: z.string().min(3).max(40) }).parse(i))
  .handler(async ({ data, context }) => {
    const raw = data.phone.trim();
    const norm = normalizePhone(raw);
    const last7 = norm.slice(-7);
    const like = `%${last7}%`;
    const sb = context.supabase;

    const [leads, customers, bookings, calls, scripts] = await Promise.all([
      sb.from("leads").select("*").or(`phone.ilike.${like},phone.ilike.%${raw}%`).limit(10),
      sb.from("customers").select("*, organizations(name,slug,kind)").or(`phone.ilike.${like},phone.ilike.%${raw}%`).limit(10),
      sb.from("bookings").select("*, services(name), organizations(name,slug,kind)").or(`customer_phone.ilike.${like}`).order("scheduled_at", { ascending: false }).limit(10),
      sb.from("voice_calls").select("*").or(`from_number.ilike.${like},to_number.ilike.${like}`).order("created_at", { ascending: false }).limit(10),
      sb.from("call_scripts").select("id,title,direction,greeting,qualifying_questions,objection_handlers,closing,full_script, organizations(name,slug,kind), services(name)").order("is_default", { ascending: false }),
    ]);

    return {
      phone: raw,
      leads: leads.data ?? [],
      customers: customers.data ?? [],
      bookings: bookings.data ?? [],
      calls: calls.data ?? [],
      scripts: scripts.data ?? [],
    };
  });

// ---------------- Ask Alien (chat) ----------------
const MsgSchema = z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(8000) });

export const askAlien = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    messages: z.array(MsgSchema).min(1).max(40),
    phone: z.string().optional().nullable(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;

    // Gather business context in parallel
    const [orgs, services, leads, customers, bookings, scripts, actions, ideas, grants, investors, settings] = await Promise.all([
      sb.from("organizations").select("id,name,slug,kind").limit(20),
      sb.from("services").select("id,name,price_cents,duration_minutes,description, organizations(name,slug)").limit(50),
      sb.from("leads").select("id,name,phone,email,stage,notes,created_at").order("created_at",{ascending:false}).limit(20),
      sb.from("customers").select("id,name,phone,email,notes, organizations(name,slug)").limit(20),
      sb.from("bookings").select("id,customer_name,customer_phone,scheduled_at,status, services(name), organizations(name,slug)").order("scheduled_at",{ascending:false}).limit(20),
      sb.from("call_scripts").select("id,title,direction,greeting,qualifying_questions,objection_handlers,closing,full_script, organizations(name,slug), services(name)").limit(30),
      sb.from("ai_actions").select("id,kind,title,status,priority,created_at").order("created_at",{ascending:false}).limit(20),
      sb.from("ideas").select("id,title,notes,status").limit(20),
      sb.from("grants").select("id,name,amount_cents,status,deadline_date,notes").limit(20),
      sb.from("investors").select("id,name,firm,email,status,notes").limit(20),
      sb.from("ai_settings").select("guidance").eq("user_id", context.userId).maybeSingle(),
    ]);

    let phoneCtx: unknown = null;
    if (data.phone && data.phone.trim()) {
      const norm = normalizePhone(data.phone);
      const last7 = norm.slice(-7);
      const like = `%${last7}%`;
      const [l, c, b, v] = await Promise.all([
        sb.from("leads").select("*").or(`phone.ilike.${like}`).limit(5),
        sb.from("customers").select("*").or(`phone.ilike.${like}`).limit(5),
        sb.from("bookings").select("*").or(`customer_phone.ilike.${like}`).order("starts_at",{ascending:false}).limit(5),
        sb.from("voice_calls").select("*").or(`from_number.ilike.${like},to_number.ilike.${like}`).order("created_at",{ascending:false}).limit(5),
      ]);
      phoneCtx = { phone: data.phone, leads: l.data, customers: c.data, bookings: b.data, calls: v.data };
    }

    const systemPrompt = `You are ALIEN 🛸 — a hyper-helpful, playful, rainbow-coded AI sidekick for MagaSonic (FeelBass + HSS - Home Setup Solutions).
You help the owner's mom run the businesses, answer ANY question about leads, customers, bookings, services, scripts, grants, investors, and pricing — and you suggest the next money-making move.
Be CONCISE, friendly, use emojis sparingly, format with markdown bullets/headers when useful. If a phone number is supplied, use the phoneContext to give personalized guidance. If asked to "read me the script", output the FULL script verbatim. Never invent customers or numbers — say "no match" if not in context.

OWNER GUIDANCE:
${settings.data?.guidance || "(none yet)"}

BUSINESS CONTEXT (JSON):
${JSON.stringify({
  organizations: orgs.data, services: services.data, leads: leads.data, customers: customers.data,
  bookings: bookings.data, scripts: scripts.data, actions: actions.data, ideas: ideas.data,
  grants: grants.data, investors: investors.data,
}).slice(0, 60000)}

PHONE CONTEXT: ${phoneCtx ? JSON.stringify(phoneCtx).slice(0, 8000) : "none"}`;

    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");
    const res = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "system", content: systemPrompt }, ...data.messages],
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Alien gateway ${res.status}: ${body.slice(0, 300)}`);
    }
    const json = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
    return { reply: json.choices?.[0]?.message?.content ?? "(no reply)" };
  });

// Notifications — recent activity
export const alienNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const [actions, runs, leads, bookings, calls] = await Promise.all([
      sb.from("ai_actions").select("id,kind,title,status,created_at").order("created_at",{ascending:false}).limit(8),
      sb.from("ai_runs").select("id,status,started_at,actions_count,summary").order("started_at",{ascending:false}).limit(5),
      sb.from("leads").select("id,name,phone,stage,created_at").order("created_at",{ascending:false}).limit(5),
      sb.from("bookings").select("id,customer_name,scheduled_at,status").order("created_at",{ascending:false}).limit(5),
      sb.from("voice_calls").select("id,from_number,to_number,status,created_at").order("created_at",{ascending:false}).limit(5),
    ]);
    return {
      actions: actions.data ?? [], runs: runs.data ?? [],
      leads: leads.data ?? [], bookings: bookings.data ?? [], calls: calls.data ?? [],
    };
  });
