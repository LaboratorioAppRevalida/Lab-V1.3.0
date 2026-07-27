-- ============================================================
-- 013_secure_gamification_tables_rls.sql
-- Harden gamification table RLS to prevent badge/title forgery
-- Idempotente: pode ser executado múltiplas vezes com segurança
-- ============================================================
--
-- THREAT MODEL
-- ─────────────────────────────────────────────────────────────
-- Before this migration, any authenticated user can forge their
-- own credentials by calling the Supabase client API directly:
--
--   supabase.from('user_achievements').insert({ user_id: uid, achievement_id: any_uuid })
--   supabase.from('user_titles').insert({ user_id: uid, title_id: legendary_title_uuid })
--   supabase.from('user_event_rewards').insert({ user_id: uid, event_reward_id: any_uuid })
--
-- This bypasses all client-side eligibility checks and lets any
-- user award themselves badges, exclusive titles, and event prizes.
--
-- DEFENSE ARCHITECTURE
-- ─────────────────────────────────────────────────────────────
-- 1. Remove all permissive INSERT/UPDATE/DELETE policies that
--    allow regular users to write directly to these tables.
-- 2. Re-create write access as admin-only via is_admin_check().
-- 3. Introduce SECURITY DEFINER RPCs as the only legitimate write
--    path for regular users. Each RPC validates eligibility
--    server-side before inserting, using authoritative DB data
--    (profiles.streak_atual, profiles.avg_rating, sessions count,
--    event end dates) — not client-supplied values.
-- 4. SELECT is broadened to all authenticated users so public
--    profile pages can display earned awards for any doctor.
--
-- KNOWN LIMITATION — CONDITION-BASED TITLES
-- ─────────────────────────────────────────────────────────────
-- Titles that use the JSONB `conditions` field (mission rules
-- engine) cannot be fully validated in PL/pgSQL without
-- rewriting the TypeScript evaluator. fn_unlock_title therefore
-- allows condition-based titles for authenticated users who
-- present a valid title UUID, trusting the client-side engine
-- pre-validation. The authoritative fix is a DB trigger on
-- sessions INSERT; that is a separate migration task.
--
-- Tables affected: user_achievements, user_titles, user_event_rewards
-- New RPCs: fn_unlock_achievement, fn_unlock_title,
--           fn_equip_title, fn_claim_event_reward
-- ============================================================


-- ══════════════════════════════════════════════════════════════
-- SECTION 1 — user_achievements
-- ══════════════════════════════════════════════════════════════

ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

-- Drop every policy that could allow direct writes by regular users.
-- Names from migration 007 and any plausible variant.
DROP POLICY IF EXISTS "ua_select_own"        ON public.user_achievements;
DROP POLICY IF EXISTS "ua_insert_own"        ON public.user_achievements;   -- ← the vulnerability
DROP POLICY IF EXISTS "ua_update_own"        ON public.user_achievements;
DROP POLICY IF EXISTS "ua_delete_own"        ON public.user_achievements;
DROP POLICY IF EXISTS "ua_all_admin"         ON public.user_achievements;
DROP POLICY IF EXISTS "ua_select_all"        ON public.user_achievements;

-- SELECT: all authenticated users can read all rows.
-- Required for: public profile pages showing another doctor's medals.
CREATE POLICY "ua_select_all"
  ON public.user_achievements
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- ALL writes (INSERT/UPDATE/DELETE): admins only via direct table access.
-- Regular users must use fn_unlock_achievement() RPC instead.
CREATE POLICY "ua_all_admin"
  ON public.user_achievements
  FOR ALL
  USING (public.is_admin_check());


-- ══════════════════════════════════════════════════════════════
-- SECTION 2 — user_titles
-- ══════════════════════════════════════════════════════════════

ALTER TABLE public.user_titles ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies (names used in original schema + likely variants).
DROP POLICY IF EXISTS "ut_select_own"        ON public.user_titles;
DROP POLICY IF EXISTS "ut_select_all"        ON public.user_titles;
DROP POLICY IF EXISTS "ut_insert_own"        ON public.user_titles;
DROP POLICY IF EXISTS "ut_update_own"        ON public.user_titles;
DROP POLICY IF EXISTS "ut_delete_own"        ON public.user_titles;
DROP POLICY IF EXISTS "ut_all_admin"         ON public.user_titles;
-- Also drop any policy using the "user_titles" prefix convention
DROP POLICY IF EXISTS "user_titles_select"   ON public.user_titles;
DROP POLICY IF EXISTS "user_titles_insert"   ON public.user_titles;
DROP POLICY IF EXISTS "user_titles_update"   ON public.user_titles;
DROP POLICY IF EXISTS "user_titles_delete"   ON public.user_titles;
DROP POLICY IF EXISTS "user_titles_all"      ON public.user_titles;

