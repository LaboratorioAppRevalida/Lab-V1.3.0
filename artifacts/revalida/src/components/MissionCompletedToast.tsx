/**
 * MissionCompletedToast.tsx
 *
 * Toast não-intrusivo exibido quando uma missão é completada em runtime.
 * Renderizado via sonner toast.custom(). Sem modal, sem alert().
 */

import { motion } from "framer-motion";
import { Sparkles, Trophy, X } from "lucide-react";
import { toast } from "sonner";

interface MissionCompletedToastProps {
  titulo: string;
  xp: number;
  toastId: string | number;
  onClaim?: () => void;
}

const PERIOD_COLORS: Record<string, string> = {
  diario:   "from-blue-500/20 to-cyan-500/10 border-blue-400/40",
  semanal:  "from-violet-500/20 to-purple-500/10 border-violet-400/40",
  mensal:   "from-amber-500/20 to-orange-500/10 border-amber-400/40",
  especial: "from-fuchsia-500/20 to-pink-500/10 border-fuchsia-400/40",
};

export function MissionCompletedToast({
  titulo,
  xp,
  toastId,
  onClaim,
}: MissionCompletedToastProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.97 }}
      transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={[
        "relative flex items-center gap-3 w-full max-w-sm",
        "rounded-2xl border bg-gradient-to-br backdrop-blur-xl shadow-2xl",
        "px-4 py-3",
        "from-background/95 to-background/90 border-border/60",
      ].join(" ")}
    >
      {/* Ícone */}
      <div className="shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
        <Trophy className="w-5 h-5 text-white" />
      </div>

      {/* Texto */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <Sparkles className="w-3 h-3 text-amber-400 shrink-0" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500 dark:text-amber-400">
            Missão concluída!
          </span>
        </div>
        <p className="text-sm font-semibold text-foreground leading-snug truncate">
          {titulo}
        </p>
        <p className="text-xs font-bold text-amber-500 dark:text-amber-400 mt-0.5">
          +{xp} XP disponível
        </p>
      </div>

      {/* Ações */}
      <div className="flex items-center gap-1 shrink-0">
        {onClaim && (
          <button
            onClick={onClaim}
            className={[
              "text-[11px] font-bold px-2.5 py-1.5 rounded-lg",
              "bg-gradient-to-r from-amber-400 to-orange-500 text-white",
              "hover:from-amber-500 hover:to-orange-600 transition-all",
              "shadow-md shadow-amber-500/25 active:scale-95",
            ].join(" ")}
          >
            Resgatar
          </button>
        )}
        <button
          onClick={() => toast.dismiss(toastId)}
          className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          aria-label="Fechar"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Barra de progresso animada (duração) */}
      <motion.div
        className="absolute bottom-0 left-0 h-[2px] rounded-full bg-gradient-to-r from-amber-400 to-orange-500 opacity-60"
        initial={{ width: "100%" }}
        animate={{ width: "0%" }}
        transition={{ duration: 5, ease: "linear" }}
      />
    </motion.div>
  );
}
