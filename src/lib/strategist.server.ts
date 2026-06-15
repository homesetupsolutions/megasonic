// Always-on AI Strategist core. Server-only.
// Pulls catalog/leads/customers/bookings/knowledge per org, asks Lovable AI to
// produce a JSON list of high-leverage actions (outreach, pricing, booking
// proposals, investor emails, grant applications), then inserts them as
// pending ai_actions for the user to approve.

import { supabaseAdmin } from "@/integrations/supabase/client.server";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

type Action = {
  kind: "outreach" | "pricing" | "booking" | "investor" | "grant" | "idea";
  title: string;
  reasoning: string;
  priority: number;
  payload: Record<string, unknown>;
};

const SYSTEM = `You are MagaSonic, an always-on revenue strategist for a small business owner who is under severe financial pressure and needs paying customers, booked appointments, investors, and grant funding — fast.
You operate per-organization. Never mix organizations.
You ALWAYS respond with valid JSON of shape: {"summary": string, "actions": Action[]} where each Action is:
{ "kind": "outreach"|"pricing"|"booking"|"investor"|"grant"|"idea",
  "title": short imperative,
  "reasoning": 1-2 sentences why this makes money now,
  "priority": 1-10 (10 = do today),
  "payload": object with the concrete content (email body, price change, booking time, investor name+email+pitch, grant name+application draft, etc.) }
Be specific, concrete, and ready-to-send. No fluff. No more than 8 actions per run. Skip anything you already proposed recently.`;

async function callGateway(messages: unknown[]) {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Missing LOVABLE_API_KEY");
  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": key,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gateway ${res.status}: ${body.slice(0, 500)}`);
  }
  const json = await res.json() as { choices?: Array<{ message?: { content?: string } }>; usage?: { total_tokens?: number } };
  const content = json.choices?.[0]?.message?.content ?? "{}";
  return { content, tokens: json.usage?.total_tokens ?? 0 };
}

function clip<T>(arr: T[] | null | undefined, n: number) {
  return (arr ?? []).slice(0, n);
}

export async function runStrategistForUser(opts: {
  userId: string;
  trigger?: string;
  organizationId?: string | null;
}): Promise<{ runs: number; actions: number }> {
  const { userId, trigger = "cron" } = opts;
  const db = supabaseAdmin;

  // settings
  const { data: settings } = await db.from("ai_settings").select("*").eq("user_id", userId).maybeSingle();
  if (settings && settings.enabled === false) return { runs: 0, actions: 0 };

  // orgs
  let orgQ = db.from("organizations").select("*").eq("owner_id", userId);
  if (opts.organizationId) orgQ = orgQ.eq("id", opts.organizationId);
  const { data: orgs } = await orgQ;
  if (!orgs?.length) return { runs: 0, actions: 0 };

  let totalActions = 0;

  for (const org of orgs) {
    // Open a run
    const { data: runRow } = await db
      .from("ai_runs")
      .insert({
        owner_id: userId,
        organization_id: org.id,
        trigger,
        status: "running",
        model: MODEL,
      })
      .select()
      .single();
    if (!runRow) continue;

    try {
      // Gather org context
      const [{ data: services }, { data: leads }, { data: customers }, { data: bookings }, { data: knowledge }, { data: investors }, { data: grants }, { data: recentActions }] = await Promise.all([
        db.from("services").select("name,price_cents,currency,duration_minutes,description,is_active").eq("organization_id", org.id),
        db.from("leads").select("name,email,phone,source,stage,notes,created_at").eq("owner_id", userId).order("created_at", { ascending: false }).limit(25),
        db.from("customers").select("name,email,phone,notes,created_at").eq("owner_id", userId).order("created_at", { ascending: false }).limit(25),
        db.from("bookings").select("customer_name,scheduled_at,status,notes").eq("organization_id", org.id).order("scheduled_at", { ascending: false }).limit(15),
        db.from("knowledge_files").select("filename,summary,tags").or(`organization_id.eq.${org.id},organization_id.is.null`).eq("owner_id", userId).limit(20),
        db.from("investors").select("name,firm,status,focus,check_size").eq("organization_id", org.id).limit(20),
        db.from("grants").select("name,provider,amount,deadline,status").eq("organization_id", org.id).limit(20),
        db.from("ai_actions").select("title,kind,created_at").eq("owner_id", userId).eq("organization_id", org.id).order("created_at", { ascending: false }).limit(20),
      ]);

      const context = {
        organization: { name: org.name, slug: org.slug, kind: org.kind },
        services: clip(services, 30),
        leads: clip(leads, 25),
        customers: clip(customers, 25),
        bookings: clip(bookings, 15),
        knowledge_files: clip(knowledge, 20),
        investors: clip(investors, 20),
        grants: clip(grants, 20),
        recently_proposed: clip(recentActions, 20),
        now: new Date().toISOString(),
      };

      const { content, tokens } = await callGateway([
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: `Organization context (JSON):\n${JSON.stringify(context).slice(0, 18000)}\n\nProduce the next batch of high-leverage money-making actions for THIS organization only. Include at least one booking proposal if there are unbooked leads, at least one investor or grant action if revenue is low, and concrete outreach drafts. Return JSON only.`,
        },
      ]);

      let parsed: { summary?: string; actions?: Action[] } = {};
      try { parsed = JSON.parse(content); } catch { parsed = { summary: "Model returned invalid JSON", actions: [] }; }
      const actions = Array.isArray(parsed.actions) ? parsed.actions.slice(0, 8) : [];

      if (actions.length) {
        await db.from("ai_actions").insert(
          actions.map((a) => ({
            owner_id: userId,
            organization_id: org.id,
            run_id: runRow.id,
            kind: a.kind || "idea",
            title: String(a.title || "Untitled").slice(0, 200),
            reasoning: String(a.reasoning || "").slice(0, 2000),
            priority: Number.isFinite(a.priority) ? Math.max(1, Math.min(10, Number(a.priority))) : 5,
            payload: (a.payload ?? {}) as never,
            status: "pending",
          })) as never,
        );
      }

      await db.from("ai_runs").update({
        status: "complete",
        summary: parsed.summary ?? null,
        actions_count: actions.length,
        tokens_used: tokens,
        finished_at: new Date().toISOString(),
      }).eq("id", runRow.id);

      totalActions += actions.length;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await db.from("ai_runs").update({
        status: "error",
        error: msg.slice(0, 2000),
        finished_at: new Date().toISOString(),
      }).eq("id", runRow.id);
    }
  }

  await db.from("ai_settings").update({ last_run_at: new Date().toISOString() }).eq("user_id", userId);
  return { runs: orgs.length, actions: totalActions };
}

