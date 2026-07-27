-- =============================================================================
-- Migration 017 — Fix session_ratings foreign key target
--
-- ROOT CAUSE
-- ─────────────────────────────────────────────────────────────────────────────
-- session_ratings.session_id had a FK pointing to public.sessions(id) — the
-- individual user history record table.  However, peer ratings are logically
-- tied to a multiplayer room (public.multiplayer_sessions), not to a single
-- user's history entry.
--
-- The client passes activeSessionId (multiplayer_sessions.id) as the session
-- reference.  Because that UUID exists only in multiplayer_sessions and NOT in
-- sessions, every INSERT into session_ratings raises:
--   "insert or update on table "session_ratings" violates foreign key
--    constraint "session_ratings_session_fkey""
--
-- This migration:
--   1. Drops the incorrect FK constraint (to sessions).
--   2. Adds the correct FK constraint (to multiplayer_sessions) with CASCADE
--      so rating rows are cleaned up if the multiplayer session is purged.
--   3. Adds a comment explaining the design intent.
--
-- Safe to run multiple times — all statements use IF EXISTS / IF NOT EXISTS.
-- =============================================================================


-- ── Step 1: Drop the incorrect FK ────────────────────────────────────────────
-- We use IF EXISTS so the migration is idempotent even if the constraint name
-- differs slightly between environments (e.g. already corrected, or never had
-- one at all).
ALTER TABLE public.session_ratings
  DROP CONSTRAINT IF EXISTS session_ratings_session_fkey;

-- Also drop common alternative auto-generated names, just in case
ALTER TABLE public.session_ratings
  DROP CONSTRAINT IF EXISTS session_ratings_session_id_fkey;


-- ── Step 2: Add the correct FK to multiplayer_sessions ───────────────────────
-- ON DELETE CASCADE: if a multiplayer session row is deleted (e.g., cleanup
-- of stale rooms), the associated peer ratings are removed automatically.
-- ON DELETE SET NULL would be the alternative if we want to retain rating
-- aggregate data even after the room is deleted — use CASCADE here because
-- the multiplayer session represents the authoritative source of truth.
ALTER TABLE public.session_ratings
  ADD CONSTRAINT session_ratings_multiplayer_session_fkey
  FOREIGN KEY (session_id)
  REFERENCES public.multiplayer_sessions(id)
  ON DELETE CASCADE;


-- ── Step 3: Annotate the column for future developers ────────────────────────
COMMENT ON COLUMN public.session_ratings.session_id IS
  'UUID of the multiplayer_sessions room in which this peer rating was given. '
  'References public.multiplayer_sessions(id). '
  'Corrected in migration 017 (was incorrectly referencing public.sessions(id)).';


-- =============================================================================
-- VERIFICATION CHECKLIST (run manually after applying)
-- =============================================================================
--
--  ✅  New constraint present:
--        SELECT conname FROM pg_constraint
--        WHERE conrelid = 'session_ratings'::regclass
--          AND contype = 'f';
--        -- should include session_ratings_multiplayer_session_fkey
--
--  ✅  Old constraint absent:
--        -- session_ratings_session_fkey and session_ratings_session_id_fkey
--        -- should NOT appear in the result above
--
--  ✅  Insert test (replace UUIDs with valid ones from your DB):
--        SELECT fn_submit_peer_rating(
--          '<valid multiplayer_sessions.id>',
--          '<valid profiles.id of rated user>',
--          5
--        );
--        -- should return { "ok": true, "newAvg": 5.0 } without FK errors
-- =============================================================================
