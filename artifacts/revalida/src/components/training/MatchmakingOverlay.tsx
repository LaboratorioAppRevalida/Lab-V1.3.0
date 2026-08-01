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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
        >
          <motion.div
            initial={{ y: 20, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 20, opacity: 0, scale: 0.96 }}
            /* Aplicado o gradiente ao card + borda com brilho suave e texto claro */
            className="relative w-full max-w-sm rounded-3xl bg-gradient-to-br from-blue-500 via-cyan-500 to-violet-500 text-white border border-white/30 shadow-2xl p-8 flex flex-col items-center gap-5"
          >
            {/* Ícone animado com destaque em fundo branco */}
            <div className="relative w-20 h-20 flex items-center justify-center">
              <span className="absolute inset-0 rounded-full bg-white/20 blur-xl animate-pulse" />
              <span className="absolute inset-0 rounded-full border-2 border-white/40 animate-ping" />
              <span className="absolute inset-2 rounded-full border-2 border-white/60 animate-ping [animation-delay:250ms]" />

              <div className="relative w-14 h-14 rounded-full bg-white flex items-center justify-center shadow-lg">
                {isMatchmaking ? (
                  <Zap className="w-7 h-7 text-cyan-600 fill-cyan-600 animate-bounce" strokeWidth={1.5} />
                ) : (
                  <Activity className="w-7 h-7 text-blue-600 animate-pulse" strokeWidth={2} />
                )}
              </div>
            </div>

            {/* Texto */}
            <div className="text-center">
              <h3 className="text-xl font-extrabold tracking-tight text-white drop-shadow-sm">{title}</h3>
              <p className="text-sm text-cyan-100 font-medium mt-1">{subtitle}</p>
            </div>

            {/* Barra de progresso + contador (só no InstaCheck) */}
            {isMatchmaking && (
              <div className="w-full">
                <div className="flex justify-between text-xs font-semibold text-cyan-100 mb-1.5">
                  <span className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-white" />
                    {inQueueCount > 0 ? `${inQueueCount} na fila` : "Aguardando..."}
                  </span>
                  <span className={`font-mono ${remainingSec <= 5 ? "text-amber-300 font-bold" : "text-white"}`}>
                    {remainingSec}s
                  </span>
                </div>

                <div className="h-2 rounded-full bg-black/20 overflow-hidden border border-white/20">
                  <motion.div
                    className="h-full rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)]"
                    animate={{ width: `${waitProgress}%` }}
                    transition={{ duration: 0.8, ease: "linear" }}
                  />
                </div>

                {remainingSec <= 5 && remainingSec > 0 && (
                  <p className="text-xs font-bold text-amber-300 text-center mt-2 animate-pulse drop-shadow-sm">
                    Conectando com parceiro disponível...
                  </p>
                )}
              </div>
            )}

            {/* Botão de Cancelar em estilo glassmorphic transparente */}
            <Button
              variant="outline"
              size="sm"
              onClick={isMatchmaking ? cancelInstaCheck : cancelOutgoingInvite}
              className="rounded-full border-white/30 bg-white/10 hover:bg-white/20 text-white font-semibold px-6 backdrop-blur-sm transition-all"
            >
              <X className="w-4 h-4 mr-1" /> Cancelar
            </Button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}