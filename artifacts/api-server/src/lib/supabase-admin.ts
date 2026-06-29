import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { logger } from "./logger.js";

let _client: SupabaseClient | null = null;

/**
 * Returns a Supabase admin client (service_role).
 * Initialization is deferred to the first call so the server can start
 * even before the secrets are injected — individual requests will fail
 * gracefully instead of crashing the process.
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (_client) return _client;

  const supabaseUrl  = process.env.SUPABASE_URL        ?? "";
  const serviceKey   = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  if (!supabaseUrl || !serviceKey) {
    logger.warn(
      "[supabase-admin] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set — " +
      "database writes from the API server will fail until these secrets are configured."
    );
  }

  _client = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return _client;
}

/** Convenience proxy — keeps backwards-compat with existing imports. */
export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabaseAdmin();
    const value = (client as unknown as Record<string | symbol, unknown>)[prop];
    return typeof value === "function" ? value.bind(client) : value;
  },
});
