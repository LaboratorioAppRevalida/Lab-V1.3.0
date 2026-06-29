-- =============================================================================
-- Migration : 034_colaborador_role.sql
-- Purpose   : Introduce the 'colaborador' user tier with:
--               1. is_colaborador flag on profiles
--               2. created_by + is_approved columns on checklists
--               3. is_colaborador_check() SECURITY DEFINER helper
--               4. Updated RLS policies (INSERT/UPDATE) for checklists
--
-- Admin write paths are UNCHANGED — is_admin_check() still grants full access.
-- Backfill: existing rows get created_by = user_id, is_approved = true so the
--           student catalog and multiplayer pool are unaffected.
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 1 — profiles: add is_colaborador
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_colaborador boolean NOT NULL DEFAULT false;


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2 — checklists: add created_by and is_approved
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.checklists
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.checklists
  ADD COLUMN IF NOT EXISTS is_approved boolean NOT NULL DEFAULT false;

-- Backfill all existing admin-created rows so they remain visible
UPDATE public.checklists
  SET created_by  = user_id,
      is_approved = true
  WHERE created_by IS NULL;


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 3 — is_colaborador_check() helper (mirrors is_admin_check pattern)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_colaborador_check()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND is_colaborador = true
  );
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 4 — Update RLS policies on public.checklists
--
-- INSERT: admin OR colaborador may insert
-- UPDATE: admin always; colaborador only on their own rows (created_by = uid)
-- DELETE: unchanged — admin only (checklists_delete_admin from migration 010)
-- SELECT: unchanged — all authenticated users (checklists_select_authenticated)
-- ─────────────────────────────────────────────────────────────────────────────

-- INSERT ─────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "checklists_insert_admin"                  ON public.checklists;
DROP POLICY IF EXISTS "checklists_insert_admin_or_colaborador"   ON public.checklists;

CREATE POLICY "checklists_insert_admin_or_colaborador"
  ON public.checklists
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin_check()
    OR public.is_colaborador_check()
  );

-- UPDATE ─────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "checklists_update_admin" ON public.checklists;

CREATE POLICY "checklists_update_admin"
  ON public.checklists
  FOR UPDATE
  TO authenticated
  USING (
    public.is_admin_check()
    OR (public.is_colaborador_check() AND created_by = auth.uid())
  )
  WITH CHECK (
    public.is_admin_check()
    OR (public.is_colaborador_check() AND created_by = auth.uid())
  );


-- =============================================================================
-- VERIFICATION QUERIES — run after applying to confirm:
--
-- SELECT column_name, data_type FROM information_schema.columns
--  WHERE table_name = 'checklists'
--    AND column_name IN ('created_by','is_approved');
--
-- SELECT column_name, data_type FROM information_schema.columns
--  WHERE table_name = 'profiles'
--    AND column_name = 'is_colaborador';
--
-- SELECT policyname, cmd, qual, with_check FROM pg_policies
--  WHERE tablename = 'checklists' ORDER BY cmd;
-- =============================================================================
