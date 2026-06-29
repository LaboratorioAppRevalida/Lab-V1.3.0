-- ============================================================
-- REVALIDA 2ª FASE — MIGRATION OFICIAL
-- Versão: 1.0.0
-- Gerado em: 2026-05-22
-- Compatível com: Supabase Auth, frontend React/Vite atual
-- Idempotente: sim (IF NOT EXISTS + OR REPLACE em todos os objetos)
-- ============================================================
-- Instruções:
--   1. Cole este arquivo inteiro no SQL Editor do Supabase
--   2. Execute como superuser (postgres ou service_role)
--   3. Os buckets de Storage são criados automaticamente ao final
--   4. NÃO é necessário rodar migrations separadas — tudo está aqui
-- ============================================================



-- ============================================================
-- BLOCO 1 — EXTENSIONS
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";



-- ============================================================
-- BLOCO 2 — FUNÇÃO HELPER: is_admin_check()
-- Usada por múltiplas policies RLS. SECURITY DEFINER para
-- evitar recursão ao consultar profiles com RLS ativo.
-- ============================================================





-- ============================================================
-- BLOCO 3 — FUNÇÃO HELPER: set_updated_at()
-- Trigger function reutilizada por todas as tabelas com updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;



-- ============================================================
-- BLOCO 4 — TABELAS CORE
-- ============================================================

-- ─────────────────────────────────────────────────
-- 4.1 profiles
-- Espelha auth.users. Criado automaticamente pelo trigger
-- handle_new_user após cada signup. É a fonte de verdade
-- para dados de perfil, XP, nível, streak e admin.
-- ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id                 uuid        NOT NULL,
  email              text        NOT NULL,
  name               text        NOT NULL DEFAULT '',
  display_name       text,
  birth_date         date,
  country            text,
  city_uf            text,
  phone              text,
  is_admin           boolean     NOT NULL DEFAULT false,
  xp_total           integer     NOT NULL DEFAULT 0 CHECK (xp_total >= 0),
  nivel              integer     NOT NULL DEFAULT 1 CHECK (nivel >= 1),
  streak_atual       integer     NOT NULL DEFAULT 0 CHECK (streak_atual >= 0),
  last_login_date    date,
  avg_rating         numeric(3,2)         CHECK (avg_rating >= 0 AND avg_rating <= 5),
  rating_count       integer     NOT NULL DEFAULT 0 CHECK (rating_count >= 0),
  avatar_url         text,
  is_suspended       boolean     NOT NULL DEFAULT false,
  suspended_until    timestamptz,
  suspension_reason  text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id)
    REFERENCES auth.users (id) ON DELETE CASCADE
);

-- Trigger updated_at para profiles
DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.profiles IS
  'Perfil público de cada usuário autenticado. Espelha auth.users. '
  'XP e nível são atualizados automaticamente pelo trigger trg_sessions_xp_nivel.';


-- ─────────────────────────────────────────────────
-- 4.2 sessions
-- Histórico permanente de estações completadas.
-- Fonte de verdade para rankings e progressão.
-- ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sessions (
  id              uuid          NOT NULL DEFAULT gen_random_uuid(),
  user_id         uuid          NOT NULL,
  parceiro_nome   text          NOT NULL DEFAULT '',
  checklist_nome  text          NOT NULL DEFAULT '',
  area            text,
  papel           text          NOT NULL CHECK (papel IN ('medico', 'paciente')),
  nota            numeric(5,2)  NOT NULL DEFAULT 0 CHECK (nota >= 0 AND nota <= 10),
  ended_at        timestamptz   NOT NULL DEFAULT now(),
  created_at      timestamptz   NOT NULL DEFAULT now(),

  CONSTRAINT sessions_pkey PRIMARY KEY (id),
  CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES public.profiles (id) ON DELETE CASCADE
);

COMMENT ON TABLE public.sessions IS
  'Histórico de estações concluídas. parceiro_nome e checklist_nome são '
  'desnormalizados intencionalmente para imutabilidade histórica.';

COMMENT ON COLUMN public.sessions.papel IS
  'Papel do usuário nesta estação: medico (avaliado) ou paciente (simulador).';

COMMENT ON COLUMN public.sessions.nota IS
  'Nota 0-10 calculada pelo frontend com base na pontuação PEP.';


-- ─────────────────────────────────────────────────
-- 4.3 checklists
-- Estações clínicas — conteúdo central do app.
-- Criadas e editadas pelo admin no painel.
-- ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.checklists (
  id               uuid        NOT NULL DEFAULT gen_random_uuid(),
  user_id          uuid        NOT NULL,
  title            text        NOT NULL DEFAULT 'Checklist sem título',
  grande_area      text        NOT NULL DEFAULT '',
  subarea          text        NOT NULL DEFAULT '',
  cenario_atuacao  text        NOT NULL DEFAULT '',
  descricao_caso   text        NOT NULL DEFAULT '',
  tarefas          text        NOT NULL DEFAULT '',
  impressos        jsonb       NOT NULL DEFAULT '[]'::jsonb,
  roteiro_paciente text        NOT NULL DEFAULT '',
  pep_blocks       jsonb       NOT NULL DEFAULT '[]'::jsonb,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT checklists_pkey PRIMARY KEY (id),
  CONSTRAINT checklists_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES public.profiles (id) ON DELETE CASCADE
);

