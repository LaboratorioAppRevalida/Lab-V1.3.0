-- =============================================================================
-- Migration 018 — Fix session_ratings unique index and RPC ON CONFLICT target
--
-- ROOT CAUSE
-- ─────────────────────────────────────────────────────────────────────────────
-- session_ratings was originally created in Supabase with a global unique
-- constraint on (rater_id, rated_id) — no session scope.  This means Postgres
-- treats every rating between a fixed pair of users as THE SAME row regardless
-- of which multiplayer session they are in.  When Doctor A rates Doctor B in
-- Session 2 after having done so in Session 1, the INSERT conflicts on the
-- global pair constraint and the DO UPDATE overwrites the historical row.
--
-- Simultaneously, migration 016 added fn_submit_peer_rating which uses:
--
--   ON CONFLICT (session_id, rater_id)
--
-- But that ON CONFLICT clause requires a unique constraint/index on exactly
-- those columns.  Without it PostgreSQL raises:
--   "there is no unique or exclusion constraint matching the ON CONFLICT
--    specification"
-- ...causing every rating attempt to fail silently.
--
-- This migration:
--   1. Drops the over-restrictive global pair constraint (all plausible names).
--   2. Drops any over-restrictive (evaluator_id, rated_id) variant as well.
--   3. Creates the correct session-scoped unique constraint:
--        UNIQUE (session_id, rater_id)
--      This backs up the ON CONFLICT clause in fn_submit_peer_rating and lets
--      each session accumulate its own rating rows independently.
--   4. Replaces fn_submit_peer_rating (idempotent) to confirm the function body
--      matches the new constraint — no logic change, just a re-GRANT to ensure
--      the function is consistent with the updated schema.
--
-- Safe to run multiple times — all DROP statements use IF EXISTS.
-- =============================================================================


-- ── Step 1: Drop the over-restrictive global pair constraints ─────────────────
-- Supabase auto-names constraints as <table>_<col1>_<col2>_key.
-- We try every plausible variant so the migration is idempotent across
-- environments where the column may have been named differently at creation.

-- Variant A: rater_id + rated_id  (most common — matches migration 016 column names)
ALTER TABLE public.session_ratings
  DROP CONSTRAINT IF EXISTS session_ratings_rater_id_rated_id_key;

-- Variant B: evaluator_id + rated_id  (original Supabase dashboard naming)
ALTER TABLE public.session_ratings
  DROP CONSTRAINT IF EXISTS session_ratings_evaluator_id_rated_id_key;

-- Variant C: evaluator_id + rated_user_id
ALTER TABLE public.session_ratings
  DROP CONSTRAINT IF EXISTS session_ratings_evaluator_id_rated_user_id_key;

-- Variant D: rater_id + rated_user_id
ALTER TABLE public.session_ratings
  DROP CONSTRAINT IF EXISTS session_ratings_rater_id_rated_user_id_key;


-- ── Step 2: Create the correct session-scoped unique constraint ───────────────
-- Allows one rating per (session, rater) pair, so:
--   • The same user CAN rate in Session 1 and again in Session 2 → two rows.
--   • Double-clicking the submit button within the same session → idempotent
--     DO UPDATE (not a duplicate row).
-- This constraint directly backs the ON CONFLICT (session_id, rater_id) clause
-- in fn_submit_peer_rating.

ALTER TABLE public.session_ratings
  ADD CONSTRAINT session_ratings_session_evaluator_key
  UNIQUE (session_id, rater_id);


-- ── Step 3: Replace fn_submit_peer_rating (idempotent) ───────────────────────
-- No logic change — this re-CREATE ensures the function is consistent with the
-- updated constraint and that the GRANT is present in all environments.

DROP FUNCTION IF EXISTS public.fn_submit_peer_rating(UUID, UUID, INTEGER);

