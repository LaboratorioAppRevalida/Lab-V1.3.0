-- =============================================================================
-- Migration : 010_secure_content_tables_rls.sql
-- Tables    : public.checklists · public.resumos
-- Purpose   : Restrict write access (INSERT / UPDATE / DELETE) to
--             administrators only, while keeping SELECT open to every
--             authenticated user so students can train normally.
--
-- Admin verification:
--   public.is_admin_check() — pre-existing helper function that reads
--   `is_admin` from the calling user's row in `public.profiles` and
--   returns TRUE when the column is set. All write policies delegate to
--   this function, so admin status is enforced server-side by Postgres,
--   independently of any client-side role check.
--
-- Backward compatibility:
--   · SELECT behaviour is unchanged — students keep full read access.
--   · Admin write paths (ChecklistBuilder, ChecklistsList, ResumoEditor,
--     ResumosList) continue to work because admins satisfy is_admin_check().
--   · Non-admin authenticated users who previously could write will now
--     receive HTTP 42501 (policy violation) on any INSERT / UPDATE / DELETE.
--     All current write call-sites are under /admin/ routes which are
--     already protected by ProtectedRoute (admin-only), so no UI breakage.
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: public.checklists
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Step 1: Ensure RLS is enabled ────────────────────────────────────────────
ALTER TABLE public.checklists ENABLE ROW LEVEL SECURITY;

-- ── Step 2: Drop all existing policies (common Supabase auto-generated names
--            plus any custom names used in this project).
--            IF EXISTS makes each statement safe to re-run. ──────────────────
DROP POLICY IF EXISTS "checklists_select_all"              ON public.checklists;
DROP POLICY IF EXISTS "checklists_select_authenticated"    ON public.checklists;
DROP POLICY IF EXISTS "checklists_insert_own"              ON public.checklists;
DROP POLICY IF EXISTS "checklists_insert_admin"            ON public.checklists;
DROP POLICY IF EXISTS "checklists_update_own"              ON public.checklists;
DROP POLICY IF EXISTS "checklists_update_admin"            ON public.checklists;
DROP POLICY IF EXISTS "checklists_delete_own"              ON public.checklists;
DROP POLICY IF EXISTS "checklists_delete_admin"            ON public.checklists;
DROP POLICY IF EXISTS "checklists_all_admin"               ON public.checklists;
DROP POLICY IF EXISTS "checklists_all_own"                 ON public.checklists;
DROP POLICY IF EXISTS "Allow read access to all users"     ON public.checklists;
DROP POLICY IF EXISTS "Allow authenticated users to read"  ON public.checklists;
DROP POLICY IF EXISTS "Enable read access for all users"   ON public.checklists;
DROP POLICY IF EXISTS "Enable insert for authenticated"    ON public.checklists;
DROP POLICY IF EXISTS "Enable update for authenticated"    ON public.checklists;
DROP POLICY IF EXISTS "Enable delete for authenticated"    ON public.checklists;

-- ── Step 3: SELECT — open to all authenticated users ─────────────────────────
-- Students use listAllChecklists() and getChecklistById() during training.
-- No restriction on read; every authenticated user may query any row.
CREATE POLICY "checklists_select_authenticated"
  ON public.checklists
  FOR SELECT
  TO authenticated
  USING (true);

-- ── Step 4: INSERT — admin only ───────────────────────────────────────────────
-- createChecklist() is called exclusively from ChecklistBuilder (/admin/).
CREATE POLICY "checklists_insert_admin"
  ON public.checklists
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_check());

-- ── Step 5: UPDATE — admin only ───────────────────────────────────────────────
-- updateChecklist() is called exclusively from ChecklistBuilder (/admin/).
CREATE POLICY "checklists_update_admin"
  ON public.checklists
  FOR UPDATE
  TO authenticated
  USING     (public.is_admin_check())
  WITH CHECK (public.is_admin_check());

