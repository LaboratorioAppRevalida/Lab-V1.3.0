import { Zap } from "lucide-react";
import { formatDatePt } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

export function StreakPill({ className }: { className?: string }) {
  const { profile } = useAuth();
  const streak = profile?.streak_atual ?? 0;

  return (
    <div className={cn("flex items-center rounded-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 shadow-xs pl-1.5 pr-3 py-1 gap-2 transition-colors", className)}>
      {/* Círculo do raio com tom amarelo suave de fundo */}
      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500/15 dark:bg-amber-500/20 text-amber-500">
        <Zap className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
      </div>
      <div className="flex items-center gap-1.5">
        <span className="font-bold text-sm text-slate-900 dark:text-slate-100">{streak}</span>
        <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">
          {formatDatePt(new Date())}
        </span>
      </div>
    </div>
  );
}