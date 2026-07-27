import { format, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";

export function formatInitials(name: string): string {
  if (!name) return "U";
  const parts = name.split(" ").filter(Boolean);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function formatDatePt(date: Date): string {
  try {
    return format(date, "EEE, dd/MMM", { locale: ptBR });
  } catch (e) {
    return format(date, "EEE, dd/MMM");
  }
}