-- ── Step 6: DELETE — admin only ───────────────────────────────────────────────
-- deleteChecklistById() is called from ChecklistBuilder and ChecklistsList,
-- both under /admin/ routes.
CREATE POLICY "checklists_delete_admin"
  ON public.checklists
  FOR DELETE
  TO authenticated
  USING (public.is_admin_check());


-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: public.resumos
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Step 1: Ensure RLS is enabled ────────────────────────────────────────────
ALTER TABLE public.resumos ENABLE ROW LEVEL SECURITY;

-- ── Step 2: Drop all existing policies ───────────────────────────────────────
DROP POLICY IF EXISTS "resumos_select_all"                 ON public.resumos;
DROP POLICY IF EXISTS "resumos_select_authenticated"       ON public.resumos;
DROP POLICY IF EXISTS "resumos_insert_own"                 ON public.resumos;
DROP POLICY IF EXISTS "resumos_insert_admin"               ON public.resumos;
DROP POLICY IF EXISTS "resumos_update_own"                 ON public.resumos;
DROP POLICY IF EXISTS "resumos_update_admin"               ON public.resumos;
DROP POLICY IF EXISTS "resumos_delete_own"                 ON public.resumos;
DROP POLICY IF EXISTS "resumos_delete_admin"               ON public.resumos;
DROP POLICY IF EXISTS "resumos_all_admin"                  ON public.resumos;
DROP POLICY IF EXISTS "resumos_all_own"                    ON public.resumos;
DROP POLICY IF EXISTS "Allow read access to all users"     ON public.resumos;
DROP POLICY IF EXISTS "Allow authenticated users to read"  ON public.resumos;
DROP POLICY IF EXISTS "Enable read access for all users"   ON public.resumos;
DROP POLICY IF EXISTS "Enable insert for authenticated"    ON public.resumos;
DROP POLICY IF EXISTS "Enable update for authenticated"    ON public.resumos;
DROP POLICY IF EXISTS "Enable delete for authenticated"    ON public.resumos;

-- ── Step 3: SELECT — open to all authenticated users ─────────────────────────
-- Students use listAllResumos() and getResumoById() from the /resumos/ pages.
CREATE POLICY "resumos_select_authenticated"
  ON public.resumos
  FOR SELECT
  TO authenticated
  USING (true);

-- ── Step 4: INSERT — admin only ───────────────────────────────────────────────
-- createResumo() is called exclusively from ResumoEditor (/admin/).
CREATE POLICY "resumos_insert_admin"
  ON public.resumos
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_check());

-- ── Step 5: UPDATE — admin only ───────────────────────────────────────────────
-- updateResumo() is called exclusively from ResumoEditor (/admin/).
CREATE POLICY "resumos_update_admin"
  ON public.resumos
  FOR UPDATE
  TO authenticated
  USING     (public.is_admin_check())
  WITH CHECK (public.is_admin_check());

-- ── Step 6: DELETE — admin only ───────────────────────────────────────────────
-- deleteResumoById() is called from ResumoEditor and ResumosList (/admin/).
CREATE POLICY "resumos_delete_admin"
  ON public.resumos
  FOR DELETE
  TO authenticated
  USING (public.is_admin_check());


-- =============================================================================
-- VERIFICATION QUERIES
-- Run these after applying the migration to confirm policies are in place.
-- =============================================================================
--
-- SELECT schemaname, tablename, policyname, cmd, qual, with_check
--   FROM pg_policies
--  WHERE tablename IN ('checklists', 'resumos')
--  ORDER BY tablename, cmd;
--
-- Expected result — 4 policies per table (8 total):
--
--  checklists | SELECT | true            | —
--  checklists | INSERT | —               | is_admin_check()
--  checklists | UPDATE | is_admin_check()| is_admin_check()
--  checklists | DELETE | is_admin_check()| —
--  resumos    | SELECT | true            | —
--  resumos    | INSERT | —               | is_admin_check()
--  resumos    | UPDATE | is_admin_check()| is_admin_check()
--  resumos    | DELETE | is_admin_check()| —
-- =============================================================================
