import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw } from "lucide-react";
import type { ConnectionState } from "@/contexts/TrainingContext";

interface ConnectionBadgeProps {
  state: ConnectionState;
  className?: string;
}

type Cfg = {
  label: string;
  dotClass: string;
  textClass: string;
  bgClass: string;
  spin?: boolean;
};

const CFG: Record<ConnectionState, Cfg> = {
  connected: {
    label: "Conectado",
    dotClass: "bg-emerald-500",
    textClass: "text-emerald-700 dark:text-emerald-300",
    bgClass: "bg-emerald-500/10",
  },
  partner_suspected: {
    label: "Parceiro instável",
    dotClass: "bg-yellow-400 animate-pulse",
    textClass: "text-yellow-700 dark:text-yellow-300",
    bgClass: "bg-yellow-400/10",
    spin: false,
  },
  self_reconnecting: {
    label: "Reconectando",
    dotClass: "bg-amber-500 animate-pulse",
    textClass: "text-amber-700 dark:text-amber-300",
    bgClass: "bg-amber-500/10",
    spin: true,
  },
  restoring_session: {
    label: "Restaurando",
    dotClass: "bg-blue-500 animate-pulse",
    textClass: "text-blue-700 dark:text-blue-300",
    bgClass: "bg-blue-500/10",
    spin: true,
  },
  partner_disconnected: {
    label: "Parceiro off",
    dotClass: "bg-rose-500",
    textClass: "text-rose-700 dark:text-rose-300",
    bgClass: "bg-rose-500/10",
  },
};

/**
 * Compact persistent badge showing the current multiplayer connection state.
 * Complements (does not replace) the ConnectionBanner for non-connected states.
 */
export function ConnectionBadge({ state, className = "" }: ConnectionBadgeProps) {
  const cfg = CFG[state];
  return (
    <AnimatePresence mode="wait">
      <motion.span
        key={state}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.15 }}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${cfg.bgClass} ${cfg.textClass} ${className}`}
      >
        {cfg.spin ? (
          <RefreshCw className="w-2.5 h-2.5 animate-spin shrink-0" />
        ) : (
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dotClass}`} />
        )}
        {cfg.label}
      </motion.span>
    </AnimatePresence>
  );
}
