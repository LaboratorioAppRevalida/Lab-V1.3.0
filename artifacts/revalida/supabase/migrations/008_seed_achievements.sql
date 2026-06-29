-- ============================================================
-- 008_seed_achievements.sql
-- Popula as 12 medalhas canônicas que espelham ACHIEVEMENTS[]
-- de gamificationStorage.ts.
-- Idempotente: ON CONFLICT (slug) DO NOTHING
-- NÃO altera tabelas existentes nem remove dados.
-- ============================================================

-- Depende da migration 007_achievements.sql (tabela achievements).

INSERT INTO public.achievements
  (slug, title, description, tier, required_streak, required_stations, required_average, is_active)
VALUES
  -- ── Constância (streak) ───────────────────────────────────
  ('streak-bronze',   'Bronze da Constância',  'Treine 7 dias seguidos',   'bronze',  7,    NULL, NULL, true),
  ('streak-prata',    'Prata da Constância',   'Treine 30 dias seguidos',  'prata',   30,   NULL, NULL, true),
  ('streak-ouro',     'Ouro da Constância',    'Treine 60 dias seguidos',  'ouro',    60,   NULL, NULL, true),
  ('streak-platina',  'Platina da Constância', 'Treine 90 dias seguidos',  'platina', 90,   NULL, NULL, true),

  -- ── Volume (estações completadas) ─────────────────────────
  ('stations-bronze',  'Iniciante',          'Complete 10 estações',   'bronze',  NULL, 10,  NULL, true),
  ('stations-prata',   'Em ritmo',           'Complete 50 estações',   'prata',   NULL, 50,  NULL, true),
  ('stations-ouro',    'Veterano',           'Complete 150 estações',  'ouro',    NULL, 150, NULL, true),
  ('stations-platina', 'Mestre da estação',  'Complete 300 estações',  'platina', NULL, 300, NULL, true),

  -- ── Performance (média geral 0-10) ────────────────────────
  ('average-bronze',  'Bom desempenho',       'Atinja média 7.0', 'bronze',  NULL, NULL, 7.0,  true),
  ('average-prata',   'Excelência',           'Atinja média 8.0', 'prata',   NULL, NULL, 8.0,  true),
  ('average-ouro',    'Performance de elite', 'Atinja média 9.0', 'ouro',    NULL, NULL, 9.0,  true),
  ('average-platina', 'Quase perfeito',       'Atinja média 9.5', 'platina', NULL, NULL, 9.5,  true)

ON CONFLICT (slug) DO NOTHING;
