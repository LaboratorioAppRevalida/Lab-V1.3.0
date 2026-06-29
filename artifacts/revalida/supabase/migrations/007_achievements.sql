-- ============================================================
-- 007_achievements.sql
-- Infraestrutura de medalhas/conquistas persistentes no Supabase
-- Idempotente: pode ser executado múltiplas vezes com segurança
-- NÃO altera tabelas existentes
-- NÃO popula dados (seed é responsabilidade da FASE MEDALHAS 2)
-- ============================================================

-- ── Tabela: achievements ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.achievements (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  slug                text        NOT NULL,
  title               text        NOT NULL,
  description         text        NOT NULL DEFAULT '',
  tier                text        NOT NULL DEFAULT 'bronze',

  icon                text,
  color               text,

  -- Critérios automáticos de desbloqueio
  required_streak     integer,
  required_stations   integer,
  required_average    numeric,

  -- Controle
  is_active           boolean     NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT achievements_slug_unique UNIQUE (slug),
  CONSTRAINT achievements_tier_check CHECK (
    tier IN ('bronze', 'prata', 'ouro', 'platina')
  )
);

-- ── Tabela: user_achievements ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_achievements (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id         uuid        NOT NULL
                              REFERENCES public.profiles(id)
                              ON DELETE CASCADE,

  achievement_id  uuid        NOT NULL
                              REFERENCES public.achievements(id)
                              ON DELETE CASCADE,

  unlocked_at     timestamptz NOT NULL DEFAULT now(),

  UNIQUE (user_id, achievement_id)
);

-- ── Índices ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_achievements_is_active
  ON public.achievements (is_active);

CREATE INDEX IF NOT EXISTS idx_achievements_tier
  ON public.achievements (tier);

CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id
  ON public.user_achievements (user_id);

CREATE INDEX IF NOT EXISTS idx_user_achievements_achievement_id
  ON public.user_achievements (achievement_id);

-- ── Trigger updated_at (achievements) ───────────────────────
-- Reutiliza a função set_updated_at() criada em 002_user_mission_progress.sql
-- Se ainda não existir, cria aqui (guarda para idempotência)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_achievements_updated_at
  ON public.achievements;

CREATE TRIGGER trg_achievements_updated_at
  BEFORE UPDATE ON public.achievements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── RLS: achievements ────────────────────────────────────────
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ach_select_all"   ON public.achievements;
DROP POLICY IF EXISTS "ach_all_admin"    ON public.achievements;

-- Qualquer usuário autenticado pode ver medalhas ativas
CREATE POLICY "ach_select_all"
  ON public.achievements
  FOR SELECT
  USING (is_active = true);

-- Admin gerencia tudo (incluindo inativas)
CREATE POLICY "ach_all_admin"
  ON public.achievements
  FOR ALL
  USING (public.is_admin_check());

-- ── RLS: user_achievements ───────────────────────────────────
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ua_select_own"   ON public.user_achievements;
DROP POLICY IF EXISTS "ua_insert_own"   ON public.user_achievements;
DROP POLICY IF EXISTS "ua_delete_own"   ON public.user_achievements;
DROP POLICY IF EXISTS "ua_all_admin"    ON public.user_achievements;

-- Usuário vê apenas as suas
CREATE POLICY "ua_select_own"
  ON public.user_achievements
  FOR SELECT
  USING (auth.uid() = user_id);

-- Usuário pode inserir apenas as suas
CREATE POLICY "ua_insert_own"
  ON public.user_achievements
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Usuário pode deletar apenas as suas
CREATE POLICY "ua_delete_own"
  ON public.user_achievements
  FOR DELETE
  USING (auth.uid() = user_id);

-- Admin vê e gerencia tudo
CREATE POLICY "ua_all_admin"
  ON public.user_achievements
  FOR ALL
  USING (public.is_admin_check());

-- ── Comentários ──────────────────────────────────────────────
COMMENT ON TABLE public.achievements IS
  'Catálogo de medalhas/conquistas da plataforma. '
  'Tier: bronze, prata, ouro, platina. '
  'Critérios automáticos: required_streak (dias), required_stations (estações), required_average (0-10). '
  'seed: FASE MEDALHAS 2.';

COMMENT ON TABLE public.user_achievements IS
  'Medalhas desbloqueadas por usuário. '
  'UNIQUE(user_id, achievement_id) garante idempotência no unlock. '
  'unlocked_at: timestamp do desbloqueio.';

COMMENT ON COLUMN public.achievements.slug IS
  'Identificador legível único (ex: "streak-bronze", "est-iniciante"). '
  'Usado para mapear as ACHIEVEMENTS[] do gamificationStorage.ts.';

COMMENT ON COLUMN public.achievements.tier IS
  'Nível visual da medalha. Deve corresponder a AchievementTier em gamificationStorage.ts.';

COMMENT ON COLUMN public.achievements.required_streak IS
  'Dias consecutivos de login necessários para desbloqueio automático.';

COMMENT ON COLUMN public.achievements.required_stations IS
  'Total de estações completadas necessárias para desbloqueio automático.';

COMMENT ON COLUMN public.achievements.required_average IS
  'Média geral mínima (escala 0-10) necessária para desbloqueio automático.';
