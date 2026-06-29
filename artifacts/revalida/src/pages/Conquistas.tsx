import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { useTraining } from "@/contexts/TrainingContext";
import { useAuth } from "@/contexts/AuthContext";
import { MissionCompletedToast } from "@/components/MissionCompletedToast";
import { Card } from "@/components/ui/card";
import {
  Award,
  Sparkles,
  Lock,
  Flame,
  CheckCircle2,
  Star,
  Zap,
  Trophy,
  CheckCheck,
  PartyPopper,
  Clock,
  Target,
  Gift,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { getLevelInfo } from "@/lib/levelSystem";
import {
  MISSIONS,
  ACHIEVEMENTS,
  TIER_META,
  missionProgress,
  isClaimed,
  claimMission,
  isAchievementUnlocked,
  type Mission,
  type MissionPeriod,
  type Achievement,
  type AchievementTier,
} from "@/lib/gamificationStorage";
import {
  fetchActiveDbMissions,
  dbMissionToMission,
  type DbMission,
} from "@/lib/missionService";
import {
  fetchActiveEventWithCounts,
  type DbEvent,
} from "@/lib/eventService";
import { getRemainingTime } from "@/lib/eventCountdown";
import {
  fetchUserMissionProgress,
  claimMissionReward,
  syncLegacyMissionProgress,
  type ProgressMap,
} from "@/lib/missionProgressService";
import { grantXp } from "@/lib/gamificationService";
import { evaluateMissionProgress, parseConditions } from "@/lib/missionRulesEngine";
import {
  fetchUserAchievements,
  type DbUserAchievement,
  type DbAchievement,
} from "@/lib/achievementService";
import { LEGACY_SLUG_MAP } from "@/lib/achievementEngine";
import { AchievementUnlockedToast } from "@/components/gamification/AchievementUnlockedToast";

const PERIOD_LABEL: Record<MissionPeriod, string> = {
  diario: "Diário",
  semanal: "Semanal",
  mensal: "Mensal",
  especial: "Especiais",
};

const PERIOD_TONE: Record<MissionPeriod, string> = {
  diario: "from-blue-500/15 to-blue-500/5 border-blue-400/30 text-blue-700 dark:text-blue-300",
  semanal: "from-violet-500/15 to-violet-500/5 border-violet-400/30 text-violet-700 dark:text-violet-300",
  mensal: "from-amber-500/15 to-amber-500/5 border-amber-400/30 text-amber-700 dark:text-amber-300",
  especial: "from-fuchsia-500/15 to-fuchsia-500/5 border-fuchsia-400/30 text-fuchsia-700 dark:text-fuchsia-300",
};

// ── Debug silencioso (apenas DEV) ────────────────────────────────────────────

const cdbg = import.meta.env.DEV
  ? (...args: unknown[]) => console.debug("[Conquistas]", ...args)
  : () => {};

const adbg = import.meta.env.DEV
  ? (...args: unknown[]) => console.debug("[AchievementToast]", ...args)
  : () => {};

const tdbg = import.meta.env.DEV
  ? (...args: unknown[]) => console.debug("[MissionToast]", ...args)
  : () => {};

// ── Intervalo mínimo entre refetches (ms) ─────────────────────────────────────

const MIN_REFETCH_INTERVAL_MS = 2500;

export default function Conquistas() {
  const { history } = useTraining();
  const { profile, user, reloadProfile } = useAuth();
  const [, force] = useState(0);
  const refresh = () => force((x) => x + 1);
  const [activePeriod, setActivePeriod] = useState<MissionPeriod>("diario");
  const [celebrate, setCelebrate] = useState<{ xp: number; titulo: string } | null>(null);
  const [dbUserAchs, setDbUserAchs] = useState<(DbUserAchievement & { achievement: DbAchievement })[]>([]);
  const dbUnlockedSlugs = useMemo(
    () => new Set(dbUserAchs.map((ua) => ua.achievement.slug)),
    [dbUserAchs],
  );
  const [, setLocation] = useLocation();
  const [activeEventData, setActiveEventData] = useState<{
    event: DbEvent;
    missionCount: number;
    rewardCount: number;
  } | null>(null);
  const [, setCountdownTick] = useState(0);

  // ── Controle de refetch reativo ───────────────────────────────────────────────
  const inflightRef     = useRef(false);
  const lastFetchRef    = useRef(0);
  const fetchVersionRef = useRef(0);

  // ── Toast de missão concluída ────────────────────────────────────────────────
  // completedMissionIdsRef: missões já conhecidas como completed nesta sessão de runtime.
  // Populado silenciosamente no primeiro fetch; toasts disparados apenas para novas entradas.
  const completedMissionIdsRef     = useRef<Set<string>>(new Set());
  const isProgressInitializedRef   = useRef(false);
  const toastQueueRef              = useRef<Mission[]>([]);
  const processingToastRef         = useRef(false);
  const missionsRef                = useRef<Mission[]>(MISSIONS);
  // handleClaimRef permite que a fila de toasts use sempre a versão mais recente de handleClaim
  const handleClaimRef             = useRef<(m: Mission) => void>(() => {/**/});

  // ── Toast de medalha desbloqueada ────────────────────────────────────────────
  const knownAchSlugsRef       = useRef<Set<string> | null>(null);
  const achToastQueueRef       = useRef<(DbUserAchievement & { achievement: DbAchievement })[]>([]);
  const processingAchToastRef  = useRef(false);

  // ── Missões: Supabase como fonte principal, MISSIONS[] como fallback ─────────
  const [missions, setMissions]       = useState<Mission[]>(MISSIONS);
  const [dbMissionsMap, setDbMissionsMap] = useState<Map<string, DbMission>>(new Map());
  const [missionsLoading, setMissionsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchActiveDbMissions()
      .then((dbList) => {
        if (cancelled) return;
        if (dbList.length > 0) {
          setMissions(dbList.map(dbMissionToMission));
          setDbMissionsMap(new Map(dbList.map((m) => [m.slug || m.id, m])));
        } else {
          setMissions(MISSIONS);
          setDbMissionsMap(new Map());
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMissions(MISSIONS);
          setDbMissionsMap(new Map());
        }
      })
      .finally(() => {
        if (!cancelled) setMissionsLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  // ── DB achievements: fila de toasts ─────────────────────────────────────────
  const processAchToastQueue = useCallback(() => {
    if (processingAchToastRef.current || achToastQueueRef.current.length === 0) return;
    processingAchToastRef.current = true;
    const ua  = achToastQueueRef.current.shift()!;
    const ach = ua.achievement;
    adbg("unlocked:", ach.slug, ach.tier);
    toast.custom(
      (id) => (
        <AchievementUnlockedToast
          titulo={ach.title}
          descricao={ach.description}
          tier={ach.tier as AchievementTier}
          toastId={id}
        />
      ),
      { duration: 5000, id: `ach-toast-${ach.slug}` },
    );
    window.setTimeout(() => {
      processingAchToastRef.current = false;
      processAchToastQueue();
    }, 5600);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── DB achievements: Supabase como fonte principal, legacy como fallback ─────
  const fetchAndDetectAchs = useCallback(async () => {
    if (!user?.id) return;
    try {
      const rows    = await fetchUserAchievements(user.id);
      setDbUserAchs(rows);
      const slugSet = new Set(rows.map((ua) => ua.achievement.slug));

      if (knownAchSlugsRef.current === null) {
        knownAchSlugsRef.current = slugSet;
        return; // Primeiro load: silencioso, sem toast
      }

      const newly = rows.filter((ua) => !knownAchSlugsRef.current!.has(ua.achievement.slug));
      if (newly.length > 0) {
        achToastQueueRef.current.push(...newly);
        processAchToastQueue();
      }
      knownAchSlugsRef.current = slugSet;
    } catch { /* silencioso — isAchievementUnlocked() cobre o fallback */ }
  }, [user?.id, processAchToastQueue]);

  useEffect(() => { fetchAndDetectAchs(); }, [fetchAndDetectAchs]);

  // Detecta novas medalhas ao retornar ao app após uma sessão
  useEffect(() => {
    const handleVisible = () => {
      if (document.visibilityState === "visible") fetchAndDetectAchs();
    };
    document.addEventListener("visibilitychange", handleVisible);
    return () => document.removeEventListener("visibilitychange", handleVisible);
  }, [fetchAndDetectAchs]);

  // ── Progresso persistido: Supabase como fonte autoritativa ──────────────────
  const [dbProgress, setDbProgress] = useState<ProgressMap | null>(null);

  // Mantém missionsRef sincronizado com o estado de missions (evita stale closure)
  useEffect(() => { missionsRef.current = missions; }, [missions]);

  // ── Fila de toasts de missão concluída ────────────────────────────────────────

  const processToastQueue = useCallback(() => {
    if (processingToastRef.current || toastQueueRef.current.length === 0) return;
    processingToastRef.current = true;
    const mission = toastQueueRef.current.shift()!;

    tdbg("completed:", mission.id, "xp:", mission.xp);

    toast.custom(
      (id) => (
        <MissionCompletedToast
          titulo={mission.titulo}
          xp={mission.xp}
          toastId={id}
          onClaim={() => {
            toast.dismiss(id);
            handleClaimRef.current(mission);
          }}
        />
      ),
      { duration: 5000, id: `mission-toast-${mission.id}` },
    );

    window.setTimeout(() => {
      processingToastRef.current = false;
      processToastQueue();
    }, 5600);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const enqueueMissionToast = useCallback((mission: Mission, source: string) => {
    tdbg("completed:", mission.id, "xp:", mission.xp, "source trigger:", source);
    if (!toastQueueRef.current.find((m) => m.id === mission.id)) {
      toastQueueRef.current.push(mission);
    }
    processToastQueue();
  }, [processToastQueue]);

  /**
   * Busca o progresso atualizado do Supabase com:
   *   - guarda de inflight (sem fetches simultâneos)
   *   - debounce mínimo de MIN_REFETCH_INTERVAL_MS
   *   - versionamento para ignorar respostas obsoletas
   *   - detecção de transição completed: false → true para toasts
   */
  const refreshMissionProgress = useCallback(async (reason: string) => {
    const userId = user?.id;
    if (!userId) return;
    if (inflightRef.current) {
      cdbg(`refetch blocked (inflight) — reason: ${reason}`);
      return;
    }
    const now = Date.now();
    if (now - lastFetchRef.current < MIN_REFETCH_INTERVAL_MS) {
      cdbg(`refetch debounced — reason: ${reason}`);
      return;
    }
    cdbg(`refetch triggered by: ${reason}`);
    inflightRef.current = true;
    const myVersion = ++fetchVersionRef.current;
    try {
      const map = await fetchUserMissionProgress(userId);
      if (fetchVersionRef.current === myVersion) {
        if (!isProgressInitializedRef.current) {
          // Primeiro fetch: semeia o set com missões já completas (sem toast)
          map.forEach((row, key) => {
            if (row.completed) completedMissionIdsRef.current.add(key);
          });
          isProgressInitializedRef.current = true;
          tdbg("initialized — known completed:", completedMissionIdsRef.current.size);
        } else {
          // Fetches subsequentes: detecta novas transições false → true
          map.forEach((row, key) => {
            if (
              row.completed &&
              !row.claimed &&
              !completedMissionIdsRef.current.has(key)
            ) {
              completedMissionIdsRef.current.add(key);
              const mission =
                missionsRef.current.find((m) => m.id === key) ??
                missionsRef.current.find((m) => m.id === row.missionKey);
              if (mission) {
                enqueueMissionToast(mission, reason);
              } else {
                tdbg("mission not found for key:", key, "— skipping toast");
              }
            }
          });
        }
        setDbProgress(map);
        lastFetchRef.current = Date.now();
      }
    } catch {
      // silencioso — mantém dbProgress anterior
    } finally {
      if (fetchVersionRef.current === myVersion) {
        inflightRef.current = false;
      }
    }
  }, [user?.id, enqueueMissionToast]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch inicial ao montar ou quando o userId muda
  useEffect(() => {
    refreshMissionProgress("mount");
  }, [refreshMissionProgress]);

  // Listeners reativos: visibilitychange, focus, missions-updated
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        refreshMissionProgress("visibility");
      }
    };
    const onFocus           = () => refreshMissionProgress("focus");
    const onMissionsUpdated = () => refreshMissionProgress("missions-updated");

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    window.addEventListener("missions-updated", onMissionsUpdated);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("missions-updated", onMissionsUpdated);
    };
  }, [refreshMissionProgress]);

  // ── Sync legado → Supabase (fire-and-forget) ─────────────────────────────────
  useEffect(() => {
    const userId = user?.id;
    if (!userId || missionsLoading) return;
    syncLegacyMissionProgress(userId, missions).catch(() => {/*silencioso*/});
  }, [user?.id, missionsLoading, missions]);

  // ── Evento ativo (leitura apenas) ────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    fetchActiveEventWithCounts()
      .then((data) => { if (!cancelled) setActiveEventData(data); })
      .catch(() => { if (!cancelled) setActiveEventData(null); });
    return () => { cancelled = true; };
  }, []);

  // Countdown: atualiza 1x por minuto (sem timer agressivo)
  useEffect(() => {
    if (!activeEventData?.event.ends_at) return;
    const timer = setInterval(() => setCountdownTick((t) => t + 1), 60_000);
    return () => clearInterval(timer);
  }, [activeEventData?.event.ends_at]);

  // ── XP e nível ───────────────────────────────────────────────────────────────
  const xp     = profile?.xp_total ?? 0;
  const level  = getLevelInfo(xp);
  const streak = profile?.streak_atual ?? 0;

  const missionsByPeriod = useMemo(() => {
    const map: Record<MissionPeriod, Mission[]> = {
      diario: [], semanal: [], mensal: [], especial: [],
    };
    for (const m of missions) map[m.period].push(m);
    return map;
  }, [missions]);

  // ── Claimed: DB tem precedência; localStorage como fallback ─────────────────
  const isClaimedMerged = (missionId: string, period: MissionPeriod): boolean => {
    const dbRow = dbProgress?.get(missionId);
    if (dbRow !== undefined) return dbRow.claimed || isClaimed(missionId, period);
    return isClaimed(missionId, period);
  };

  // ── Claim com persistência dual ───────────────────────────────────────────────
  const handleClaim = async (m: Mission) => {
    const claimed = claimMission(m);
    if (!claimed) return;

    if (user?.id) {
      const dbMission  = dbMissionsMap.get(m.id);
      const conditions = dbMission ? parseConditions(dbMission.conditions) : null;
      const cp = conditions
        ? evaluateMissionProgress(conditions, history)
        : missionProgress(m, history);
      const progress = "totalProgress" in cp ? cp.totalProgress : cp.current;
      const target   = "totalTarget"   in cp ? cp.totalTarget   : cp.goal;

      await grantXp(user.id, m.xp);
      await reloadProfile();

      claimMissionReward(user.id, m.id, progress, target).catch(() => {/*silencioso*/});
    }

    setCelebrate({ xp: m.xp, titulo: m.titulo });
    toast.success(`+${m.xp} XP conquistado`);
    window.setTimeout(() => setCelebrate(null), 1800);
    refresh();
  };

  // Mantém handleClaimRef sempre atualizado (evita stale closure na fila de toasts)
  useEffect(() => { handleClaimRef.current = handleClaim; });

  // Supabase = fonte principal; localStorage/history = fallback
  const isUnlockedMerged = (a: Achievement): boolean =>
    dbUnlockedSlugs.has(LEGACY_SLUG_MAP[a.id] ?? "") || isAchievementUnlocked(a, history);

  const achievementsUnlockedCount = ACHIEVEMENTS.filter((a) =>
    isUnlockedMerged(a),
  ).length;

  return (
    <div className="flex flex-col gap-5">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="px-1 pt-2"
      >
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider font-bold text-muted-foreground">
          <Award className="w-3.5 h-3.5" /> Conquistas
        </div>
        <h1 className="text-3xl font-bold tracking-tight mt-1">Sua progressão</h1>
        <p className="text-muted-foreground mt-1 font-medium">
          Cumpra missões, ganhe XP e desbloqueie medalhas
        </p>
      </motion.div>

      {/* ACTIVE EVENT CARD */}
      {activeEventData && (() => {
        const { event, missionCount, rewardCount } = activeEventData;
        const remaining = getRemainingTime(event.ends_at);
        return (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.05 }}
          >
            <Card className="relative overflow-hidden rounded-3xl border border-emerald-400/30 bg-gradient-to-br from-emerald-500/15 via-teal-500/10 to-cyan-500/15 backdrop-blur-xl shadow-xl">
              <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-400/10 rounded-full blur-3xl pointer-events-none" />
              {event.banner_url && (
                <img
                  src={event.banner_url}
                  alt={event.name}
                  className="w-full h-28 object-cover rounded-t-3xl"
                />
              )}
              <div className="relative p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-1">
                      <PartyPopper className="w-3 h-3" />
                      Evento ativo
                    </div>
                    <h2 className="text-base font-extrabold leading-snug truncate">{event.name}</h2>
                    {event.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-snug">
                        {event.description}
                      </p>
                    )}
                  </div>
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shrink-0 shadow-lg">
                    <PartyPopper className="w-5 h-5 text-white" />
                  </div>
                </div>

                <div className="flex items-center gap-4 mt-3 flex-wrap">
                  {remaining !== null && (
                    <div className="flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      <Clock className="w-3 h-3" />
                      {remaining.encerrado ? "Encerrado" : remaining.label}
                    </div>
                  )}
                  {missionCount > 0 && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground font-medium">
                      <Target className="w-3 h-3" />
                      {missionCount} {missionCount === 1 ? "missão" : "missões"}
                    </div>
                  )}
                  {rewardCount > 0 && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground font-medium">
                      <Gift className="w-3 h-3" />
                      {rewardCount} {rewardCount === 1 ? "recompensa" : "recompensas"}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => setLocation(`/conquistas/evento/${event.id}`)}
                  className="mt-3 flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
                >
                  Ver Evento <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </Card>
          </motion.div>
        );
      })()}

      {/* LEVEL CARD */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <Card className="relative overflow-hidden rounded-3xl border-white/30 dark:border-white/10 bg-gradient-to-br from-blue-500/30 via-cyan-500/20 to-violet-500/30 backdrop-blur-xl p-6 shadow-2xl">
          <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-40 h-40 bg-violet-400/20 rounded-full blur-3xl pointer-events-none" />
          <div className="relative flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="text-[10px] uppercase tracking-wider font-bold opacity-80">Nível atual</div>
              <div className="flex items-baseline gap-1.5 mt-1">
                <div className="text-5xl font-extrabold tabular-nums leading-none text-gradient-primary">{level.level}</div>
                <div className="text-sm font-bold opacity-80">{level.name}</div>
              </div>
              <div className="mt-1 text-xs font-semibold opacity-80">
                {achievementsUnlockedCount} / {ACHIEVEMENTS.length} medalhas conquistadas
              </div>
            </div>
            <div className="w-14 h-14 rounded-2xl gradient-primary glow-primary flex items-center justify-center shrink-0">
              <Trophy className="w-7 h-7 text-white" />
            </div>
          </div>

          <div className="relative mt-5 space-y-2">
            <div className="h-3 w-full rounded-full bg-white/30 dark:bg-white/10 overflow-hidden backdrop-blur-sm">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${level.pct}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="h-full gradient-primary rounded-full glow-primary relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-pulse" />
              </motion.div>
            </div>
            <div className="flex justify-between items-center text-xs font-bold">
              <span className="tabular-nums">
                {level.xpInCurrentLevel.toLocaleString("pt-BR")} / {level.xpForCurrentLevel.toLocaleString("pt-BR")} XP
              </span>
              <span className="tabular-nums opacity-80">
                {level.xpRestante > 0
                  ? `${level.xpRestante.toLocaleString("pt-BR")} XP até Nível ${level.level + 1}`
                  : "Nível máximo!"}
              </span>
            </div>
          </div>

          <div className="relative grid grid-cols-3 gap-3 mt-5">
            <MiniStat icon={Zap}   label="XP total"  value={xp.toLocaleString("pt-BR")} />
            <MiniStat icon={Flame} label="Sequência" value={`${streak}d`} />
            <MiniStat icon={Star}  label="Estações"  value={String(history.length)} />
          </div>
        </Card>
      </motion.div>

      {/* MISSIONS */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2 px-1">
          <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <Sparkles className="w-4 h-4" />
          </div>
          <h2 className="font-bold text-lg">Missões</h2>
          {missionsLoading && (
            <span className="ml-auto text-[10px] font-bold text-muted-foreground animate-pulse uppercase tracking-wider">
              Carregando…
            </span>
          )}
        </div>

        {/* Period tabs */}
        <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1 scrollbar-none">
          {(Object.keys(PERIOD_LABEL) as MissionPeriod[]).map((p) => {
            const active = activePeriod === p;
            const count  = missionsByPeriod[p].filter((m) => !isClaimedMerged(m.id, m.period)).length;
            return (
              <button
                key={p}
                onClick={() => setActivePeriod(p)}
                className={cn(
                  "shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all border",
                  active
                    ? "bg-primary text-primary-foreground border-primary shadow-md"
                    : "bg-card text-muted-foreground border-border/60 hover:border-primary/40 hover:text-foreground",
                )}
              >
                {PERIOD_LABEL[p]}
                {count > 0 && (
                  <span className={cn(
                    "px-1.5 py-0 rounded-full text-[9px] font-extrabold",
                    active ? "bg-white/20 text-white" : "bg-primary/15 text-primary",
                  )}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Mission cards */}
        <div className="flex flex-col gap-2.5">
          {missionsLoading ? (
            <div className="flex flex-col gap-2.5">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-24 rounded-2xl bg-muted/40 animate-pulse"
                  style={{ animationDelay: `${i * 80}ms` }}
                />
              ))}
            </div>
          ) : missionsByPeriod[activePeriod].length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground font-medium">
              Nenhuma missão nesta categoria.
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {missionsByPeriod[activePeriod].map((m, i) => (
                <motion.div
                  key={m.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.25, delay: i * 0.04 }}
                >
                  <MissionCard
                    mission={m}
                    history={history}
                    dbClaimed={dbProgress?.get(m.id)?.claimed}
                    dbMission={dbMissionsMap.get(m.id)}
                    onClaim={() => handleClaim(m)}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      </section>

      {/* ACHIEVEMENTS */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2 px-1">
          <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <Award className="w-4 h-4" />
          </div>
          <h2 className="font-bold text-lg">Medalhas</h2>
          <span className="ml-auto text-xs font-bold text-muted-foreground tabular-nums">
            {achievementsUnlockedCount} / {ACHIEVEMENTS.length}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {ACHIEVEMENTS.map((a, i) => {
            const unlocked = isUnlockedMerged(a);
            return (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: i * 0.03 }}
              >
                <AchievementBadge a={a} unlocked={unlocked} />
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* CELEBRATION */}
      <AnimatePresence>
        {celebrate && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
          >
            <div className="rounded-3xl px-6 py-4 bg-gradient-to-br from-blue-500 via-cyan-500 to-violet-500 text-white shadow-2xl glow-primary flex items-center gap-3 backdrop-blur-md">
              <Sparkles className="w-6 h-6" />
              <div>
                <div className="text-xs font-bold uppercase tracking-wider opacity-90">+{celebrate.xp} XP conquistado</div>
                <div className="text-sm font-bold">{celebrate.titulo}</div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

function MiniStat({ icon: Icon, label, value }: { icon: typeof Zap; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/40 dark:bg-white/10 border border-white/30 dark:border-white/10 backdrop-blur-md px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold opacity-80">
        <Icon className="w-3 h-3" /> {label}
      </div>
      <div className="text-lg font-extrabold tabular-nums mt-0.5 leading-none">{value}</div>
    </div>
  );
}

function MissionCard({
  mission,
  history,
  dbClaimed,
  dbMission,
  onClaim,
}: {
  mission: Mission;
  history: ReturnType<typeof useTraining>["history"];
  dbClaimed: boolean | undefined;
  dbMission: DbMission | undefined;
  onClaim: () => void;
}) {
  // Determinar se tem conditions dinâmicas
  const conditions = dbMission ? parseConditions(dbMission.conditions) : null;

  // Progresso: conditions-based ou legado
  const condProgress = conditions ? evaluateMissionProgress(conditions, history) : null;
  const legProgress  = condProgress ? null : missionProgress(mission, history);

  const isDone = condProgress ? condProgress.allDone : (legProgress?.done ?? false);
  const pct    = condProgress ? condProgress.pct     : (legProgress?.pct ?? 0);

  // Claimed: DB tem precedência; localStorage como fallback
  const claimed = dbClaimed !== undefined
    ? (dbClaimed || isClaimed(mission.id, mission.period))
    : isClaimed(mission.id, mission.period);
  const canClaim = isDone && !claimed;

  return (
    <Card
      className={cn(
        "rounded-2xl p-4 border bg-gradient-to-br backdrop-blur-md flex flex-col gap-3 transition-all",
        PERIOD_TONE[mission.period],
        canClaim && "ring-2 ring-emerald-400/60 shadow-lg",
        claimed && "opacity-60",
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all",
            claimed
              ? "bg-emerald-500 text-white"
              : canClaim
                ? "gradient-primary text-white glow-primary"
                : "bg-white/40 dark:bg-white/10",
          )}
        >
          {claimed ? <CheckCircle2 className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-sm leading-tight flex-1 min-w-0">{mission.titulo}</h3>
            <span className="shrink-0 inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-white/40 dark:bg-white/10 backdrop-blur-sm">
              <Zap className="w-3 h-3" />+{mission.xp}
            </span>
          </div>
          <p className="text-xs opacity-80 mt-0.5 leading-snug">{mission.descricao}</p>
        </div>
      </div>

      {/* Progresso: compostas (por regra) ou simples */}
      {condProgress ? (
        <div className="flex flex-col gap-1.5">
          {condProgress.rules.map((rp, i) => (
            <div key={i} className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold opacity-90 flex items-center gap-1">
                  {rp.done && <CheckCheck className="w-3 h-3 text-emerald-500" />}
                  {rp.label}
                </span>
                <span className="text-[11px] font-bold tabular-nums opacity-80">
                  {rp.current}/{rp.target}
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-white/30 dark:bg-white/10 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${rp.target > 0 ? Math.round((rp.current / rp.target) * 100) : 0}%` }}
                  transition={{ duration: 0.6, ease: "easeOut", delay: i * 0.05 }}
                  className={cn(
                    "h-full rounded-full",
                    rp.done ? "bg-emerald-500" : "gradient-primary",
                  )}
                />
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between gap-2 mt-1">
            <span className="text-[10px] text-muted-foreground/70 font-medium">
              {condProgress.totalProgress}/{condProgress.totalTarget} total
            </span>
            {canClaim ? (
              <button
                onClick={onClaim}
                className="px-3 py-1 rounded-full text-[11px] font-extrabold bg-emerald-500 text-white hover:bg-emerald-600 transition-colors shadow-sm"
              >
                Resgatar
              </button>
            ) : claimed ? (
              <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 inline-flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Concluída
              </span>
            ) : (
              <span className="text-[11px] font-bold opacity-60">{pct}%</span>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          <div className="h-2 w-full rounded-full bg-white/30 dark:bg-white/10 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className={cn(
                "h-full rounded-full",
                claimed
                  ? "bg-emerald-500"
                  : isDone
                    ? "bg-gradient-to-r from-emerald-400 to-emerald-600"
                    : "gradient-primary",
              )}
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold tabular-nums opacity-80">
              {legProgress?.current ?? 0} / {legProgress?.goal ?? mission.goal}
            </span>
            {canClaim ? (
              <button
                onClick={onClaim}
                className="px-3 py-1 rounded-full text-[11px] font-extrabold bg-emerald-500 text-white hover:bg-emerald-600 transition-colors shadow-sm"
              >
                Resgatar
              </button>
            ) : claimed ? (
              <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 inline-flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Concluída
              </span>
            ) : (
              <span className="text-[11px] font-bold opacity-60">{pct}%</span>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

function AchievementBadge({ a, unlocked }: { a: Achievement; unlocked: boolean }) {
  const meta = TIER_META[a.tier];
  const reqText = a.requiredStreak
    ? `${a.requiredStreak} dias seguidos`
    : a.requiredEstacoes
      ? `${a.requiredEstacoes} estações`
      : a.requiredMedia
        ? `Média ${a.requiredMedia.toFixed(1)}`
        : "";
  return (
    <Card
      className={cn(
        "rounded-2xl p-4 border-border/60 flex flex-col items-center text-center gap-2 transition-all",
        unlocked ? "bg-card/80 backdrop-blur-md hover:-translate-y-0.5" : "bg-muted/40 grayscale opacity-70",
      )}
    >
      <div
        className={cn(
          "w-14 h-14 rounded-2xl flex items-center justify-center bg-gradient-to-br ring-2",
          unlocked
            ? `${meta.glow} ${meta.bg} ${meta.ring} text-white`
            : "from-muted to-muted ring-border text-muted-foreground",
        )}
      >
        {unlocked ? <Award className="w-7 h-7" /> : <Lock className="w-6 h-6" />}
      </div>
      <div className="space-y-0.5">
        <div className={cn("text-[9px] uppercase tracking-wider font-extrabold", unlocked ? meta.text : "text-muted-foreground")}>
          {meta.label}
        </div>
        <h3 className="text-xs font-bold leading-tight">{a.titulo}</h3>
        <p className="text-[10px] text-muted-foreground leading-snug line-clamp-2">
          {unlocked ? a.descricao : reqText}
        </p>
      </div>
    </Card>
  );
}
