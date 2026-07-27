import { supabase } from "@/lib/supabase";

export type NotaRankRow = {
  id: string;
  name: string;
  nivel: number;
  total_estacoes: number;
  media_nota: number;
};

export type AreaRankRow = {
  id: string;
  name: string;
  nivel: number;
  area: string;
  total_estacoes: number;
  media_nota: number;
};

export type XpRankRow = {
  id: string;
  name: string;
  xp_total: number;
  nivel: number;
};

export type StreakRankRow = {
  id: string;
  name: string;
  nivel: number;
  streak_atual: number;
};

export type WeeklyRankRow = {
  id: string;
  name: string;
  nivel: number;
  estacoes_semana: number;
};

type RpcRow = {
  id: string;
  name: string;
  nivel: number;
  area: string | null;
  total_estacoes: number;
  media_nota: number;
};

/** Ranking Geral — média de notas de todas as estações (papel médico) via RPC */
export async function fetchNotaRanking(): Promise<NotaRankRow[]> {
  const { data, error } = await supabase.rpc("get_top_medicos_ranking", {
    p_area: null,
  });

  if (error) throw new Error(error.message);

  return (data as RpcRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    nivel: row.nivel,
    total_estacoes: Number(row.total_estacoes),
    media_nota: Number(row.media_nota),
  }));
}

/** Ranking por Área — média de notas filtrada por especialidade via RPC */
export async function fetchAreaRanking(area: string): Promise<AreaRankRow[]> {
  const { data, error } = await supabase.rpc("get_top_medicos_ranking", {
    p_area: area,
  });

  if (error) throw new Error(error.message);

  return (data as RpcRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    nivel: row.nivel,
    area: row.area ?? area,
    total_estacoes: Number(row.total_estacoes),
    media_nota: Number(row.media_nota),
  }));
}

/** Ranking de Nível/XP — ordenado por xp_total (fonte oficial de XP de missões) */
export async function fetchXpRanking(): Promise<XpRankRow[]> {
  const { data, error } = await supabase
    .from("profiles_public")
    .select("id, name, xp_total, nivel")
    .gt("xp_total", 0)
    .order("xp_total", { ascending: false })
    .limit(50);

  if (error) throw new Error(error.message);
  return (data ?? []) as XpRankRow[];
}

/** Ranking de Constância — dias seguidos */
export async function fetchStreakRanking(): Promise<StreakRankRow[]> {
  const { data, error } = await supabase
    .from("profiles_public")
    .select("id, name, nivel, streak_atual")
    .gt("streak_atual", 0)
    .order("streak_atual", { ascending: false })
    .limit(50);

  if (error) throw new Error(error.message);
  return (data ?? []) as StreakRankRow[];
}

/** Ranking Semanal — estações nos últimos 7 dias */
export async function fetchWeeklyRanking(): Promise<WeeklyRankRow[]> {
  const { data, error } = await supabase
    .from("ranking_semana")
    .select("id, name, nivel, estacoes_semana")
    .limit(50);

  if (error) throw new Error(error.message);
  return (data ?? []) as WeeklyRankRow[];
}
