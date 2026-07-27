import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Loader2, Volume2 } from "lucide-react";
import { useLiveKitAudio } from "@/contexts/LiveKitAudioContext";

interface MicToggleButtonProps {
  className?: string;
}

export function MicToggleButton({ className = "" }: MicToggleButtonProps) {
  const { audioState, isMuted, isPlaybackBlocked, toggleMic, unblockPlayback } =
    useLiveKitAudio();

  if (audioState === "idle" || audioState === "error") return null;

  const isConnecting = audioState === "connecting";

  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      {/* ── Autoplay-blocked banner ──────────────────────────────────────────
          Shown when the mobile browser is blocking incoming audio playback.
          Tapping it calls unblockPlayback() inside the native click handler,
          which satisfies the user-gesture requirement and calls startAudio(). */}
      <AnimatePresence>
        {isPlaybackBlocked && audioState === "connected" && (
          <motion.button
            key="playback-blocked-banner"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ type: "spring", stiffness: 320, damping: 24 }}
            onClick={() => void unblockPlayback()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold
                       bg-amber-500/20 border border-amber-400/50 text-amber-300
                       backdrop-blur-md hover:bg-amber-500/30 active:scale-95 transition-all"
            aria-label="Toque para ativar o áudio"
          >
            <Volume2 className="w-3.5 h-3.5 shrink-0" />
            Toque para ouvir o parceiro
          </motion.button>
        )}
      </AnimatePresence>

      {/* ── Mic toggle button ─────────────────────────────────────────────── */}
      <AnimatePresence>
        <motion.button
          key="mic-toggle"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ type: "spring", stiffness: 300, damping: 22 }}
          onClick={() => void toggleMic()}
          disabled={isConnecting}
          aria-label={isMuted ? "Ativar microfone" : "Silenciar microfone"}
          className="relative group flex items-center justify-center"
          style={{ width: 52, height: 52 }}
        >
          {/* Glassmorphic background */}
          <span
            className={`absolute inset-0 rounded-full backdrop-blur-md border transition-all duration-300 ${
              isConnecting
                ? "bg-slate-500/20 border-slate-400/30"
                : isMuted
                ? "bg-slate-800/50 dark:bg-slate-900/60 border-slate-600/40 dark:border-slate-500/30"
                : "bg-emerald-500/20 dark:bg-emerald-600/25 border-emerald-400/60 dark:border-emerald-500/50"
            }`}
          />

          {/* Emerald glow pulse when active */}
          {!isMuted && !isConnecting && (
            <span className="absolute inset-0 rounded-full bg-emerald-400/30 animate-pulse" />
          )}

          {/* Icon */}
          <span className="relative z-10 flex items-center justify-center">
            {isConnecting ? (
              <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
            ) : isMuted ? (
              <MicOff className="w-5 h-5 text-slate-400 dark:text-slate-500" />
            ) : (
              <Mic className="w-5 h-5 text-emerald-400" />
            )}
          </span>

          {/* Tooltip */}
          <span
            className={`absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap px-2 py-1 rounded-lg text-[10px] font-semibold pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm border ${
              isMuted
                ? "bg-slate-800/80 text-slate-200 border-slate-700/50"
                : "bg-emerald-900/80 text-emerald-200 border-emerald-700/50"
            }`}
          >
            {isConnecting ? "Conectando…" : isMuted ? "Microfone mudo" : "Microfone ativo"}
          </span>
        </motion.button>
      </AnimatePresence>
    </div>
  );
}
