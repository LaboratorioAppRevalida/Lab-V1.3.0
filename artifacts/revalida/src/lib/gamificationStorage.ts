import type { SavedSession } from "@/contexts/TrainingContext";

export type MissionPeriod = "diario" | "semanal" | "mensal" | "especial";

export type Mission = {
  id: string;
  titulo: string;
  descricao: string;
  xp: number;
  period: MissionPeriod;
  goal: number;
  metric:
    | "estacoesHoje"
    | "estacoesSemana"
    | "estacoesMes"
    | "loginDiario"
    | "streak7"
    | "media8"
    | "areasUnicasSemana"
    | "papelPaciente"
    | "marathonMes";
};

export type AchievementTier = "bronze" | "prata" | "ouro" | "platina";

export type Achievement = {
  id: string;
  titulo: string;
  descricao: string;
  tier: AchievementTier;
  requiredStreak?: number;
  requiredEstacoes?: number;
  requiredMedia?: number;
};

export const MISSIONS: Mission[] = [
  // DIÁRIO
  { id: "diario-login", titulo: "Login diário", descricao: "Abra a plataforma hoje", xp: 10, period: "diario", goal: 1, metric: "loginDiario" },
  { id: "diario-3-est", titulo: "3 estações no dia", descricao: "Complete 3 estações hoje", xp: 50, period: "diario", goal: 3, metric: "estacoesHoje" },
  { id: "diario-paciente", titulo: "Atue como paciente", descricao: "Faça uma estação no papel de paciente", xp: 20, period: "diario", goal: 1, metric: "papelPaciente" },

  // SEMANAL
  { id: "semanal-7-est", titulo: "7 estações na semana", descricao: "Mantenha o ritmo: 7 estações", xp: 120, period: "semanal", goal: 7, metric: "estacoesSemana" },
  { id: "semanal-areas", titulo: "Diversifique áreas", descricao: "Treine 3 grandes áreas diferentes", xp: 80, period: "semanal", goal: 3, metric: "areasUnicasSemana" },
  { id: "semanal-streak", titulo: "Constância de 7 dias", descricao: "Treine 7 dias seguidos", xp: 100, period: "semanal", goal: 7, metric: "streak7" },

  // MENSAL
  { id: "mensal-30-est", titulo: "Marathon mensal", descricao: "Complete 30 estações no mês", xp: 400, period: "mensal", goal: 30, metric: "marathonMes" },
  { id: "mensal-media", titulo: "Média acima de 8", descricao: "Mantenha média geral acima de 8.0", xp: 250, period: "mensal", goal: 1, metric: "media8" },

  // ESPECIAIS
  { id: "especial-bronze", titulo: "Constância Bronze", descricao: "7 dias de treino seguidos", xp: 150, period: "especial", goal: 7, metric: "streak7" },
  { id: "especial-prata", titulo: "Constância Prata", descricao: "30 dias de treino seguidos", xp: 350, period: "especial", goal: 30, metric: "streak7" },
];

export const ACHIEVEMENTS: Achievement[] = [
  { id: "ach-streak-7", titulo: "Bronze da Constância", descricao: "Treine 7 dias seguidos", tier: "bronze", requiredStreak: 7 },
  { id: "ach-streak-30", titulo: "Prata da Constância", descricao: "Treine 30 dias seguidos", tier: "prata", requiredStreak: 30 },
  { id: "ach-streak-60", titulo: "Ouro da Constância", descricao: "Treine 60 dias seguidos", tier: "ouro", requiredStreak: 60 },
  { id: "ach-streak-90", titulo: "Platina da Constância", descricao: "Treine 90 dias seguidos", tier: "platina", requiredStreak: 90 },

  { id: "ach-est-10", titulo: "Iniciante", descricao: "Complete 10 estações", tier: "bronze", requiredEstacoes: 10 },
  { id: "ach-est-50", titulo: "Em ritmo", descricao: "Complete 50 estações", tier: "prata", requiredEstacoes: 50 },
  { id: "ach-est-150", titulo: "Veterano", descricao: "Complete 150 estações", tier: "ouro", requiredEstacoes: 150 },
  { id: "ach-est-300", titulo: "Mestre da estação", descricao: "Complete 300 estações", tier: "platina", requiredEstacoes: 300 },

  { id: "ach-media-7", titulo: "Bom desempenho", descricao: "Atinja média 7.0", tier: "bronze", requiredMedia: 7 },
  { id: "ach-media-8", titulo: "Excelência", descricao: "Atinja média 8.0", tier: "prata", requiredMedia: 8 },
  { id: "ach-media-9", titulo: "Performance de elite", descricao: "Atinja média 9.0", tier: "ouro", requiredMedia: 9 },
  { id: "ach-media-95", titulo: "Quase perfeito", descricao: "Atinja média 9.5", tier: "platina", requiredMedia: 9.5 },
];

