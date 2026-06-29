/**
 * missionProgressService.ts
 *
 * FASE 1 — Persistência de progresso de missões no Supabase.
 *
 * Fonte de verdade: public.user_mission_progress
 * Fallback:         localStorage via gamificationStorage.ts
 *
 * NÃO altera: gamificationStorage.ts, MISSIONS[], XP, sessões,
 *             realtime, multiplayer, rankings, auth, storage.
 */

import { supabase } from "./supabase";
import { loadClaimed, periodBucket } from "./gamificationStorage";
import type { Mission } from "./gamificationStorage";

// ── Tipos públicos ────────────────────────────────────────────────────────────

export type ProgressRow = {
  id: string;
  userId: string;
  missionId: string;       // UUID da linha em public.missions
  missionKey: string;      // slug (ou UUID) — chave usada em Conquistas.tsx
  progress: number;
  target: number;
  completed: boolean;
  claimed: boolean;
  completedAt: string | null;
  claimedAt: string | null;
  lastEvaluatedAt: string | null;
};

/** Map<missionKey, ProgressRow> — chave = Mission.id (slug ou UUID) */
export type ProgressMap = Map<string, ProgressRow>;

// ── Helpers internos ─────────────────────────────────────────────────────────

/**
 * Resolve o UUID real da tabela missions a partir do slug ou UUID.
 * Tenta por slug primeiro; se não encontrar, tenta por id direto.
 */
async function getMissionDbId(missionKey: string): Promise<string | null> {
  const { data: bySlug } = await supabase
    .from("missions")
    .select("id")
    .eq("slug", missionKey)
    .maybeSingle();
  if (bySlug) return bySlug.id as string;

  const { data: byId } = await supabase
    .from("missions")
    .select("id")
    .eq("id", missionKey)
    .maybeSingle();
  return byId ? (byId.id as string) : null;
}

// ── API pública ───────────────────────────────────────────────────────────────

/**
 * Carrega todo o progresso de missões do usuário.
 * Retorna Map<missionKey, ProgressRow> para lookup por Mission.id.
 *
 * Lança erro em caso de falha — o chamador deve tratar e usar fallback.
 */
export async function fetchUserMissionProgress(
  userId: string,
): Promise<ProgressMap> {
  const { data, error } = await supabase
    .from("user_mission_progress")
    .select("*, missions(id, slug)")
    .eq("user_id", userId);

  if (error) throw error;

  const map: ProgressMap = new Map();

  for (const row of data ?? []) {
    const m = row.missions as { id: string; slug: string } | null;
    const key = m ? (m.slug || m.id) : "";
    if (!key) continue;

    map.set(key, {
      id:              row.id as string,
      userId:          row.user_id as string,
      missionId:       row.mission_id as string,
      missionKey:      key,
      progress:        row.progress as number,
      target:          row.target as number,
      completed:       row.completed as boolean,
      claimed:         row.claimed as boolean,
      completedAt:     row.completed_at as string | null,
      claimedAt:       row.claimed_at as string | null,
      lastEvaluatedAt: (row.last_evaluated_at as string | null) ?? null,
    });
  }

  return map;
}

/**
 * Cria ou atualiza o registro de progresso de uma missão.
 * Silencioso em caso de erro — mantém o sistema funcionando sem interrupção.
 */
export async function upsertMissionProgress(
  userId: string,
  missionKey: string,
  progress: number,
  target: number,
  completed: boolean,
): Promise<void> {
  const missionId = await getMissionDbId(missionKey);
  if (!missionId) return;

  const now = new Date().toISOString();

  const { error } = await supabase
    .from("user_mission_progress")
    .upsert(
      {
        user_id:      userId,
        mission_id:   missionId,
        progress,
        target,
        completed,
        completed_at: completed ? now : null,
        updated_at:   now,
      },
      { onConflict: "user_id,mission_id" },
    );

  if (error) {
    console.warn("[missionProgressService] upsertMissionProgress:", error.message);
  }
}

/**
 * Marca uma missão como reivindicada (claimed=true) no Supabase.
 * Silencioso em caso de erro — o claim no localStorage já foi feito.
 */
export async function claimMissionReward(
  userId: string,
  missionKey: string,
  progress: number,
  target: number,
): Promise<void> {
  const missionId = await getMissionDbId(missionKey);
  if (!missionId) return;

  const now = new Date().toISOString();

  const { error } = await supabase
    .from("user_mission_progress")
    .upsert(
      {
        user_id:      userId,
        mission_id:   missionId,
        progress,
        target,
        completed:    true,
        claimed:      true,
        completed_at: now,
        claimed_at:   now,
        updated_at:   now,
      },
      { onConflict: "user_id,mission_id" },
    );

  if (error) {
    console.warn("[missionProgressService] claimMissionReward:", error.message);
  }
}

/**
 * Migra claims do localStorage para o Supabase.
 * Não remove o localStorage — apenas espelha para o banco.
 * Usado no mount de Conquistas.tsx para migração segura.
 */
export async function syncLegacyMissionProgress(
  userId: string,
  missions: Mission[],
): Promise<void> {
  const claimed = loadClaimed();

  const tasks = missions
    .filter((m) => claimed[m.id] === periodBucket(m.period))
    .map((m) =>
      claimMissionReward(userId, m.id, m.goal, m.goal),
    );

  await Promise.allSettled(tasks);
}
