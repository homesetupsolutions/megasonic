import { createFileRoute } from "@tanstack/react-router";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-hub-key",
  "Access-Control-Max-Age": "86400",
};

// GET /api/public/catalog?key=<project_key>
// Returns active services for the organization linked to the project.
export const Route = createFileRoute("/api/public/catalog")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const key = url.searchParams.get("key") ?? request.headers.get("x-hub-key");
          if (!key) return jerr(401, "Missing key");

          const { hashApiKey } = await import("@/lib/api-key.server");
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          const { data: project, error: pErr } = await supabaseAdmin
            .from("linked_projects")
            .select("id, owner_id, organization_id")
            .eq("api_key_hash", hashApiKey(key))
            .maybeSingle();
          if (pErr || !project) return jerr(401, "Invalid key");
          if (!project.organization_id) return jerr(400, "Project has no organization assigned. Pick one in MagaSonic → Projects.");

          const { data: services, error: sErr } = await supabaseAdmin
            .from("services")
            .select("id, name, description, price_cents, currency, duration_minutes, sku, active, version, updated_at")
            .eq("organization_id", project.organization_id)
            .eq("active", true)
            .order("name", { ascending: true });
          if (sErr) throw sErr;

          await supabaseAdmin
            .from("linked_projects")
            .update({ last_seen_at: new Date().toISOString() })
            .eq("id", project.id);

          return new Response(JSON.stringify({ services }), {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "no-store",
              ...CORS,
            },
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