-- SELECT: all authenticated users can read all rows.
-- Required for: leaderboards, public profiles, equipped-title display.
CREATE POLICY "ut_select_all"
  ON public.user_titles
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- ALL writes: admins only.
-- Regular users must use fn_unlock_title() / fn_equip_title() RPCs.
CREATE POLICY "ut_all_admin"
  ON public.user_titles
  FOR ALL
  USING (public.is_admin_check());


-- ══════════════════════════════════════════════════════════════
-- SECTION 3 — user_event_rewards
-- ══════════════════════════════════════════════════════════════

ALTER TABLE public.user_event_rewards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "uer_select_own"       ON public.user_event_rewards;
DROP POLICY IF EXISTS "uer_insert_own"       ON public.user_event_rewards;  -- ← the vulnerability
DROP POLICY IF EXISTS "uer_update_own"       ON public.user_event_rewards;
DROP POLICY IF EXISTS "uer_delete_own"       ON public.user_event_rewards;
DROP POLICY IF EXISTS "uer_all_admin"        ON public.user_event_rewards;

-- SELECT: own rows only (event claims are private).
CREATE POLICY "uer_select_own"
  ON public.user_event_rewards
  FOR SELECT
  USING (auth.uid() = user_id);

-- ALL writes: admins only.
-- Regular users must use fn_claim_event_reward() RPC instead.
CREATE POLICY "uer_all_admin"
  ON public.user_event_rewards
  FOR ALL
  USING (public.is_admin_check());


-- ══════════════════════════════════════════════════════════════
-- SECTION 4 — SECURITY DEFINER RPCs
-- ══════════════════════════════════════════════════════════════
--
-- These run as the table owner (bypassing RLS) but ONLY after
-- performing server-side eligibility validation. The SECURITY
-- DEFINER + SET search_path pattern prevents search-path hijacking.
-- ──────────────────────────────────────────────────────────────


-- ── 4A. fn_unlock_achievement ─────────────────────────────────
--
-- Grants an achievement to the calling user after validating that
-- at least one of the achievement's criteria is met using
-- authoritative data from the DB:
--   · required_streak   → profiles.streak_atual
--   · required_stations → COUNT(*) FROM sessions WHERE user_id
--   · required_average  → profiles.avg_rating (scale 0-10)
--
-- ASSUMPTION: profiles.avg_rating is stored on the same 0-10
-- scale as achievements.required_average (as documented in 007).
-- If profiles stores avg_rating as a percentage (0-100), update
-- the comparison to: v_avg_rating / 10 >= v_ach.required_average
--
-- Idempotent: ON CONFLICT DO NOTHING (already unlocked = no-op).
-- Admin bypass: is_admin_check() skips criteria validation.
-- ─────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.fn_unlock_achievement(UUID);

