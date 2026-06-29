-- =============================================================================
-- Migration 019 — Purge all global unique constraints on session_ratings
--
-- ROOT CAUSE (why migration 018 was insufficient)
-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 018 attempted to drop the over-restrictive global pair constraint
-- on session_ratings using four hard-coded plausible names:
--
--   session_ratings_rater_id_rated_id_key
--   session_ratings_evaluator_id_rated_id_key
--   session_ratings_evaluator_id_rated_user_id_key
--   session_ratings_rater_id_rated_user_id_key
--
-- The actual constraint in this database uses a different name (e.g. one that
-- was set manually, or auto-generated with a slightly different column order
-- or prefix).  Because none of the four DROP CONSTRAINT IF EXISTS statements
-- matched, the constraint survived and continues to cause cross-session
-- overwrites even after applying migration 018 and after the frontend was
-- fixed to generate fresh UUIDs per match.
--
-- SOLUTION
-- ─────────────────────────────────────────────────────────────────────────────
-- Use a dynamic PL/pgSQL loop to query pg_constraint and drop EVERY unique
-- constraint on public.session_ratings whose definition does NOT include
-- session_id.  This is name-agnostic and therefore environment-agnostic.
--
-- After purging the rogue constraints, the migration re-creates (idempotent)
-- the correct session-scoped constraint:
--
--   UNIQUE (session_id, rater_id)   → named session_ratings_session_evaluator_key
--
-- and replaces fn_submit_peer_rating so the ON CONFLICT clause names this
-- constraint explicitly.
--
-- Safe to run multiple times — the DO block skips constraints that no longer
-- exist, and all ALTER TABLE statements use IF EXISTS / IF NOT EXISTS.
-- =============================================================================


-- ── Step 1: Drop every unique constraint that does NOT include session_id ─────
--
-- pg_constraint.contype = 'u'  → UNIQUE constraint (not PK = 'p', FK = 'f')
-- We skip the constraint we want to keep (session_ratings_session_evaluator_key)
-- and any constraint whose column set already includes session_id.
--
-- The inner array_agg / array comparison ensures we only drop constraints whose
-- columns do NOT contain the session_id column.  This is belt-and-suspenders:
-- even without the filter the explicit EXCEPT guard prevents us from removing
-- the correct constraint.

DO $$
DECLARE
  r           RECORD;
  col_names   TEXT[];
BEGIN
  FOR r IN
    SELECT c.conname,
           array_agg(a.attname ORDER BY a.attnum) AS cols
    FROM   pg_constraint c
    JOIN   pg_attribute  a
           ON a.attrelid = c.conrelid
          AND a.attnum   = ANY(c.conkeys)
    WHERE  c.conrelid = 'public.session_ratings'::regclass
      AND  c.contype  = 'u'                                  -- UNIQUE only
      AND  c.conname != 'session_ratings_session_evaluator_key'  -- keep our constraint
    GROUP  BY c.conname
  LOOP
    -- Only drop if session_id is NOT already one of the constrained columns
    -- (extra safety — avoids removing a legitimate session-scoped constraint
    -- that happens to have a different name in some environments).
    IF NOT ('session_id' = ANY(r.cols)) THEN
      RAISE NOTICE 'Dropping over-restrictive unique constraint: % (columns: %)',
        r.conname, array_to_string(r.cols, ', ');
      EXECUTE format(
        'ALTER TABLE public.session_ratings DROP CONSTRAINT IF EXISTS %I',
        r.conname
      );
    END IF;
  END LOOP;
END $$;


-- ── Step 2: Ensure the correct session-scoped constraint exists ───────────────
--
-- Drop first (idempotent) in case it already exists from migration 018,
-- then re-add to guarantee it is present regardless of prior migration state.

ALTER TABLE public.session_ratings
  DROP CONSTRAINT IF EXISTS session_ratings_session_evaluator_key;

ALTER TABLE public.session_ratings
  ADD CONSTRAINT session_ratings_session_evaluator_key
  UNIQUE (session_id, rater_id);


-- ── Step 3: Replace fn_submit_peer_rating (idempotent) ───────────────────────
--
-- Re-create with ON CONFLICT ON CONSTRAINT <name> so PostgreSQL resolves the
-- conflict target unambiguously, regardless of other constraints present.

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
  -- ON CONFLICT ON CONSTRAINT targets the session-scoped unique index added in
  -- migrations 018/019.  A conflict fires only when the same rater resubmits
  -- within the same session (double-click / network retry).  Ratings from
  -- distinct sessions are always new rows — cross-session history accumulates.
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

  -- ── 7. Return result ────────────────────────────────────────────────────────
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
  'sessions. Double-submissions within the same session are idempotent (DO UPDATE). '
  'Added in migration 018, re-enforced in migration 019 after the global '
  '(rater_id, rated_id) constraint was found to survive migration 018 due to '
  'an unknown auto-generated constraint name.';

COMMENT ON FUNCTION public.fn_submit_peer_rating(UUID, UUID, INTEGER) IS
  'SECURITY DEFINER. Validates caller is authenticated and not self-rating. '
  'Clamps rating to 0–5. Upserts into session_ratings ON CONFLICT ON CONSTRAINT '
  'session_ratings_session_evaluator_key so only same-session retries are '
  'idempotent; distinct sessions always produce new rows. Recalculates '
  'avg_rating / rating_count for the rated user and persists to profiles. '
  'Updated in migration 019.';


-- =============================================================================
-- VERIFICATION (run in Supabase SQL editor after applying)
-- =============================================================================
--
--  1. Confirm only the correct constraint exists:
--
--       SELECT c.conname,
--              pg_get_constraintdef(c.oid) AS definition
--       FROM   pg_constraint c
--       WHERE  c.conrelid = 'public.session_ratings'::regclass
--         AND  c.contype  IN ('u', 'p')
--       ORDER  BY c.conname;
--
--       Expected rows (unique + primary):
--         session_ratings_pkey                    PRIMARY KEY (id)
--         session_ratings_session_evaluator_key   UNIQUE (session_id, rater_id)
--
--       Must NOT see: any constraint on (rater_id, rated_id) alone,
--                     or (evaluator_id, rated_id) alone.
--
--  2. Two sessions produce two independent rows:
--
--       SELECT fn_submit_peer_rating('<session_uuid_1>', '<user_b>', 4);
--       SELECT fn_submit_peer_rating('<session_uuid_2>', '<user_b>', 5);
--       SELECT session_id, rater_id, rated_id, rating
--       FROM   public.session_ratings
--       WHERE  rated_id = '<user_b>';
--       -- Must return 2 rows with different session_id values
--
--  3. Same session — double submit is idempotent (updates, not duplicates):
--
--       SELECT fn_submit_peer_rating('<session_uuid_1>', '<user_b>', 3);
--       SELECT fn_submit_peer_rating('<session_uuid_1>', '<user_b>', 5);
--       SELECT COUNT(*) FROM public.session_ratings
--       WHERE  session_id = '<session_uuid_1>'
--         AND  rated_id   = '<user_b>';
--       -- Must return COUNT = 1 with rating = 5
-- =============================================================================