export const TIER_META: Record<AchievementTier, { label: string; ring: string; bg: string; text: string; glow: string }> = {
  bronze: {
    label: "Bronze",
    ring: "ring-amber-700/40",
    bg: "from-amber-700 to-amber-500",
    text: "text-amber-700 dark:text-amber-400",
    glow: "shadow-[0_0_24px_-6px_rgba(180,83,9,0.6)]",
  },
  prata: {
    label: "Prata",
    ring: "ring-slate-400/40",
    bg: "from-slate-400 to-slate-200",
    text: "text-slate-600 dark:text-slate-300",
    glow: "shadow-[0_0_24px_-6px_rgba(148,163,184,0.7)]",
  },
  ouro: {
    label: "Ouro",
    ring: "ring-yellow-500/50",
    bg: "from-yellow-500 to-yellow-300",
    text: "text-yellow-700 dark:text-yellow-300",
    glow: "shadow-[0_0_28px_-4px_rgba(234,179,8,0.7)]",
  },
  platina: {
    label: "Platina",
    ring: "ring-cyan-400/60",
    bg: "from-cyan-400 via-blue-400 to-violet-400",
    text: "text-cyan-700 dark:text-cyan-200",
    glow: "shadow-[0_0_30px_-4px_rgba(6,182,212,0.8)]",
  },
};

// ============= XP & LEVEL =============

const XP_KEY = "revalida.gam.xpBonus";
const CLAIMED_KEY = "revalida.gam.claimedMissions";
const LOGIN_KEY = "revalida.gam.loginDates";

const XP_PER_ESTACAO = 25;
const XP_PER_NOTA_PERCENT = 0.5; // up to ~50 XP per session by score

export function xpFromHistory(history: SavedSession[]): number {
  let xp = 0;
  for (const s of history) {
    xp += XP_PER_ESTACAO;
    const pct = s.notaMaxima > 0 ? (s.notaTotal / s.notaMaxima) * 100 : 0;
    xp += Math.round(pct * XP_PER_NOTA_PERCENT);
  }
  return xp;
}

export function bonusXp(): number {
  try {
    return Number(localStorage.getItem(XP_KEY) ?? "0") || 0;
  } catch {
    return 0;
  }
}

export function addBonusXp(value: number) {
  const current = bonusXp();
  localStorage.setItem(XP_KEY, String(current + value));
}

export function totalXp(history: SavedSession[]): number {
  return xpFromHistory(history) + bonusXp();
}

// Level curve: xpProximoNivel(N) = N*1000 + N*200 = N*1200 XP per level
// Cumulative: L1=0, L2=1200, L3=3600, L4=7200, L5=12000, L6=18000...
// Closed form: xpForLevelStart(N) = sum_{k=1..N-1} k*1200 = 600 * N * (N - 1)
export function xpForLevelStart(level: number): number {
  return 600 * level * (level - 1);
}

export function xpForNextLevel(level: number): number {
  return level * 1000 + level * 200;
}

export function levelInfo(xp: number): {
  level: number;
  currentLevelStart: number;
  nextLevelStart: number;
  progressInLevel: number;
  xpForLevel: number;
  pct: number;
} {
  let level = 1;
  while (xpForLevelStart(level + 1) <= xp) level++;
  const currentLevelStart = xpForLevelStart(level);
  const nextLevelStart = xpForLevelStart(level + 1);
  const xpForLevel = nextLevelStart - currentLevelStart;
  const progressInLevel = xp - currentLevelStart;
  const pct = Math.min(100, Math.round((progressInLevel / xpForLevel) * 100));
  return { level, currentLevelStart, nextLevelStart, progressInLevel, xpForLevel, pct };
}

// ============= LOGIN STREAK =============

function todayISO(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export function recordLoginToday(): { added: boolean; newStreak: number } {
  const dates = loadLoginDates();
  const today = todayISO();
  if (dates.includes(today)) {
    return { added: false, newStreak: computeStreak(dates) };
  }
  const next = [...dates, today].sort();
  localStorage.setItem(LOGIN_KEY, JSON.stringify(next));
  return { added: true, newStreak: computeStreak(next) };
}

export function loadLoginDates(): string[] {
  try {
    const data = localStorage.getItem(LOGIN_KEY);
    return data ? (JSON.parse(data) as string[]) : [];
  } catch {
    return [];
  }
}

function computeStreak(dates: string[]): number {
  if (dates.length === 0) return 0;
  const set = new Set(dates);
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    if (set.has(todayISO(d))) {
      streak++;
    } else {
      if (i === 0) continue; // allow today not yet logged
      break;
    }
  }
  return streak;
}