-- Trigger updated_at para checklists
DROP TRIGGER IF EXISTS trg_checklists_updated_at ON public.checklists;
CREATE TRIGGER trg_checklists_updated_at
  BEFORE UPDATE ON public.checklists
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.checklists IS
  'Estações clínicas com critérios PEP e roteiro do paciente. '
  'impressos e pep_blocks são arrays JSONB com estrutura tipada no frontend.';

COMMENT ON COLUMN public.checklists.impressos IS
  'Array de ImpressoItem: { id, titulo, tipo: "texto"|"imagem", conteudo }';

COMMENT ON COLUMN public.checklists.pep_blocks IS
  'Array de PepBlock: { id, titulo, texto, scoreAdequado, scoreParcial }';


-- ─────────────────────────────────────────────────
-- 4.4 multiplayer_sessions
-- Estado sincronizado de uma sessão multiplayer em andamento.
-- Criada por createOrGetMultiplayerSession() via upsert com
-- session_code determinístico (sorted user IDs).
-- ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.multiplayer_sessions (
  id                      uuid        NOT NULL DEFAULT gen_random_uuid(),
  session_code            text        NOT NULL,
  status                  text        NOT NULL DEFAULT 'invited'
                            CHECK (status IN (
                              'invited',
                              'roles_selection',
                              'waiting_roles',
                              'configuring_station',
                              'waiting_start',
                              'running',
                              'paused_disconnect',
                              'finished',
                              'abandoned'
                            )),
  host_user_id            uuid        NOT NULL,
  guest_user_id           uuid        NOT NULL,
  host_role               text        CHECK (host_role IN ('medico', 'paciente')),
  guest_role              text        CHECK (guest_role IN ('medico', 'paciente')),
  specialty               text,
  checklist_id            uuid,
  checklist_title         text,
  duration_minutes        integer     CHECK (duration_minutes IN (8, 9, 10)),
  started_at              timestamptz,
  ended_at                timestamptz,
  current_phase           text        NOT NULL DEFAULT 'invited',
  timer_started_at        timestamptz,
  timer_remaining_seconds integer,
  host_connected          boolean     NOT NULL DEFAULT true,
  guest_connected         boolean     NOT NULL DEFAULT true,
  last_event              jsonb,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT multiplayer_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT multiplayer_sessions_session_code_key UNIQUE (session_code),
  CONSTRAINT multiplayer_sessions_host_fkey FOREIGN KEY (host_user_id)
    REFERENCES public.profiles (id) ON DELETE CASCADE,
  CONSTRAINT multiplayer_sessions_guest_fkey FOREIGN KEY (guest_user_id)
    REFERENCES public.profiles (id) ON DELETE CASCADE,
  CONSTRAINT multiplayer_sessions_checklist_fkey FOREIGN KEY (checklist_id)
    REFERENCES public.checklists (id) ON DELETE SET NULL
);

-- Trigger updated_at para multiplayer_sessions
-- CRÍTICO: multiplayerSessionService.ts diz "handled by DB trigger"
DROP TRIGGER IF EXISTS trg_mps_updated_at ON public.multiplayer_sessions;
CREATE TRIGGER trg_mps_updated_at
  BEFORE UPDATE ON public.multiplayer_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.multiplayer_sessions IS
  'Estado sincronizado de sessão multiplayer. session_code é determinístico: '
  'mp_{sorted_id1[0:8]}_{sorted_id2[0:8]}. updated_at é sentinela de atividade — '
  'sessões com updated_at > 30min são consideradas órfãs e marcadas como abandoned.';



COMMENT ON COLUMN public.multiplayer_sessions.timer_remaining_seconds IS
  'Não confiável — calculado no cliente a partir de timer_started_at. '
  'Mantido para compatibilidade futura com recovery server-side.';



-- ============================================================
-- BLOCO 5 — TABELAS DE CONTEÚDO
-- ============================================================

-- ─────────────────────────────────────────────────
-- 5.1 resumos
-- Material de estudo estruturado criado pelo admin.
-- Acessível por todos os usuários autenticados.
-- ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.resumos (
  id         uuid        NOT NULL DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL,
  titulo     text        NOT NULL DEFAULT '',
  area       text        NOT NULL DEFAULT '',
  subarea    text        NOT NULL DEFAULT '',
  blocks     jsonb       NOT NULL DEFAULT '[]'::jsonb,
  video_url  text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT resumos_pkey PRIMARY KEY (id),
  CONSTRAINT resumos_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES public.profiles (id) ON DELETE CASCADE
);

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_resumos_updated_at ON public.resumos;
CREATE TRIGGER trg_resumos_updated_at
  BEFORE UPDATE ON public.resumos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON COLUMN public.resumos.blocks IS
  'Array de ResumoBlock (tipos definidos em resumosStorage.ts).';


-- ─────────────────────────────────────────────────
-- 5.2 noticias
-- Feed de notícias exibido no dashboard.
-- Sem user_id — notícias são globais.
-- ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.noticias (
  id           uuid        NOT NULL DEFAULT gen_random_uuid(),
  titulo       text        NOT NULL DEFAULT '',
  resumo       text        NOT NULL DEFAULT '',
  blocks       jsonb       NOT NULL DEFAULT '[]'::jsonb,
  published_at timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT noticias_pkey PRIMARY KEY (id)
);

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_noticias_updated_at ON public.noticias;
CREATE TRIGGER trg_noticias_updated_at
  BEFORE UPDATE ON public.noticias
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON COLUMN public.noticias.blocks IS
  'Array de NoticiaBlock: { id, type: "texto"|"imagem"|"video"|"link", '
  'content, titulo?, legenda?, descricao? }';


