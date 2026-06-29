-- Migration 011: Create server-side ranking RPC
-- Replaces client-side aggregation in rankingService.ts for grade-based rankings.
-- Function computes AVG(nota) per user on the database, returns top 50, joins profiles.

CREATE OR REPLACE FUNCTION get_top_medicos_ranking(p_area TEXT DEFAULT NULL)
RETURNS TABLE (
  id            UUID,
  name          TEXT,
  nivel         INTEGER,
  area          TEXT,
  total_estacoes BIGINT,
  media_nota    NUMERIC
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    p.id,
    COALESCE(p.name, 'Usuário')   AS name,
    COALESCE(p.nivel, 1)          AS nivel,
    p_area                        AS area,
    COUNT(s.nota)::BIGINT         AS total_estacoes,
    ROUND(AVG(s.nota)::NUMERIC, 2) AS media_nota
  FROM sessions s
  JOIN profiles p ON p.id = s.user_id
  WHERE
    s.papel = 'medico'
    AND (p_area IS NULL OR s.area = p_area)
    AND s.nota IS NOT NULL
  GROUP BY p.id, p.name, p.nivel
  ORDER BY media_nota DESC
  LIMIT 50;
$$;

-- Allow authenticated users and anon (RLS is enforced on underlying tables via SECURITY DEFINER owner)
GRANT EXECUTE ON FUNCTION get_top_medicos_ranking(TEXT) TO authenticated, anon;