export function loginStreak(): number {
  return computeStreak(loadLoginDates());
}

// ============= MISSIONS =============

type ClaimedMap = Record<string, string>; // missionId -> period bucket key

export function loadClaimed(): ClaimedMap {
  try {
    const data = localStorage.getItem(CLAIMED_KEY);
    return data ? (JSON.parse(data) as ClaimedMap) : {};
  } catch {
    return {};
  }
}

export function saveClaimed(c: ClaimedMap) {
  localStorage.setItem(CLAIMED_KEY, JSON.stringify(c));
}

export function periodBucket(period: MissionPeriod): string {
  const now = new Date();
  if (period === "diario") return now.toISOString().slice(0, 10);
  if (period === "semanal") {
    const d = new Date(now);
    const day = (d.getDay() + 6) % 7; // monday = 0
    d.setDate(d.getDate() - day);
    return `W-${d.toISOString().slice(0, 10)}`;
  }
  if (period === "mensal") return `M-${now.toISOString().slice(0, 7)}`;
  return "EVER";
}

export function isClaimed(missionId: string, period: MissionPeriod): boolean {
  const claimed = loadClaimed();
  return claimed[missionId] === periodBucket(period);
}

export function claimMission(mission: Mission): boolean {
  const claimed = loadClaimed();
  const bucket = periodBucket(mission.period);
  if (claimed[mission.id] === bucket) return false;
  claimed[mission.id] = bucket;
  saveClaimed(claimed);
  addBonusXp(mission.xp);
  return true;
}

export function missionProgress(
  m: Mission,
  history: SavedSession[],
): { current: number; goal: number; pct: number; done: boolean } {
  const goal = m.goal;
  const now = new Date();
  const todayStr = todayISO(now);
  const monthStr = now.toISOString().slice(0, 7);
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  weekStart.setHours(0, 0, 0, 0);

  let current = 0;
  switch (m.metric) {
    case "loginDiario":
      current = loadLoginDates().includes(todayStr) ? 1 : 0;
      break;
    case "estacoesHoje":
      current = history.filter((h) => h.endedAt.slice(0, 10) === todayStr).length;
      break;
    case "estacoesSemana":
      current = history.filter((h) => new Date(h.endedAt) >= weekStart).length;
      break;
    case "estacoesMes":
    case "marathonMes":
      current = history.filter((h) => h.endedAt.slice(0, 7) === monthStr).length;
      break;
    case "areasUnicasSemana": {
      const week = history.filter((h) => new Date(h.endedAt) >= weekStart);
      const set = new Set<string>();
      for (const s of week) {
        const a = inferArea(s.checklistTitle);
        if (a) set.add(a);
      }
      current = set.size;
      break;
    }
    case "papelPaciente":
      current = history.filter((h) => h.endedAt.slice(0, 10) === todayStr && h.role === "paciente").length;
      break;
    case "streak7":
      current = loginStreak();
      break;
    case "media8": {
      const pct = avgPercent(history);
      current = pct >= 80 ? 1 : 0;
      break;
    }
  }
  const done = current >= goal;
  const pct = Math.min(100, Math.round((current / goal) * 100));
  return { current: Math.min(current, goal), goal, pct, done };
}

export function avgPercent(history: SavedSession[]): number {
  if (history.length === 0) return 0;
  const total = history.reduce(
    (acc, h) => acc + (h.notaMaxima > 0 ? (h.notaTotal / h.notaMaxima) * 100 : 0),
    0,
  );
  return total / history.length;
}

export function inferArea(checklistTitle: string): string | null {
  const t = checklistTitle.toLowerCase();
  if (t.includes("clínica") || t.includes("cm")) return "Clínica médica";
  if (t.includes("cirurg") || t.includes("cir")) return "Cirurgia";
  if (t.includes("pediatr")) return "Pediatria";
  if (t.includes("ginec") || t.includes("obstetr") || t.includes("go")) return "GO";
  if (t.includes("família") || t.includes("comunidade") || t.includes("mfc")) return "MFC";
  return null;
}

// ============= ACHIEVEMENTS =============

export function isAchievementUnlocked(a: Achievement, history: SavedSession[]): boolean {
  const streak = loginStreak();
  const total = history.length;
  const media = avgPercent(history) / 10; // back to 0-10
  if (a.requiredStreak !== undefined && streak >= a.requiredStreak) return true;
  if (a.requiredEstacoes !== undefined && total >= a.requiredEstacoes) return true;
  if (a.requiredMedia !== undefined && media >= a.requiredMedia) return true;
  return false;
}
