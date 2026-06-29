-- =============================================================================
-- Migration : 012_secure_profiles_select_rls.sql
-- Table     : public.profiles
-- Purpose   : LGPD-compliant SELECT hardening for the profiles table.
--
-- Architecture overview
-- ─────────────────────
-- Problem: a plain permissive SELECT policy exposes every column (email,
-- phone, birth_date, is_suspended, suspension_reason …) to any authenticated
-- user who calls the Supabase REST API directly.
--
-- Solution — two-tier access model:
--
--   Tier 1 · public.profiles (direct table)
--     • Own row  : any authenticated user may SELECT all columns of THEIR OWN row.
--     • Admin    : is_admin_check() users may SELECT all columns of ALL rows.
--     • Everyone else is denied at the row level → zero exposure.
--
--   Tier 2 · public.profiles_public (security-barrier view)
--     • Returns only the 9 safe, non-sensitive columns for EVERY user.
--     • Built on a SECURITY DEFINER helper function so it runs as the
--       table owner (postgres / superuser), bypassing the table's RLS.
--       Without this, a view simply inherits the caller's RLS and would
--       only return the caller's own row.
--     • The view itself has its own permissive RLS policy so any
--       authenticated or anon user can query it.
--
-- Sensitive columns protected (never readable by third parties):
--   email, phone, birth_date, country, city_uf,
--   is_suspended, suspended_until, suspension_reason,
--   is_admin, last_login_date, updated_at
--
-- Safe columns exposed via profiles_public:
--   id, name, display_name, nivel, avatar_url,
--   xp_total, streak_atual, avg_rating, rating_count, created_at
--
-- Code impact:
--   · AuthContext.tsx     — loadProfileFromDb() selects own row → unaffected
--   · adminUserService.ts — select("*") → admin policy applies → unaffected
--   · rankingService.ts   — fetchXpRanking / fetchStreakRanking switched to
--                           profiles_public (handled in the same commit)
--   · get_top_medicos_ranking RPC — SECURITY DEFINER → bypasses RLS → unaffected
-- =============================================================================


-- ── Step 1: Drop ALL known SELECT policies on profiles ────────────────────────
-- Supabase auto-generates several variants; we drop every known name so the
-- new policies become the single source of truth. IF EXISTS prevents errors
-- on a fresh database where some names may not exist.

DROP POLICY IF EXISTS "Enable read access for all users"            ON public.profiles;
DROP POLICY IF EXISTS "Enable read access for all"                  ON public.profiles;
DROP POLICY IF EXISTS "Allow read access for all users"             ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_authenticated"               ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_own"                         ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_admin"                       ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone"    ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Users can view all profiles"                 ON public.profiles;
DROP POLICY IF EXISTS "Allow authenticated read access"             ON public.profiles;


-- ── Step 2: Strict own-row SELECT policy ─────────────────────────────────────
-- An authenticated user may read all columns of their OWN profile row.
-- This keeps AuthContext, profileService, and the Supabase Auth helpers
-- working without any code changes.

CREATE POLICY "profiles_select_own"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);


-- ── Step 3: Admin full-read SELECT policy ────────────────────────────────────
-- Administrators may read all columns of all rows so that the admin panel
-- (UsuariosAdmin.tsx / adminUserService.ts) continues to work without changes.

CREATE POLICY "profiles_select_admin"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (public.is_admin_check());


-- ── Step 4: SECURITY DEFINER helper function ──────────────────────────────────
-- This function runs as the postgres (superuser) role, which has BYPASSRLS.
-- It is the only way to let the profiles_public VIEW see all users' rows while
-- the underlying table remains locked down by the strict policies above.
-- Direct access to this function is not granted to unprivileged roles —
-- callers go through the view instead.

CREATE OR REPLACE FUNCTION public.fn_profiles_public_rows()
RETURNS TABLE (
  id            UUID,
  name          TEXT,
  display_name  TEXT,
  nivel         INTEGER,
  avatar_url    TEXT,
  xp_total      INTEGER,
  streak_atual  INTEGER,
  avg_rating    NUMERIC,
  rating_count  INTEGER,
  created_at    TIMESTAMPTZ
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
    avg_rating,
    rating_count,
    created_at
  FROM public.profiles;
$$;

-- Do NOT grant EXECUTE to authenticated/anon; access is mediated by the view.
REVOKE ALL ON FUNCTION public.fn_profiles_public_rows() FROM PUBLIC;


-- ── Step 5: Security-barrier public view ─────────────────────────────────────
-- The view queries fn_profiles_public_rows(), which runs as postgres and thus
-- sees all rows regardless of the caller's RLS context.
-- security_barrier = true prevents query-rewrite attacks (e.g. a malicious
-- WHERE clause injecting a function that leaks rows before the filter runs).

DROP VIEW IF EXISTS public.profiles_public;

CREATE VIEW public.profiles_public
  WITH (security_barrier = true)
AS
  SELECT * FROM public.fn_profiles_public_rows();

COMMENT ON VIEW public.profiles_public IS
  'LGPD-safe read-only projection of profiles. '
  'Exposes only non-sensitive public columns. '
  'Use this view in all cross-user queries (rankings, lobbies, leaderboards).';


-- ── Step 6: RLS on the view ───────────────────────────────────────────────────
-- The view itself needs RLS enabled and a permissive policy so that the
-- Supabase REST API (PostgREST) does not block queries to it.

ALTER VIEW public.profiles_public OWNER TO postgres;

ALTER TABLE public.profiles_public ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_public_select_all"
  ON public.profiles_public
  FOR SELECT
  TO authenticated, anon
  USING (true);


-- ── Step 7: Grant SELECT on the view ─────────────────────────────────────────

GRANT SELECT ON public.profiles_public TO authenticated, anon;


-- =============================================================================
-- VERIFICATION CHECKLIST (run after applying this migration)
-- =============================================================================
--
--  ✅  Own profile  →  SELECT * FROM profiles WHERE id = auth.uid()
--                      Returns full row including email, phone, etc.
--
--  ✅  Admin panel  →  adminUserService.ts calls select("*") on profiles.
--                      Admin satisfies is_admin_check() → full rows returned.
--
--  ✅  Rankings (nota/area)  →  get_top_medicos_ranking RPC is SECURITY DEFINER
--                               → unaffected by table RLS.
--
--  ✅  Rankings (XP/streak)  →  rankingService.ts updated to from("profiles_public")
--                               → only safe columns, all users visible.
--
--  ✅  Third-party row test  →  SELECT email FROM profiles WHERE id != auth.uid()
--                               Must return 0 rows (policy blocks it).
--
--  ✅  Public view test      →  SELECT * FROM profiles_public LIMIT 5
--                               Must return rows for all users, safe columns only.
-- =============================================================================
