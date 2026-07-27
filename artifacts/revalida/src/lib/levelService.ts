/**
 * levelService.ts
 *
 * CRUD para a tabela `levels` (Supabase).
 * Substitui LEVEL_THRESHOLDS hardcoded de levelSystem.ts
 * como fonte de verdade para o painel administrativo.
 *
 * O frontend continua usando levelSystem.ts para cálculos em tempo real
 * (getLevelInfo, calculateLevel, etc.) para compatibilidade retroativa.
 * Este serviço é usado exclusivamente pelo painel admin.
 */

import { supabase } from "./supabase";

export type LevelRewardType = "title" | "xp_bonus" | "badge" | "none";

export type DbLevel = {
  level:        number;
  xp_required:  number;
  reward_type:  LevelRewardType;
  reward_value: string | null;
  title_id:     string | null;
  created_at:   string;
};

export type LevelInput = Omit<DbLevel, "created_at">;

export async function fetchLevels(): Promise<DbLevel[]> {
  const { data, error } = await supabase
    .from("levels")
    .select("*")
    .order("level", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function upsertLevel(l: LevelInput): Promise<void> {
  const { error } = await supabase.from("levels").upsert(l, { onConflict: "level" });
  if (error) throw error;
}

export async function deleteLevel(level: number): Promise<void> {
  const { error } = await supabase.from("levels").delete().eq("level", level);
  if (error) throw error;
}

/**
 * Retorna os thresholds de XP da tabela DB formatados como array,
 * compatíveis com calculateLevel() de levelSystem.ts.
 * Retorna null em caso de falha (frontend usa fallback hardcoded).
 */
export async function fetchLevelThresholds(): Promise<number[] | null> {
  const levels = await fetchLevels().catch(() => null);
  if (!levels || levels.length === 0) return null;
  return levels.map((l) => l.xp_required);
}
