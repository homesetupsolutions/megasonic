// Open-access mode: no login required.
// Every server function that previously demanded a signed-in user now runs as
// the single owner account of this workspace (the first profile in the DB).
// If a real bearer token IS present we still honour it, so existing sessions
// keep working exactly as before.
import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

let cachedOwnerId: string | null = null;

async function resolveOwnerId(): Promise<string> {
  if (cachedOwnerId) return cachedOwnerId;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, created_at")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error || !data?.id) {
    throw new Error("No owner profile exists yet. Sign in once with Google to create it.");
  }
  cachedOwnerId = data.id;
  return cachedOwnerId;
}

export const requireSupabaseAuth = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
      throw new Error("Missing Supabase environment variables.");
    }

    const token = getRequest()
      ?.headers?.get("authorization")
      ?.replace(/^Bearer\s+/i, "");

    if (token) {
      const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
      });
      const { data } = await supabase.auth.getClaims(token);
      if (data?.claims?.sub) {
        return next({
          context: {
            supabase,
            userId: data.claims.sub as string,
            claims: data.claims as Record<string, unknown>,
          },
        });
      }
    }

    // No session — fall back to owner-scoped admin access.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = await resolveOwnerId();
    return next({
      context: {
        supabase: supabaseAdmin as unknown as ReturnType<typeof createClient<Database>>,
        userId,
        claims: { sub: userId } as Record<string, unknown>,
      },
    });
  },
);
