import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Stethoscope, UserRound, Activity, Play, ChevronLeft, RefreshCw, WifiOff, Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import { useTraining } from "@/contexts/TrainingContext";
import { useLiveKitAudio } from "@/contexts/LiveKitAudioContext";
import { ConnectionBanner } from "@/components/training/ConnectionBanner";
import { MicToggleButton } from "@/components/training/MicToggleButton";
import { ROTATING_WAITING_MESSAGES } from "@/lib/trainingData";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

export default function MedicoEspera() {
  const {
    partnerName,
    role,
    status,
    config,
    startStation,
    exitTraining,
    connectionState,
    disconnectCountdown,
    encerrarEstacao,
    activeSessionId,
    partnerId,
  } = useTraining();
  const { connect, disconnect, audioState } = useLiveKitAudio();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [msgIndex, setMsgIndex] = useState(0);
  const audioConnectedRef = useRef(false);

  // Saída por estado inválido — aguarda recovery antes de redirecionar
  useEffect(() => {
    if (status === "idle" && connectionState !== "restoring_session") {
      setLocation("/treino");
    }
  }, [status, connectionState, setLocation]);

  // Quando a estação iniciar (recebido via sync ou localmente), ambos avançam
  useEffect(() => {
    if (status === "running") {
      setLocation("/treino/estacao");
    }
  }, [status, setLocation]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setMsgIndex((prev) => (prev + 1) % ROTATING_WAITING_MESSAGES.length);
    }, 2400);
    return () => window.clearInterval(id);
  }, []);

  // Connect to LiveKit audio room as soon as we enter the waiting state
  // with a real partner and a valid session ID
  useEffect(() => {
    const isRealSession =
      activeSessionId &&
      partnerId &&
      !partnerId.startsWith("u-") &&
      partnerId !== "__solo__" &&
      connectionState !== "restoring_session";

    if (!isRealSession || audioConnectedRef.current) return;
    if (audioState === "connecting" || audioState === "connected") return;

    audioConnectedRef.current = true;
    const participantName =
      user?.displayName ||
      user?.name ||
      user?.email ||
      "Participante";

    void connect(activeSessionId, participantName);
  }, [activeSessionId, partnerId, connectionState, audioState, connect, user]);

  const isMedico = role === "medico";

  // Médico: pronto para iniciar quando config foi recebida
  const readyToStart = isMedico && !!config && status === "waiting";

  const handleStart = () => {
    startStation();
    setLocation("/treino/estacao");
  };

  const handleExit = () => {
    disconnect();
    exitTraining();
    setLocation("/treino");
  };

  // Bloquear render e redirects enquanto o recovery ainda não concluiu
  if (connectionState === "restoring_session") {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background text-foreground relative overflow-hidden flex flex-col">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(59,130,246,0.18),transparent_55%),radial-gradient(ellipse_at_bottom,rgba(139,92,246,0.18),transparent_55%)] pointer-events-none" />

      <div className="relative max-w-3xl mx-auto w-full px-4 pt-6">
        <button
          onClick={handleExit}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> Sair da espera
        </button>
        <div className="mt-3">
          <ConnectionBanner
            state={connectionState}
            partnerName={partnerName}
            disconnectCountdown={disconnectCountdown}
            onAbandon={() => {
              encerrarEstacao();
              disconnect();
              exitTraining();
              setLocation("/treino");
            }}
          />
        </div>
      </div>

      <div className="relative flex-1 flex items-center justify-center px-4 py-10">
        <motion.div
          initial={{ opacity: 0, y: 14, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md rounded-3xl backdrop-blur-2xl bg-white/70 dark:bg-slate-900/70 border border-white/40 dark:border-white/10 shadow-2xl p-8 sm:p-10 flex flex-col items-center gap-6 text-center"
        >
          {/* Ícone animado contextual por papel */}
          <div className="relative w-28 h-28 flex items-center justify-center">
            <span className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-500/30 via-cyan-400/20 to-violet-500/30 blur-2xl animate-pulse" />
            <span className="absolute inset-0 rounded-full border border-blue-300/40 animate-ping" />
            <motion.div
              animate={{ y: [0, -6, 0, -3, 0], rotate: [-2, 2, -2, 2, -2] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
              className="relative w-20 h-20 rounded-full gradient-primary flex items-center justify-center glow-primary shadow-lg"
            >
              {isMedico ? (
                <Stethoscope className="w-10 h-10 text-white" strokeWidth={1.5} />
              ) : (
                <UserRound className="w-10 h-10 text-white" strokeWidth={1.5} />
              )}
            </motion.div>
          </div>

          <AnimatePresence mode="wait">
            {/* ── MÉDICO: aguardando configuração do paciente ── */}
            {isMedico && !readyToStart && (
              <motion.div
                key="medico-waiting"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="flex flex-col gap-4 w-full"
              >
                <div className="flex flex-col gap-2">
                  <h1 className="text-2xl font-bold tracking-tight">
                    Aguardando chefe da estação
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    <span className="font-semibold text-foreground">{partnerName}</span> está
                    configurando a estação.
                  </p>
                </div>
                <div className="h-12 flex items-center justify-center w-full">
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={msgIndex}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.4 }}
                      className="text-base font-medium text-primary"
                    >
                      {ROTATING_WAITING_MESSAGES[msgIndex]}
                    </motion.p>
                  </AnimatePresence>
                </div>
                <div className={`flex items-center justify-center gap-2 px-3 py-2 rounded-full text-xs ${
                  connectionState !== "connected"
                    ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                    : "bg-muted/60 text-muted-foreground"
                }`}>
                  {connectionState === "self_reconnecting" ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : connectionState === "partner_disconnected" ? (
                    <WifiOff className="w-3.5 h-3.5" />
                  ) : (
                    <Activity className="w-3.5 h-3.5 animate-pulse text-blue-500" />
                  )}
                  {connectionState === "self_reconnecting"
                    ? "Reconectando ao servidor…"
                    : connectionState === "partner_disconnected"
                    ? `Aguardando ${partnerName ?? "parceiro"} reconectar…`
                    : "Conectado · canal estável"}
                </div>
              </motion.div>
            )}

            {/* ── MÉDICO: configuração recebida, pronto para iniciar ── */}
            {isMedico && readyToStart && (
              <motion.div
                key="medico-ready"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="flex flex-col gap-4 w-full"
              >
                <div className="flex flex-col gap-2">
                  <h1 className="text-2xl font-bold tracking-tight">Estação pronta</h1>
                  <p className="text-sm text-muted-foreground">
                    <span className="font-semibold text-foreground">{partnerName}</span> definiu
                    o caso. Quando estiver pronto, inicie a estação.
                  </p>
                  <div className="mt-2 flex items-center justify-center gap-3 text-xs">
                    <span className="px-2.5 py-1 rounded-full bg-primary/10 text-primary font-bold">
                      {config?.tempoMin} minutos
                    </span>
                    <span className="px-2.5 py-1 rounded-full bg-muted text-muted-foreground font-semibold">
                      Caso surpresa
                    </span>
                  </div>
                </div>
                <Button
                  onClick={handleStart}
                  className="w-full h-14 rounded-2xl gradient-primary text-white border-0 glow-primary text-base"
                >
                  <Play className="w-5 h-5 mr-2 fill-current" />
                  Iniciar estação
                </Button>
              </motion.div>
            )}

            {/* ── PACIENTE: aguardando médico iniciar ── */}
            {!isMedico && (
              <motion.div
                key="paciente-waiting"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="flex flex-col gap-4 w-full"
              >
                <div className="flex flex-col gap-2">
                  <h1 className="text-2xl font-bold tracking-tight">Aguardando médico</h1>
                  <p className="text-sm text-muted-foreground">
                    Configuração enviada.{" "}
                    <span className="font-semibold text-foreground">{partnerName}</span> irá
                    iniciar a estação quando estiver pronto.
                  </p>
                </div>
                <div className="h-12 flex items-center justify-center w-full">
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={msgIndex}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.4 }}
                      className="text-base font-medium text-primary"
                    >
                      {ROTATING_WAITING_MESSAGES[msgIndex]}
                    </motion.p>
                  </AnimatePresence>
                </div>
                <div className={`flex items-center justify-center gap-2 px-3 py-2 rounded-full text-xs ${
                  connectionState !== "connected"
                    ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                    : "bg-muted/60 text-muted-foreground"
                }`}>
                  {connectionState === "self_reconnecting" ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Activity className="w-3.5 h-3.5 animate-pulse text-violet-500" />
                  )}
                  {connectionState === "self_reconnecting"
                    ? "Reconectando ao servidor…"
                    : "Configuração enviada · aguardando início"}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Floating mic toggle — only for real sessions */}
      {partnerId && !partnerId.startsWith("u-") && partnerId !== "__solo__" && (
        <div className="fixed bottom-6 right-6 z-50">
          <MicToggleButton />
        </div>
      )}
    </div>
  );
}
