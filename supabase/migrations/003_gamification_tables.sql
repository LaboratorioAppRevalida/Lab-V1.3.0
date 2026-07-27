-- ============================================================
-- REVALIDA — GAMIFICAÇÃO ADMINISTRÁVEL
-- Versão: 1.0.0  |  Gerado em: 2026-05-23
-- Idempotente: sim (IF NOT EXISTS / ON CONFLICT DO NOTHING)
-- NÃO altera tabelas existentes (profiles, sessions).
-- NÃO apaga dados de usuários.
-- ============================================================

-- ============================================================
-- BLOCO 1 — TABELA missions
-- Substitui as missões hardcoded de gamificationStorage.ts
-- ============================================================

CREATE TABLE IF NOT EXISTS public.missions (
  id            uuid        NOT NULL DEFAULT gen_random_uuid(),
  slug          text        NOT NULL,
  name          text        NOT NULL,
  description   text        NOT NULL DEFAULT '',
  xp_reward     integer     NOT NULL DEFAULT 0 CHECK (xp_reward >= 0),
  type          text        NOT NULL DEFAULT 'diaria'
                CHECK (type IN ('diaria','semanal','especial','evento','secreta')),
  category      text        NOT NULL DEFAULT 'geral',
  rarity        text        NOT NULL DEFAULT 'common'
                CHECK (rarity IN ('common','rare','epic','legendary','exclusive','event')),
  is_active     boolean     NOT NULL DEFAULT true,
  hidden        boolean     NOT NULL DEFAULT false,
  icon          text,
  trigger_type  text        NOT NULL DEFAULT 'manual',
  trigger_value integer     NOT NULL DEFAULT 1 CHECK (trigger_value >= 0),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT missions_pkey    PRIMARY KEY (id),
  CONSTRAINT missions_slug_uq UNIQUE (slug)
);

DROP TRIGGER IF EXISTS trg_missions_updated_at ON public.missions;
CREATE TRIGGER trg_missions_updated_at
  BEFORE UPDATE ON public.missions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed: todas as missões existentes em gamificationStorage.ts
INSERT INTO public.missions
  (slug, name, description, xp_reward, type, category, rarity, trigger_type, trigger_value)
VALUES
  ('diario-login',   'Login diário',           'Abra a plataforma hoje',                       10,  'diaria',   'login',       'common', 'login',                     1),
  ('diario-3-est',   '3 estações no dia',       'Complete 3 estações hoje',                    50,  'diaria',   'estacoes',    'common', 'completar_estacao',          3),
  ('diario-paciente','Atue como paciente',      'Faça uma estação no papel de paciente',        20,  'diaria',   'papel',       'common', 'completar_estacao_paciente', 1),
  ('semanal-7-est',  '7 estações na semana',    'Mantenha o ritmo: 7 estações',                120,  'semanal',  'estacoes',    'rare',   'completar_estacao',          7),
  ('semanal-areas',  'Diversifique áreas',      'Treine 3 grandes áreas diferentes',            80,  'semanal',  'diversidade', 'rare',   'completar_estacao',          3),
  ('semanal-streak', 'Constância de 7 dias',    'Treine 7 dias seguidos',                      100,  'semanal',  'streak',      'rare',   'streak',                    7),
  ('mensal-30-est',  'Marathon mensal',         'Complete 30 estações no mês',                 400,  'especial', 'estacoes',    'epic',   'completar_estacao',         30),
  ('mensal-media',   'Média acima de 8',        'Mantenha média geral acima de 8.0',           250,  'especial', 'performance', 'epic',   'media_nota',                 8),
  ('especial-bronze','Constância Bronze',       '7 dias de treino seguidos',                   150,  'especial', 'streak',      'rare',   'streak',                    7),
  ('especial-prata', 'Constância Prata',        '30 dias de treino seguidos',                  350,  'especial', 'streak',      'epic',   'streak',                   30)
ON CONFLICT (slug) DO NOTHING;

COMMENT ON TABLE public.missions IS
  'Missões administráveis da plataforma. Substitui array hardcoded de gamificationStorage.ts. '
  'Migrations antigas são preservadas via ON CONFLICT DO NOTHING.';

-- ============================================================
-- BLOCO 2 — TABELA levels
-- Substitui LEVEL_THRESHOLDS hardcoded de levelSystem.ts
-- ============================================================

CREATE TABLE IF NOT EXISTS public.levels (
  level         integer     NOT NULL,
  xp_required   integer     NOT NULL DEFAULT 0 CHECK (xp_required >= 0),
  reward_type   text        NOT NULL DEFAULT 'title'
                CHECK (reward_type IN ('title','xp_bonus','badge','none')),
  reward_value  text,
  title_id      uuid,
  created_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT levels_pkey PRIMARY KEY (level),
  CONSTRAINT levels_level_positive CHECK (level >= 1)
);

