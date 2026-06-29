import { Zap, Users } from "lucide-react";
import { motion } from "framer-motion";
import { useTraining } from "@/contexts/TrainingContext";
import { useRealtime } from "@/contexts/RealtimeContext";

export function InstaCheckButton() {
  const { startInstaCheck, matchmakingActive } = useTraining();
  const { onlineUsers } = useRealtime();

  // Outros usuários atualmente na fila InstaCheck
  const inQueueCount = onlineUsers.filter((u) => u.status === "matchmaking").length;

  return (
    <motion.button
      whileHover={{ scale: matchmakingActive ? 1 : 1.02 }}
      whileTap={{ scale: matchmakingActive ? 1 : 0.97 }}
      onClick={startInstaCheck}
      disabled={matchmakingActive}
      className="relative w-full flex items-center justify-center gap-2 px-5 py-4 rounded-2xl backdrop-blur-md bg-blue-500/10 dark:bg-blue-400/10 border border-blue-400/30 dark:border-blue-300/30 text-blue-700 dark:text-blue-200 font-semibold shadow-lg shadow-blue-500/10 hover:shadow-blue-500/20 hover:bg-blue-500/15 transition-all overflow-hidden disabled:opacity-70 disabled:cursor-not-allowed"
    >
      {/* Brilho de fundo */}
      <span className="absolute inset-0 bg-gradient-to-r from-blue-500/0 via-cyan-400/10 to-violet-500/0 pointer-events-none" />

      <Zap className="w-5 h-5 fill-current relative" strokeWidth={1.5} />
      <span className="relative">InstaCheck</span>

      {/* Badge: usuários na fila OU "Instantâneo" */}
      {inQueueCount > 0 ? (
        <motion.span
          key="queue"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative ml-1 flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border border-emerald-400/30"
        >
          <Users className="w-3 h-3" />
          {inQueueCount} na fila
        </motion.span>
      ) : (
        <span className="relative ml-1 text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/40 dark:bg-white/10 text-blue-700 dark:text-blue-100">
          Instantâneo
        </span>
      )}
    </motion.button>
  );
}
