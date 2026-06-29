-- ============================================================
-- 003_missions_conditions.sql
-- Adiciona suporte a condições dinâmicas (JSONB) em missões
-- Idempotente: pode ser executado múltiplas vezes
-- ============================================================

-- Adiciona coluna conditions se não existir
ALTER TABLE public.missions
  ADD COLUMN IF NOT EXISTS conditions jsonb;

-- Índice GIN para consultas eficientes sobre JSONB
CREATE INDEX IF NOT EXISTS idx_missions_conditions
  ON public.missions USING GIN (conditions)
  WHERE conditions IS NOT NULL;

-- Comentário explicativo do formato
COMMENT ON COLUMN public.missions.conditions IS
  'Condições dinâmicas no formato {"rules":[{"type":"station_completed","area":"Cirurgia","count":10}]}. '
  'Missões sem esta coluna usam trigger_type/trigger_value (legado).';