CREATE OR REPLACE FUNCTION public.fn_submit_peer_rating(
  p_session_id  UUID,     -- multiplayer_sessions.id for this match
  p_rated_id    UUID,     -- the user being rated
  p_rating      INTEGER   -- raw star value from the client (clamped 0–5)
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id  UUID    := auth.uid();
  v_clamped    INTEGER;
  v_avg        NUMERIC;
  v_count      INTEGER;
BEGIN
  -- ── 1. Authentication ───────────────────────────────────────────────────────
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated: must be logged in to submit a rating';
  END IF;

  -- ── 2. No self-rating ───────────────────────────────────────────────────────
  IF v_caller_id = p_rated_id THEN
    RAISE EXCEPTION 'self_rating_not_allowed: cannot rate yourself';
  END IF;

  -- ── 3. Clamp rating to valid range ──────────────────────────────────────────
  v_clamped := GREATEST(0, LEAST(5, p_rating));

  -- ── 4. Upsert the rating row ────────────────────────────────────────────────
  -- ON CONFLICT targets (session_id, rater_id) — the constraint added in
  -- migration 018.  A conflict only fires when the SAME user resubmits within
  -- the SAME session (e.g. double-click).  Ratings from different sessions
  -- always insert as new rows so history accumulates correctly.
  INSERT INTO public.session_ratings (session_id, rater_id, rated_id, rating)
  VALUES (p_session_id, v_caller_id, p_rated_id, v_clamped)
  ON CONFLICT ON CONSTRAINT session_ratings_session_evaluator_key
  DO UPDATE SET
    rating   = EXCLUDED.rating,
    rated_id = EXCLUDED.rated_id;

  -- ── 5. Recalculate aggregate for the rated user ─────────────────────────────
  SELECT
    ROUND(AVG(rating)::NUMERIC, 2),
    COUNT(*)::INTEGER
  INTO v_avg, v_count
  FROM public.session_ratings
  WHERE rated_id = p_rated_id;

  -- ── 6. Persist aggregate to the rated user's profile ───────────────────────
  UPDATE public.profiles
  SET
    avg_rating   = v_avg,
    rating_count = v_count,
    updated_at   = now()
  WHERE id = p_rated_id;

  -- ── 7. Return result to the caller ─────────────────────────────────────────
  RETURN jsonb_build_object(
    'ok',     true,
    'newAvg', v_avg
  );
END;
$$;


-- ── Access control ────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.fn_submit_peer_rating(UUID, UUID, INTEGER) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_submit_peer_rating(UUID, UUID, INTEGER) FROM anon;


-- ── Audit comments ────────────────────────────────────────────────────────────
COMMENT ON CONSTRAINT session_ratings_session_evaluator_key
  ON public.session_ratings IS
  'Session-scoped uniqueness: one rating per (session_id, rater_id) pair. '
  'Allows the same two users to accumulate historical ratings across multiple '
  'sessions while preventing duplicates within a single session. '
  'Added in migration 018 to replace the global (rater_id, rated_id) constraint '
  'that caused cross-session overwrites.';

COMMENT ON FUNCTION public.fn_submit_peer_rating(UUID, UUID, INTEGER) IS
  'SECURITY DEFINER. Validates caller is authenticated and not self-rating. '
  'Clamps rating to 0–5, upserts into session_ratings ON CONFLICT ON CONSTRAINT '
  'session_ratings_session_evaluator_key (session_id, rater_id), recalculates '
  'avg_rating and rating_count for the rated user, and updates public.profiles. '
  'Updated in migration 018: ON CONFLICT now names the constraint explicitly so '
  'ratings from different sessions are stored as separate rows.';


-- =============================================================================
-- VERIFICATION CHECKLIST (run manually in Supabase SQL editor after applying)
-- =============================================================================
--
--  ✅  New constraint present and old global one absent:
--        SELECT conname, contype,
--               pg_get_constraintdef(oid) AS definition
--        FROM   pg_constraint
--        WHERE  conrelid = 'session_ratings'::regclass
--          AND  contype IN ('u', 'p')
--        ORDER  BY conname;
--        -- Must include: session_ratings_session_evaluator_key
--        -- Must NOT include: session_ratings_rater_id_rated_id_key
--        --                   session_ratings_evaluator_id_rated_id_key
--
--  ✅  Two sessions between the same users produce two rows (not one):
--        SELECT fn_submit_peer_rating('<session_uuid_1>', '<user_b_uuid>', 4);
--        SELECT fn_submit_peer_rating('<session_uuid_2>', '<user_b_uuid>', 5);
--        SELECT * FROM session_ratings WHERE rated_id = '<user_b_uuid>';
--        -- should return 2 rows with different session_id values
--
--  ✅  Double-click within same session produces exactly one row (idempotent):
--        SELECT fn_submit_peer_rating('<session_uuid_1>', '<user_b_uuid>', 3);
--        SELECT fn_submit_peer_rating('<session_uuid_1>', '<user_b_uuid>', 5);
--        SELECT * FROM session_ratings
--        WHERE session_id = '<session_uuid_1>' AND rated_id = '<user_b_uuid>';
--        -- should return exactly 1 row with rating = 5
-- =============================================================================
