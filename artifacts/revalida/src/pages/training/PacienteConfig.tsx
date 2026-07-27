import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  Search,
  Clock,
  ListChecks,
  ArrowRight,
  Sparkles,
  Loader2,
  WifiOff,
  RefreshCw,
} from "lucide-react";
import { useLocation } from "wouter";
import { useTraining } from "@/contexts/TrainingContext";
import { type ChecklistSummary } from "@/lib/checklistStorage";
import { listChecklistCatalog } from "@/lib/checklistService";
import { QUICK_AREAS, type QuickArea } from "@/lib/trainingData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

export default function PacienteConfig() {
  const {
    partnerName, role, status, sessionSync, setStationConfig, startStation,
    connectionState, hasNetworkError, retryLoad, hydrateStation,
  } = useTraining();
  const [, setLocation] = useLocation();

  const [tempo, setTempo] = useState<8 | 9 | 10 | null>(null);
  const [area, setArea] = useState<QuickArea | null>(null);
  const [checklistId, setChecklistId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [allChecklists, setAllChecklists] = useState<ChecklistSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  const isRealSession = !!sessionSync.partnerId;

  useEffect(() => {
    setIsLoading(true);
    listChecklistCatalog()
      .then(setAllChecklists)
      .catch((e) => console.warn("[PacienteConfig] loadChecklists error:", e))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    if ((status === "idle" || role !== "paciente") && connectionState !== "restoring_session") {
      setLocation("/treino");
    }
  }, [status, role, connectionState, setLocation]);

  useEffect(() => {
    if (status === "waiting") {
      setLocation("/treino/espera");
    }
  }, [status, setLocation]);

  const filtered = useMemo(() => {
    if (!area) return [];
    let list = allChecklists;
    if (area !== "Aleatório") {
      list = list.filter((c) => c.grandeArea === area);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (c) =>
          c.title.toLowerCase().includes(q) || c.subarea.toLowerCase().includes(q),
      );
    }
    return list;
  }, [allChecklists, area, search]);

  const canConfirm = !!tempo && !!checklistId && !isStarting;

  const handleConfirm = async () => {
    if (!tempo || !checklistId) return;
    setIsStarting(true);
    try {
      // Fetch and cache full station details before starting.
      // Heavy exam content only enters the browser at this exact moment —
      // after the paciente has committed to the station configuration.
      const detail = await hydrateStation(checklistId);
      if (!detail) {
        setIsStarting(false);
        return;
      }

      if (isRealSession) {
        setStationConfig({ tempoMin: tempo, checklistId });
        // Navigation to /treino/espera happens via useEffect watching status==="waiting"
      } else {
        setStationConfig({ tempoMin: tempo, checklistId });
        startStation();
        setLocation("/treino/estacao");
      }
    } catch {
      setIsStarting(false);
    }
  };

  const confirmLabel = isRealSession ? "Confirmar configuração" : "Confirmar e iniciar estação";

  if (connectionState === "restoring_session") {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background text-foreground relative overflow-hidden pb-32">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(139,92,246,0.16),transparent_55%),radial-gradient(ellipse_at_bottom_left,rgba(59,130,246,0.16),transparent_55%)] pointer-events-none" />
      <div className="relative max-w-3xl mx-auto px-4 py-8 flex flex-col gap-6">
        <button
          onClick={() => setLocation("/treino/roles")}
          className="self-start inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> Voltar
        </button>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-2"
        >
          <span className="inline-flex self-start items-center gap-1.5 px-2.5 py-1 rounded-full bg-violet-500/10 text-violet-700 dark:text-violet-300 text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-3 h-3" /> Chefe da estação
          </span>
          <h1 className="text-3xl font-bold tracking-tight">Configurar a estação</h1>
          <p className="text-muted-foreground">
            Você é o paciente nesta rodada. Configure o tempo e o checklist que será aplicado
            em{" "}
            <span className="font-semibold text-foreground">{partnerName}</span>.
          </p>
          {isRealSession && (
            <p className="text-xs text-muted-foreground/70">
              Após confirmar, o médico receberá a configuração e poderá iniciar a estação.
            </p>
          )}
        </motion.div>

        {/* TEMPO */}
        <Card className="rounded-2xl p-5 border-border/60 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold">Tempo da estação</h3>
              <p className="text-xs text-muted-foreground">Duração do atendimento prático.</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[8, 9, 10].map((t) => (
              <button
                key={t}
                onClick={() => setTempo(t as 8 | 9 | 10)}
                className={`h-14 rounded-xl border-2 font-bold text-lg tabular-nums transition-all ${
                  tempo === t
                    ? "gradient-primary text-white border-transparent shadow-lg glow-primary"
                    : "border-border/60 bg-card/60 hover:bg-muted/60"
                }`}
              >
                {t} min
              </button>
            ))}
          </div>
        </Card>

        {/* ÁREA */}
        <Card className="rounded-2xl p-5 border-border/60 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold">Escolha rápida</h3>
              <p className="text-xs text-muted-foreground">
                Filtre por grande área ou escolha aleatório.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {QUICK_AREAS.map((a) => (
              <button
                key={a}
                onClick={() => {
                  setArea(a);
                  setChecklistId(null);
                }}
                className={`px-3.5 py-1.5 rounded-full text-sm font-semibold border-2 transition-all ${
                  area === a
                    ? "bg-primary text-primary-foreground border-primary shadow-md"
                    : "border-border/60 bg-card/60 text-foreground hover:bg-muted/60"
                }`}
              >
                {a}
              </button>
            ))}
          </div>
        </Card>

        {/* LISTA DE CHECKLISTS */}
        <AnimatePresence>
          {area && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
            >
              <Card className="rounded-2xl p-5 border-border/60 flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center">
                    <ListChecks className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold">Checklists disponíveis</h3>
                    <p className="text-xs text-muted-foreground">
                      {area === "Aleatório" ? "Todos os checklists" : `Filtrado por ${area}`}{" "}
                      · {filtered.length} encontrado{filtered.length === 1 ? "" : "s"}
                    </p>
                  </div>
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar por título ou subárea"
                    className="pl-9 h-11 rounded-xl"
                  />
                </div>

                <div className="flex flex-col gap-2 max-h-[420px] overflow-y-auto pr-1">
                  {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    </div>
                  ) : hasNetworkError ? (
                    <div className="flex flex-col items-center gap-3 p-6 text-center rounded-xl border border-destructive/30 bg-destructive/5">
                      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-destructive/10">
                        <WifiOff className="w-5 h-5 text-destructive" />
                      </div>
                      <div className="flex flex-col gap-1">
                        <p className="font-semibold text-sm text-foreground">Falha de conexão</p>
                        <p className="text-xs text-muted-foreground">
                          Não foi possível carregar os seus dados devido a uma falha de conexão.
                        </p>
                      </div>
                      <button
                        onClick={() => retryLoad()}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Tentar novamente
                      </button>
                    </div>
                  ) : filtered.length === 0 ? (
                    <div className="p-6 text-center text-sm text-muted-foreground border border-dashed border-border/60 rounded-xl">
                      Nenhum checklist disponível nesta categoria.
                    </div>
                  ) : (
                    filtered.map((c) => {
                      const active = checklistId === c.id;
                      return (
                        <button
                          key={c.id}
                          onClick={() => setChecklistId(c.id)}
                          className={`text-left p-4 rounded-xl border-2 transition-all ${
                            active
                              ? "border-primary bg-primary/5 shadow-md"
                              : "border-border/60 bg-card/60 hover:bg-muted/40"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="font-semibold text-sm sm:text-base leading-tight truncate">
                                {c.title}
                              </div>
                              <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-1">
                                <span>{c.grandeArea}</span>
                                {c.subarea && (
                                  <span className="opacity-70">· {c.subarea}</span>
                                )}
                                <span className="opacity-70">
                                  · {c.pepBlockCount} itens PEP
                                </span>
                              </div>
                            </div>
                            {active && (
                              <span className="shrink-0 text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-full bg-primary text-primary-foreground">
                                Selecionado
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* STICKY CONFIRM */}
      <div className="fixed bottom-0 left-0 right-0 z-30 px-4 pb-4 pt-3 bg-gradient-to-t from-background via-background/95 to-background/0 backdrop-blur-md">
        <div className="max-w-3xl mx-auto">
          <Button
            disabled={!canConfirm}
            onClick={handleConfirm}
            className="w-full h-14 rounded-2xl text-base gradient-primary text-white border-0 disabled:opacity-50 disabled:cursor-not-allowed glow-primary"
          >
            {isStarting ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Carregando estação…
              </>
            ) : (
              <>
                {confirmLabel}
                <ArrowRight className="w-5 h-5 ml-2" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
