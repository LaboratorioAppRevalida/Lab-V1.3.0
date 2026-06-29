/**
 * missionProgressEngine.ts
 *
 * FASE 4 — Persistência autoritativa de progresso de missões.
 *
 * Responsabilidades:
 *   processMissionProgressAfterSession() — dispara após salvarEstacao
 *   processLoginMissionProgress()        — dispara no login / mount
 *
 * Princípios:
 *   - Apenas missões afetadas pela ação são avaliadas (filtragem por trigger)
 *   - Cache de 5 min para a lista de missões ativas (evita N round-trips)
 *   - Persistência direta por UUID (sem lookup slug→id por missão)
 *   - Idempotente: upsert com onConflict
 *   - Silencioso em produção; logs de debug apenas em DEV
 *
 * NÃO altera: missionRulesEngine, gamificationStorage, XP, sessões, realtime.
 */

import { supabase } from "./supabase";
import type { SavedSession } from "@/contexts/TrainingContext";
import {
  fetchActiveDbMissions,
  dbMissionToMission,
  type DbMission,
} from "./missionService";
import { evaluateMissionProgress, parseConditions } from "./missionRulesEngine";
import { missionProgress } from "./gamificationStorage";

// ── Debug silencioso (apenas DEV) ────────────────────────────────────────────

const dbg = import.meta.env.DEV
  ? (...args: unknown[]) => console.debug("[missionProgressEngine]", ...args)
  : () => {};

// ── Cache de missões ativas (5 minutos) ───────────────────────────────────────

let _missionCache: DbMission[] = [];
let _missionCacheExpiry = 0;

async function getCachedDbMissions(): Promise<DbMission[]> {
  if (Date.now() < _missionCacheExpiry && _missionCache.length > 0) {
    return _missionCache;
  }
  _missionCache = await fetchActiveDbMissions();
  _missionCacheExpiry = Date.now() + 5 * 60 * 1000;
  dbg(`cache atualizado: ${_missionCache.length} missões`);
  return _missionCache;
}

/** Invalida o cache de missões (útil após alterações via admin). */
export function invalidateMissionCache(): void {
  _missionCacheExpiry = 0;
  _missionCache = [];
}

// ── Classificação de triggers ─────────────────────────────────────────────────

/**
 * trigger_types de missões legado afetadas por uma sessão de treino.
 * Reflete os valores da coluna trigger_type na tabela missions.
 */
const SESSION_TRIGGER_TYPES = new Set([
  "completar_estacao",
  "completar_estacao_paciente",
  "finalizar_multiplayer",
  "media_nota",
  "completar_checklist",
]);

/**
 * Tipos de regra em conditions.rules afetados por uma sessão de treino.
 */
const SESSION_CONDITION_RULE_TYPES = new Set([
  "station_completed",
  "session_count",
  "average_score",
  "min_score",
  "multiplayer_count",
  "time_spent_minutes",
]);

/** trigger_types de missões legado afetadas pelo login. */
const LOGIN_TRIGGER_TYPES = new Set(["login", "streak"]);

/** Tipos de regra em conditions.rules afetados pelo login. */
const LOGIN_CONDITION_RULE_TYPES = new Set(["login_streak"]);

function isSessionMission(m: DbMission): boolean {
  const c = parseConditions(m.conditions);
  if (c) return c.rules.some((r) => SESSION_CONDITION_RULE_TYPES.has(r.type));
  return SESSION_TRIGGER_TYPES.has(m.trigger_type);
}

function isLoginMission(m: DbMission): boolean {
  const c = parseConditions(m.conditions);
  if (c) return c.rules.some((r) => LOGIN_CONDITION_RULE_TYPES.has(r.type));
  return LOGIN_TRIGGER_TYPES.has(m.trigger_type);
}

// ── Avaliação de uma missão ───────────────────────────────────────────────────

type EvalResult = { progress: number; target: number; completed: boolean };

