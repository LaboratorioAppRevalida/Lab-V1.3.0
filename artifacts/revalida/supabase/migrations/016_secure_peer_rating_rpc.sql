-- =============================================================================
-- Migration 016 — Secure peer-rating RPC
--
-- PROBLEM
-- ─────────────────────────────────────────────────────────────────────────────
-- ratingService.ts previously performed three raw client-side operations:
--   1. supabase.from("session_ratings").upsert(...)   — insert the star rating
--   2. supabase.from("session_ratings").select(...)   — read all ratings for
--                                                        the rated user
--   3. supabase.from("profiles").update({ avg_rating, rating_count })
--                                                    — update the RATED user's
--                                                      profile row
--
-- Step 3 is blocked by migration 009 (profiles_update_own_secure) which
-- enforces USING (auth.uid() = id): a user cannot update another user's row.
-- This causes an HTTP 42501 (RLS policy violation) and surfaces as the
-- "Não foi possível enviar a avaliação" toast in RatingCard.
--
-- SOLUTION
-- ─────────────────────────────────────────────────────────────────────────────
-- A SECURITY DEFINER RPC (fn_submit_peer_rating) moves all three operations
-- server-side.  The function:
--   1. Validates the caller is authenticated.
--   2. Validates p_rated_id != caller (no self-rating).
--   3. Clamps the rating to 0–5.
--   4. Upserts into session_ratings (ON CONFLICT session_id, rater_id).
--   5. Recalculates avg and count from all stored ratings for p_rated_id.
--   6. Updates the rated user's profiles row (bypasses RLS as SECURITY DEFINER).
--   7. Returns { ok: true, newAvg: number }.
--
-- The frontend (ratingService.ts) now calls
--   supabase.rpc("fn_submit_peer_rating", { p_session_id, p_rated_id, p_rating })
-- instead of the three direct table mutations.
--
-- Safe to run multiple times (idempotent DROP + CREATE OR REPLACE).
-- =============================================================================


-- ── Drop previous version if it exists (idempotent) ──────────────────────────
DROP FUNCTION IF EXISTS public.fn_submit_peer_rating(UUID, UUID, INTEGER);


-- ── Main RPC ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_submit_peer_rating(
  p_session_id  UUID,     -- session_ratings.session_id key
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
  --   ON CONFLICT uses (session_id, rater_id) unique constraint so that a user
  --   can update (but not duplicate) their rating for a given session.
  INSERT INTO public.session_ratings (session_id, rater_id, rated_id, rating)
  VALUES (p_session_id, v_caller_id, p_rated_id, v_clamped)
  ON CONFLICT (session_id, rater_id)
  DO UPDATE SET
    rating     = EXCLUDED.rating,
    rated_id   = EXCLUDED.rated_id;

  -- ── 5. Recalculate aggregate for the rated user ─────────────────────────────
  SELECT
    ROUND(AVG(rating)::NUMERIC, 2),
    COUNT(*)::INTEGER
  INTO v_avg, v_count
  FROM public.session_ratings
  WHERE rated_id = p_rated_id;

  -- ── 6. Persist aggregate to the rated user's profile ───────────────────────
  --   SECURITY DEFINER lets this bypass the profiles_update_own_secure RLS
  --   policy that restricts users to updating only their own row.
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
-- Authenticated users may submit peer ratings; anonymous callers cannot.
GRANT EXECUTE ON FUNCTION public.fn_submit_peer_rating(UUID, UUID, INTEGER) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_submit_peer_rating(UUID, UUID, INTEGER) FROM anon;


-- ── Audit comment ─────────────────────────────────────────────────────────────
COMMENT ON FUNCTION public.fn_submit_peer_rating(UUID, UUID, INTEGER) IS
  'SECURITY DEFINER. Validates caller is authenticated and not self-rating. '
  'Clamps rating to 0–5, upserts into session_ratings, recalculates avg_rating '
  'and rating_count for the rated user, and updates public.profiles atomically. '
  'Bypasses the profiles_update_own_secure RLS policy (added in migration 009) '
  'so that any authenticated user can persist a rating for a peer. '
  'Returns {ok: true, newAvg: numeric}. '
  'Added in migration 016. Replaces the direct three-step client mutation in '
  'ratingService.ts (upsert session_ratings + select + update profiles).';