-- ─────────────────────────────────────────────────
-- 5.3 notes
-- Notas pessoais do estudante no Supabase.
-- Substitui o notasStorage.ts (localStorage legado).
-- ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notes (
  id         uuid        NOT NULL DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL,
  title      text        NOT NULL DEFAULT '',
  content    text        NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT notes_pkey PRIMARY KEY (id),
  CONSTRAINT notes_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES public.profiles (id) ON DELETE CASCADE
);

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_notes_updated_at ON public.notes;
CREATE TRIGGER trg_notes_updated_at
  BEFORE UPDATE ON public.notes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();



-- ============================================================
-- BLOCO 6 — TABELAS SOCIAIS E ADMIN
-- ============================================================

-- ─────────────────────────────────────────────────
-- 6.1 session_ratings
-- Avaliação de 0-5 estrelas dada após cada sessão.
-- UNIQUE(session_id, rater_id) impede duplicidade.
-- ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.session_ratings (
  id         uuid    NOT NULL DEFAULT gen_random_uuid(),
  session_id uuid    NOT NULL,
  rater_id   uuid    NOT NULL,
  rated_id   uuid    NOT NULL,
  rating     integer NOT NULL CHECK (rating >= 0 AND rating <= 5),

  CONSTRAINT session_ratings_pkey PRIMARY KEY (id),
  CONSTRAINT session_ratings_unique UNIQUE (session_id, rater_id),
  CONSTRAINT session_ratings_session_fkey FOREIGN KEY (session_id)
    REFERENCES public.sessions (id) ON DELETE CASCADE,
  CONSTRAINT session_ratings_rater_fkey FOREIGN KEY (rater_id)
    REFERENCES public.profiles (id) ON DELETE CASCADE,
  CONSTRAINT session_ratings_rated_fkey FOREIGN KEY (rated_id)
    REFERENCES public.profiles (id) ON DELETE CASCADE
);

COMMENT ON TABLE public.session_ratings IS
  'Avaliação de parceiro após sessão. Após cada insert, ratingService.ts '
  'recalcula profiles.avg_rating e profiles.rating_count para o rated_id.';


-- ─────────────────────────────────────────────────
-- 6.2 user_warnings
-- Advertências emitidas pelo admin.
-- ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_warnings (
  id         uuid        NOT NULL DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL,
  admin_id   uuid        NOT NULL,
  reason     text        NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT user_warnings_pkey PRIMARY KEY (id),
  CONSTRAINT user_warnings_user_fkey FOREIGN KEY (user_id)
    REFERENCES public.profiles (id) ON DELETE CASCADE,
  CONSTRAINT user_warnings_admin_fkey FOREIGN KEY (admin_id)
    REFERENCES public.profiles (id) ON DELETE CASCADE
);



-- ============================================================
-- BLOCO 7 — TABELAS DE OBSERVABILIDADE
-- ============================================================

-- ─────────────────────────────────────────────────
-- 7.1 app_events
-- Analytics de uso — inserido silenciosamente pelo frontend.
-- Exibido em tempo real na tela de Observabilidade do admin
-- via Postgres Changes (INSERT).
-- ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.app_events (
  id         uuid        NOT NULL DEFAULT gen_random_uuid(),
  user_id    uuid,
  event_type text        NOT NULL,
  stage      text,
  payload    jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT app_events_pkey PRIMARY KEY (id)
);

COMMENT ON COLUMN public.app_events.event_type IS
  'Valores: session_started, session_completed, session_abandoned, '
  'session_flow_error, session_restored, session_disconnected, '
  'session_reconnected, session_recovered_after_refresh, '
  'session_abandoned_by_timeout, login, register, feedback_submitted';


-- ─────────────────────────────────────────────────
-- 7.2 user_feedback
-- Mensagens de feedback enviadas pelos usuários.
-- ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_feedback (
  id             uuid        NOT NULL DEFAULT gen_random_uuid(),
  user_id        uuid,
  message        text        NOT NULL CHECK (length(message) <= 2000),
  current_screen text,
  created_at     timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT user_feedback_pkey PRIMARY KEY (id)
);


-- ─────────────────────────────────────────────────
-- 7.3 app_error_logs
-- Log silencioso de erros do frontend.
-- ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.app_error_logs (
  id         uuid        NOT NULL DEFAULT gen_random_uuid(),
  type       text        NOT NULL,
  user_id    uuid,
  message    text        NOT NULL CHECK (length(message) <= 500),
  context    jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT app_error_logs_pkey PRIMARY KEY (id)
);

COMMENT ON COLUMN public.app_error_logs.type IS
  'Valores: login_failure, realtime_failure, save_session_failure, '
  'ranking_load_failure, avatar_upload_failure, generic';



-- ============================================================
-- BLOCO 8 — TABELA DE CONFIGURAÇÕES
-- ============================================================

-- ─────────────────────────────────────────────────
-- 8.1 app_settings
-- Configurações globais editáveis pelo admin.
-- Chave única: key. Valores conhecidos: whatsapp, email_suporte.
-- ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.app_settings (
  key        text        NOT NULL,
  value      text        NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT app_settings_pkey PRIMARY KEY (key)
);

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_app_settings_updated_at ON public.app_settings;
CREATE TRIGGER trg_app_settings_updated_at
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();



-- ============================================================
-- BLOCO 9 — ÍNDICES DE PERFORMANCE
-- ============================================================

-- profiles
CREATE INDEX IF NOT EXISTS idx_profiles_is_admin
  ON public.profiles (is_admin) WHERE is_admin = true;
