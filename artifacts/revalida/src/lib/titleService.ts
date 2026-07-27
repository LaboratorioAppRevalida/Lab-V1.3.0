/**
 * titleService.ts
 *
 * CRUD para as tabelas `titles` e `user_titles` (Supabase).
 * FASE 3: suporta conditions JSONB + desbloqueio automático.
 *
 * NÃO toca: auth, realtime, multiplayer, rankings, missions.
 */

import { supabase } from "./supabase";
import type { MissionConditions } from "@/types/missions";
import { evaluateMissionProgress, parseConditions } from "@/lib/missionRulesEngine";
import type { SavedSession } from "@/contexts/TrainingContext";

// ── Types ─────────────────────────────────────────────────────────────────────

export type TitleRarity =
  | "common"
  | "rare"
  | "epic"
  | "legendary"
  | "exclusive"
  | "event";

export type DbTitle = {
  id:           string;
  name:         string;
  description:  string;
  rarity:       TitleRarity;
  color:        string;
  icon:         string | null;
  unlock_level: number | null;
  event_id:     string | null;
  is_active:    boolean;
  conditions:   MissionConditions | null;
  created_at:   string;
  updated_at:   string;
};

export type TitleInput = Omit<DbTitle, "id" | "created_at" | "updated_at">;

export type DbUserTitle = {
  id:          string;
  user_id:     string;
  title_id:    string;
  is_equipped: boolean;
  unlocked_at: string;
};

export const TITLE_RARITIES: { value: TitleRarity; label: string; color: string }[] = [
  { value: "common",    label: "Comum",     color: "#94a3b8" },
  { value: "rare",      label: "Raro",      color: "#3b82f6" },
  { value: "epic",      label: "Épico",     color: "#8b5cf6" },
  { value: "legendary", label: "Lendário",  color: "#f59e0b" },
  { value: "exclusive", label: "Exclusivo", color: "#ec4899" },
  { value: "event",     label: "Evento",    color: "#10b981" },
];

// ── Titles CRUD ───────────────────────────────────────────────────────────────

