// Public read-only endpoint for linked Lovable projects.
// GET /api/public/all?key=<project_key>&include=services,bookings,leads,customers,ideas,scripts
// Returns whatever the project asks for from the org it's linked to.
import { createFileRoute } from "@tanstack/react-router";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-hub-key",
  "Access-Control-Max-Age": "86400",
};

const DEFAULT_INCLUDE = ["services", "bookings", "leads", "customers", "ideas", "scripts"];

export const Route = createFileRoute("/api/public/all")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const key = url.searchParams.get("key") ?? request.headers.get("x-hub-key");
          if (!key) return jerr(401, "Missing key");

          const includeParam = url.searchParams.get("include");
          const include = includeParam ? includeParam.split(",").map((s) => s.trim()) : DEFAULT_INCLUDE;

          const { hashApiKey } = await import("@/lib/api-key.server");
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          const { data: project, error: pErr } = await supabaseAdmin
            .from("linked_projects")
            .select("id, owner_id, organization_id")
            .eq("api_key_hash", hashApiKey(key))
            .maybeSingle();
          if (pErr || !project) return jerr(401, "Invalid key");

          const orgFilter = project.organization_id;
          const ownerFilter = project.owner_id;
          const out: Record<string, any> = {
            project_id: project.id,
            organization_id: orgFilter,
            fetched_at: new Date().toISOString(),
          };

          const tasks: PromiseLike<void>[] = [];

          if (include.includes("services") && orgFilter) {
            tasks.push(
              supabaseAdmin
                .from("services")
                .select("id, name, description, price_cents, currency, duration_minutes, sku, active, version, updated_at")
                .eq("organization_id", orgFilter)
                .eq("active", true)
                .then(({ data }) => {
                  out.services = data ?? [];
                }),
            );
          }
          if (include.includes("bookings") && orgFilter) {
            tasks.push(
              supabaseAdmin
                .from("bookings")
                .select("id, customer_name, customer_phone, customer_email, scheduled_at, duration_minutes, status, source, notes")
                .eq("organization_id", orgFilter)
                .order("scheduled_at", { ascending: true })
                .limit(200)
                .then(({ data }) => {
                  out.bookings = data ?? [];
                }),
            );
          }
          if (include.includes("leads")) {
            tasks.push(
              supabaseAdmin
                .from("leads")
                .select("id, name, email, phone, source, stage, notes, created_at")
                .eq("owner_id", ownerFilter)
                .order("created_at", { ascending: false })
                .limit(200)
                .then(({ data }) => {
                  out.leads = data ?? [];
                }),
            );
          }
          if (include.includes("customers")) {
            tasks.push(
              supabaseAdmin
                .from("customers")
                .select("id, name, email, phone, notes, created_at")
                .eq("owner_id", ownerFilter)
                .order("created_at", { ascending: false })
                .limit(200)
                .then(({ data }) => {
                  out.customers = data ?? [];
                }),
            );
          }
          if (include.includes("ideas")) {
            tasks.push(
              supabaseAdmin
                .from("ideas")
                .select("id, title, body, stage, priority, created_at")
                .eq("owner_id", ownerFilter)
                .order("created_at", { ascending: false })
                .limit(200)
                .then(({ data }) => {
                  out.ideas = data ?? [];
                }),
            );
          }
          if (include.includes("scripts") && orgFilter) {
            tasks.push(
              supabaseAdmin
                .from("call_scripts")
                .select("id, title, direction, is_default, greeting, qualifying_questions, objection_handlers, closing, full_script")
                .eq("organization_id", orgFilter)
                .then(({ data }) => {
                  out.scripts = data ?? [];
                }),
            );
          }

          await Promise.all(tasks);

          await supabaseAdmin
            .from("linked_projects")
            .update({ last_seen_at: new Date().toISOString() })
            .eq("id", project.id);

          return new Response(JSON.stringify(out), {
            status: 200,
            headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...CORS },
          });
        } catch (e) {
          return jerr(400, e instanceof Error ? e.message : "Bad request");
        }
      },
    },
  },
});

function jerr(status: number, msg: string) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}
