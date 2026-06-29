import { motion, AnimatePresence } from "framer-motion";
import { Stethoscope, UserRound, Shuffle, Users, Loader2, RefreshCw } from "lucide-react";
import { useTraining } from "@/contexts/TrainingContext";
import { useLocation } from "wouter";
import { useEffect } from "react";

export default function SelecaoPapel() {
  const { partnerName, status, selectRole, sessionSync, connectionState } = useTraining();
  const [, setLocation] = useLocation();

  // Aguarda recovery antes de redirecionar
  useEffect(() => {
    if (status === "idle" && connectionState !== "restoring_session") {
      setLocation("/treino");
    }
  }, [status, connectionState, setLocation]);

  useEffect(() => {
    if (status === "config") setLocation("/treino/config");
    if (status === "waiting") setLocation("/treino/espera");
  }, [status, setLocation]);

  // Sessão real: meu papel foi enviado mas ainda aguardando parceiro confirmar
  const awaitingPartner = !!sessionSync.myRole && !sessionSync.rolesComplete;

  const options: Array<{
    key: "medico" | "paciente" | "aleatorio";
    title: string;
    desc: string;
    icon: typeof Stethoscope;
    accent: string;
    iconBg: string;
  }> = [
    {
      key: "medico",
      title: "Médico",
      desc: "Atender o caso, conduzir a anamnese e o exame físico.",
      icon: Stethoscope,
      accent: "from-blue-500/20 via-cyan-400/15 to-blue-500/0",
      iconBg: "from-blue-500 to-cyan-500",
    },
    {
      key: "paciente",
      title: "Paciente",
      desc: "Conduzir a estação, simular o caso e avaliar o médico.",
      icon: UserRound,
      accent: "from-violet-500/20 via-fuchsia-400/15 to-violet-500/0",
      iconBg: "from-violet-500 to-fuchsia-500",
    },
    {
      key: "aleatorio",
      title: "Aleatório",
      desc: "Deixar o sistema sortear seu papel para esta estação.",
      icon: Shuffle,
      accent: "from-emerald-500/20 via-cyan-400/15 to-emerald-500/0",
      iconBg: "from-emerald-500 to-teal-500",
    },
  ];

  const roleLabel: Record<string, string> = {
    medico: "Médico",
    paciente: "Paciente",
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
    <div className="min-h-[100dvh] bg-background text-foreground relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(59,130,246,0.18),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgba(139,92,246,0.16),transparent_55%)] pointer-events-none" />
      <div className="relative max-w-3xl mx-auto px-4 py-10 sm:py-14 flex flex-col gap-8">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-2 text-center"
        >
          <div className="inline-flex self-center items-center gap-2 px-3 py-1 rounded-full backdrop-blur-md bg-white/40 dark:bg-white/5 border border-border/60 text-xs font-semibold text-muted-foreground">
            <Users className="w-3.5 h-3.5" /> Treinando com {partnerName}
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Escolha seu papel</h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            Defina como você vai participar desta estação prática.
          </p>
        </motion.div>

        <AnimatePresence mode="wait">
          {awaitingPartner ? (
            /* Estado: aguardando parceiro escolher o papel */
            <motion.div
              key="waiting"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center gap-5 py-8 px-4 rounded-3xl border border-border/60 backdrop-blur-xl bg-card/70"
            >
              <div className="relative w-16 h-16 flex items-center justify-center">
                <span className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-500/30 to-violet-500/30 blur-xl animate-pulse" />
                <Loader2 className="w-9 h-9 text-primary animate-spin relative z-10" />
              </div>
              <div className="flex flex-col gap-1 text-center">
                <p className="text-base font-semibold">
                  Você escolheu:{" "}
                  <span className="text-primary">
                    {sessionSync.myRole ? roleLabel[sessionSync.myRole] : ""}
                  </span>
                </p>
                <p className="text-sm text-muted-foreground">
                  Aguardando{" "}
                  <span className="font-semibold text-foreground">{partnerName}</span> escolher
                  o papel…
                </p>
                <div className="flex items-center justify-center gap-1.5 text-xs mt-1">
                  {connectionState === "self_reconnecting" ? (
                    <>
                      <RefreshCw className="w-3 h-3 animate-spin text-amber-500" />
                      <span className="text-amber-600 dark:text-amber-400">Reconectando…</span>
                    </>
                  ) : connectionState === "partner_disconnected" ? (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                      <span className="text-rose-600 dark:text-rose-400">Aguardando parceiro reconectar…</span>
                    </>
                  ) : (
                    <span className="text-muted-foreground/70">A estação começa assim que ambos estiverem prontos.</span>
                  )}
                </div>
              </div>
            </motion.div>
          ) : (
            /* Estado: escolha de papel */
            <motion.div
              key="cards"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 sm:grid-cols-3 gap-4"
            >
              {options.map((opt, i) => {
                const Icon = opt.icon;
                return (
                  <motion.button
                    key={opt.key}
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: 0.1 + i * 0.08 }}
                    whileHover={{ y: -4 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => selectRole(opt.key)}
                    className="group relative text-left rounded-3xl p-6 border border-border/60 backdrop-blur-xl bg-card/70 hover:bg-card/90 hover:border-border shadow-lg hover:shadow-2xl transition-all overflow-hidden"
                  >
                    <div
                      className={`absolute inset-0 bg-gradient-to-br ${opt.accent} opacity-60 group-hover:opacity-100 transition-opacity pointer-events-none`}
                    />
                    <div className="relative flex flex-col gap-4">
                      <div
                        className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${opt.iconBg} flex items-center justify-center shadow-lg`}
                      >
                        <Icon className="w-7 h-7 text-white" strokeWidth={1.6} />
                      </div>
                      <div className="flex flex-col gap-1">
                        <h3 className="text-lg font-bold tracking-tight">{opt.title}</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {opt.desc}
                        </p>
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
