import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "./env";

/**
 * Service-role client. BYPASSES Row Level Security.
 * Only use inside trusted server code (result validation, coin awards, admin jobs).
 * Never import from a client component — the "server-only" import enforces this at build time.
 */
export function createSupabaseAdminClient() {
  const env = getSupabaseEnv();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!env || !serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_NOT_CONFIGURED");
  return createClient(env.url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