CREATE INDEX IF NOT EXISTS idx_profiles_xp_total
  ON public.profiles (xp_total DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_streak_atual
  ON public.profiles (streak_atual DESC);

-- sessions
CREATE INDEX IF NOT EXISTS idx_sessions_user_id
  ON public.sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_papel
  ON public.sessions (papel);
CREATE INDEX IF NOT EXISTS idx_sessions_area
  ON public.sessions (area) WHERE area IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sessions_ended_at
  ON public.sessions (ended_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_user_papel
  ON public.sessions (user_id, papel);

-- checklists
CREATE INDEX IF NOT EXISTS idx_checklists_user_id
  ON public.checklists (user_id);
CREATE INDEX IF NOT EXISTS idx_checklists_grande_area
  ON public.checklists (grande_area);
CREATE INDEX IF NOT EXISTS idx_checklists_updated_at
  ON public.checklists (updated_at DESC);

-- multiplayer_sessions
CREATE INDEX IF NOT EXISTS idx_mps_host_user_id
  ON public.multiplayer_sessions (host_user_id);
CREATE INDEX IF NOT EXISTS idx_mps_guest_user_id
  ON public.multiplayer_sessions (guest_user_id);
CREATE INDEX IF NOT EXISTS idx_mps_status
  ON public.multiplayer_sessions (status);
CREATE INDEX IF NOT EXISTS idx_mps_updated_at
  ON public.multiplayer_sessions (updated_at DESC);
-- Índice composto para getActiveSessionForUser()
CREATE INDEX IF NOT EXISTS idx_mps_active_lookup
  ON public.multiplayer_sessions (host_user_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_mps_active_lookup_guest
  ON public.multiplayer_sessions (guest_user_id, status, updated_at DESC);

-- resumos
CREATE INDEX IF NOT EXISTS idx_resumos_area
  ON public.resumos (area);
CREATE INDEX IF NOT EXISTS idx_resumos_updated_at
  ON public.resumos (updated_at DESC);

-- noticias
CREATE INDEX IF NOT EXISTS idx_noticias_published_at
  ON public.noticias (published_at DESC);

-- notes
CREATE INDEX IF NOT EXISTS idx_notes_user_id
  ON public.notes (user_id);
CREATE INDEX IF NOT EXISTS idx_notes_updated_at
  ON public.notes (updated_at DESC);

-- session_ratings
CREATE INDEX IF NOT EXISTS idx_ratings_rated_id
  ON public.session_ratings (rated_id);
CREATE INDEX IF NOT EXISTS idx_ratings_session_id
  ON public.session_ratings (session_id);

-- user_warnings
CREATE INDEX IF NOT EXISTS idx_warnings_user_id
  ON public.user_warnings (user_id);

-- app_events (observabilidade — consultas por tipo e data)
CREATE INDEX IF NOT EXISTS idx_app_events_created_at
  ON public.app_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_events_event_type
  ON public.app_events (event_type);
CREATE INDEX IF NOT EXISTS idx_app_events_user_id
  ON public.app_events (user_id) WHERE user_id IS NOT NULL;

-- app_error_logs
CREATE INDEX IF NOT EXISTS idx_error_logs_created_at
  ON public.app_error_logs (created_at DESC);

-- user_feedback
CREATE INDEX IF NOT EXISTS idx_feedback_created_at
  ON public.user_feedback (created_at DESC);



-- ============================================================
-- BLOCO 10 — VIEW: ranking_semana
-- Compatível com rankingService.ts → fetchWeeklyRanking()
-- que faz: supabase.from("ranking_semana").select("id, name, nivel, estacoes_semana")
-- ============================================================

CREATE OR REPLACE VIEW public.ranking_semana AS
SELECT
  p.id,
  COALESCE(NULLIF(p.display_name, ''), p.name) AS name,
  p.nivel,
  COUNT(s.id)::integer                           AS estacoes_semana
FROM public.profiles p
INNER JOIN public.sessions s ON s.user_id = p.id
WHERE
  s.ended_at >= (now() - INTERVAL '7 days')
  AND s.papel = 'medico'
GROUP BY p.id, p.display_name, p.name, p.nivel
ORDER BY estacoes_semana DESC;

COMMENT ON VIEW public.ranking_semana IS
  'Ranking semanal: conta estações concluídas no papel de médico nos últimos 7 dias. '
  'Consumida por rankingService.fetchWeeklyRanking(). '
  'Se houver degradação de performance, considere converter para MATERIALIZED VIEW '
  'com refresh via pg_cron a cada 5 minutos.';



-- ============================================================
-- BLOCO 11 — TRIGGER: handle_new_user
-- Cria automaticamente um registro em profiles após cada
-- signup no Supabase Auth. CRÍTICO para o funcionamento do app.
-- AuthContext.tsx tem fallback via createProfileInDb() caso
-- este trigger não exista, mas o trigger é a fonte primária.
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    name,
    display_name,
    birth_date,
    country,
    city_uf,
    phone,
    is_admin
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'name', ''),
      split_part(COALESCE(NEW.email, 'usuario@'), '@', 1)
    ),
    NULLIF(NEW.raw_user_meta_data->>'display_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'birth_date', '')::date,
    NULLIF(NEW.raw_user_meta_data->>'country', ''),
    NULLIF(NEW.raw_user_meta_data->>'city_uf', ''),
    NULLIF(NEW.raw_user_meta_data->>'phone', ''),
    -- Admin bootstrapping: o primeiro admin é determinado por e-mail
    COALESCE(NEW.email, '') = 'admin@revalida.com'
  )
  ON CONFLICT (id) DO NOTHING;  -- idempotente: não sobrescreve perfil existente

  RETURN NEW;
END;
$$;

-- Instala o trigger em auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

COMMENT ON FUNCTION public.handle_new_user() IS
  'Cria perfil em profiles após signup. raw_user_meta_data contém '
  'name, display_name, birth_date, country, city_uf, phone '
  'passados via supabase.auth.signUp({ options: { data: {...} } }).';



-- ============================================================
-- BLOCO 12 — TRIGGER: update_xp_nivel_on_session
-- Atualiza profiles.xp_total e profiles.nivel após cada
-- sessão inserida. CRÍTICO para rankings e progressão.
--
-- Fórmula de XP (extraída de gamificationStorage.ts):
--   XP_PER_ESTACAO = 25 (base fixo)
--   XP_PER_NOTA_PERCENT = 0.5 (por ponto percentual da nota)
--   pct = (nota / 10) * 100   → 0 a 100
--   session_xp = 25 + ROUND(pct * 0.5)  → 25 a 75 XP
--
-- Thresholds de nível (extraídos de levelSystem.ts):
--   1=0, 2=100, 3=300, 4=600, 5=1000,
--   6=1500, 7=2100, 8=2800, 9=3600, 10=4500
--   Além do nível 10: +900 XP por nível adicional
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_xp_nivel_on_session()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pct       numeric;
  v_session_xp integer;
  v_new_xp    integer;
  v_new_nivel integer;
BEGIN
  -- Calcula XP desta sessão
  v_pct        := (NEW.nota / 10.0) * 100.0;
  v_session_xp := 25 + ROUND(v_pct * 0.5)::integer;

  -- Incrementa xp_total e captura o novo valor
  UPDATE public.profiles
  SET
    xp_total   = xp_total + v_session_xp,
    updated_at = now()
  WHERE id = NEW.user_id
  RETURNING xp_total INTO v_new_xp;

  -- Calcula novo nível com base nos thresholds do levelSystem.ts
  v_new_nivel := CASE
    WHEN v_new_xp >= 4500 THEN 10 + FLOOR((v_new_xp - 4500)::numeric / 900)::integer
    WHEN v_new_xp >= 3600 THEN 9
    WHEN v_new_xp >= 2800 THEN 8
    WHEN v_new_xp >= 2100 THEN 7
    WHEN v_new_xp >= 1500 THEN 6
    WHEN v_new_xp >= 1000 THEN 5
    WHEN v_new_xp >= 600  THEN 4
    WHEN v_new_xp >= 300  THEN 3
    WHEN v_new_xp >= 100  THEN 2
    ELSE 1
  END;

  -- Atualiza nível (sem rebater em outro UPDATE se não mudou)
  UPDATE public.profiles
  SET nivel = v_new_nivel
  WHERE id = NEW.user_id AND nivel <> v_new_nivel;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sessions_xp_nivel ON public.sessions;
CREATE TRIGGER trg_sessions_xp_nivel
  AFTER INSERT ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_xp_nivel_on_session();

COMMENT ON FUNCTION public.update_xp_nivel_on_session() IS
  'Após cada INSERT em sessions, incrementa profiles.xp_total e recalcula profiles.nivel. '
  'Fórmula: xp = 25 + round((nota/10 * 100) * 0.5). '
  'Thresholds de nível espelham levelSystem.ts para consistência frontend/backend.';

CREATE OR REPLACE FUNCTION public.is_admin_check()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_admin = true
  );
