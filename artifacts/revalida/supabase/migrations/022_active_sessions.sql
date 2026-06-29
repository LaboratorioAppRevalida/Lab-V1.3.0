-- 022_active_sessions.sql
-- Anti-simultaneous-login guard.
-- Stores one row per user representing the currently active device session.
-- last_heartbeat is refreshed every 30 s by the client; a row older than
-- 90 s is considered stale (device closed/crashed) and a new login is allowed.

CREATE TABLE IF NOT EXISTS public.user_active_sessions (
  user_id        uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  session_token  text        NOT NULL,
  last_heartbeat timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_active_sessions ENABLE ROW LEVEL SECURITY;

-- Each user can only read/write their own row.
CREATE POLICY "owner_all" ON public.user_active_sessions
  FOR ALL TO authenticated
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
