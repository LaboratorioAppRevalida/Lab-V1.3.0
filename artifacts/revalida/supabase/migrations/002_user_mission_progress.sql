-- ============================================================
-- 002_user_mission_progress.sql
-- Persistência de progresso de missões por usuário
-- Idempotente: pode ser executado múltiplas vezes com segurança
-- ============================================================

-- ── Tabela ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_mission_progress (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id      uuid        NOT NULL
                           REFERENCES public.profiles(id)
                           ON DELETE CASCADE,

  mission_id   uuid        NOT NULL
                           REFERENCES public.missions(id)
                           ON DELETE CASCADE,

  progress     integer     NOT NULL DEFAULT 0,
  target       integer     NOT NULL DEFAULT 1,

  completed    boolean     NOT NULL DEFAULT false,
  claimed      boolean     NOT NULL DEFAULT false,

  completed_at timestamptz,
  claimed_at   timestamptz,

  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),

  UNIQUE (user_id, mission_id)
);

-- ── Trigger updated_at ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_mission_progress_updated_at
  ON public.user_mission_progress;

CREATE TRIGGER trg_user_mission_progress_updated_at
  BEFORE UPDATE ON public.user_mission_progress
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── RLS ─────────────────────────────────────────────────────
ALTER TABLE public.user_mission_progress ENABLE ROW LEVEL SECURITY;

-- ── Políticas ────────────────────────────────────────────────
-- Limpar políticas antigas para idempotência
DROP POLICY IF EXISTS "ump_select_own"   ON public.user_mission_progress;
DROP POLICY IF EXISTS "ump_insert_own"   ON public.user_mission_progress;
DROP POLICY IF EXISTS "ump_update_own"   ON public.user_mission_progress;
DROP POLICY IF EXISTS "ump_delete_own"   ON public.user_mission_progress;
DROP POLICY IF EXISTS "ump_all_admin"    ON public.user_mission_progress;

-- Usuário vê apenas os seus
CREATE POLICY "ump_select_own"
  ON public.user_mission_progress
  FOR SELECT
  USING (auth.uid() = user_id);

-- Usuário pode inserir apenas os seus
CREATE POLICY "ump_insert_own"
  ON public.user_mission_progress
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Usuário pode atualizar apenas os seus
CREATE POLICY "ump_update_own"
  ON public.user_mission_progress
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Usuário pode deletar apenas os seus
CREATE POLICY "ump_delete_own"
  ON public.user_mission_progress
  FOR DELETE
  USING (auth.uid() = user_id);

-- Admin vê e gerencia tudo
CREATE POLICY "ump_all_admin"
  ON public.user_mission_progress
  FOR ALL
  USING (public.is_admin_check());