function evaluateDbMission(m: DbMission, history: SavedSession[]): EvalResult {
  const conditions = parseConditions(m.conditions);
  if (conditions) {
    const cp = evaluateMissionProgress(conditions, history);
    return {
      progress:  cp.totalProgress,
      target:    cp.totalTarget,
      completed: cp.allDone,
    };
  }
  // Missão legado: avalia via trigger_type → metric mapeado em missionService
  const legacy = dbMissionToMission(m);
  const lp = missionProgress(legacy, history);
  return { progress: lp.current, target: lp.goal, completed: lp.done };
}

// ── Persistência direta por UUID ──────────────────────────────────────────────

async function upsertMissionProgressById(
  userId:    string,
  missionId: string,
  progress:  number,
  target:    number,
  completed: boolean,
): Promise<void> {
  const now = new Date().toISOString();

  // Tenta com last_evaluated_at (requer migration 005).
  // Se a coluna ainda não existir, faz fallback sem ela.
  const { error } = await supabase
    .from("user_mission_progress")
    .upsert(
      {
        user_id:           userId,
        mission_id:        missionId,
        progress,
        target,
        completed,
        completed_at:      completed ? now : null,
        last_evaluated_at: now,
        updated_at:        now,
      },
      { onConflict: "user_id,mission_id" },
    );

  if (error) {
    // Coluna last_evaluated_at ainda não existe — retry sem ela
    if (error.message.includes("last_evaluated_at")) {
      const { error: e2 } = await supabase
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
      if (e2) dbg("upsertMissionProgressById (fallback):", e2.message);
    } else {
      dbg("upsertMissionProgressById:", error.message);
    }
  }
}

async function evaluateAndPersistMission(
  userId:  string,
  m:       DbMission,
  history: SavedSession[],
): Promise<void> {
  const result = evaluateDbMission(m, history);
  dbg(
    `${m.slug || m.id}: ${result.progress}/${result.target}`,
    result.completed ? "✓ completa" : "",
  );
  await upsertMissionProgressById(
    userId,
    m.id,
    result.progress,
    result.target,
    result.completed,
  );
}

// ── API pública ───────────────────────────────────────────────────────────────

/**
 * Avalia e persiste todas as missões afetadas por uma sessão de treino.
 *
 * Deve ser chamado fire-and-forget após saveSession() em TrainingContext.
 * Avalia apenas as missões com SESSION_TRIGGER_TYPES ou SESSION_CONDITION_RULE_TYPES.
 */
export async function processMissionProgressAfterSession(
  userId:  string,
  history: SavedSession[],
): Promise<void> {
  try {
    const all     = await getCachedDbMissions();
    const targets = all.filter(isSessionMission);
    dbg(`session: ${targets.length} missões-alvo de ${all.length} ativas`);
    await Promise.allSettled(
      targets.map((m) => evaluateAndPersistMission(userId, m, history)),
    );
    // Notifica a UI que o progresso foi persistido
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("missions-updated"));
      dbg("missions-updated dispatched");
    }
  } catch (e) {
    dbg("processMissionProgressAfterSession error:", e);
  }
}

/**
 * Avalia e persiste missões de login/streak.
 *
 * Deve ser chamado fire-and-forget no carregamento inicial do histórico.
 * Avalia apenas as missões com LOGIN_TRIGGER_TYPES ou LOGIN_CONDITION_RULE_TYPES.
 */
export async function processLoginMissionProgress(
  userId:  string,
  history: SavedSession[],
): Promise<void> {
  try {
    const all     = await getCachedDbMissions();
    const targets = all.filter(isLoginMission);
    dbg(`login: ${targets.length} missões-alvo de ${all.length} ativas`);
    await Promise.allSettled(
      targets.map((m) => evaluateAndPersistMission(userId, m, history)),
    );
  } catch (e) {
    dbg("processLoginMissionProgress error:", e);
  }
}