$$;

-- ============================================================
-- BLOCO 13 — HABILITAÇÃO DO RLS
-- ============================================================

ALTER TABLE public.profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklists         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.multiplayer_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resumos            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.noticias           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_ratings    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_warnings      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_events         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_feedback      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_error_logs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings       ENABLE ROW LEVEL SECURITY;



-- ============================================================
-- BLOCO 14 — POLICIES RLS
-- Convenção de nomes: {tabela}_{operação}_{sujeito}
-- Todas são PERMISSIVE (padrão). Múltiplas policies por
-- operação são OR'd — basta uma ser verdadeira.
-- ============================================================

-- ─────────────────────────────────────────────────
-- profiles
-- ─────────────────────────────────────────────────
-- Qualquer usuário autenticado pode ler todos os perfis
-- (necessário para a lista de usuários no Treino e Rankings)
DROP POLICY IF EXISTS "profiles_select_authenticated" ON public.profiles;
CREATE POLICY "profiles_select_authenticated"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

-- Usuário pode inserir apenas seu próprio perfil
-- (fallback caso o trigger handle_new_user falhe)
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- Usuário pode atualizar seu próprio perfil
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Admin pode atualizar qualquer perfil (moderação, suspensão, promoção)
DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
CREATE POLICY "profiles_update_admin"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (public.is_admin_check());

-- Admin pode ler todos os perfis com campos de suspensão
-- (já coberto por profiles_select_authenticated, mas explicitado para clareza)


-- ─────────────────────────────────────────────────
-- sessions
-- SELECT é global (necessário para rankings que leem todas as sessões)
-- INSERT/UPDATE/DELETE é restrito ao dono
-- ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "sessions_select_authenticated" ON public.sessions;
CREATE POLICY "sessions_select_authenticated"
  ON public.sessions FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "sessions_insert_own" ON public.sessions;
CREATE POLICY "sessions_insert_own"
  ON public.sessions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "sessions_update_own" ON public.sessions;
CREATE POLICY "sessions_update_own"
  ON public.sessions FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "sessions_delete_own" ON public.sessions;
