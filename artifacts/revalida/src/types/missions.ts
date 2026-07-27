/**
 * missions.ts — Tipos centralizados para o sistema de missões dinâmicas.
 *
 * FASE 2 + FASE A (expansão): 7 tipos de regra suportados na engine.
 * Compatível com o sistema legado (trigger_type / trigger_value).
 *
 * Nenhum `any` em todo o arquivo.
 */

// ── Primitivos reutilizáveis ───────────────────────────────────────────────────

export type SessionRole = "medico" | "paciente";

export const MISSION_AREAS = [
  "Clínica Médica",
  "Cirurgia",
  "Pediatria",
  "GO",
  "MFC",
] as const;

export type MissionArea = (typeof MISSION_AREAS)[number];

// ── Todos os tipos de regra suportados ───────────────────────────────────────

export type MissionRuleType =
  | "station_completed"
  | "session_count"
  | "login_streak"
  | "average_score"
  | "min_score"
  | "multiplayer_count"
  | "time_spent_minutes";

// ── Rótulos legíveis para o painel admin ─────────────────────────────────────

export const RULE_TYPE_LABELS: Record<MissionRuleType, string> = {
  station_completed:  "Estações completas",
  session_count:      "Contagem de sessões",
  login_streak:       "Streak de login",
  average_score:      "Média de nota",
  min_score:          "Nota mínima",
  multiplayer_count:  "Sessões multiplayer",
  time_spent_minutes: "Tempo de treino (min)",
};

// ── Definições de regra (discriminated union por `type`) ──────────────────────

/**
 * station_completed — estação concluída com filtros opcionais.
 * Exemplos:
 *   { type: "station_completed", area: "Cirurgia", role: "medico", count: 10 }
 *   { type: "station_completed", multiplayer: true, count: 3 }
 */
export type StationCompletedRule = {
  type: "station_completed";
  area?: string;
  role?: SessionRole;
  multiplayer?: boolean;
  count: number;
};

/**
 * session_count — contagem de sessões por área (sem filtro de papel/multi).
 * Exemplo: { type: "session_count", area: "Cirurgia", count: 10 }
 */
export type SessionCountRule = {
  type: "session_count";
  area?: string;
  count: number;
};

/**
 * login_streak — streak de login consecutivo (localStorage).
 * Exemplo: { type: "login_streak", days: 7 }
 */
export type LoginStreakRule = {
  type: "login_streak";
  days: number;
};

/**
 * average_score — sessões onde a nota ≥ minimum (escala 0–10).
 * Exemplo: { type: "average_score", area: "Clínica Médica", minimum: 8, count: 5 }
 */
export type AverageScoreRule = {
  type: "average_score";
  area?: string;
  minimum: number; // 0–10
  count: number;   // número mínimo de sessões qualificadas
};

/**
 * min_score — sessões com nota ≥ minimum, sem filtro de área.
 * Exemplo: { type: "min_score", minimum: 9, count: 3 }
 */
export type MinScoreRule = {
  type: "min_score";
  minimum: number; // 0–10
  count: number;
};

/**
 * multiplayer_count — sessões multiplayer (qualquer área).
 * Exemplo: { type: "multiplayer_count", count: 10 }
 */
export type MultiplayerCountRule = {
  type: "multiplayer_count";
  count: number;
};

/**
 * time_spent_minutes — soma de tempoMin das sessões na área.
 * Exemplo: { type: "time_spent_minutes", area: "Pediatria", minutes: 120 }
 */
export type TimeSpentMinutesRule = {
  type: "time_spent_minutes";
  area?: string;
  minutes: number;
};

// ── União discriminada — adicionar novos tipos AQUI ───────────────────────────

export type MissionRule =
  | StationCompletedRule
  | SessionCountRule
  | LoginStreakRule
  | AverageScoreRule
  | MinScoreRule
  | MultiplayerCountRule
  | TimeSpentMinutesRule;

/** Alias semântico */
export type MissionCondition = MissionRule;

// ── MissionConditions — formato armazenado no campo JSONB ────────────────────

export type MissionConditions = {
  rules: MissionRule[];
};

// ── Resultado de avaliação ────────────────────────────────────────────────────

export type RuleProgress = {
  rule:    MissionRule;
  label:   string;   // rótulo legível ex: "Cirurgia · 7/10"
  current: number;
  target:  number;
  done:    boolean;
};

export type ConditionProgress = {
  rules:         RuleProgress[];
  totalProgress: number;
  totalTarget:   number;
  allDone:       boolean;
  pct:           number;
};
