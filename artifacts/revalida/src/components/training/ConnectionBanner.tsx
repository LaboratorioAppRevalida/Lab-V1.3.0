import { motion, AnimatePresence } from "framer-motion";
import { WifiOff, RefreshCw, AlertTriangle, Clock, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ConnectionState } from "@/contexts/TrainingContext";

export type { ConnectionState };

interface ConnectionBannerProps {
  state: ConnectionState;
  partnerName?: string | null;
  /** Seconds remaining before the "abandon" button appears (counts from 120→0). */
  disconnectCountdown?: number;
  onAbandon?: () => void;
}

type BannerTone = "amber" | "yellow" | "blue" | "violet";

interface BannerConfig {
  icon: React.ReactNode;
  title: string;
  desc: (partnerName: string, countdown: number) => string;
  tone: BannerTone;
}

const configs: Record<Exclude<ConnectionState, "connected">, BannerConfig> = {
  partner_suspected: {
    icon: <Wifi className="w-4 h-4 opacity-60" />,
    title: "Reconectando parceiro…",
    desc: (name) => `Aguardando ${name} restabelecer a conexão. O cronômetro segue normalmente.`,
    tone: "yellow",
  },
  partner_disconnected: {
    icon: <WifiOff className="w-4 h-4" />,
    title: "Sessão pausada — aguardando reconexão",
    desc: (name, cd) =>
      cd > 0
        ? `Aguardando ${name} reconectar… ${formatSecs(cd)}`
        : `${name} não voltou. Você pode encerrar a sessão.`,
    tone: "amber",
  },
  self_reconnecting: {
    icon: <RefreshCw className="w-4 h-4 animate-spin" />,
    title: "Reconectando…",
    desc: () => "Restaurando conexão em tempo real com o servidor.",
    tone: "blue",
  },
  restoring_session: {
    icon: <RefreshCw className="w-4 h-4 animate-spin" />,
    title: "Restaurando sessão",
    desc: () => "Recuperando estado da estação anterior…",
    tone: "blue",
  },
};

const toneWrapper: Record<BannerTone, string> = {
  yellow:
    "border-yellow-300/40 bg-yellow-400/10 text-yellow-800 dark:text-yellow-200",
  amber:
    "border-amber-300/40 bg-amber-500/10 text-amber-800 dark:text-amber-200",
  blue: "border-blue-300/40 bg-blue-500/10 text-blue-800 dark:text-blue-200",
  violet:
    "border-violet-300/40 bg-violet-500/10 text-violet-800 dark:text-violet-200",
};

const toneIcon: Record<BannerTone, string> = {
  yellow: "bg-yellow-400/15 text-yellow-700 dark:text-yellow-200",
  amber: "bg-amber-500/15 text-amber-700 dark:text-amber-200",
  blue: "bg-blue-500/15 text-blue-700 dark:text-blue-200",
  violet: "bg-violet-500/15 text-violet-700 dark:text-violet-200",
};

function formatSecs(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, "0")}` : `${s}s`;
}

export function ConnectionBanner({
  state,
  partnerName,
  disconnectCountdown = 0,
  onAbandon,
}: ConnectionBannerProps) {
  const visible = state !== "connected";
  if (!visible) return null;

  const cfg = configs[state as Exclude<ConnectionState, "connected">];
  const name = partnerName ?? "Parceiro";
  const showAbandon =
    state === "partner_disconnected" && disconnectCountdown <= 0 && !!onAbandon;
  const showTimer =
    state === "partner_disconnected" && disconnectCountdown > 0;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key={state}
          initial={{ opacity: 0, y: -6, height: 0 }}
          animate={{ opacity: 1, y: 0, height: "auto" }}
          exit={{ opacity: 0, y: -6, height: 0 }}
          transition={{ duration: 0.28 }}
          className="overflow-hidden"
        >
          <div
            className={`rounded-2xl border ${toneWrapper[cfg.tone]} p-3 flex items-center gap-3 mb-3`}
          >
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${toneIcon[cfg.tone]}`}
            >
              {cfg.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm leading-tight">{cfg.title}</p>
              <p className="text-xs opacity-80 mt-0.5">
                {cfg.desc(name, disconnectCountdown)}
              </p>
            </div>
            {showTimer && (
              <div className="shrink-0 flex items-center gap-1 text-xs font-mono font-semibold opacity-70">
                <Clock className="w-3 h-3" />
                {formatSecs(disconnectCountdown)}
              </div>
            )}
            {showAbandon && (
              <Button
                size="sm"
                variant="outline"
                onClick={onAbandon}
                className="shrink-0 border-amber-400/50 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10 h-8 text-xs rounded-lg"
              >
                <AlertTriangle className="w-3 h-3 mr-1" />
                Encerrar
              </Button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
