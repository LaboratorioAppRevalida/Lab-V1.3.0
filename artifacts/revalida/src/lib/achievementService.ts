/**
 * achievementService.ts
 *
 * CRUD para as tabelas `achievements` e `user_achievements` (Supabase).
 *
 * NÃO substitui nem remove:
 *  - ACHIEVEMENTS[] / isAchievementUnlocked() em gamificationStorage.ts
 *  - O comportamento atual de Conquistas.tsx
 *
 * Infraestrutura para FASE MEDALHAS 1. O unlock automático e a
 * integração com Conquistas.tsx ocorrerão na FASE MEDALHAS 2.
 */

import { supabase } from "./supabase";

// ── Tipos ──────────────────────────────────────────────────────────────────────

export type AchievementTierDb = "bronze" | "prata" | "ouro" | "platina";

export type DbAchievement = {
  id:                 string;
  slug:               string;
  title:              string;
  description:        string;
  tier:               AchievementTierDb;
  icon:               string | null;
  color:              string | null;
  required_streak:    number | null;
  required_stations:  number | null;
  required_average:   number | null;
  is_active:          boolean;
  created_at:         string;
  updated_at:         string;
};

export type DbUserAchievement = {
  id:             string;
  user_id:        string;
  achievement_id: string;
  unlocked_at:    string;
};

export type AchievementInput = Omit<DbAchievement, "id" | "created_at" | "updated_at">;

// ── Achievements ───────────────────────────────────────────────────────────────

/**
 * Lista todas as medalhas ativas do catálogo.
 * Ordenadas por tier (bronze → platina) e depois por título.
 */
export async function fetchAchievements(): Promise<DbAchievement[]> {
  const { data, error } = await supabase
    .from("achievements")
    .select("*")
    .eq("is_active", true)
    .order("tier",  { ascending: true })
    .order("title", { ascending: true });

  if (error) throw error;
  return (data ?? []) as DbAchievement[];
}

/**
 * Lista todas as medalhas (ativas e inativas).
 * Uso exclusivo: painel admin (FASE MEDALHAS 3).
 */
export async function fetchAllAchievements(): Promise<DbAchievement[]> {
  const { data, error } = await supabase
    .from("achievements")
    .select("*")
    .order("tier",  { ascending: true })
    .order("title", { ascending: true });

  if (error) throw error;
  return (data ?? []) as DbAchievement[];
}

// ── User Achievements ──────────────────────────────────────────────────────────

/**
 * Retorna as medalhas desbloqueadas de um usuário, com dados da medalha joinados.
 * Ordenadas da mais recente para a mais antiga.
 */
export async function fetchUserAchievements(
  userId: string,
): Promise<(DbUserAchievement & { achievement: DbAchievement })[]> {
  const { data, error } = await supabase
    .from("user_achievements")
    .select("*, achievement:achievements(*)")
    .eq("user_id", userId)
    .order("unlocked_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as (DbUserAchievement & { achievement: DbAchievement })[];
}

/**
 * Desbloqueia uma medalha para o usuário via RPC segura.
 *
 * Post-migration 013: direct INSERT on user_achievements is blocked by RLS
 * for regular users. fn_unlock_achievement() is a SECURITY DEFINER function
 * that validates criteria server-side (streak, sessions count)
 * before inserting. Idempotent — already-unlocked achievements are silenced.
 */
export async function unlockAchievement(
  _userId:       string,   // kept for call-site compat; RPC uses auth.uid()
  achievementId: string,
): Promise<void> {
  const { error } = await supabase.rpc("fn_unlock_achievement", {
    p_achievement_id: achievementId,
  });

  // Silence idempotency errors: "criteria_not_met" is also silenced here because
  // achievementEngine already pre-validated; the RPC error means the DB disagrees
  // (e.g. stale streak cache) — not a hard failure, just skip.
  if (error) {
    const msg = error.message ?? "";
    const isSilenced =
      msg.includes("criteria_not_met") ||
      msg.includes("already") ||
      String(error.code ?? "").startsWith("23505");
    if (!isSilenced) throw error;
  }
}

/**
 * Retorna contagens de desbloqueios por medalha.
 * Uso: painel admin (FASE MEDALHAS 3).
 *
 * Retorna mapa achievementId → count.
 */
export async function fetchAchievementCounts(): Promise<Map<string, number>> {
  const { data, error } = await supabase
    .from("user_achievements")
    .select("achievement_id");

  if (error) throw error;

  const map = new Map<string, number>();
  for (const row of (data ?? []) as { achievement_id: string }[]) {
    map.set(row.achievement_id, (map.get(row.achievement_id) ?? 0) + 1);
  }
  return map;
}
