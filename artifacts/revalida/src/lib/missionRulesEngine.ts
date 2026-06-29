/**
 * missionRulesEngine.ts
 *
 * Engine genérica e expansível para missões com conditions JSONB.
 * FASE 2 + FASE A: suporta 7 tipos de regra.
 *
 * Tipos suportados:
 *   station_completed   — estações com filtros de área / papel / multiplayer
 *   session_count       — contagem de sessões por área
 *   login_streak        — streak de login (localStorage)
 *   average_score       — sessões com nota média ≥ X
 *   min_score           — sessões com nota individual ≥ X
 *   multiplayer_count   — sessões multiplayer
 *   time_spent_minutes  — total de minutos treinados por área
 *
 * ZERO any · ZERO loops infinitos · ZERO regressões
 * NÃO toca: XP, sessões, realtime, multiplayer, auth, rankings.
 */

import type { SavedSession } from "@/contexts/TrainingContext";
import type {
  MissionRule,
  MissionConditions,
  RuleProgress,
  ConditionProgress,
} from "@/types/missions";
import { inferArea, loginStreak } from "@/lib/gamificationStorage";

// ── Helpers internos ──────────────────────────────────────────────────────────

/** Converte notaTotal/notaMaxima para escala 0–10. */
function sessionScore(s: SavedSession): number {
  return s.notaMaxima > 0 ? (s.notaTotal / s.notaMaxima) * 10 : 0;
}

/** Verifica se uma sessão foi multiplayer. */
function isMultiplayerSession(s: SavedSession): boolean {
  return (
    s.partnerName !== "Modo Solo" &&
    s.partnerName !== ""          &&
    s.partnerName !== "__solo__"
  );
}

// ── Rótulos legíveis (FASE D) ─────────────────────────────────────────────────

function ruleLabel(rule: MissionRule): string {
  switch (rule.type) {
    case "station_completed": {
      const parts: string[] = [];
      if (rule.area) parts.push(rule.area);
      if (rule.role === "paciente") parts.push("como paciente");
      if (rule.role === "medico")   parts.push("como médico");
      if (rule.multiplayer)         parts.push("multiplayer");
      return parts.length > 0 ? parts.join(" · ") : "Estações";
    }
    case "session_count": {
      const parts: string[] = ["Sessões"];
      if (rule.area) parts.unshift(rule.area);
      return parts.join(" · ");
    }
    case "login_streak":
      return `Login consecutivo · ${rule.days} dias`;
    case "average_score": {
      const base = `Média ≥ ${rule.minimum}`;
      return rule.area ? `${base} · ${rule.area}` : base;
    }
    case "min_score":
      return `Nota ≥ ${rule.minimum}`;
    case "multiplayer_count":
      return "Multiplayer";
    case "time_spent_minutes": {
      const base = "Tempo de treino";
      return rule.area ? `${base} · ${rule.area}` : base;
    }
  }
}

// ── matchRule — usado apenas por station_completed ────────────────────────────

/**
 * Verifica se uma sessão satisfaz uma regra station_completed.
 * Retorna false para qualquer outro tipo (não é um erro — simplesmente
 * os outros tipos não operam por filtro de sessão individual).
 */
export function matchRule(session: SavedSession, rule: MissionRule): boolean {
  if (rule.type !== "station_completed") return false;

  if (rule.area !== undefined && rule.area !== "") {
    const sessionArea = inferArea(session.checklistTitle);
    if (sessionArea !== rule.area) return false;
  }
  if (rule.role !== undefined) {
    if (session.role !== rule.role) return false;
  }
  if (rule.multiplayer !== undefined) {
    if (isMultiplayerSession(session) !== rule.multiplayer) return false;
  }
  return true;
}

// ── evaluateRule ──────────────────────────────────────────────────────────────

/**
 * Avalia uma única regra contra o histórico completo.
 *
 * Cada tipo de regra usa sua própria lógica de avaliação:
 *
 *   station_completed   → filtra sessões pelo matchRule()
 *   session_count       → conta sessões por área
 *   login_streak        → lê loginStreak() do localStorage
 *   average_score       → conta sessões com nota média ≥ minimum na área
 *   min_score           → conta sessões com nota individual ≥ minimum
 *   multiplayer_count   → conta sessões multiplayer
 *   time_spent_minutes  → soma tempoMin das sessões na área
 */
export function evaluateRule(
  rule: MissionRule,
  history: SavedSession[],
): RuleProgress {
  let current = 0;
  let target  = 0;

  switch (rule.type) {
    case "station_completed": {
      const matching = history.filter((s) => matchRule(s, rule)).length;
      target  = rule.count;
      current = Math.min(matching, target);
      break;
    }

    case "session_count": {
      const filtered = rule.area
        ? history.filter((s) => inferArea(s.checklistTitle) === rule.area)
        : history;
      target  = rule.count;
      current = Math.min(filtered.length, target);
      break;
    }

    case "login_streak": {
      target  = rule.days;
      current = Math.min(loginStreak(), target);
      break;
    }

    case "average_score": {
      const filtered = rule.area
        ? history.filter((s) => inferArea(s.checklistTitle) === rule.area)
        : history;
      const qualifying = filtered.filter(
        (s) => s.notaMaxima > 0 && sessionScore(s) >= rule.minimum,
      ).length;
      target  = rule.count;
      current = Math.min(qualifying, target);
      break;
    }

    case "min_score": {
      const qualifying = history.filter(
        (s) => s.notaMaxima > 0 && sessionScore(s) >= rule.minimum,
      ).length;
      target  = rule.count;
      current = Math.min(qualifying, target);
      break;
    }

    case "multiplayer_count": {
      const mp = history.filter(isMultiplayerSession).length;
      target  = rule.count;
      current = Math.min(mp, target);
      break;
    }

    case "time_spent_minutes": {
      const filtered = rule.area
        ? history.filter((s) => inferArea(s.checklistTitle) === rule.area)
        : history;
      const total = filtered.reduce((acc, s) => acc + (s.tempoMin ?? 0), 0);
      target  = rule.minutes;
      current = Math.min(total, target);
      break;
    }
  }

  return {
    rule,
    label:   ruleLabel(rule),
    current,
    target,
    done:    current >= target && target > 0,
  };
}

// ── evaluateMissionProgress ───────────────────────────────────────────────────

/**
 * Avalia todas as regras de uma MissionConditions contra o histórico.
 *
 * A missão está concluída (allDone = true) somente quando
 * TODAS as regras estão individualmente concluídas.
 *
 * Compatível com qualquer combinação de tipos de regra.
 */
export function evaluateMissionProgress(
  conditions: MissionConditions,
  history: SavedSession[],
): ConditionProgress {
  const rules = conditions.rules.map((rule) => evaluateRule(rule, history));

  const allDone       = rules.length > 0 && rules.every((r) => r.done);
  const totalProgress = rules.reduce((acc, r) => acc + r.current, 0);
  const totalTarget   = rules.reduce((acc, r) => acc + r.target,  0);
  const pct = totalTarget > 0
    ? Math.min(100, Math.round((totalProgress / totalTarget) * 100))
    : 0;

  return { rules, totalProgress, totalTarget, allDone, pct };
}

// ── parseConditions ───────────────────────────────────────────────────────────

/**
 * Parse seguro de um valor JSONB vindo do Supabase.
 * Retorna null se inválido, vazio ou sem regras.
 */
export function parseConditions(raw: unknown): MissionConditions | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj.rules) || obj.rules.length === 0) return null;
  return obj as MissionConditions;
}