-- Seed: thresholds existentes de levelSystem.ts
INSERT INTO public.levels (level, xp_required, reward_type, reward_value)
VALUES
  (1,     0, 'title', 'Iniciante'),
  (2,   100, 'title', 'Aprendiz'),
  (3,   300, 'title', 'Residente'),
  (4,   600, 'title', 'Especialista'),
  (5,  1000, 'title', 'Médico'),
  (6,  1500, 'title', 'Sênior'),
  (7,  2100, 'title', 'Expert'),
  (8,  2800, 'title', 'Mestre'),
  (9,  3600, 'title', 'Elite'),
  (10, 4500, 'title', 'Lenda')
ON CONFLICT (level) DO NOTHING;

COMMENT ON TABLE public.levels IS
  'Curva de XP por nível, administrável. Espelha e substitui LEVEL_THRESHOLDS de levelSystem.ts. '
  'Além do nível 10, o frontend usa a fórmula de extensão (+900 XP/nível) como fallback.';

-- ============================================================
-- BLOCO 3 — TABELA titles
-- Substitui LEVEL_NAMES hardcoded de levelSystem.ts
-- ============================================================

CREATE TABLE IF NOT EXISTS public.titles (
  id            uuid        NOT NULL DEFAULT gen_random_uuid(),
  name          text        NOT NULL,
  description   text        NOT NULL DEFAULT '',
  rarity        text        NOT NULL DEFAULT 'common'
                CHECK (rarity IN ('common','rare','epic','legendary','exclusive','event')),
  color         text        NOT NULL DEFAULT '#6366f1',
  icon          text,
  unlock_level  integer,
  event_id      uuid,
  is_active     boolean     NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT titles_pkey PRIMARY KEY (id)
);

DROP TRIGGER IF EXISTS trg_titles_updated_at ON public.titles;
CREATE TRIGGER trg_titles_updated_at
  BEFORE UPDATE ON public.titles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed: títulos existentes de levelSystem.ts LEVEL_NAMES
INSERT INTO public.titles (name, description, rarity, color, unlock_level, is_active)
VALUES
  ('Iniciante',   'Título do nível 1',  'common',    '#94a3b8', 1,  true),
  ('Aprendiz',    'Título do nível 2',  'common',    '#64748b', 2,  true),
  ('Residente',   'Título do nível 3',  'common',    '#3b82f6', 3,  true),
  ('Especialista','Título do nível 4',  'rare',      '#8b5cf6', 4,  true),
  ('Médico',      'Título do nível 5',  'rare',      '#6366f1', 5,  true),
  ('Sênior',      'Título do nível 6',  'rare',      '#0ea5e9', 6,  true),
  ('Expert',      'Título do nível 7',  'epic',      '#f59e0b', 7,  true),
  ('Mestre',      'Título do nível 8',  'epic',      '#f97316', 8,  true),
  ('Elite',       'Título do nível 9',  'legendary', '#ef4444', 9,  true),
  ('Lenda',       'Título do nível 10', 'legendary', '#ec4899', 10, true)
ON CONFLICT DO NOTHING;

COMMENT ON TABLE public.titles IS
  'Títulos administráveis. Substituem LEVEL_NAMES hardcoded de levelSystem.ts. '
  'Podem ser vinculados a níveis (unlock_level) ou eventos (event_id).';

-- ============================================================
-- BLOCO 4 — TABELA user_titles
-- Relação usuário ↔ título (múltiplos títulos por usuário)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_titles (
  id          uuid        NOT NULL DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL,
  title_id    uuid        NOT NULL,
  is_equipped boolean     NOT NULL DEFAULT false,
  unlocked_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT user_titles_pkey         PRIMARY KEY (id),
  CONSTRAINT user_titles_user_fkey    FOREIGN KEY (user_id)
    REFERENCES public.profiles (id) ON DELETE CASCADE,
  CONSTRAINT user_titles_title_fkey   FOREIGN KEY (title_id)
    REFERENCES public.titles (id)   ON DELETE CASCADE,
  CONSTRAINT user_titles_user_title_uq UNIQUE (user_id, title_id)
);

COMMENT ON TABLE public.user_titles IS
  'Relação N:N entre usuários e títulos desbloqueados. '
  'is_equipped = true indica o título ativo no perfil (máximo 1 por usuário).';

-- ============================================================
-- BLOCO 5 — TABELA events
-- Fundação do sistema de eventos administráveis
-- ============================================================

CREATE TABLE IF NOT EXISTS public.events (
  id          uuid        NOT NULL DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  description text        NOT NULL DEFAULT '',
  banner_url  text,
  type        text        NOT NULL DEFAULT 'evento'
              CHECK (type IN ('evento','especial','sazonal')),
  is_active   boolean     NOT NULL DEFAULT false,
  starts_at   timestamptz,
  ends_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT events_pkey PRIMARY KEY (id)
);

DROP TRIGGER IF EXISTS trg_events_updated_at ON public.events;
CREATE TRIGGER trg_events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.events IS
  'Eventos temporários da plataforma (fundação). '
  'Battle pass, temporadas e cosméticos NÃO implementados nesta versão.';

-- ============================================================
-- BLOCO 6 — TABELA event_rewards
-- Recompensas vinculadas a eventos
-- ============================================================

