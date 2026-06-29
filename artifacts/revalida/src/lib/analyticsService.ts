import { supabase } from "@/lib/supabase";

export type AppEventType =
  | "session_started"
  | "session_completed"
  | "session_abandoned"
  | "session_flow_error"
  | "session_restored"
  | "session_disconnected"
  | "session_reconnected"
  | "session_recovered_after_refresh"
  | "session_abandoned_by_timeout"
  | "login"
  | "register"
  | "feedback_submitted";

/**
 * Registra um evento de uso silenciosamente no Supabase.
 * Nunca lança exceção — falhas são ignoradas.
 */
export function trackEvent(
  userId: string | null,
  eventType: AppEventType,
  stage?: string,
  payload?: Record<string, unknown>,
): void {
  void Promise.resolve(
    supabase.from("app_events").insert({
      user_id: userId,
      event_type: eventType,
      stage: stage ?? null,
      payload: payload ?? null,
    }),
  ).catch(() => {});
}

/**
 * Salva uma mensagem de feedback do usuário.
 * Retorna true se salvou com sucesso.
 */
export async function submitFeedback(
  userId: string | null,
  message: string,
  currentScreen: string,
): Promise<boolean> {
  try {
    const { error } = await supabase.from("user_feedback").insert({
      user_id: userId,
      message: message.trim().slice(0, 2000),
      current_screen: currentScreen,
    });
    return !error;
  } catch {
    return false;
  }
}
