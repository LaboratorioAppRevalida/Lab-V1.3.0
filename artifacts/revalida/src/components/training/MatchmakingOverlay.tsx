import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTraining } from "@/contexts/TrainingContext";
import { useRealtime } from "@/contexts/RealtimeContext";
import { Activity, X, Users, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

const TOTAL_WAIT = 20; // segundos até fallback mock

export function MatchmakingOverlay() {
  const { matchmakingActive, outgoingInviteName, cancelInstaCheck, cancelOutgoingInvite } = useTraining();
  const { onlineUsers } = useRealtime();
  const [elapsed, setElapsed] = useState(0);

  const visible = matchmakingActive || !!outgoingInviteName;
  const isMatchmaking = matchmakingActive && !outgoingInviteName;

  // Outros usuários na fila InstaCheck
  const inQueueCount = onlineUsers.filter((u) => u.status === "matchmaking").length;

  // Cronômetro de busca
  useEffect(() => {
    if (!isMatchmaking) {
      setElapsed(0);
      return;
    }
    setElapsed(0);
    const id = window.setInterval(() => {
      setElapsed((prev) => Math.min(prev + 1, TOTAL_WAIT));
    }, 1000);
    return () => window.clearInterval(id);
  }, [isMatchmaking]);

  const waitProgress = Math.min((elapsed / TOTAL_WAIT) * 100, 100);
  const remainingSec = Math.max(TOTAL_WAIT - elapsed, 0);

  const title = isMatchmaking
    ? "Buscando parceiro..."
    : `Convite enviado para ${outgoingInviteName}`;

  const subtitle = isMatchmaking
    ? inQueueCount > 0
      ? `${inQueueCount} médico${inQueueCount > 1 ? "s" : ""} também ${inQueueCount > 1 ? "estão" : "está"} buscando`
      : "Aguardando outros médicos entrarem"
    : "Aguardando resposta do convite";

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
        >
          <motion.div
            initial={{ y: 20, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 20, opacity: 0, scale: 0.96 }}
            className="relative w-full max-w-sm rounded-3xl backdrop-blur-xl bg-white/85 dark:bg-slate-900/85 border border-white/40 dark:border-white/10 shadow-2xl p-8 flex flex-col items-center gap-5"
          >
            {/* Ícone animado */}
            <div className="relative w-20 h-20 flex items-center justify-center">
              <span className="absolute inset-0 rounded-full gradient-primary opacity-20 blur-2xl animate-pulse" />
              <span className="absolute inset-0 rounded-full border-2 border-blue-400/40 animate-ping" />
              <span className="absolute inset-2 rounded-full border-2 border-cyan-400/40 animate-ping [animation-delay:250ms]" />
              <div className="relative w-14 h-14 rounded-full gradient-primary flex items-center justify-center glow-primary">
                {isMatchmaking
                  ? <Zap className="w-7 h-7 text-white fill-current" strokeWidth={1.5} />
                  : <Activity className="w-7 h-7 text-white" strokeWidth={2} />
                }
              </div>
            </div>

            {/* Texto */}
            <div className="text-center">
              <h3 className="text-lg font-bold tracking-tight">{title}</h3>
              <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
            </div>

            {/* Barra de progresso + contador (só no InstaCheck) */}
            {isMatchmaking && (
              <div className="w-full">
                <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                  <span className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    {inQueueCount > 0 ? `${inQueueCount} na fila` : "Aguardando..."}
                  </span>
                  <span className={`font-mono font-semibold ${remainingSec <= 5 ? "text-amber-500" : "text-foreground"}`}>
                    {remainingSec}s
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <motion.div
                    className="h-full rounded-full gradient-primary"
                    animate={{ width: `${waitProgress}%` }}
                    transition={{ duration: 0.8, ease: "linear" }}
                  />
                </div>
                {remainingSec <= 5 && remainingSec > 0 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 text-center mt-2">
                    Conectando com parceiro disponível...
                  </p>
                )}
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={isMatchmaking ? cancelInstaCheck : cancelOutgoingInvite}
              className="rounded-full"
            >
              <X className="w-4 h-4 mr-1" /> Cancelar
            </Button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
