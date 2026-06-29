/**
 * AchievementUnlockedToast.tsx
 *
 * Toast discreto exibido quando uma medalha é desbloqueada em runtime.
 * Renderizado via sonner toast.custom(). Sem modal, sem alert().
 * Auto-dismiss: 5 segundos.
 * Mesma estrutura do MissionCompletedToast.
 */

import { motion } from "framer-motion";
import { Medal, X } from "lucide-react";
import { toast } from "sonner";
import { TIER_META, type AchievementTier } from "@/lib/gamificationStorage";
import { cn } from "@/lib/utils";

// ── Gradiente de fundo por tier ────────────────────────────────────────────────

const TIER_BG: Record<AchievementTier, string> = {
  bronze:  "from-amber-600/20 to-amber-500/5 border-amber-500/40",
  prata:   "from-slate-400/20 to-slate-300/5 border-slate-400/40",
  ouro:    "from-yellow-500/20 to-amber-400/5 border-yellow-400/40",
  platina: "from-cyan-400/20 to-blue-400/5 border-cyan-400/40",
};

const TIER_ICON: Record<AchievementTier, string> = {
  bronze:  "from-amber-700 to-amber-500 shadow-amber-500/30",
  prata:   "from-slate-400 to-slate-300 shadow-slate-300/30",
  ouro:    "from-yellow-500 to-amber-400 shadow-yellow-400/30",
  platina: "from-cyan-400 to-blue-500 shadow-cyan-400/30",
};

const TIER_TIMER: Record<AchievementTier, string> = {
  bronze:  "from-amber-700 to-amber-500",
  prata:   "from-slate-400 to-slate-300",
  ouro:    "from-yellow-500 to-amber-400",
  platina: "from-cyan-400 to-blue-500",
};

// ── Componente ─────────────────────────────────────────────────────────────────

interface AchievementUnlockedToastProps {
  titulo:    string;
  descricao: string;
  tier:      AchievementTier;
  toastId:   string | number;
}

export function AchievementUnlockedToast({
  titulo,
  descricao,
  tier,
  toastId,
}: AchievementUnlockedToastProps) {
  const meta = TIER_META[tier];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.97 }}
      transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={cn(
        "relative flex items-center gap-3 w-full max-w-sm",
        "rounded-2xl border bg-gradient-to-br backdrop-blur-xl shadow-2xl",
        "px-4 py-3",
        TIER_BG[tier],
      )}
    >
      {/* Ícone */}
      <div
        className={cn(
          "shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-lg",
          TIER_ICON[tier],
        )}
      >
        <Medal className="w-5 h-5 text-white" />
      </div>

      {/* Texto */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className={cn("text-[10px] font-bold uppercase tracking-wider", meta.text)}>
            {meta.label} · Medalha desbloqueada!
          </span>
        </div>
        <p className="text-sm font-semibold text-foreground leading-snug truncate">
          {titulo}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">
          {descricao}
        </p>
      </div>

      {/* Fechar */}
      <button
        onClick={() => toast.dismiss(toastId)}
        className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors shrink-0"
        aria-label="Fechar"
      >
        <X className="w-3.5 h-3.5" />
      </button>

      {/* Barra de progresso animada (duração 5s) */}
      <motion.div
        className={cn(
          "absolute bottom-0 left-0 h-[2px] rounded-full bg-gradient-to-r opacity-60",
          TIER_TIMER[tier],
        )}
        initial={{ width: "100%" }}
        animate={{ width: "0%" }}
        transition={{ duration: 5, ease: "linear" }}
      />
    </motion.div>
  );
}