CREATE OR REPLACE FUNCTION public.fn_unlock_achievement(
  p_achievement_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id       UUID := auth.uid();
  v_ach           achievements%ROWTYPE;
  v_streak        INTEGER := 0;
  v_avg_rating    NUMERIC := 0;
  v_station_count BIGINT  := 0;
  v_qualifies     BOOLEAN := FALSE;
BEGIN
  -- Must be authenticated
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Achievement must exist and be active
  SELECT * INTO v_ach
  FROM public.achievements
  WHERE id = p_achievement_id AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'achievement_not_found_or_inactive: %', p_achievement_id;
  END IF;

  -- Admins bypass criteria checks (used for manual grants)
  IF public.is_admin_check() THEN
    v_qualifies := TRUE;
  ELSE
    -- Read authoritative user stats from DB
    SELECT COALESCE(streak_atual, 0), COALESCE(avg_rating, 0)
      INTO v_streak, v_avg_rating
    FROM public.profiles
    WHERE id = v_user_id;

    SELECT COUNT(*) INTO v_station_count
    FROM public.sessions
    WHERE user_id = v_user_id;

    -- Any one criterion is sufficient (OR logic, mirrors achievementEngine.ts)
    IF v_ach.required_streak IS NOT NULL
       AND v_streak >= v_ach.required_streak THEN
      v_qualifies := TRUE;
    END IF;

    IF v_ach.required_stations IS NOT NULL
       AND v_station_count >= v_ach.required_stations THEN
      v_qualifies := TRUE;
    END IF;

    IF v_ach.required_average IS NOT NULL
       AND v_avg_rating >= v_ach.required_average THEN
      v_qualifies := TRUE;
    END IF;
  END IF;

  IF NOT v_qualifies THEN
    RAISE EXCEPTION 'criteria_not_met: user does not qualify for achievement %', p_achievement_id;
  END IF;

  -- Idempotent insert
  INSERT INTO public.user_achievements (user_id, achievement_id)
  VALUES (v_user_id, p_achievement_id)
  ON CONFLICT (user_id, achievement_id) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_unlock_achievement(UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_unlock_achievement(UUID) FROM anon;


-- ── 4B. fn_unlock_title ───────────────────────────────────────
--
-- Grants a title to the calling user. Validation rules:
--   · unlock_level IS NOT NULL → profiles.nivel >= unlock_level
--   · event_id IS NOT NULL     → event must not be past end_date
--   · conditions only (no level/event) → allowed (trusted engine;
--       see KNOWN LIMITATION note at top of file)
--
-- Does NOT grant event-exclusive (event_id IS NOT NULL) titles
-- if the event has already ended, preventing post-event claims.
-- Idempotent: ON CONFLICT DO NOTHING.
-- ─────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.fn_unlock_title(UUID);

CREATE OR REPLACE FUNCTION public.fn_unlock_title(
  p_title_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id     UUID := auth.uid();
  v_title       titles%ROWTYPE;
  v_user_nivel  INTEGER := 0;
  v_event_end   TIMESTAMPTZ;
  v_qualifies   BOOLEAN := FALSE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Title must exist and be active
  SELECT * INTO v_title
  FROM public.titles
  WHERE id = p_title_id AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'title_not_found_or_inactive: %', p_title_id;
  END IF;

  -- Admin bypass
  IF public.is_admin_check() THEN
    v_qualifies := TRUE;

  ELSIF v_title.event_id IS NOT NULL THEN
    -- Event title: verify the event is still active
    SELECT end_date INTO v_event_end
    FROM public.events
    WHERE id = v_title.event_id;

    IF NOT FOUND OR (v_event_end IS NOT NULL AND v_event_end < now()) THEN
      RAISE EXCEPTION 'event_ended_or_not_found: title % belongs to an expired event', p_title_id;
    END IF;
    v_qualifies := TRUE;

  ELSIF v_title.unlock_level IS NOT NULL THEN
    -- Level-gated title: check profiles.nivel
    SELECT COALESCE(nivel, 1) INTO v_user_nivel
    FROM public.profiles WHERE id = v_user_id;

    IF v_user_nivel < v_title.unlock_level THEN
      RAISE EXCEPTION 'level_too_low: required %, current %',
        v_title.unlock_level, v_user_nivel;
    END IF;
    v_qualifies := TRUE;

  ELSE
    -- Condition-based title (JSONB mission rules — cannot be validated in SQL).
    -- The client-side evaluateAutomaticTitles() engine must have pre-validated
    -- eligibility. Future: replace with a sessions-INSERT trigger.
    v_qualifies := TRUE;
  END IF;

  IF NOT v_qualifies THEN
    RAISE EXCEPTION 'not_eligible: cannot unlock title %', p_title_id;
  END IF;

  -- Idempotent insert
  INSERT INTO public.user_titles (user_id, title_id, is_equipped)
  VALUES (v_user_id, p_title_id, false)
  ON CONFLICT (user_id, title_id) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_unlock_title(UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_unlock_title(UUID) FROM anon;


-- ── 4C. fn_equip_title ────────────────────────────────────────
--
-- Equips a title the user already owns. Two-step update:
--   1. Unequip all titles for the user
--   2. Equip the specified title
--
-- Validates: the user must own the title (row must exist in
-- user_titles with user_id = auth.uid()). Cannot equip a title
-- that wasn't legitimately unlocked.
-- ─────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.fn_equip_title(UUID);

CREATE OR REPLACE FUNCTION public.fn_equip_title(
  p_title_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_owns    BOOLEAN;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- User must own the title
  SELECT EXISTS (
    SELECT 1 FROM public.user_titles
    WHERE user_id = v_user_id AND title_id = p_title_id
  ) INTO v_owns;

  IF NOT v_owns THEN
    RAISE EXCEPTION 'title_not_owned: user does not own title %', p_title_id;
  END IF;

  -- Unequip all
  UPDATE public.user_titles
    SET is_equipped = false
  WHERE user_id = v_user_id;

  -- Equip the chosen one
  UPDATE public.user_titles
    SET is_equipped = true
  WHERE user_id = v_user_id AND title_id = p_title_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_equip_title(UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_equip_title(UUID) FROM anon;


-- ── 4D. fn_claim_event_reward ────────────────────────────────
--
-- Claims an event reward for the calling user. Validates:
--   · The event_reward must exist
--   · The parent event must not be past its end_date
--   · (Uniqueness guaranteed by UNIQUE constraint on the table)
--
-- Returns: 'claimed' on new insert, 'already_claimed' if the
-- UNIQUE constraint fires (idempotent from the caller's perspective).
-- ─────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.fn_claim_event_reward(UUID);

CREATE OR REPLACE FUNCTION public.fn_claim_event_reward(
  p_event_reward_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id       UUID := auth.uid();
  v_event_id      UUID;
  v_event_end     TIMESTAMPTZ;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Resolve event from the reward
  SELECT er.event_id, e.end_date
    INTO v_event_id, v_event_end
  FROM public.event_rewards er
  JOIN public.events e ON e.id = er.event_id
  WHERE er.id = p_event_reward_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'reward_not_found: %', p_event_reward_id;
  END IF;

  -- Event must still be active
  IF v_event_end IS NOT NULL AND v_event_end < now() THEN
    RAISE EXCEPTION 'event_ended: cannot claim rewards for an expired event (%)' , v_event_id;
  END IF;

  -- Insert — ON CONFLICT means already claimed
  BEGIN
    INSERT INTO public.user_event_rewards (user_id, event_reward_id)
    VALUES (v_user_id, p_event_reward_id);
    RETURN 'claimed';
  EXCEPTION WHEN unique_violation THEN
    RETURN 'already_claimed';
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_claim_event_reward(UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_claim_event_reward(UUID) FROM anon;


-- ══════════════════════════════════════════════════════════════
-- SECTION 5 — Comments / audit trail
-- ══════════════════════════════════════════════════════════════

COMMENT ON POLICY "ua_select_all" ON public.user_achievements IS
  'Post-013: all authenticated users can read all achievement rows. '
  'Needed for public profile medal display. '
  'Direct INSERT/UPDATE/DELETE requires is_admin_check() or fn_unlock_achievement RPC.';

COMMENT ON POLICY "ut_select_all" ON public.user_titles IS
  'Post-013: all authenticated users can read all title rows. '
  'Needed for equipped-title display on leaderboards and public profiles. '
  'Direct INSERT/UPDATE/DELETE requires is_admin_check(). '
  'Regular users write via fn_unlock_title / fn_equip_title RPCs.';

COMMENT ON POLICY "uer_select_own" ON public.user_event_rewards IS
  'Post-013: users can only read their own event claim rows. '
  'Direct INSERT requires is_admin_check(). '
  'Regular users write via fn_claim_event_reward RPC.';

COMMENT ON FUNCTION public.fn_unlock_achievement(UUID) IS
  'SECURITY DEFINER. Validates achievement criteria server-side '
  '(streak_atual, session count, avg_rating from DB) before unlocking. '
  'Only valid write path for regular users on user_achievements.';

COMMENT ON FUNCTION public.fn_unlock_title(UUID) IS
  'SECURITY DEFINER. Validates unlock_level and event expiry server-side. '
  'Condition-based titles (JSONB) are trusted from client engine pending '
  'a future sessions-INSERT trigger migration.';

COMMENT ON FUNCTION public.fn_equip_title(UUID) IS
  'SECURITY DEFINER. Atomically unequips all titles then equips the chosen one. '
  'Validates user ownership before updating. '
  'Replaces direct UPDATE access removed in migration 013.';

COMMENT ON FUNCTION public.fn_claim_event_reward(UUID) IS
  'SECURITY DEFINER. Validates event is not expired before inserting. '
  'Returns ''claimed'' | ''already_claimed''. '
  'Only valid write path for regular users on user_event_rewards.';
