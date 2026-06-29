/**
 * EventoDetalhes.tsx
 *
 * FASE EVENTOS 1E — Claim real de recompensas de eventos.
 * Rota: /conquistas/evento/:id
 *
 * Somente leitura.
 * Progresso lido de user_mission_progress via fetchEventMissionProgress.
 * Nenhuma escrita, nenhum recálculo, nenhum engine alterado.
 * Zero queries extras — EventSummaryCard usa apenas dados já carregados.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  ChevronLeft,
  Calendar,
  Clock,
  Target,
  Gift,
  Loader2,
  PartyPopper,
  Zap,
  Star,
  Trophy,
  CheckCircle2,
  CheckCheck,
  Lock,
  Sparkles,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { TitleBadge } from "@/components/gamification/TitleBadge";
import { grantXp } from "@/lib/gamificationService";
import { unlockTitle } from "@/lib/titleService";
import {
  fetchEventById,
  fetchEventMissions,
  fetchEventRewards,
  fetchEventMissionProgress,
  fetchUserEventClaims,
  claimEventReward,
  type DbEvent,
  type EventMissionRow,
  type EventRewardWithTitle,
  type EventProgressMap,
} from "@/lib/eventService";
import { getRemainingTime, formatEventDate } from "@/lib/eventCountdown";
import type { MissionRarity } from "@/lib/missionService";

// ── Constantes ────────────────────────────────────────────────────────────────

const MIN_PROGRESS_REFETCH_MS = 2500;

// ── Helpers visuais ──────────────────────────────────────────────────────────

const RARITY_STYLE: Record<MissionRarity, string> = {
  common:    "bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-400/30",
  rare:      "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-400/30",
  epic:      "bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-400/30",
  legendary: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-400/30",
  exclusive: "bg-pink-500/15 text-pink-600 dark:text-pink-400 border-pink-400/30",
  event:     "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-400/30",
};

const RARITY_LABEL: Record<MissionRarity, string> = {
  common:    "Comum",
  rare:      "Raro",
  epic:      "Épico",
  legendary: "Lendário",
  exclusive: "Exclusivo",
  event:     "Evento",
};

const REWARD_TYPE_LABEL: Record<string, string> = {
  xp:    "XP",
  title: "Título",
  badge: "Badge",
};

const REWARD_TYPE_ICON: Record<string, React.ReactNode> = {
  xp:    <Zap className="w-4 h-4 text-amber-400" />,
  title: <Trophy className="w-4 h-4 text-violet-400" />,
  badge: <Star className="w-4 h-4 text-blue-400" />,
};

// ── Skeleton de missão ────────────────────────────────────────────────────────

function MissionSkeleton() {
  return (
    <Card className="rounded-2xl border-border/50 bg-muted/20 p-4 flex items-start gap-3">
      <div className="w-9 h-9 rounded-xl bg-muted/60 animate-pulse shrink-0" />
      <div className="flex-1 space-y-2 pt-0.5">
        <div className="h-3 bg-muted/60 animate-pulse rounded-full w-3/4" />
        <div className="h-2.5 bg-muted/60 animate-pulse rounded-full w-full" />
        <div className="h-2 bg-muted/60 animate-pulse rounded-full w-1/2" />
        <div className="h-1.5 bg-muted/40 animate-pulse rounded-full w-full mt-1" />
      </div>
    </Card>
  );
}

// ── Card de missão com progresso ──────────────────────────────────────────────

interface MissionCardProps {
  row: EventMissionRow;
  progressMap: EventProgressMap | null;
  progressLoading: boolean;
}

function MissionCard({ row, progressMap, progressLoading }: MissionCardProps) {
  const m = row.mission;
  if (!m) return null;

  const pr = progressMap?.get(row.mission_id) ?? null;

  const pct = pr
    ? Math.min(100, pr.target > 0 ? Math.round((pr.progress / pr.target) * 100) : 0)
    : 0;

  return (
    <Card className="rounded-2xl border-border/50 bg-muted/20 p-4 flex items-start gap-3">
      {/* Ícone */}
      <div
        className={[
          "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
          pr?.claimed
            ? "bg-gradient-to-br from-emerald-500/30 to-teal-500/20 border border-emerald-400/30"
            : pr?.completed
              ? "bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-400/20"
              : "bg-gradient-to-br from-emerald-500/15 to-teal-500/5 border border-emerald-400/10",
        ].join(" ")}
      >
        {pr?.claimed ? (
          <CheckCheck className="w-4 h-4 text-emerald-500" />
        ) : pr?.completed ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
        ) : (
          <Target className="w-4 h-4 text-emerald-500" />
        )}
      </div>

      {/* Conteúdo */}
      <div className="flex-1 min-w-0">
        {/* Nome + raridade */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-sm">{m.name}</span>
          <span
            className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${RARITY_STYLE[m.rarity]}`}
          >
            {RARITY_LABEL[m.rarity]}
          </span>
        </div>

        {/* Descrição */}
        <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
          {m.description}
        </p>

        {/* XP */}
        <div className="flex items-center gap-1 mt-1.5">
          <Zap className="w-3 h-3 text-amber-400" />
          <span className="text-xs font-bold text-amber-500 dark:text-amber-400">
            +{m.xp_reward} XP
          </span>
        </div>

        {/* Progresso */}
        <div className="mt-2.5">
          {progressLoading && pr === null ? (
            <div className="space-y-1.5">
              <div className="h-1.5 bg-muted/60 animate-pulse rounded-full w-full" />
              <div className="h-2 bg-muted/60 animate-pulse rounded-full w-16" />
            </div>
          ) : pr?.claimed ? (
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
              <CheckCheck className="w-3.5 h-3.5" />
              Recompensa Resgatada
            </div>
          ) : pr?.completed ? (
            <div className="space-y-1">
              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div className="h-full w-full rounded-full bg-emerald-500" />
              </div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Concluída
              </div>
            </div>
          ) : pr ? (
            <div className="space-y-1">
              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  className="h-full rounded-full bg-primary"
                />
              </div>
              <div className="text-xs font-semibold text-muted-foreground">
                {pr.progress}/{pr.target}
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div className="h-full w-0 rounded-full bg-primary" />
              </div>
              <div className="text-xs font-semibold text-muted-foreground">0/{m.trigger_value || "—"}</div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

// ── Card Resumo Geral do Evento (FASE 1C) ─────────────────────────────────────

interface EventSummaryCardProps {
  missions:       EventMissionRow[];
  progressMap:    EventProgressMap | null;
  progressLoading: boolean;
  rewards:        EventRewardWithTitle[];
}

function EventSummaryCard({
  missions,
  progressMap,
  progressLoading,
  rewards,
}: EventSummaryCardProps) {
  const total     = missions.length;
  const completed = missions.filter(
    (r) => r.mission && progressMap?.get(r.mission_id)?.completed,
  ).length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  // Derivado de rewards (já carregado)
  const totalXp     = rewards
    .filter((r) => r.reward_type === "xp")
    .reduce((sum, r) => sum + Number(r.reward_value || 0), 0);
  const titlesCount = rewards.filter((r) => r.reward_type === "title").length;
  const badgesCount = rewards.filter((r) => r.reward_type === "badge").length;
  const hasRewards  = totalXp > 0 || titlesCount > 0 || badgesCount > 0;

  // Estado de loading inicial (antes do primeiro fetch de progresso)
  const isInitialLoad = progressLoading && progressMap === null;

  if (total === 0) {
    return (
      <Card className="rounded-2xl border-dashed border-border/50 bg-muted/20 p-5 flex flex-col gap-1 text-center">
        <p className="text-sm font-semibold text-muted-foreground">
          Nenhuma missão vinculada ao evento ainda.
        </p>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl border-border/50 bg-gradient-to-br from-muted/40 to-muted/20 p-5 flex flex-col gap-4">
      {/* Cabeçalho — percentual + contador */}
      <div className="flex items-end justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Progresso geral
          </span>
          {isInitialLoad ? (
            <div className="h-7 w-16 bg-muted/60 animate-pulse rounded-lg" />
          ) : (
            <span className="text-3xl font-extrabold tabular-nums leading-none">
              {pct}%
            </span>
          )}
        </div>

        {isInitialLoad ? (
          <div className="h-4 w-28 bg-muted/60 animate-pulse rounded-full" />
        ) : (
          <span className="text-sm font-semibold text-muted-foreground pb-0.5">
            {completed} de {total} concluída{total !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Barra de progresso */}
      {isInitialLoad ? (
        <div className="h-2.5 bg-muted/60 animate-pulse rounded-full w-full" />
      ) : (
        <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className={[
              "h-full rounded-full",
              pct === 100
                ? "bg-emerald-500"
                : "bg-gradient-to-r from-primary to-primary/70",
            ].join(" ")}
          />
        </div>
      )}

      {/* Recompensas do evento — só mostra se existirem */}
      {hasRewards && (
        <div className="border-t border-border/40 pt-3 flex flex-wrap gap-x-4 gap-y-1.5">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground w-full">
            Recompensas
          </span>
          {totalXp > 0 && (
            <div className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-sm font-bold text-amber-500 dark:text-amber-400">
                {totalXp} XP
              </span>
            </div>
          )}
          {titlesCount > 0 && (
            <div className="flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5 text-violet-400" />
              <span className="text-sm font-bold text-violet-500 dark:text-violet-400">
                {titlesCount} título{titlesCount !== 1 ? "s" : ""}
              </span>
            </div>
          )}
          {badgesCount > 0 && (
            <div className="flex items-center gap-1.5">
              <Star className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-sm font-bold text-blue-500 dark:text-blue-400">
                {badgesCount} badge{badgesCount !== 1 ? "s" : ""}
              </span>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

// ── Componente principal ─────────────────────────────────────────────────────

export default function EventoDetalhes() {
  const [, params]   = useRoute("/conquistas/evento/:id");
  const [, setLocation] = useLocation();
  const { user }     = useAuth();
  const id           = params?.id ?? null;
  const userId       = user?.id ?? null;

  // ── Dados do evento (one-time) ───────────────────────────────────────────────
  const [event,    setEvent]   = useState<DbEvent | null>(null);
  const [missions, setMissions] = useState<EventMissionRow[]>([]);
  const [rewards,  setRewards]  = useState<EventRewardWithTitle[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(false);

  // ── Progresso (reativo) ──────────────────────────────────────────────────────
  const [progressMap,     setProgressMap]     = useState<EventProgressMap | null>(null);
  const [progressLoading, setProgressLoading] = useState(false);
  const inflightRef     = useRef(false);
  const lastFetchRef    = useRef(0);
  const fetchVersionRef = useRef(0);

  // ── Claims de recompensas ─────────────────────────────────────────────────────
  const [claimedIds,  setClaimedIds]  = useState<Set<string>>(new Set());
  const [claimingId,  setClaimingId]  = useState<string | null>(null);

  // ── Countdown ────────────────────────────────────────────────────────────────
  const [, setTick] = useState(0);

  // ── Carrega evento + missões + recompensas (paralelo, one-time) ───────────────
  useEffect(() => {
    if (!id) { setError(true); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    setError(false);

    Promise.all([
      fetchEventById(id),
      fetchEventMissions(id),
      fetchEventRewards(id),
    ])
      .then(([ev, ms, rs]) => {
        if (cancelled) return;
        setEvent(ev);
        setMissions(ms);
        setRewards(rs);
      })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [id]);

  // ── Refresh de progresso (com guards anti-loop, debounce e inflight) ─────────
  const refreshProgress = useCallback(async (reason: string) => {
    if (!userId || !id) return;
    if (inflightRef.current) return;
    const now = Date.now();
    if (now - lastFetchRef.current < MIN_PROGRESS_REFETCH_MS) return;

    inflightRef.current = true;
    const myVersion = ++fetchVersionRef.current;
    setProgressLoading(true);

    try {
      const [map, claimedSet] = await Promise.all([
        fetchEventMissionProgress(userId, id),
        fetchUserEventClaims(userId, id),
      ]);
      if (fetchVersionRef.current === myVersion) {
        setProgressMap(map);
        setClaimedIds(claimedSet);
        lastFetchRef.current = Date.now();
      }
    } catch {
      // silencioso — mantém estados anteriores
    } finally {
      if (fetchVersionRef.current === myVersion) {
        inflightRef.current = false;
        setProgressLoading(false);
      }
    }
  }, [userId, id]);

  // Mount
  useEffect(() => {
    refreshProgress("mount");
  }, [refreshProgress]);

  // Listeners reativos: visibilitychange, focus, missions-updated
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible") refreshProgress("visibility");
    };
    const onFocus           = () => refreshProgress("focus");
    const onMissionsUpdated = () => refreshProgress("missions-updated");

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    window.addEventListener("missions-updated", onMissionsUpdated);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("missions-updated", onMissionsUpdated);
    };
  }, [refreshProgress]);

  // ── Claim de recompensa ──────────────────────────────────────────────────────
  const handleClaim = useCallback(async (rw: EventRewardWithTitle) => {
    if (!userId) return;
    if (claimedIds.has(rw.id)) return;
    if (claimingId !== null) return;

    setClaimingId(rw.id);
    try {
      const result = await claimEventReward(userId, rw.id);

      // Se já estava no DB (race condition ou duplo clique), só atualiza o estado local
      if (result === "already_claimed") {
        setClaimedIds((prev) => new Set([...prev, rw.id]));
        return;
      }

      // Entrega a recompensa
      if (rw.reward_type === "xp") {
        const amount = Number(rw.reward_value) || 0;
        if (amount > 0) {
          await grantXp(userId, amount);
          toast.success(`Você recebeu +${amount} XP! ⚡`);
        }
      } else if (rw.reward_type === "title" && rw.title) {
        await unlockTitle(userId, rw.title.id);
        toast.success(`Novo título desbloqueado: ${rw.title.name} 🏆`);
      } else {
        toast.success("Recompensa resgatada!");
      }

      // Marca como resgatada localmente (sem precisar de novo fetch)
      setClaimedIds((prev) => new Set([...prev, rw.id]));
    } catch {
      toast.error("Erro ao resgatar recompensa. Tente novamente.");
    } finally {
      setClaimingId(null);
    }
  }, [userId, claimedIds, claimingId]);

  // Countdown: atualiza 1x por minuto
  useEffect(() => {
    if (!event?.ends_at) return;
    const timer = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(timer);
  }, [event?.ends_at]);

  const remaining = event ? getRemainingTime(event.ends_at) : null;

  // ── Loading / erro ───────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-muted-foreground">
        <Loader2 className="w-7 h-7 animate-spin text-primary" />
        <span className="text-sm font-medium">Carregando evento…</span>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-6 text-center">
        <PartyPopper className="w-12 h-12 text-muted-foreground/40" />
        <div>
          <p className="font-semibold text-lg">Evento não encontrado</p>
          <p className="text-sm text-muted-foreground mt-1">
            Este evento pode ter expirado ou não existe.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setLocation("/conquistas")}>
          <ChevronLeft className="w-4 h-4 mr-1" /> Voltar
        </Button>
      </div>
    );
  }

  // ── Contagem de missões por status ───────────────────────────────────────────
  const completedCount = missions.filter(
    (r) => r.mission && progressMap?.get(r.mission_id)?.completed,
  ).length;

  // eventCompleted: todas as missões concluídas (progresso carregado + > 0 missões)
  const eventCompleted =
    progressMap !== null &&
    missions.length > 0 &&
    missions.every((r) => r.mission && progressMap.get(r.mission_id)?.completed === true);

  // ── Conteúdo ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-5 pb-8">

      {/* Voltar */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="px-1 pt-2"
      >
        <button
          onClick={() => setLocation("/conquistas")}
          className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Conquistas
        </button>
      </motion.div>

      {/* Banner */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        {event.banner_url ? (
          <div className="rounded-3xl overflow-hidden border border-white/20 shadow-2xl">
            <img
              src={event.banner_url}
              alt={event.name}
              className="w-full h-44 object-cover"
            />
          </div>
        ) : (
          <div className="rounded-3xl bg-gradient-to-br from-emerald-500/30 via-teal-500/20 to-cyan-500/30 border border-white/20 shadow-2xl p-8 flex items-center justify-center min-h-[11rem] relative overflow-hidden">
            <div className="absolute top-0 right-0 w-52 h-52 bg-white/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-40 h-40 bg-teal-400/20 rounded-full blur-3xl pointer-events-none" />
            <PartyPopper className="relative w-16 h-16 text-emerald-400/60" />
          </div>
        )}
      </motion.div>

      {/* Info principal */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
        className="px-1"
      >
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider font-bold text-emerald-600 dark:text-emerald-400 mb-1">
          <PartyPopper className="w-3.5 h-3.5" />
          Evento ativo
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight">{event.name}</h1>
        {event.description && (
          <p className="text-muted-foreground mt-2 leading-relaxed">{event.description}</p>
        )}
      </motion.div>

      {/* Resumo geral do evento */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.08 }}
      >
        <EventSummaryCard
          missions={missions}
          progressMap={progressMap}
          progressLoading={progressLoading}
          rewards={rewards}
        />
      </motion.div>

      {/* Período + Countdown */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <Card className="rounded-2xl border-border/50 bg-muted/30 p-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                <Calendar className="w-3.5 h-3.5" />
                Período
              </div>
              <div className="text-sm font-semibold">
                {formatEventDate(event.starts_at)}
              </div>
              {event.ends_at && (
                <div className="text-xs text-muted-foreground">
                  até {formatEventDate(event.ends_at)}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                <Clock className="w-3.5 h-3.5" />
                Tempo restante
              </div>
              {remaining === null ? (
                <div className="text-sm font-semibold">Sem prazo</div>
              ) : remaining.encerrado ? (
                <div className="text-sm font-semibold text-red-500">Encerrado</div>
              ) : (
                <>
                  <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                    {remaining.label}
                  </div>
                  {remaining.dias > 0 && (
                    <div className="text-xs text-muted-foreground">
                      {remaining.horas}h {remaining.minutos}min
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Missões do Evento */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
        className="flex flex-col gap-3"
      >
        <div className="flex items-center gap-2 px-1">
          <Target className="w-4 h-4 text-muted-foreground" />
          <h2 className="font-bold text-base">Missões do Evento</h2>
          <div className="ml-auto flex items-center gap-1.5">
            {missions.length > 0 && completedCount > 0 && (
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                {completedCount}/{missions.length}
              </span>
            )}
            <Badge variant="secondary" className="text-xs">
              {missions.length}
            </Badge>
          </div>
        </div>

        {missions.length === 0 ? (
          <Card className="rounded-2xl border-dashed border-border/50 bg-muted/20 p-6 text-center text-sm text-muted-foreground">
            Nenhuma missão vinculada a este evento ainda.
          </Card>
        ) : progressLoading && progressMap === null ? (
          // Skeleton inicial (antes do primeiro fetch de progresso)
          <div className="flex flex-col gap-2">
            {missions.map((row) => <MissionSkeleton key={row.id} />)}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {missions.map((row) => (
              <MissionCard
                key={row.id}
                row={row}
                progressMap={progressMap}
                progressLoading={progressLoading}
              />
            ))}
          </div>
        )}
      </motion.div>

      {/* Card de Conclusão — só quando todas as missões concluídas */}
      {eventCompleted && (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.18 }}
        >
          <Card className="rounded-2xl border-emerald-400/40 bg-gradient-to-br from-emerald-500/15 via-teal-500/10 to-emerald-500/5 p-5 flex flex-col gap-2 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-400/10 rounded-full blur-3xl pointer-events-none" />
            <div className="flex items-center gap-2.5 relative">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center shrink-0">
                <Sparkles className="w-4.5 h-4.5 text-emerald-500" />
              </div>
              <div>
                <p className="font-extrabold text-emerald-700 dark:text-emerald-400 leading-tight">
                  Evento Concluído
                </p>
                <p className="text-xs text-emerald-600/80 dark:text-emerald-500/80 mt-0.5">
                  ✓ Todas as missões finalizadas
                </p>
              </div>
            </div>
          </Card>
        </motion.div>
      )}

      {/* Recompensas */}
      {rewards.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="flex flex-col gap-3"
        >
          {/* Cabeçalho */}
          <div className="flex items-center gap-2 px-1">
            <Gift className="w-4 h-4 text-muted-foreground" />
            <h2 className="font-bold text-base">
              {eventCompleted ? "Recompensas desbloqueadas" : "Recompensas"}
            </h2>
            {eventCompleted && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full border bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-400/30 ml-1">
                Disponíveis
              </span>
            )}
            <Badge variant="secondary" className="ml-auto text-xs">
              {rewards.length}
            </Badge>
          </div>

          {/* Lista */}
          <div className="flex flex-col gap-2">
            {rewards.map((rw) => {
              const isXp      = rw.reward_type === "xp";
              const isTitle   = rw.reward_type === "title";
              const isClaimed = claimedIds.has(rw.id);
              const isClaiming = claimingId === rw.id;

              return (
                <Card
                  key={rw.id}
                  className={[
                    "rounded-2xl border-border/50 p-4 flex items-start gap-3 transition-colors",
                    isClaimed
                      ? "bg-emerald-500/5 border-emerald-400/20"
                      : eventCompleted
                        ? "bg-muted/30 border-border/60"
                        : "bg-muted/15 opacity-75",
                  ].join(" ")}
                >
                  {/* Ícone */}
                  <div
                    className={[
                      "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5",
                      isXp
                        ? "bg-gradient-to-br from-amber-500/20 to-yellow-500/10 border border-amber-400/30"
                        : isTitle
                          ? "bg-gradient-to-br from-violet-500/20 to-fuchsia-500/10 border border-violet-400/25"
                          : "bg-gradient-to-br from-blue-500/20 to-sky-500/10 border border-blue-400/25",
                    ].join(" ")}
                  >
                    {isClaimed ? (
                      <CheckCheck className="w-4 h-4 text-emerald-500" />
                    ) : isXp ? (
                      <Zap className="w-4 h-4 text-amber-500" />
                    ) : isTitle ? (
                      <Trophy className="w-4 h-4 text-violet-400" />
                    ) : (
                      <Star className="w-4 h-4 text-blue-400" />
                    )}
                  </div>

                  {/* Conteúdo */}
                  <div className="flex-1 min-w-0">
                    {/* Tipo + status */}
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <span
                        className={[
                          "text-[10px] font-bold px-1.5 py-0.5 rounded-full border",
                          isXp
                            ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-400/30"
                            : isTitle
                              ? "bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-400/30"
                              : "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-400/30",
                        ].join(" ")}
                      >
                        {REWARD_TYPE_LABEL[rw.reward_type] ?? rw.reward_type}
                      </span>

                      {isClaimed ? (
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                          <CheckCircle2 className="w-3 h-3" />
                          Resgatada
                        </span>
                      ) : eventCompleted ? (
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                          <CheckCircle2 className="w-3 h-3" />
                          Disponível
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium text-muted-foreground flex items-center gap-0.5">
                          <Lock className="w-3 h-3" />
                          Bloqueada
                        </span>
                      )}
                    </div>

                    {/* Valor / TitleBadge */}
                    {isXp && (
                      <p className="text-base font-extrabold text-amber-500 dark:text-amber-400 leading-tight">
                        +{rw.reward_value} XP
                      </p>
                    )}

                    {isTitle && rw.title && (
                      <TitleBadge
                        title={{
                          name:   rw.title.name,
                          rarity: rw.title.rarity,
                          color:  rw.title.color,
                          icon:   rw.title.icon,
                        }}
                        size="md"
                      />
                    )}

                    {isTitle && !rw.title && (
                      <p className="text-sm font-semibold text-muted-foreground">
                        {String(rw.reward_value)}
                      </p>
                    )}

                    {!isXp && !isTitle && (
                      <p className="text-sm font-bold">{String(rw.reward_value)}</p>
                    )}

                    {/* Botão de claim */}
                    <div className="mt-3">
                      {isClaimed ? (
                        <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                          <CheckCheck className="w-3.5 h-3.5" />
                          Resgatada
                        </div>
                      ) : eventCompleted ? (
                        <Button
                          size="sm"
                          variant="default"
                          disabled={isClaiming || claimingId !== null}
                          onClick={() => handleClaim(rw)}
                          className="h-8 px-4 text-xs font-bold"
                        >
                          {isClaiming ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                              Resgatando…
                            </>
                          ) : (
                            <>
                              <Gift className="w-3.5 h-3.5 mr-1.5" />
                              Resgatar
                            </>
                          )}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </motion.div>
      )}
    </div>
  );
}
