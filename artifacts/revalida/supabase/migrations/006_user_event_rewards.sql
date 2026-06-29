-- ============================================================
-- 006_user_event_rewards.sql
-- FASE EVENTOS 1E — Controle de resgate de recompensas de eventos
-- Idempotente: pode ser executado múltiplas vezes com segurança
-- ============================================================

-- ── Tabela ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_event_rewards (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id           uuid        NOT NULL
                                REFERENCES public.profiles(id)
                                ON DELETE CASCADE,

  event_reward_id   uuid        NOT NULL
                                REFERENCES public.event_rewards(id)
                                ON DELETE CASCADE,

  claimed_at        timestamptz NOT NULL DEFAULT now(),

  UNIQUE (user_id, event_reward_id)
);

-- ── RLS ─────────────────────────────────────────────────────
ALTER TABLE public.user_event_rewards ENABLE ROW LEVEL SECURITY;

-- ── Políticas ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "uer_select_own" ON public.user_event_rewards;
DROP POLICY IF EXISTS "uer_insert_own" ON public.user_event_rewards;
DROP POLICY IF EXISTS "uer_all_admin"  ON public.user_event_rewards;

-- Usuário vê apenas os seus registros
CREATE POLICY "uer_select_own"
  ON public.user_event_rewards
  FOR SELECT
  USING (auth.uid() = user_id);

-- Usuário insere apenas os seus
CREATE POLICY "uer_insert_own"
  ON public.user_event_rewards
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admin vê e gerencia tudo
CREATE POLICY "uer_all_admin"
  ON public.user_event_rewards
  FOR ALL
  USING (public.is_admin_check());