/** Todos os títulos (painel admin). */
export async function fetchTitles(): Promise<DbTitle[]> {
  const { data, error } = await supabase
    .from("titles")
    .select("*")
    .order("unlock_level", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return data ?? [];
}

/** Apenas títulos ativos — fonte primária para desbloqueio automático. */
export async function fetchActiveTitles(): Promise<DbTitle[]> {
  const { data, error } = await supabase
    .from("titles")
    .select("*")
    .eq("is_active", true)
    .order("unlock_level", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return data ?? [];
}

export async function createTitle(t: TitleInput): Promise<DbTitle> {
  const { data, error } = await supabase
    .from("titles")
    .insert(t)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateTitle(id: string, updates: Partial<TitleInput>): Promise<void> {
  const { error } = await supabase.from("titles").update(updates).eq("id", id);
  if (error) throw error;
}

export async function deleteTitle(id: string): Promise<void> {
  const { error } = await supabase.from("titles").delete().eq("id", id);
  if (error) throw error;
}

// ── User Titles ───────────────────────────────────────────────────────────────

/**
 * Desbloqueia um título para o usuário via RPC segura.
 *
 * Post-migration 013: direct INSERT on user_titles is blocked by RLS for
 * regular users. fn_unlock_title() is a SECURITY DEFINER function that
 * validates unlock_level and event expiry server-side before inserting.
 * Condition-based titles (JSONB) are validated client-side by the caller.
 * Idempotent — duplicate unlocks are silenced.
 */
export async function unlockTitle(
  _userId: string,   // kept for call-site compat; RPC uses auth.uid()
  titleId: string,
): Promise<void> {
  const { error } = await supabase.rpc("fn_unlock_title", {
    p_title_id: titleId,
  });

  if (error) {
    const msg = error.message ?? "";
    const isSilenced =
      msg.includes("already") ||
      String(error.code ?? "").startsWith("23505");
    if (!isSilenced) throw error;
  }
}

/**
 * @deprecated Use unlockTitle() instead.
 * Kept for backward compatibility with admin panel's "Conceder" flow.
 */
export async function grantTitleToUser(userId: string, titleId: string): Promise<void> {
  return unlockTitle(userId, titleId);
}

/** Títulos desbloqueados do usuário (com dados do título joinados). */
export async function getUserTitles(
  userId: string,
): Promise<(DbUserTitle & { title: DbTitle })[]> {
  const { data, error } = await supabase
    .from("user_titles")
    .select("*, title:titles(*)")
    .eq("user_id", userId)
    .order("unlocked_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as (DbUserTitle & { title: DbTitle })[];
}

/** Título atualmente equipado do usuário, ou null. */
export async function getEquippedTitle(userId: string): Promise<DbTitle | null> {
  const { data, error } = await supabase
    .from("user_titles")
    .select("*, title:titles(*)")
    .eq("user_id", userId)
    .eq("is_equipped", true)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as DbUserTitle & { title: DbTitle };
  return row.title ?? null;
}

/**
 * Busca títulos equipados de múltiplos usuários em uma só query.
 * Retorna mapa userId → DbTitle.
 */
export async function fetchEquippedTitlesByUserIds(
  userIds: string[],
): Promise<Map<string, DbTitle>> {
  if (userIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from("user_titles")
    .select("user_id, title:titles(*)")
    .eq("is_equipped", true)
    .in("user_id", userIds);
  if (error) throw error;
  const map = new Map<string, DbTitle>();
  for (const row of (data ?? []) as unknown as Array<{ user_id: string; title: DbTitle }>) {
    if (row.title) map.set(row.user_id, row.title);
  }
  return map;
}

/**
 * Equipa o título selecionado para o usuário via RPC segura.
 *
 * Post-migration 013: direct UPDATE on user_titles is blocked by RLS for
 * regular users. fn_equip_title() is a SECURITY DEFINER function that
 * validates the user owns the title before atomically unequipping all and
 * equipping the chosen one. Prevents equipping titles not legitimately owned.
 */
export async function equipTitle(
  _userId: string,   // kept for call-site compat; RPC uses auth.uid()
  titleId: string,
): Promise<void> {
  const { error } = await supabase.rpc("fn_equip_title", {
    p_title_id: titleId,
  });
  if (error) throw error;
}

/** Remove o título de um usuário (apenas admin). */
export async function revokeTitle(userId: string, titleId: string): Promise<void> {
  const { error } = await supabase
    .from("user_titles")
    .delete()
    .eq("user_id", userId)
    .eq("title_id", titleId);
  if (error) throw error;
}

// ── Engine automática ─────────────────────────────────────────────────────────

/**
 * Avalia títulos com conditions e desbloqueia automaticamente
 * quando todas as regras são satisfeitas.
 *
 * - Fire-and-forget: chamada em TrainingContext após sessão salva
 * - Silencia erros de rede (nunca bloqueia UX)
 * - Ignora títulos já desbloqueados (ON CONFLICT DO NOTHING)
 * - Usa a mesma engine de missionRulesEngine.ts
 *
 * @param userId  ID do usuário autenticado
 * @param history Histórico de sessões (inclui a sessão recém-salva)
 */
export async function evaluateAutomaticTitles(
  userId: string,
  history: SavedSession[],
): Promise<void> {
  // 1. Busca títulos ativos com conditions
  const activeTitles = await fetchActiveTitles();
  const conditionTitles = activeTitles.filter(
    (t) => t.conditions !== null && t.conditions !== undefined,
  );
  if (conditionTitles.length === 0) return;

  // 2. Busca IDs dos títulos já desbloqueados (evita re-unlock desnecessário)
  const { data: userTitleRows } = await supabase
    .from("user_titles")
    .select("title_id")
    .eq("user_id", userId);
  const unlockedIds = new Set(
    (userTitleRows ?? []).map((r: { title_id: string }) => r.title_id),
  );

  // 3. Avalia cada título ainda não desbloqueado
  for (const title of conditionTitles) {
    if (unlockedIds.has(title.id)) continue;
    const conditions = parseConditions(title.conditions);
    if (!conditions) continue;
    const progress = evaluateMissionProgress(conditions, history);
    if (!progress.allDone) continue;

    // 4. Desbloqueia — ON CONFLICT DO NOTHING (erro 23505 é silenciado em unlockTitle)
    try {
      await unlockTitle(userId, title.id);
    } catch {
      // silencioso — nunca bloqueia UX
    }
  }
}
