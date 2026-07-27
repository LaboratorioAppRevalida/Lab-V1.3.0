-- ============================================================
-- 005_ump_columns.sql
-- FASE 4 — Adiciona colunas de rastreamento ao user_mission_progress
-- Idempotente: pode ser executado múltiplas vezes com segurança
-- ============================================================

ALTER TABLE public.user_mission_progress
  ADD COLUMN IF NOT EXISTS last_evaluated_at timestamptz,
  ADD COLUMN IF NOT EXISTS metadata           jsonb;

-- Índice parcial para varredura rápida de missões não-avaliadas recentemente
CREATE INDEX IF NOT EXISTS idx_ump_last_evaluated
  ON public.user_mission_progress (user_id, last_evaluated_at)
  WHERE completed = false;
