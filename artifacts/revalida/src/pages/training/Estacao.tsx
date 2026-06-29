import { useEffect, useMemo, useRef, useState } from "react";
import { resolveImage } from "@/lib/storageService";
import { motion, AnimatePresence } from "framer-motion";
import { useLiveKitAudio } from "@/contexts/LiveKitAudioContext";
import { MicToggleButton } from "@/components/training/MicToggleButton";
import {
  Bell,
  BellOff,
  ChevronLeft,
  Lock,
  StopCircle,
  Save,
  Home,
  Eye,
  FileText,
  ListChecks,
  Loader2,
  ScrollText,
  CheckCircle2,
  CheckCheck,
  Trophy,
  PartyPopper,
  PauseCircle,
  PlayCircle,
} from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { trackEvent } from "@/lib/analyticsService";
import { useTraining, type PepResposta } from "@/contexts/TrainingContext";
import { ConnectionBanner } from "@/components/training/ConnectionBanner";
import { StationTimer } from "@/components/training/StationTimer";
import { ConnectionBadge } from "@/components/training/ConnectionBadge";
import { useAlertPreference } from "@/hooks/useAlertPreference";
import { useStationSounds } from "@/hooks/useStationSounds";
import { PepBlockInteractive } from "@/components/training/PepBlockInteractive";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

