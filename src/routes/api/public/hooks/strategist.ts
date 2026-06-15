// Public cron hook — runs the strategist for all enabled users.
// Called by pg_cron every 5 minutes.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/strategist")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const { runStrategistAllUsers } = await import("@/lib/strategist.server");
          const result = await runStrategistAllUsers("cron");
          return Response.json({ ok: true, ...result });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return new Response(JSON.stringify({ ok: false, error: msg }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
      GET: async () => Response.json({ ok: true, note: "POST to run strategist" }),
    },
  },
});
