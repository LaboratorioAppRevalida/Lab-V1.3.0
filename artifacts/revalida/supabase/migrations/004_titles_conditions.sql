-- ============================================================
-- 004_titles_conditions.sql
-- Adiciona suporte a condições dinâmicas (JSONB) em títulos
-- Idempotente: pode ser executado múltiplas vezes
-- ============================================================

ALTER TABLE public.titles
  ADD COLUMN IF NOT EXISTS conditions jsonb;

CREATE INDEX IF NOT EXISTS idx_titles_conditions
  ON public.titles USING GIN (conditions)
  WHERE conditions IS NOT NULL;

COMMENT ON COLUMN public.titles.conditions IS
  'Condições automáticas para desbloqueio do título. '
  'Mesmo formato do sistema de missões: {"rules":[{"type":"station_completed","count":10}]}. '
  'Compatível com unlock_level (ambos podem coexistir — qualquer critério satisfeito desbloqueia).';