CREATE TABLE IF NOT EXISTS public.event_rewards (
  id           uuid    NOT NULL DEFAULT gen_random_uuid(),
  event_id     uuid    NOT NULL,
  reward_type  text    NOT NULL DEFAULT 'xp'
               CHECK (reward_type IN ('xp','title','badge')),
  reward_value text    NOT NULL,
  title_id     uuid,
  created_at   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT event_rewards_pkey       PRIMARY KEY (id),
  CONSTRAINT event_rewards_event_fkey FOREIGN KEY (event_id)
    REFERENCES public.events (id) ON DELETE CASCADE,
  CONSTRAINT event_rewards_title_fkey FOREIGN KEY (title_id)
    REFERENCES public.titles (id) ON DELETE SET NULL
);

-- ============================================================
-- BLOCO 7 — TABELA event_missions
-- Relação evento ↔ missão
-- ============================================================

CREATE TABLE IF NOT EXISTS public.event_missions (
  id         uuid NOT NULL DEFAULT gen_random_uuid(),
  event_id   uuid NOT NULL,
  mission_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT event_missions_pkey         PRIMARY KEY (id),
  CONSTRAINT event_missions_event_fkey   FOREIGN KEY (event_id)
    REFERENCES public.events (id)   ON DELETE CASCADE,
  CONSTRAINT event_missions_mission_fkey FOREIGN KEY (mission_id)
    REFERENCES public.missions (id) ON DELETE CASCADE,
  CONSTRAINT event_missions_uq           UNIQUE (event_id, mission_id)
);

-- ============================================================
-- BLOCO 8 — RLS (Row Level Security)
-- ============================================================

ALTER TABLE public.missions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.levels         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.titles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_titles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_rewards  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_missions ENABLE ROW LEVEL SECURITY;

-- missions: leitura pública; escrita apenas admin
DROP POLICY IF EXISTS "missions_select_all"  ON public.missions;
DROP POLICY IF EXISTS "missions_admin_write" ON public.missions;
CREATE POLICY "missions_select_all"  ON public.missions FOR SELECT USING (true);
CREATE POLICY "missions_admin_write" ON public.missions FOR ALL    USING (public.is_admin_check());

-- levels: leitura pública; escrita apenas admin
DROP POLICY IF EXISTS "levels_select_all"  ON public.levels;
DROP POLICY IF EXISTS "levels_admin_write" ON public.levels;
CREATE POLICY "levels_select_all"  ON public.levels FOR SELECT USING (true);
CREATE POLICY "levels_admin_write" ON public.levels FOR ALL    USING (public.is_admin_check());

-- titles: leitura pública; escrita apenas admin
DROP POLICY IF EXISTS "titles_select_all"  ON public.titles;
DROP POLICY IF EXISTS "titles_admin_write" ON public.titles;
CREATE POLICY "titles_select_all"  ON public.titles FOR SELECT USING (true);
CREATE POLICY "titles_admin_write" ON public.titles FOR ALL    USING (public.is_admin_check());

-- user_titles: usuário vê/edita os seus; admin vê/edita todos
DROP POLICY IF EXISTS "user_titles_select_own"  ON public.user_titles;
DROP POLICY IF EXISTS "user_titles_insert_own"  ON public.user_titles;
DROP POLICY IF EXISTS "user_titles_update_own"  ON public.user_titles;
DROP POLICY IF EXISTS "user_titles_admin_all"   ON public.user_titles;
CREATE POLICY "user_titles_select_own" ON public.user_titles FOR SELECT USING (auth.uid() = user_id OR public.is_admin_check());
CREATE POLICY "user_titles_insert_own" ON public.user_titles FOR INSERT WITH CHECK (auth.uid() = user_id OR public.is_admin_check());
CREATE POLICY "user_titles_update_own" ON public.user_titles FOR UPDATE USING  (auth.uid() = user_id OR public.is_admin_check());
CREATE POLICY "user_titles_admin_all"  ON public.user_titles FOR DELETE USING  (public.is_admin_check());

-- events: público vê apenas eventos ativos; admin vê/edita todos
DROP POLICY IF EXISTS "events_select_active" ON public.events;
DROP POLICY IF EXISTS "events_admin_write"   ON public.events;
CREATE POLICY "events_select_active" ON public.events FOR SELECT USING (is_active = true OR public.is_admin_check());
CREATE POLICY "events_admin_write"   ON public.events FOR ALL    USING (public.is_admin_check());

-- event_rewards / event_missions: leitura pública; escrita admin
DROP POLICY IF EXISTS "event_rewards_select"  ON public.event_rewards;
DROP POLICY IF EXISTS "event_rewards_admin"   ON public.event_rewards;
DROP POLICY IF EXISTS "event_missions_select" ON public.event_missions;
DROP POLICY IF EXISTS "event_missions_admin"  ON public.event_missions;
CREATE POLICY "event_rewards_select"  ON public.event_rewards  FOR SELECT USING (true);
CREATE POLICY "event_rewards_admin"   ON public.event_rewards  FOR ALL    USING (public.is_admin_check());
CREATE POLICY "event_missions_select" ON public.event_missions FOR SELECT USING (true);
CREATE POLICY "event_missions_admin"  ON public.event_missions FOR ALL    USING (public.is_admin_check());