CREATE POLICY "sessions_delete_own"
  ON public.sessions FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Admin pode deletar sessões de qualquer usuário (adminResetMetrics)
DROP POLICY IF EXISTS "sessions_delete_admin" ON public.sessions;
CREATE POLICY "sessions_delete_admin"
  ON public.sessions FOR DELETE
  TO authenticated
  USING (public.is_admin_check());


-- ─────────────────────────────────────────────────
-- checklists
-- Qualquer autenticado pode ler (listAllChecklists sem filtro).
-- Apenas o criador pode criar/editar/deletar.
-- ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "checklists_select_authenticated" ON public.checklists;
CREATE POLICY "checklists_select_authenticated"
  ON public.checklists FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "checklists_insert_own" ON public.checklists;
CREATE POLICY "checklists_insert_own"
  ON public.checklists FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "checklists_update_own" ON public.checklists;
CREATE POLICY "checklists_update_own"
  ON public.checklists FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "checklists_delete_own" ON public.checklists;
CREATE POLICY "checklists_delete_own"
  ON public.checklists FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Admin pode gerenciar qualquer checklist
DROP POLICY IF EXISTS "checklists_all_admin" ON public.checklists;
CREATE POLICY "checklists_all_admin"
  ON public.checklists FOR ALL
  TO authenticated
  USING (public.is_admin_check())
  WITH CHECK (public.is_admin_check());


-- ─────────────────────────────────────────────────
-- multiplayer_sessions
-- Apenas os dois participantes (host e guest) podem ler/escrever.
-- ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "mps_select_participant" ON public.multiplayer_sessions;
CREATE POLICY "mps_select_participant"
  ON public.multiplayer_sessions FOR SELECT
  TO authenticated
  USING (
    host_user_id = auth.uid() OR guest_user_id = auth.uid()
  );

DROP POLICY IF EXISTS "mps_insert_participant" ON public.multiplayer_sessions;
CREATE POLICY "mps_insert_participant"
  ON public.multiplayer_sessions FOR INSERT
  TO authenticated
  WITH CHECK (
    host_user_id = auth.uid() OR guest_user_id = auth.uid()
  );

DROP POLICY IF EXISTS "mps_update_participant" ON public.multiplayer_sessions;
CREATE POLICY "mps_update_participant"
  ON public.multiplayer_sessions FOR UPDATE
  TO authenticated
  USING (
    host_user_id = auth.uid() OR guest_user_id = auth.uid()
  );

-- Admin pode ler todas as sessões multiplayer (observabilidade)
DROP POLICY IF EXISTS "mps_select_admin" ON public.multiplayer_sessions;
CREATE POLICY "mps_select_admin"
  ON public.multiplayer_sessions FOR SELECT
  TO authenticated
  USING (public.is_admin_check());


-- ─────────────────────────────────────────────────
-- resumos
-- Qualquer autenticado lê. Apenas criador ou admin escreve.
-- ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "resumos_select_authenticated" ON public.resumos;
CREATE POLICY "resumos_select_authenticated"
  ON public.resumos FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "resumos_insert_own" ON public.resumos;
CREATE POLICY "resumos_insert_own"
  ON public.resumos FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "resumos_update_own" ON public.resumos;
CREATE POLICY "resumos_update_own"
  ON public.resumos FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "resumos_delete_own" ON public.resumos;
CREATE POLICY "resumos_delete_own"
  ON public.resumos FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "resumos_all_admin" ON public.resumos;
CREATE POLICY "resumos_all_admin"
  ON public.resumos FOR ALL
  TO authenticated
  USING (public.is_admin_check())
  WITH CHECK (public.is_admin_check());


-- ─────────────────────────────────────────────────
-- noticias
-- SELECT público (anon pode ler — dashboard pré-auth futuro).
-- INSERT/UPDATE/DELETE somente admin.
-- ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "noticias_select_public" ON public.noticias;
CREATE POLICY "noticias_select_public"
  ON public.noticias FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "noticias_write_admin" ON public.noticias;
CREATE POLICY "noticias_write_admin"
  ON public.noticias FOR ALL
  TO authenticated
  USING (public.is_admin_check())
  WITH CHECK (public.is_admin_check());


-- ─────────────────────────────────────────────────
-- notes
-- CRUD restrito ao dono.
-- ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "notes_crud_own" ON public.notes;
CREATE POLICY "notes_crud_own"
  ON public.notes FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


-- ─────────────────────────────────────────────────
-- session_ratings
-- Insert: apenas o avaliador (rater_id = auth.uid())
-- Select: avaliado pode ler suas próprias notas; admin pode tudo
-- Delete: admin pode deletar (adminResetMetrics)
-- ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "ratings_insert_rater" ON public.session_ratings;
CREATE POLICY "ratings_insert_rater"
  ON public.session_ratings FOR INSERT
  TO authenticated
  WITH CHECK (rater_id = auth.uid());

DROP POLICY IF EXISTS "ratings_select_participant" ON public.session_ratings;
CREATE POLICY "ratings_select_participant"
  ON public.session_ratings FOR SELECT
  TO authenticated
  USING (rater_id = auth.uid() OR rated_id = auth.uid());

DROP POLICY IF EXISTS "ratings_update_rater" ON public.session_ratings;
CREATE POLICY "ratings_update_rater"
  ON public.session_ratings FOR UPDATE
  TO authenticated
  USING (rater_id = auth.uid());

