import { supabase } from "./supabase";

/**
 * Calls the `reset_user_progress` SECURITY DEFINER RPC.
 *
 * Wipes for the authenticated user:
 *   sessions, user_mission_progress, user_achievements,
 *   user_titles, user_event_rewards, user_active_sessions
 *
 * Resets in profiles (row is NOT deleted):
 *   xp_total → 0, nivel → 1, streak_atual → 0, last_login_date → null
 *
 * Never touches: auth account, profiles row, subscriptions, messages.
 *
 * @throws if the RPC errors or the caller is not the authenticated user.
 */
export async function resetAccount(userId: string): Promise<void> {
  const { error } = await supabase.rpc("reset_user_progress", {
    p_user_id: userId,
  });

  if (error) {
    throw new Error(error.message);
  }
}