export default function Estacao() {
  const {
    role,
    status,
    partnerId,
    partnerName,
    endedAt,
    impressosLiberados,
    pepRespostas,
    liberarImpresso,
    marcarPep,
    encerrarEstacao,
    salvarEstacao,
    isSavingSession,
    exitTraining,
    getActiveChecklist,
    connectionState,
    disconnectCountdown,
    partnerDisconnected,
    remainingSec,
    isSolo,
    pauseStation,
    resumeStation,
    pausedByName,
    activeSessionId,
  } = useTraining();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const { connect, disconnect, audioState } = useLiveKitAudio();
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<"tarefas" | "impressos" | "pep">(
    role === "paciente" ? "pep" : "tarefas",
  );
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [saved, setSaved] = useState(false);
  const startTrackedRef = useRef(false);
  const audioConnectedRef = useRef(false);

  // Alert preference & sounds
  const { alertsEnabled, toggleAlerts } = useAlertPreference();
  const { play } = useStationSounds(alertsEnabled);
  const soundStartedRef = useRef(false);
  const sound60Ref = useRef(false);
  const soundTimeupRef = useRef(false);

  const checklist = getActiveChecklist();

  // Aguarda recovery antes de redirecionar para evitar flash no refresh
  useEffect(() => {
    if (status === "idle" && connectionState !== "restoring_session") {
      setLocation("/treino");
    }
  }, [status, connectionState, setLocation]);

  // Connect to LiveKit audio — seamless from espera, or re-join after hard refresh.
  // Hard-refresh guard: wait until session is fully restored before fetching token.
  useEffect(() => {
    const isRealSession =
      activeSessionId &&
      partnerId &&
      !partnerId.startsWith("u-") &&
      partnerId !== "__solo__" &&
      connectionState !== "restoring_session";

    if (!isRealSession || audioConnectedRef.current) return;
    if (audioState === "connecting" || audioState === "connected") {
      // Already connected (from MedicoEspera) — mark ref so we don't reconnect
      audioConnectedRef.current = true;
      return;
    }

    audioConnectedRef.current = true;
    const participantName =
      user?.displayName ||
      user?.name ||
      user?.email ||
      "Participante";

    void connect(activeSessionId, participantName);
  }, [activeSessionId, partnerId, connectionState, audioState, connect, user]);

  useEffect(() => {
    if (status === "ended" && role === "medico") {
      setTab("pep");
    }
  }, [status, role]);

  // Analytics: registrar início da sessão uma única vez
  useEffect(() => {
    if (status === "running" && userId && !startTrackedRef.current) {
      startTrackedRef.current = true;
      trackEvent(userId, "session_started", "estação", {
        role: role ?? undefined,
        checklist: checklist?.title,
      });
    }
  }, [status, userId, role, checklist]);

  // ── Sound effects ───────────────────────────────────────────────────────────

  // Station start — plays once when status becomes "running"
  useEffect(() => {
    if (status === "running" && !soundStartedRef.current) {
      soundStartedRef.current = true;
      play("start");
    }
    if (status !== "running" && status !== "ended") {
      soundStartedRef.current = false;
      sound60Ref.current = false;
    }
  }, [status, play]);

  // Last 60s warning — plays once when timer crosses 60 s
  useEffect(() => {
    if (
      status === "running" &&
      remainingSec <= 60 &&
      remainingSec > 0 &&
      !sound60Ref.current
    ) {
      sound60Ref.current = true;
      play("warning60");
    }
  }, [status, remainingSec, play]);

  // Time-up — plays when the timer reaches 0 naturally (not manual encerrar)
  useEffect(() => {
    if (status === "ended" && remainingSec === 0 && !soundTimeupRef.current) {
      soundTimeupRef.current = true;
      play("timeup");
    }
    if (status !== "ended") {
      soundTimeupRef.current = false;
    }
  }, [status, remainingSec, play]);

  const { notaTotal, notaMaxima } = useMemo(() => {
    if (!checklist) return { notaTotal: 0, notaMaxima: 0 };
    let total = 0;
    let max = 0;
    for (const block of checklist.pepBlocks) {
      max += Math.max(block.scoreAdequado, block.scoreParcial, 0);
      const r = pepRespostas[block.id];
      if (r === "adequado") total += block.scoreAdequado;
      else if (r === "parcial") total += block.scoreParcial;
    }
    return {
      notaTotal: Math.round(total * 100) / 100,
      notaMaxima: Math.round(max * 100) / 100,
    };
  }, [checklist, pepRespostas]);

  // Bloquear render e redirects enquanto o recovery ainda não concluiu
  if (connectionState === "restoring_session") {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!checklist || !role) return null;

  const isMedico = role === "medico";
  const isPaciente = role === "paciente";
  const ended = status === "ended";
  // In solo mode PEP is always unlocked — the user self-evaluates in real time
  const pepLockedForMedico = isMedico && !ended && !isSolo;
  // Solo mode: bypass the "liberar" flow — all station materials are immediately available.
  const effectiveLiberados = isMedico && isSolo
    ? checklist.impressos.map((i) => i.id)
    : impressosLiberados;

  const handleEncerrar = () => {
    play("end");
    encerrarEstacao();
    setConfirmEnd(false);
    toast.info("Estação encerrada");
    // Disconnect audio gracefully when station ends
    disconnect();
  };

  const handleSalvar = () => {
    trackEvent(userId, "session_completed", "pós-estação", {
      role: role ?? undefined,
      checklist: checklist?.title,
    });
    salvarEstacao();
    setSaved(true);
    toast.success("Estação salva no histórico");
  };

  const handleExit = () => {
    if (!saved) {
      trackEvent(userId, "session_abandoned", ended ? "pós-estação" : "durante-estação", {
        role: role ?? undefined,
        checklist: checklist?.title,
      });
    }
    disconnect();
    exitTraining();
    setLocation("/inicio");
  };

  const liberadosCount = effectiveLiberados.length;
  const totalImpressos = checklist.impressos.length;

  return (
    <div className="min-h-[100dvh] bg-background text-foreground relative">
      {/* TOP BAR */}
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-background/80 border-b border-border/60">
        <div className="max-w-5xl mx-auto px-3 sm:px-4 py-3 flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => {
              if (ended) {
                handleExit();
              } else {
                setConfirmEnd(true);
              }
            }}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
            aria-label="Voltar"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          {/* Desktop title + persistent connection badge */}
          <div className="hidden sm:flex flex-col min-w-0 flex-1">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
              {isSolo
                ? `Modo solo · ${isMedico ? "médico" : "paciente"}`
                : `${isMedico ? "Você é o médico" : "Você é o paciente"} · com ${partnerName}`}
            </span>
            <div className="flex items-center gap-2 min-w-0">
              {isMedico && !isSolo ? (
                <span className="text-sm font-semibold truncate text-muted-foreground/60 italic select-none">
                  Estação em andamento…
                </span>
              ) : (
                <span className="text-sm font-bold truncate">{checklist.title}</span>
              )}
              {!isSolo && (
                <ConnectionBadge state={connectionState} className="shrink-0" />
              )}
            </div>
          </div>

          <div className="flex-1 sm:hidden" />

          {/* Last-minute badge — desktop only */}
          <AnimatePresence>
            {status === "running" &&
              remainingSec <= 60 &&
              alertsEnabled &&
              !partnerDisconnected && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className={`hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-bold shrink-0 ${
                    remainingSec <= 15
                      ? "bg-red-500/15 text-red-700 dark:text-red-300"
                      : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                  }`}
                >
                  {remainingSec <= 15 ? "⚡ Encerrando" : "⏱ Último minuto"}
                </motion.span>
              )}
          </AnimatePresence>

          <StationTimer />

          {/* Alert preference toggle */}
          <button
            onClick={toggleAlerts}
            className={`p-2 rounded-lg hover:bg-muted transition-colors ${
              alertsEnabled ? "text-foreground" : "text-muted-foreground/40"
            }`}
            title={alertsEnabled ? "Silenciar alertas finais" : "Ativar alertas finais"}
            aria-label={alertsEnabled ? "Silenciar alertas finais" : "Ativar alertas finais"}
          >
            {alertsEnabled ? (
              <Bell className="w-4 h-4" />
            ) : (
              <BellOff className="w-4 h-4" />
            )}
          </button>

          {/* Pause / Resume — multiplayer only, not solo, not ended */}
          {!ended && !isSolo && (status === "running" || status === "paused_manual") && (
            <Button
              variant="outline"
              size="sm"
              onClick={status === "running" ? pauseStation : resumeStation}
              className={`rounded-xl ${
                status === "paused_manual"
                  ? "border-blue-300/60 text-blue-600 dark:text-blue-300 hover:bg-blue-500/10"
                  : "border-amber-300/60 text-amber-600 dark:text-amber-300 hover:bg-amber-500/10"
              }`}
            >
              {status === "paused_manual" ? (
                <>
                  <PlayCircle className="w-4 h-4 sm:mr-1.5" />
                  <span className="hidden sm:inline">Retomar</span>
                </>
              ) : (
                <>
                  <PauseCircle className="w-4 h-4 sm:mr-1.5" />
                  <span className="hidden sm:inline">Pausar</span>
                </>
              )}
            </Button>
          )}

          {!ended && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmEnd(true)}
              className="rounded-xl border-rose-300/60 text-rose-600 dark:text-rose-300 hover:bg-rose-500/10"
            >
              <StopCircle className="w-4 h-4 sm:mr-1.5" />
              <span className="hidden sm:inline">Encerrar</span>
            </Button>
          )}
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-3 sm:px-4 py-4 sm:py-6 pb-40">
        {/* CONNECTION BANNER — hidden in solo mode */}
        {!isSolo && (
          <ConnectionBanner
            state={connectionState}
            partnerName={partnerName}
            disconnectCountdown={disconnectCountdown}
            onAbandon={() => {
              encerrarEstacao();
              toast.info("Sessão encerrada por abandono do parceiro");
            }}
          />
        )}
        {/* MANUAL PAUSE BANNER */}
        <AnimatePresence>
          {status === "paused_manual" && (
            <motion.div
              key="paused-banner"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-4 rounded-2xl backdrop-blur-md border border-blue-300/40 bg-blue-500/10 p-4 sm:p-5 flex items-center gap-3"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-600 dark:text-blue-300 flex items-center justify-center shrink-0">
                <PauseCircle className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-blue-800 dark:text-blue-200">
                  {pausedByName ? `${pausedByName} pausou a estação` : "Estação pausada"}
                </h3>
                <p className="text-sm text-blue-700/80 dark:text-blue-200/80 leading-snug">
                  O cronômetro está congelado. Clique em Retomar para continuar.
                </p>
              </div>
              <Button
                size="sm"
                onClick={resumeStation}
                className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white shrink-0"
              >
                <PlayCircle className="w-4 h-4 mr-1.5" />
                Retomar
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ENDED BANNER */}
        <AnimatePresence>
          {ended && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 rounded-2xl backdrop-blur-md border border-emerald-300/40 bg-emerald-500/10 p-4 sm:p-5 flex items-center gap-3"
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 flex items-center justify-center shrink-0">
                <PartyPopper className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-emerald-800 dark:text-emerald-200">Estação encerrada</h3>
                <p className="text-sm text-emerald-700/80 dark:text-emerald-200/80 leading-snug">
                  {isMedico
                    ? "PEP desbloqueado. Veja a avaliação registrada pelo paciente."
                    : "Boa estação! Confira a pontuação final e salve no histórico."}
                </p>
              </div>
              <div className="hidden sm:flex flex-col items-end shrink-0">
                <span className="text-xl font-extrabold tabular-nums text-emerald-700 dark:text-emerald-200">
                  {notaTotal.toFixed(2)}
                </span>
                <span className="text-[10px] uppercase tracking-wider font-bold text-emerald-700/70 dark:text-emerald-200/70">
                  de {notaMaxima.toFixed(2)} pts
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList className="w-full grid grid-cols-3 h-12 rounded-xl backdrop-blur-md bg-card/60 border border-border/60 p-1">
            <TabsTrigger value="tarefas" className="rounded-lg gap-1.5">
              <FileText className="w-4 h-4" />
              <span>Tarefas</span>
            </TabsTrigger>
            <TabsTrigger value="impressos" className="rounded-lg gap-1.5 relative">
              <ListChecks className="w-4 h-4" />
              <span>Impressos</span>
              {liberadosCount > 0 && (
                <span className="ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-700 dark:text-blue-300 tabular-nums">
                  {liberadosCount}/{totalImpressos}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="pep" className="rounded-lg gap-1.5">
              {pepLockedForMedico ? <Lock className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
              <span>PEP</span>
            </TabsTrigger>
          </TabsList>

          {/* TAREFAS */}
          <TabsContent value="tarefas" className="mt-5 focus-visible:outline-none">
            <div className="flex flex-col gap-4">
              <SectionCard icon={<Eye className="w-4 h-4" />} title="Cenário de atuação" tone="blue">
                <p className="whitespace-pre-line text-sm leading-relaxed">{checklist.cenarioAtuacao}</p>
              </SectionCard>
              <SectionCard icon={<FileText className="w-4 h-4" />} title="Descrição do caso" tone="violet">
                <p className="whitespace-pre-line text-sm leading-relaxed">{checklist.descricaoCaso}</p>
              </SectionCard>
              <SectionCard icon={<CheckCheck className="w-4 h-4" />} title="Tarefas" tone="emerald">
                <p className="whitespace-pre-line text-sm leading-relaxed">{checklist.tarefas}</p>
              </SectionCard>
              {isPaciente && (
                <p className="text-xs text-muted-foreground italic">
                  Esta aba serve como referência. Sua aba principal é o PEP.
                </p>
              )}
            </div>
          </TabsContent>

          {/* IMPRESSOS */}
          <TabsContent value="impressos" className="mt-5 focus-visible:outline-none">
            {isMedico ? (
              <ImpressosMedico
                checklist={checklist}
                liberados={effectiveLiberados}
              />
            ) : (
              <ImpressosPaciente
                checklist={checklist}
                liberados={impressosLiberados}
                onLiberar={liberarImpresso}
                disabled={ended}
              />
            )}
          </TabsContent>

          {/* PEP */}
          <TabsContent value="pep" className="mt-5 focus-visible:outline-none">
            {pepLockedForMedico ? (
              <div className="flex flex-col gap-4">
                <div className="rounded-2xl border border-dashed border-border/60 bg-card/40 backdrop-blur-md p-10 flex flex-col items-center text-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
                    <Lock className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <h3 className="font-bold text-lg">PEP bloqueado</h3>
                  <p className="text-sm text-muted-foreground max-w-md">
                    O Padrão Esperado de Procedimento será liberado quando a estação encerrar. Foque no atendimento por enquanto.
                  </p>
                </div>
                {notaMaxima > 0 && (
                  <div className="rounded-2xl backdrop-blur-md bg-card/70 border border-border/60 p-4 flex items-center gap-4 shadow-sm">
                    <div className="w-11 h-11 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-300 flex items-center justify-center shrink-0">
                      <Trophy className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Nota parcial (tempo real)</div>
                      <div className="mt-1 h-1.5 w-full bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full gradient-primary transition-all"
                          style={{ width: `${Math.min(100, notaMaxima > 0 ? (notaTotal / notaMaxima) * 100 : 0)}%` }}
                        />
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-xl font-extrabold tabular-nums text-gradient-primary">
                        {notaTotal.toFixed(2)}
                      </span>
                      <span className="text-xs text-muted-foreground tabular-nums ml-1">
                        / {notaMaxima.toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ) : isPaciente ? (
              <PacientePep
                checklist={checklist}
                pepRespostas={pepRespostas}
                onMark={marcarPep}
                notaTotal={notaTotal}
                notaMaxima={notaMaxima}
                ended={ended}
              />
            ) : (
              <MedicoPepUnlocked
                checklist={checklist}
                pepRespostas={pepRespostas}
                notaTotal={notaTotal}
                notaMaxima={notaMaxima}
              />
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* BOTTOM BAR — médico vê "Salvar"; paciente vê só "Voltar" */}
      {ended && (
        <motion.div
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="fixed bottom-0 inset-x-0 z-30 px-3 pb-4 pt-3 bg-gradient-to-t from-background via-background/95 to-background/0 backdrop-blur-md"
        >
          <div className={`max-w-5xl mx-auto ${isMedico && !isSolo ? "grid grid-cols-2 gap-3" : "flex"}`}>
            <Button
              variant="outline"
              onClick={handleExit}
              className="h-12 rounded-xl flex-1"
            >
              <Home className="w-4 h-4 mr-2" /> Voltar ao início
            </Button>
            {isMedico && !isSolo && (
              <Button
                onClick={handleSalvar}
                disabled={saved || isSavingSession}
                className="h-12 rounded-xl gradient-primary text-white border-0 glow-primary disabled:opacity-70"
              >
                {isSavingSession ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                {saved ? "Salvo no histórico" : isSavingSession ? "Calculando nota..." : "Salvar estação"}
              </Button>
            )}
          </div>
        </motion.div>
      )}

      {/* CONFIRM ENCERRAR */}
      <AlertDialog open={confirmEnd} onOpenChange={setConfirmEnd}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Encerrar a estação agora?</AlertDialogTitle>
            <AlertDialogDescription>
              Ao encerrar, o cronômetro para e o PEP é liberado para o médico. Não é possível continuar a estação depois.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleEncerrar}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              Encerrar agora
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Floating mic toggle — only for real multiplayer sessions */}
      {!isSolo && !ended && (
        <div className="fixed bottom-6 right-6 z-50">
          <MicToggleButton />
        </div>
      )}
    </div>
  );
}

function SectionCard({
  icon,
  title,
  tone,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  tone: "blue" | "violet" | "emerald" | "amber";
  children: React.ReactNode;
}) {
  const toneMap = {
    blue: "bg-blue-500/10 text-blue-600 dark:text-blue-300",
    violet: "bg-violet-500/10 text-violet-600 dark:text-violet-300",
    emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
    amber: "bg-amber-500/10 text-amber-600 dark:text-amber-300",
  };
  return (
    <div className="rounded-2xl border border-border/60 bg-card/70 backdrop-blur-md p-4 sm:p-5 flex flex-col gap-3 shadow-sm">
      <div className="flex items-center gap-2">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${toneMap[tone]}`}>{icon}</div>
        <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">{title}</h3>
      </div>
      <div className="text-foreground">{children}</div>
    </div>
  );
}

function ImpressosMedico({
  checklist,
  liberados,
}: {
  checklist: ReturnType<typeof useTraining>["getActiveChecklist"] extends () => infer R ? NonNullable<R> : never;
  liberados: string[];
}) {
  const items = checklist.impressos.filter((i) => liberados.includes(i.id));
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/60 bg-card/40 backdrop-blur-md p-10 flex flex-col items-center text-center gap-3">
        <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
          <ScrollText className="w-6 h-6 text-muted-foreground" />
        </div>
        <h3 className="font-bold text-lg">Nenhum impresso disponível</h3>
        <p className="text-sm text-muted-foreground max-w-md">
          Os exames e documentos serão liberados pelo paciente conforme você os solicitar durante o atendimento.
        </p>
      </div>
    );
  }
  return (
    <Accordion type="multiple" defaultValue={items.map((i) => i.id)} className="space-y-3">
      {items.map((it) => (
        <AccordionItem
          key={it.id}
          value={it.id}
          className="border border-border/60 rounded-2xl bg-card/70 backdrop-blur-md px-4 overflow-hidden"
        >
          <AccordionTrigger className="hover:no-underline py-3">
            <div className="flex items-center gap-3 text-left">
              <span className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-300 flex items-center justify-center shrink-0">
                <ScrollText className="w-4 h-4" />
              </span>
              <span className="font-semibold">{it.titulo}</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            {it.tipo === "imagem" ? (
              <img
                src={resolveImage(it.conteudo, "resumos-media")}
                alt={it.titulo}
                className="w-full max-h-[420px] object-contain rounded-xl border border-border/60"
              />
            ) : (
              <div className="rounded-xl bg-muted/40 p-4 text-sm whitespace-pre-line leading-relaxed">
                {it.conteudo}
              </div>
            )}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

function ImpressosPaciente({
  checklist,
  liberados,
  onLiberar,
  disabled,
}: {
  checklist: ReturnType<typeof useTraining>["getActiveChecklist"] extends () => infer R ? NonNullable<R> : never;
  liberados: string[];
  onLiberar: (id: string) => void;
  disabled: boolean;
}) {
  if (checklist.impressos.length === 0) {
    return (
      <div className="text-center text-sm text-muted-foreground p-8 border border-dashed border-border/60 rounded-2xl">
        Esta estação não possui impressos.
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground italic">
        Libere os impressos solicitados pelo médico. Eles aparecerão imediatamente para ele.
      </p>
      {checklist.impressos.map((it) => {
        const liberado = liberados.includes(it.id);
        return (
          <div
            key={it.id}
            className={`flex items-center gap-3 p-4 rounded-2xl border transition-all ${
              liberado
                ? "border-emerald-300/40 bg-emerald-500/5 backdrop-blur-md"
                : "border-border/60 bg-card/70 backdrop-blur-md"
            }`}
          >
            <span
              className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                liberado
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
                  : "bg-blue-500/10 text-blue-600 dark:text-blue-300"
              }`}
            >
              {liberado ? <CheckCircle2 className="w-4 h-4" /> : <ScrollText className="w-4 h-4" />}
            </span>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm sm:text-base truncate">{it.titulo}</div>
              <div className="text-xs text-muted-foreground capitalize">{it.tipo}</div>
            </div>
            {liberado ? (
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 px-2 py-1 rounded-full bg-emerald-500/10">
                Liberado
              </span>
            ) : (
              <Button
                size="sm"
                onClick={() => onLiberar(it.id)}
                disabled={disabled}
                className="rounded-xl"
              >
                Liberar
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}

function PacientePep({
  checklist,
  pepRespostas,
  onMark,
  notaTotal,
  notaMaxima,
  ended,
}: {
  checklist: ReturnType<typeof useTraining>["getActiveChecklist"] extends () => infer R ? NonNullable<R> : never;
  pepRespostas: Record<string, PepResposta>;
  onMark: (id: string, r: PepResposta) => void;
  notaTotal: number;
  notaMaxima: number;
  ended: boolean;
}) {
  const respondidos = Object.keys(pepRespostas).length;
  const totalBlocos = checklist.pepBlocks.length;
  const pct = notaMaxima > 0 ? (notaTotal / notaMaxima) * 100 : 0;

  return (
    <div className={`flex flex-col gap-4 ${ended ? "pb-24" : "pb-32"}`}>
      {/* ROTEIRO */}
      <div className="rounded-2xl backdrop-blur-md bg-gradient-to-br from-violet-500/10 via-blue-500/5 to-cyan-500/10 border border-violet-300/30 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-7 h-7 rounded-lg bg-white/40 dark:bg-white/10 text-violet-700 dark:text-violet-200 flex items-center justify-center">
            <ScrollText className="w-4 h-4" />
          </div>
          <h3 className="font-bold text-sm uppercase tracking-wider text-violet-700 dark:text-violet-200">
            Roteiro do paciente
          </h3>
        </div>
        <div className="max-h-64 overflow-y-auto pr-1">
          <p className="text-sm leading-relaxed whitespace-pre-line text-foreground">
            {checklist.roteiroPaciente || "Sem roteiro definido para esta estação."}
          </p>
        </div>
      </div>

      {/* PEP BLOCKS */}
      <div className="flex flex-col gap-3">
        {checklist.pepBlocks.length === 0 && (
          <div className="text-center text-sm text-muted-foreground p-8 border border-dashed border-border/60 rounded-2xl">
            Este checklist ainda não possui itens PEP.
          </div>
        )}
        {checklist.pepBlocks.map((block, idx) => (
          <PepBlockInteractive
            key={block.id}
            index={idx}
            block={block}
            current={pepRespostas[block.id]}
            onMark={(r) => onMark(block.id, r)}
            readOnly={ended}
          />
        ))}
      </div>

      {/* SCORE — flutuante durante a sessão, inline quando encerrada */}
      <div className={ended ? "" : "fixed bottom-4 inset-x-0 z-20 px-4 pointer-events-none"}>
        <div className={ended ? "" : "max-w-5xl mx-auto pointer-events-auto"}>
          <motion.div
            layout
            className="rounded-2xl backdrop-blur-xl bg-card/90 border border-border/60 shadow-2xl p-4 flex items-center gap-4"
          >
            <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center text-white shrink-0 glow-primary">
              <Trophy className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-xs uppercase tracking-wider font-bold text-muted-foreground">Nota total</span>
                <span className="text-2xl font-extrabold tabular-nums text-gradient-primary">
                  {notaTotal.toFixed(2)}
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  / {notaMaxima.toFixed(2)}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 w-full bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full gradient-primary transition-all"
                  style={{ width: `${Math.min(100, pct)}%` }}
                />
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground tabular-nums">
                {respondidos} de {totalBlocos} itens avaliados
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

function MedicoPepUnlocked({
  checklist,
  pepRespostas,
  notaTotal,
  notaMaxima,
}: {
  checklist: ReturnType<typeof useTraining>["getActiveChecklist"] extends () => infer R ? NonNullable<R> : never;
  pepRespostas: Record<string, PepResposta>;
  notaTotal: number;
  notaMaxima: number;
}) {
  const pct = notaMaxima > 0 ? (notaTotal / notaMaxima) * 100 : 0;
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl backdrop-blur-md bg-gradient-to-br from-emerald-500/10 via-cyan-500/5 to-blue-500/10 border border-emerald-300/30 p-5 flex items-center gap-4 shadow-sm">
        <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center text-white glow-primary shrink-0">
          <Trophy className="w-6 h-6" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs uppercase tracking-wider font-bold text-muted-foreground">Avaliação registrada</div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tabular-nums text-gradient-primary">{notaTotal.toFixed(2)}</span>
            <span className="text-sm text-muted-foreground tabular-nums">/ {notaMaxima.toFixed(2)}</span>
          </div>
          <div className="mt-2 h-1.5 w-full bg-muted rounded-full overflow-hidden">
            <div className="h-full rounded-full gradient-primary" style={{ width: `${Math.min(100, pct)}%` }} />
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-3">
        {checklist.pepBlocks.map((block, idx) => (
          <PepBlockInteractive
            key={block.id}
            index={idx}
            block={block}
            current={pepRespostas[block.id]}
            onMark={() => {}}
            readOnly
          />
        ))}
      </div>
    </div>
  );
}