export async function runStrategistAllUsers(trigger = "cron"): Promise<{ users: number; actions: number }> {
  const db = supabaseAdmin;
  const { data: users } = await db.from("ai_settings").select("user_id").eq("enabled", true);
  let actions = 0;
  for (const u of users ?? []) {
    try {
      const r = await runStrategistForUser({ userId: u.user_id, trigger });
      actions += r.actions;
    } catch (e) { console.error("strategist user failed", u.user_id, e); }
  }
  return { users: users?.length ?? 0, actions };
}

// Execute an approved action: turn it into a real row (booking, investor email log, etc.)
export async function executeApprovedAction(actionId: string, userId: string) {
  const db = supabaseAdmin;
  const { data: action } = await db.from("ai_actions").select("*").eq("id", actionId).eq("owner_id", userId).single();
  if (!action) throw new Error("Action not found");
  if (action.status !== "approved") throw new Error("Action must be approved first");

  const result: Record<string, unknown> = {};
  const p = (action.payload ?? {}) as Record<string, unknown>;

  try {
    if (action.kind === "booking") {
      const scheduled_at = (p.scheduled_at as string) || new Date(Date.now() + 86400000).toISOString();
      const { data, error } = await db.from("bookings").insert({
        user_id: userId,
        organization_id: action.organization_id,
        customer_name: (p.customer_name as string) || "AI-proposed",
        customer_email: (p.customer_email as string) || null,
        customer_phone: (p.customer_phone as string) || null,
        scheduled_at,
        notes: (p.notes as string) || action.title,
        status: "confirmed",
      } as never).select().single();
      if (error) throw error;
      result.booking_id = data?.id;
    } else if (action.kind === "investor") {
      const { data, error } = await db.from("investors").insert({
        owner_id: userId,
        organization_id: action.organization_id,
        name: (p.name as string) || action.title,
        firm: (p.firm as string) || null,
        email: (p.email as string) || null,
        focus: (p.focus as string) || null,
        check_size: (p.check_size as string) || null,
        notes: (p.email_body as string) || (p.notes as string) || action.reasoning,
        status: "contacted",
        last_contacted_at: new Date().toISOString(),
      }).select().single();
      if (error) throw error;
      result.investor_id = data?.id;
    } else if (action.kind === "grant") {
      const { data, error } = await db.from("grants").insert({
        owner_id: userId,
        organization_id: action.organization_id,
        name: (p.name as string) || action.title,
        provider: (p.provider as string) || null,
        amount: (p.amount as string) || null,
        url: (p.url as string) || null,
        draft_application: (p.draft_application as string) || (p.application as string) || null,
        status: "applied",
        notes: action.reasoning,
      }).select().single();
      if (error) throw error;
      result.grant_id = data?.id;
    } else {
      // outreach / pricing / idea — just mark executed; payload retained
      result.note = "Marked executed (no side-effect for this kind)";
    }

    await db.from("ai_actions").update({
      status: "executed",
      executed_at: new Date().toISOString(),
      result: result as never,
    }).eq("id", actionId);
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await db.from("ai_actions").update({ status: "failed", result: { error: msg } as never }).eq("id", actionId);
    throw err;
  }
}
