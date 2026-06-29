-- =============================================================================
-- Migration 015 — Extend profiles_public view
--
-- Adds to the security-barrier profiles_public view:
--   • city_uf, country  — public location fields (not LGPD-sensitive)
--   • avg_partner_rating — alias of avg_rating (canonical peer-review score)
--   • total_reviews_count — alias of rating_count
--
-- All averages remain computed at the profiles table level by ratingService.ts
-- (server-side upsert into session_ratings → recalculate avg → update profiles).
-- This migration only reshapes what the view exposes; no table is modified.
--
-- Safe to run multiple times (all statements are idempotent).
-- =============================================================================


-- ── Step 1: Replace the SECURITY DEFINER helper with the expanded column set ──
-- The function runs as postgres (BYPASSRLS) so it can read all profile rows.
-- Callers access data only through the view, not by calling the function directly.

CREATE OR REPLACE FUNCTION public.fn_profiles_public_rows()
RETURNS TABLE (
  id                   UUID,
  name                 TEXT,
  display_name         TEXT,
  nivel                INTEGER,
  avatar_url           TEXT,
  xp_total             INTEGER,
  streak_atual         INTEGER,
  city_uf              TEXT,
  country              TEXT,
  avg_rating           NUMERIC,
  rating_count         INTEGER,
  avg_partner_rating   NUMERIC,
  total_reviews_count  INTEGER,
  created_at           TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    id,
    name,
    display_name,
    nivel,
    avatar_url,
    xp_total,
    streak_atual,
    city_uf,
    country,
    avg_rating,
    rating_count,
    -- Semantic aliases so consumers can use intent-revealing names
    avg_rating    AS avg_partner_rating,
    rating_count  AS total_reviews_count,
    created_at
  FROM public.profiles;
$$;

-- Keep access mediated exclusively through the view.
REVOKE ALL ON FUNCTION public.fn_profiles_public_rows() FROM PUBLIC;


-- ── Step 2: Recreate the security-barrier view ────────────────────────────────
-- DROP + CREATE is required because adding columns to a view is not supported
-- in-place in PostgreSQL. The old view is replaced atomically.

DROP VIEW IF EXISTS public.profiles_public;

CREATE VIEW public.profiles_public
  WITH (security_barrier = true)
AS
  SELECT * FROM public.fn_profiles_public_rows();

COMMENT ON VIEW public.profiles_public IS
  'LGPD-safe read-only projection of profiles. '
  'Exposes only non-sensitive public columns (no email, phone). '
  'avg_partner_rating and total_reviews_count are semantic aliases of '
  'avg_rating and rating_count. '
  'Use this view in all cross-user queries (lobbies, rankings, public profiles).';


-- ── Step 3: Re-apply ownership, RLS, policy, and grants ──────────────────────
-- These are lost when the view is dropped and must be reapplied.

ALTER VIEW public.profiles_public OWNER TO postgres;

ALTER TABLE public.profiles_public ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_public_select_all" ON public.profiles_public;
CREATE POLICY "profiles_public_select_all"
  ON public.profiles_public
  FOR SELECT
  TO authenticated, anon
  USING (true);

GRANT SELECT ON public.profiles_public TO authenticated, anon;


-- =============================================================================
-- VERIFICATION CHECKLIST
-- =============================================================================
--
--  ✅  New columns present:
--        SELECT city_uf, country, avg_partner_rating, total_reviews_count
--        FROM profiles_public LIMIT 1;
--
--  ✅  Backward compat — old column names still present:
--        SELECT avg_rating, rating_count FROM profiles_public LIMIT 1;
--
--  ✅  LGPD check — private columns not exposed:
--        SELECT email, phone FROM profiles_public LIMIT 1;  -- must error
--
--  ✅  Cross-user read (authenticated non-owner):
--        SELECT * FROM profiles_public WHERE id != auth.uid() LIMIT 5;
--        Must return rows (view bypasses table RLS via SECURITY DEFINER).
--
-- =============================================================================
