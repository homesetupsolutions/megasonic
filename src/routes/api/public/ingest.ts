import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-hub-key",
  "Access-Control-Max-Age": "86400",
};

const Body = z.object({
  project_key: z.string().min(10).optional(),
  type: z.string().min(1).max(64),
  payload: z.record(z.any()).default({}),
});

export const Route = createFileRoute("/api/public/ingest")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        try {
          const json = await request.json();
          const headerKey = request.headers.get("x-hub-key") ?? undefined;
          const parsed = Body.parse({ ...json, project_key: json?.project_key ?? headerKey });
          const key = parsed.project_key;
          if (!key) return json415("Missing project_key");

          const { hashApiKey } = await import("@/lib/api-key.server");
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const keyHash = hashApiKey(key);

          const { data: project, error: projErr } = await supabaseAdmin
            .from("linked_projects")
            .select("id, owner_id, event_count")
            .eq("api_key_hash", keyHash)
            .maybeSingle();
          if (projErr || !project) return json415("Invalid project_key");

          // Record raw event
          const { error: evtErr } = await supabaseAdmin.from("events").insert({
            owner_id: project.owner_id,
            project_id: project.id,
            type: parsed.type,
            payload: parsed.payload,
          });
          if (evtErr) throw evtErr;

          // Fan-out by type
          const t = parsed.type.toLowerCase();
          const p = parsed.payload as Record<string, any>;
          if (t === "lead" || t === "lead.created") {
            await supabaseAdmin.from("leads").insert({
              owner_id: project.owner_id,
              project_id: project.id,
              name: String(p.name ?? "Unnamed lead"),
              email: p.email ?? null,
              phone: p.phone ?? null,
              source: p.source ?? null,
              notes: p.notes ?? null,
            });
          } else if (t === "idea" || t === "idea.created") {
            await supabaseAdmin.from("ideas").insert({
              owner_id: project.owner_id,
              project_id: project.id,
              title: String(p.title ?? p.text ?? "Untitled idea"),
              body: p.body ?? p.notes ?? null,
            });
          } else if (t === "customer" || t === "customer.created") {
            await supabaseAdmin.from("customers").insert({
              owner_id: project.owner_id,
              project_id: project.id,
              name: String(p.name ?? "Customer"),
              email: p.email ?? null,
              phone: p.phone ?? null,
              notes: p.notes ?? null,
            });
          } else if (t.startsWith("inventory")) {
            await supabaseAdmin.from("inventory_items").insert({
              owner_id: project.owner_id,
              project_id: project.id,
              sku: p.sku ?? null,
              name: String(p.name ?? p.sku ?? "Item"),
              quantity: Number(p.quantity ?? 1),
              location: p.location ?? null,
              status: p.status ?? "available",
              last_event_at: new Date().toISOString(),
            });
          }

          await supabaseAdmin
            .from("linked_projects")
            .update({
              last_seen_at: new Date().toISOString(),
              event_count: (project.event_count ?? 0) + 1,
            })
            .eq("id", project.id);

          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { "Content-Type": "application/json", ...CORS },
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Bad request";
          return new Response(JSON.stringify({ error: msg }), {
            status: 400,
            headers: { "Content-Type": "application/json", ...CORS },
          });
        }
      },
    },
  },
});

function json415(msg: string) {
  return new Response(JSON.stringify({ error: msg }), {
    status: 401,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}
