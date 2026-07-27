import { supabase } from "@/lib/supabase";

export type ErrorLogType =
  | "login_failure"
  | "realtime_failure"
  | "save_session_failure"
  | "ranking_load_failure"
  | "avatar_upload_failure"
  | "generic";

/**
 * Registra um erro silenciosamente no Supabase.
 * Nunca lança exceção — falhas de log são ignoradas.
 */
export function logError(
  type: ErrorLogType,
  message: string,
  userId?: string | null,
  context?: Record<string, unknown>,
): void {
  void Promise.resolve(
    supabase.from("app_error_logs").insert({
      type,
      user_id: userId ?? null,
      message: message.slice(0, 500),
      context: context ?? null,
    }),
  ).catch(() => {});
}
