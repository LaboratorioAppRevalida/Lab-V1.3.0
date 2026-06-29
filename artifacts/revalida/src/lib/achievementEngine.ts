/**
 * achievementEngine.ts
 *
 * Avalia e persiste desbloqueios de medalhas no Supabase.
 * Fire-and-forget: chamado após salvar estação e após loadHistory.
 *
 * NÃO emite toasts.
 * NÃO cria polling.
 * NÃO toca: missionProgressEngine, titleService, eventService,
 *            multiplayer, realtime, rankings.
 *
 * Fontes de dados:
 *   - achievements: tabela Supabase (via achievementService)
 *   - loginStreak:  localStorage (gamificationStorage)
 *   - history:      SavedSession[] do TrainingContext
 */

import type { SavedSession } from "@/contexts/TrainingContext";
import { loginStreak, avgPercent } from "@/lib/gamificationStorage";
import { fetchAchievements, unlockAchievement, type DbAchievement } from "@/lib/achievementService";

// ── Mapeamento: id legado → slug Supabase ──────────────────────────────────────
// Permite que Conquistas.tsx cruze o estado legacy com o estado persistido.
export const LEGACY_SLUG_MAP: Record<string, string> = {
  "ach-streak-7":   "streak-bronze",
  "ach-streak-30":  "streak-prata",
  "ach-streak-60":  "streak-ouro",
  "ach-streak-90":  "streak-platina",
  "ach-est-10":     "stations-bronze",
  "ach-est-50":     "stations-prata",
  "ach-est-150":    "stations-ouro",
  "ach-est-300":    "stations-platina",
  "ach-media-7":    "average-bronze",
  "ach-media-8":    "average-prata",
  "ach-media-9":    "average-ouro",
  "ach-media-95":   "average-platina",
};

// ── Avaliação interna ──────────────────────────────────────────────────────────

function meetsAchievementCriteria(
  a:             DbAchievement,
  streak:        number,
  totalStations: number,
  average:       number, // escala 0-10
): boolean {
  if (a.required_streak    !== null && streak        >= a.required_streak)    return true;
  if (a.required_stations  !== null && totalStations >= a.required_stations)  return true;
  if (a.required_average   !== null && average       >= a.required_average)   return true;
  return false;
}

// ── Engine principal ───────────────────────────────────────────────────────────

/**
 * Avalia todas as medalhas ativas e desbloqueia as que o usuário já merece.
 * Idempotente: unlockAchievement usa ON CONFLICT DO NOTHING.
 *
 * Chamado:
 *   1. Após salvar estação (fire-and-forget em TrainingContext)
 *   2. Após loadHistory/login (evaluateLoginAchievements)
 */
export async function evaluateAndUnlockAchievements(
  userId:  string,
  history: SavedSession[],
): Promise<void> {
  try {
    const achievements = await fetchAchievements();
    if (achievements.length === 0) return;

    const streak        = loginStreak();
    const totalStations = history.length;
    const average       = avgPercent(history) / 10; // converte % para escala 0-10

    const eligible = achievements.filter((a) =>
      meetsAchievementCriteria(a, streak, totalStations, average),
    );

    if (eligible.length === 0) return;

    // Promise.allSettled: uma falha individual não cancela os outros unlocks
    await Promise.allSettled(
      eligible.map((a) => unlockAchievement(userId, a.id)),
    );
  } catch {
    // silencioso — falha de rede ou Supabase não bloqueia o fluxo principal
  }
}

/**
 * Avalia medalhas após login / carregamento do histórico.
 * Equivale a evaluateAndUnlockAchievements — avalia todos os critérios,
 * não apenas streak, pois o histórico completo já está disponível.
 */
export async function evaluateLoginAchievements(
  userId:  string,
  history: SavedSession[],
): Promise<void> {
  return evaluateAndUnlockAchievements(userId, history);
}
