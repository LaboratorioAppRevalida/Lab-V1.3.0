-- =============================================================================
-- Migration : 009_secure_profiles_update_rls.sql
-- Table     : public.profiles
-- Purpose   : Harden the UPDATE Row-Level Security policy to prevent
--             privilege escalation and gamification fraud via raw API calls.
--
-- Protected columns (users cannot alter these):
--   · is_admin          – prevents self-promotion to admin
--   · is_suspended      – prevents self-unsuspension
--   · xp_total          – prevents XP spoofing
--   · nivel             – prevents level spoofing
--   · suspended_until   – admin-controlled field, must not be user-writable
--   · suspension_reason – admin-controlled field, must not be user-writable
--
-- Allowed columns (users CAN update their own row):
--   name, display_name, birth_date, country, city_uf, phone, avatar_url,
--   streak_atual, last_login_date, updated_at, avg_rating, rating_count
--
-- IMPORTANT – READ BEFORE RUNNING:
--   gamificationService.ts currently writes xp_total and nivel from the
--   client-side using the user's JWT. After this migration those writes will
--   be silently rejected by Postgres. Move XP/level updates to a Postgres
--   trigger or a Supabase Edge Function (service-role key) before deploying
--   this migration to production. See the note at the bottom of this file.
-- =============================================================================

-- ── Step 1: Drop ALL existing UPDATE policies on profiles ─────────────────────
-- Supabase auto-generates policies with various display names depending on
-- how the table was created. We drop every known variant so the new policy
-- is the sole authority. IF EXISTS makes each statement safe to re-run.

DROP POLICY IF EXISTS "profiles_update_own"                        ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own_secure"                 ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_admin"                      ON public.profiles;
DROP POLICY IF EXISTS "profiles_all_own"                           ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile"               ON public.profiles;
DROP POLICY IF EXISTS "Allow users to update own profile"          ON public.profiles;
DROP POLICY IF EXISTS "Enable update for users based on id"        ON public.profiles;
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON public.profiles;


-- ── Step 2: Admin bypass policy ───────────────────────────────────────────────
-- Admins (rows where is_admin = true, verified via is_admin_check()) may
-- UPDATE any profile row and any column without restriction. This preserves
-- existing admin operations: suspendUser, promoteToAdmin, resetUserProgress.

CREATE POLICY "profiles_update_admin"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING     (public.is_admin_check())
  WITH CHECK (public.is_admin_check());


-- ── Step 3: Secure user-level UPDATE policy ───────────────────────────────────
-- A non-admin authenticated user may only update their own profile row, and
-- exclusively the non-sensitive columns listed above.
--
-- How the immutability check works:
--   The WITH CHECK clause receives the *incoming* (new) row values. For each
--   protected column we compare the incoming value against a subquery that
--   reads the *current* stored value. If they differ, Postgres rejects the
--   entire UPDATE with a policy violation error (HTTP 42501 / PGRST301).
--   When the caller omits a protected column from the UPDATE payload, Postgres
--   automatically carries the existing value forward, so the comparison always
--   passes for columns that were not touched.

CREATE POLICY "profiles_update_own_secure"
  ON public.profiles
  FOR UPDATE
  TO authenticated

  -- USING: which rows the caller is allowed to target
  USING (auth.uid() = id)

  -- WITH CHECK: what the new row values must look like after the write
  WITH CHECK (
    -- Row must still belong to the calling user
    auth.uid() = id

    -- ── Immutable: privilege flags ──────────────────────────────────────────
    AND is_admin = (
      SELECT is_admin FROM public.profiles WHERE id = auth.uid()
    )
    AND is_suspended = (
      SELECT is_suspended FROM public.profiles WHERE id = auth.uid()
    )

    -- ── Immutable: gamification counters ───────────────────────────────────
    AND xp_total = (
      SELECT xp_total FROM public.profiles WHERE id = auth.uid()
    )
    AND nivel = (
      SELECT nivel FROM public.profiles WHERE id = auth.uid()
    )

    -- ── Immutable: suspension metadata (set only by admins) ────────────────
    AND suspended_until = (
      SELECT suspended_until FROM public.profiles WHERE id = auth.uid()
    )
    AND suspension_reason = (
      SELECT suspension_reason FROM public.profiles WHERE id = auth.uid()
    )
  );


-- =============================================================================
-- POST-MIGRATION ACTION REQUIRED
-- =============================================================================
--
-- gamificationService.ts (client-side) currently calls:
--
--   supabase.from("profiles").update({ xp_total: newXp, nivel: newLevel })
--
-- with the logged-in user's JWT. This will be SILENTLY REJECTED by the new
-- policy above (the update appears to succeed from the SDK but no row is
-- actually changed because the WITH CHECK blocks the write).
--
-- Recommended fix – choose one:
--
--   Option A (preferred): Move XP/level writes to a Postgres trigger on the
--     `sessions` table. The existing trigger `update_xp_nivel_on_session`
--     mentioned in AdminGamificacao.tsx is the right place to centralise this.
--     The trigger runs as the table owner (superuser context), bypassing RLS.
--
--   Option B: Create a Supabase Edge Function that uses the service-role key
--     (bypasses RLS) to apply XP changes after a session is saved. The client
--     calls the function with the session result; the function validates and
--     writes XP/level atomically.
--
--   Option C (short-term workaround): Grant the `xp_total` and `nivel`
--     columns a SECURITY DEFINER function that validates the delta is within
--     an acceptable range before applying it, then remove those columns from
--     the immutability checks above.
--
-- profileService.ts – additional hardening (no DB change needed):
--   Remove `xp_total` and `nivel` from the Partial<Pick<...>> type in
--   updateProfile() so the TypeScript compiler blocks those writes at
--   compile time, making the defence-in-depth complete.
-- =============================================================================
