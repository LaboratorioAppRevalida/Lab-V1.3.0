/**
 * eventCountdown.ts
 *
 * Helper de contagem regressiva para eventos.
 * Pura, sem side-effects. Não cria timers — apenas calcula.
 * Componentes devem atualizar no máximo 1x por minuto.
 */

export type RemainingTime = {
  total: number;
  dias: number;
  horas: number;
  minutos: number;
  label: string;
  encerrado: boolean;
};

/**
 * Calcula o tempo restante até endDate.
 * Retorna null se endDate for null (evento sem prazo).
 * Retorna { encerrado: true } se o prazo já passou.
 */
export function getRemainingTime(endDate: string | null): RemainingTime | null {
  if (!endDate) return null;

  const end = new Date(endDate).getTime();
  const now = Date.now();
  const total = end - now;

  if (total <= 0) {
    return { total: 0, dias: 0, horas: 0, minutos: 0, label: "Encerrado", encerrado: true };
  }

  const MS_MIN  = 60_000;
  const MS_HOUR = 60 * MS_MIN;
  const MS_DAY  = 24 * MS_HOUR;

  const dias    = Math.floor(total / MS_DAY);
  const horas   = Math.floor((total % MS_DAY) / MS_HOUR);
  const minutos = Math.floor((total % MS_HOUR) / MS_MIN);

  let label: string;
  if (dias >= 2)       label = `${dias} dias`;
  else if (dias === 1) label = `1 dia`;
  else if (horas >= 1) label = `${horas} ${horas === 1 ? "hora" : "horas"}`;
  else                 label = `${minutos} min`;

  return { total, dias, horas, minutos, label, encerrado: false };
}

/** Formata a data de início/fim num formato legível. */
export function formatEventDate(date: string | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