DROP POLICY IF EXISTS "ratings_delete_admin" ON public.session_ratings;
CREATE POLICY "ratings_delete_admin"
  ON public.session_ratings FOR DELETE
  TO authenticated
  USING (public.is_admin_check());


-- ─────────────────────────────────────────────────
-- user_warnings
-- Apenas admin pode criar, ler e deletar.
-- ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "warnings_all_admin" ON public.user_warnings;
CREATE POLICY "warnings_all_admin"
  ON public.user_warnings FOR ALL
  TO authenticated
  USING (public.is_admin_check())
  WITH CHECK (public.is_admin_check());

-- Usuário pode ver suas próprias advertências
DROP POLICY IF EXISTS "warnings_select_own" ON public.user_warnings;
CREATE POLICY "warnings_select_own"
  ON public.user_warnings FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());


-- ─────────────────────────────────────────────────
-- app_events
-- Qualquer autenticado pode inserir (fire-and-forget).
-- Somente admin pode ler.
-- ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "app_events_insert_authenticated" ON public.app_events;
CREATE POLICY "app_events_insert_authenticated"
  ON public.app_events FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "app_events_select_admin" ON public.app_events;
CREATE POLICY "app_events_select_admin"
  ON public.app_events FOR SELECT
  TO authenticated
  USING (public.is_admin_check());


-- ─────────────────────────────────────────────────
-- user_feedback
-- Qualquer autenticado (ou anon) pode inserir.
-- Somente admin pode ler.
-- ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "feedback_insert_any" ON public.user_feedback;
CREATE POLICY "feedback_insert_any"
  ON public.user_feedback FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "feedback_select_admin" ON public.user_feedback;
CREATE POLICY "feedback_select_admin"
  ON public.user_feedback FOR SELECT
  TO authenticated
  USING (public.is_admin_check());


-- ─────────────────────────────────────────────────
-- app_error_logs
-- Qualquer autenticado pode inserir (log silencioso).
-- Somente admin pode ler.
-- ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "error_logs_insert_authenticated" ON public.app_error_logs;
CREATE POLICY "error_logs_insert_authenticated"
  ON public.app_error_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "error_logs_select_admin" ON public.app_error_logs;
CREATE POLICY "error_logs_select_admin"
  ON public.app_error_logs FOR SELECT
  TO authenticated
  USING (public.is_admin_check());


-- ─────────────────────────────────────────────────
-- app_settings
-- Qualquer autenticado pode ler (configurações públicas do app).
-- Somente admin pode escrever.
-- ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "settings_select_authenticated" ON public.app_settings;
CREATE POLICY "settings_select_authenticated"
  ON public.app_settings FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "settings_write_admin" ON public.app_settings;
CREATE POLICY "settings_write_admin"
  ON public.app_settings FOR ALL
  TO authenticated
  USING (public.is_admin_check())
  WITH CHECK (public.is_admin_check());



-- ============================================================
-- BLOCO 15 — STORAGE: BUCKETS
-- Criados via storage schema. Públicos para leitura.
-- Eliminam a necessidade de createBucket() no frontend.
-- ============================================================

-- Bucket: avatars
-- Fotos de perfil dos usuários. Caminho: {user_id}/avatar.{ext}
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  5242880,  -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public             = EXCLUDED.public,
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Bucket: resumos-media
-- Imagens incorporadas nos resumos de estudo. Caminho: {timestamp}-{random}.{ext}
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'resumos-media',
  'resumos-media',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public             = EXCLUDED.public,
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Bucket: news-media
-- Imagens incorporadas nas notícias. Caminho: {timestamp}-{random}.{ext}
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'news-media',
  'news-media',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public             = EXCLUDED.public,
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;


-- ─────────────────────────────────────────────────
-- Storage Policies
-- ─────────────────────────────────────────────────

-- avatars: dono pode upload (INSERT/UPDATE), todos podem ler (SELECT)
DROP POLICY IF EXISTS "avatars_select_public" ON storage.objects;
CREATE POLICY "avatars_select_public"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_insert_owner" ON storage.objects;
CREATE POLICY "avatars_insert_owner"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "avatars_update_owner" ON storage.objects;
CREATE POLICY "avatars_update_owner"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "avatars_delete_owner" ON storage.objects;
CREATE POLICY "avatars_delete_owner"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- resumos-media: admin pode upload, todos podem ler
DROP POLICY IF EXISTS "resumos_media_select_public" ON storage.objects;
CREATE POLICY "resumos_media_select_public"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'resumos-media');

DROP POLICY IF EXISTS "resumos_media_insert_admin" ON storage.objects;
CREATE POLICY "resumos_media_insert_admin"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'resumos-media'
    AND public.is_admin_check()
  );

DROP POLICY IF EXISTS "resumos_media_delete_admin" ON storage.objects;
CREATE POLICY "resumos_media_delete_admin"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'resumos-media'
    AND public.is_admin_check()
  );

-- news-media: admin pode upload, todos podem ler
DROP POLICY IF EXISTS "news_media_select_public" ON storage.objects;
CREATE POLICY "news_media_select_public"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'news-media');

DROP POLICY IF EXISTS "news_media_insert_admin" ON storage.objects;
CREATE POLICY "news_media_insert_admin"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'news-media'
    AND public.is_admin_check()
  );

DROP POLICY IF EXISTS "news_media_delete_admin" ON storage.objects;
CREATE POLICY "news_media_delete_admin"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'news-media'
    AND public.is_admin_check()
  );



