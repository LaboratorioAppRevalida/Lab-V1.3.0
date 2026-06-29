-- Migration 033: reset_user_progress RPC
--
-- SECURITY DEFINER function — runs with elevated privilege but enforces
-- that only the authenticated user can reset their own data.
--
-- WIPES (rows belonging to p_user_id):
--   sessions, user_mission_progress, user_achievements, user_titles,
--   user_event_rewards, user_active_sessions
-- RESETS in profiles (does NOT delete the row):
--   xp_total → 0, nivel → 1, streak_atual → 0, last_login_date → null
--
-- NEVER TOUCHES:
--   profiles row (identity/account), subscriptions, private_messages,
--   platform_config, multiplayer_sessions (shared between users)

create or replace function public.reset_user_progress(p_user_id uuid)
returns boolean
language plpgsql
security definer
as $$
begin
  -- Enforce: only the authenticated user may reset their own account
  if auth.uid() <> p_user_id then
    raise exception 'Forbidden: cannot reset another user''s progress';
  end if;

  -- Wipe study history & progress rows
  delete from public.sessions              where user_id = p_user_id;
  delete from public.user_mission_progress where user_id = p_user_id;
  delete from public.user_achievements     where user_id = p_user_id;
  delete from public.user_titles           where user_id = p_user_id;
  delete from public.user_event_rewards    where user_id = p_user_id;
  delete from public.user_active_sessions  where user_id = p_user_id;

  -- Reset gamification columns in profiles (row itself is preserved)
  update public.profiles
  set
    xp_total        = 0,
    nivel           = 1,
    streak_atual    = 0,
    last_login_date = null,
    updated_at      = now()
  where id = p_user_id;

  return true;
end;
$$;

-- Grant to authenticated users only; revoke from anonymous/public
revoke execute on function public.reset_user_progress(uuid) from public;
grant  execute on function public.reset_user_progress(uuid) to authenticated;
