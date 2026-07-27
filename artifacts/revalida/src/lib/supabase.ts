import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !anon) {
  // We log instead of throwing so the UI still mounts in dev with hot reload.
  // Calls to supabase will fail explicitly with a friendly toast in services.
  // eslint-disable-next-line no-console
  console.error(
    "[supabase] Variáveis VITE_SUPABASE_URL e/ou VITE_SUPABASE_ANON_KEY ausentes.",
  );
}

export const supabase = createClient(url || "https://placeholder.supabase.co", anon || "placeholder", {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: "revalida.supabase.auth",
  },
});

export const isSupabaseConfigured = !!url && !!anon;

/**
 * Raw Supabase project URL — used for keepalive fetch in beforeunload handlers
 * where async SDK calls cannot complete before the page unloads.
 */
export const SUPABASE_REST_URL = url || "";

/**
 * Supabase anon (public) key — used as a fallback bearer token in keepalive
 * fetches when the user JWT cannot be read synchronously from localStorage.
 */
export const SUPABASE_ANON_KEY = anon || "";

/**
 * Reads the active user's JWT synchronously from localStorage.
 * Supabase v2 stores the serialised session under the `storageKey` configured
 * in the client options ("revalida.supabase.auth"). Returns the anon key as a
 * safe fallback so keepalive fetches always have a valid Authorization header.
 */
export function readJwtSync(): string {
  try {
    const raw = localStorage.getItem("revalida.supabase.auth");
    if (!raw) return SUPABASE_ANON_KEY;
    const parsed = JSON.parse(raw) as { access_token?: string } | null;
    return parsed?.access_token || SUPABASE_ANON_KEY;
  } catch {
    return SUPABASE_ANON_KEY;
  }
}
