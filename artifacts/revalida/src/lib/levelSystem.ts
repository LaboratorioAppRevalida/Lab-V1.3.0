// Sistema de progressão por nível baseado em XP acumulado no Supabase.
// O XP vem de profiles.xp_total (atualizado via trigger após cada sessão).

/** XP mínimo necessário para atingir cada nível (índice 0 = nível 1). */
export const LEVEL_THRESHOLDS = [
  0,    // Nível 1
  100,  // Nível 2
  300,  // Nível 3
  600,  // Nível 4
  1000, // Nível 5
  1500, // Nível 6
  2100, // Nível 7
  2800, // Nível 8
  3600, // Nível 9
  4500, // Nível 10
] as const;

const LEVEL_NAMES: Record<number, string> = {
  1: "Iniciante",
  2: "Aprendiz",
  3: "Residente",
  4: "Especialista",
  5: "Médico",
  6: "Sênior",
  7: "Expert",
  8: "Mestre",
  9: "Elite",
  10: "Lenda",
};

const MAX_DEFINED_LEVEL = LEVEL_THRESHOLDS.length;

/**
 * Retorna o nível atual baseado no XP total.
 * Extensível: acima de 4500 XP, progressão continua com +900 XP por nível.
 */
export function calculateLevel(xp: number): number {
  // Percorre os thresholds definidos
  let level = 1;
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (xp >= LEVEL_THRESHOLDS[i]) {
      level = i + 1;
    }
  }

  // Extensão infinita além do nível 10: +900 XP por nível
  if (level === MAX_DEFINED_LEVEL) {
    const xpBeyond = xp - LEVEL_THRESHOLDS[MAX_DEFINED_LEVEL - 1];
    const extraLevels = Math.floor(xpBeyond / 900);
    level += extraLevels;
  }

  return level;
}

/** XP necessário para começar o nível N (funciona além do nível 10). */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  if (level <= MAX_DEFINED_LEVEL) return LEVEL_THRESHOLDS[level - 1];
  // Extensão: 4500 + (level - 10) * 900
  return LEVEL_THRESHOLDS[MAX_DEFINED_LEVEL - 1] + (level - MAX_DEFINED_LEVEL) * 900;
}

/**
 * Retorna a fração de progresso (0–1) dentro do nível atual.
 * Usado para barras de progresso.
 */
export function getProgressToNextLevel(xp: number): number {
  const level = calculateLevel(xp);
  const currentXp = xpForLevel(level);
  const nextXp = xpForLevel(level + 1);
  if (nextXp === currentXp) return 1;
  return Math.min(Math.max((xp - currentXp) / (nextXp - currentXp), 0), 1);
}

/** Nome do título correspondente ao nível. */
export function levelName(level: number): string {
  return LEVEL_NAMES[level] ?? `Nível ${level}`;
}

/** Objeto completo com todos os dados de progressão. */
export function getLevelInfo(xp: number) {
  const level = calculateLevel(xp);
  const currentLevelXp = xpForLevel(level);
  const nextLevelXp = xpForLevel(level + 1);
  const xpInCurrentLevel = xp - currentLevelXp;
  const xpForCurrentLevel = nextLevelXp - currentLevelXp;
  const progress = getProgressToNextLevel(xp);
  const pct = Math.max(2, Math.min(100, Math.round(progress * 100)));
  const xpRestante = Math.max(0, nextLevelXp - xp);
  const name = levelName(level);

  return {
    level,
    name,
    xp,
    currentLevelXp,
    nextLevelXp,
    xpInCurrentLevel,
    xpForCurrentLevel,
    progress,
    pct,
    xpRestante,
  };
}