-- ============================================================
-- BLOCO 16 — REALTIME: PUBLICAÇÃO DE TABELAS
-- Garante que as tabelas necessárias estejam na publication
-- supabase_realtime para o canal observabilidade-live.
-- Os canais online-users (Presence) e global-events (Broadcast)
-- são efêmeros — não requerem configuração de tabela.
-- ============================================================

-- Adiciona tabelas à publication realtime (ignora se já existe)
DO $$
BEGIN
  -- app_events (INSERT — observabilidade ao vivo)
  ALTER PUBLICATION supabase_realtime ADD TABLE public.app_events;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  -- app_error_logs (INSERT — observabilidade ao vivo)
  ALTER PUBLICATION supabase_realtime ADD TABLE public.app_error_logs;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  -- user_feedback (INSERT — observabilidade ao vivo)
  ALTER PUBLICATION supabase_realtime ADD TABLE public.user_feedback;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON TABLE public.app_events IS
  'Publicada em supabase_realtime para o canal observabilidade-live '
  '(Postgres Changes INSERT) usado pela tela de Observabilidade do admin.';



-- ============================================================
-- BLOCO 17 — SEED: CONFIGURAÇÕES PADRÃO
-- Valores iniciais para app_settings.
-- ON CONFLICT DO NOTHING: não sobrescreve valores já existentes.
-- ============================================================

INSERT INTO public.app_settings (key, value)
VALUES
  ('whatsapp',       '5511999999999'),
  ('email_suporte',  'suporte@revalida.app')
ON CONFLICT (key) DO NOTHING;



-- ============================================================
-- RESUMO FINAL — O QUE FOI CRIADO
-- ============================================================
--
-- TABELAS (13):
--   public.profiles
--   public.sessions
--   public.checklists
--   public.multiplayer_sessions
--   public.resumos
--   public.noticias
--   public.notes
--   public.session_ratings
--   public.user_warnings
--   public.app_events
--   public.user_feedback
--   public.app_error_logs
--   public.app_settings
--
-- VIEWS (1):
--   public.ranking_semana
--
-- TRIGGERS (5):
--   on_auth_user_created         — auth.users AFTER INSERT → handle_new_user()
--   trg_profiles_updated_at      — profiles BEFORE UPDATE → set_updated_at()
--   trg_checklists_updated_at    — checklists BEFORE UPDATE → set_updated_at()
--   trg_resumos_updated_at       — resumos BEFORE UPDATE → set_updated_at()
--   trg_mps_updated_at           — multiplayer_sessions BEFORE UPDATE → set_updated_at()
--   trg_notes_updated_at         — notes BEFORE UPDATE → set_updated_at()
--   trg_app_settings_updated_at  — app_settings BEFORE UPDATE → set_updated_at()
--   trg_sessions_xp_nivel        — sessions AFTER INSERT → update_xp_nivel_on_session()
--
-- FUNCTIONS (3):
--   public.is_admin_check()             — helper RLS, SECURITY DEFINER
--   public.set_updated_at()             — trigger function reutilizável
--   public.handle_new_user()            — trigger auth SECURITY DEFINER
--   public.update_xp_nivel_on_session() — trigger XP SECURITY DEFINER
--
-- ÍNDICES (31):
--   idx_profiles_is_admin, idx_profiles_xp_total, idx_profiles_streak_atual
--   idx_sessions_user_id, idx_sessions_papel, idx_sessions_area,
--   idx_sessions_ended_at, idx_sessions_user_papel
--   idx_checklists_user_id, idx_checklists_grande_area, idx_checklists_updated_at
--   idx_mps_host_user_id, idx_mps_guest_user_id, idx_mps_status,
--   idx_mps_updated_at, idx_mps_active_lookup, idx_mps_active_lookup_guest
--   idx_resumos_area, idx_resumos_updated_at
--   idx_noticias_published_at
--   idx_notes_user_id, idx_notes_updated_at
--   idx_ratings_rated_id, idx_ratings_session_id
--   idx_warnings_user_id
--   idx_app_events_created_at, idx_app_events_event_type, idx_app_events_user_id
--   idx_error_logs_created_at
--   idx_feedback_created_at
--
-- POLICIES RLS (38):
--   profiles (5), sessions (5), checklists (5), multiplayer_sessions (4),
--   resumos (5), noticias (2), notes (1), session_ratings (4),
--   user_warnings (2), app_events (2), user_feedback (2),
--   app_error_logs (2), app_settings (2), storage.objects (9)
--
-- STORAGE BUCKETS (3):
--   avatars        — público, 5MB, imagens, owner = {user_id}/
--   resumos-media  — público, 5MB, imagens, upload só admin
--   news-media     — público, 5MB, imagens, upload só admin
--
-- REALTIME CHANNELS (3):
--   online-users        — Presence (efêmero, sem tabela)
--   global-events       — Broadcast (efêmero, sem tabela)
--   observabilidade-live — Postgres Changes INSERT em:
--                          app_events, app_error_logs, user_feedback
--
-- RISCOS RESIDUAIS APÓS ESTA MIGRATION:
--   1. notasStorage.ts ainda usa localStorage — migrar para notes (frontend)
--   2. bonusXp() em gamificationStorage.ts não sincroniza com xp_total — unificar
--   3. streak em gamificationStorage.ts duplica profiles.streak_atual — unificar
--   4. ranking_semana é VIEW simples — monitorar performance com > 10k sessões
--   5. Métricas de Observabilidade calculadas client-side nos últimos 60 registros
--   6. multiplayer_sessions.specialty nunca é preenchida — campo reservado
--   7. timer_remaining_seconds não é confiável — calculado no cliente
--
-- ============================================================
