import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { SUPABASE_REST_URL, SUPABASE_ANON_KEY, readJwtSync } from "@/lib/supabase";
import { toast } from "sonner";
import type { Checklist, ChecklistSummary } from "@/lib/checklistStorage";
import {
  listChecklistCatalog,
  fetchChecklistDetailsForTraining,
} from "@/lib/checklistService";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { fetchSessions, saveSession } from "@/lib/sessionService";
import { useAuth } from "@/contexts/AuthContext";
import { useRealtime } from "@/contexts/RealtimeContext";
import type { IncomingInvite, SessionSyncState } from "@/lib/realtimeStateManager";
import {
  createOrGetMultiplayerSession,
  getActiveSessionForUser,
  updateMultiplayerSession,
  finishMultiplayerSession,
  abandonMultiplayerSession,
  cleanupOrphanSessions,
  pauseSession,
  resumeSession,
} from "@/lib/multiplayerSessionService";
import { fetchPublicProfile } from "@/lib/profileService";
import { trackEvent } from "@/lib/analyticsService";
import { useSessionHeartbeat } from "@/hooks/useSessionHeartbeat";
import { evaluateAutomaticTitles } from "@/lib/titleService";
import {
  processMissionProgressAfterSession,
  processLoginMissionProgress,
} from "@/lib/missionProgressEngine";
import {
  evaluateAndUnlockAchievements,
  evaluateLoginAchievements,
} from "@/lib/achievementEngine";

export type { IncomingInvite };

// ── Types ──────────────────────────────────────────────────────────────────────

export type Role = "medico" | "paciente";
export type PepResposta = "adequado" | "parcial" | "inadequado";
export type SessionStatus =
  | "idle"
  | "matchmaking"
  | "role-select"
  | "config"
  | "waiting"
  | "running"
  | "paused_manual"
  | "ended";

export type ConnectionState =
  | "connected"
  | "partner_suspected"
  | "partner_disconnected"
  | "self_reconnecting"
  | "restoring_session";

export type StationConfig = {
  tempoMin: 8 | 9 | 10;
  checklistId: string;
};

export type SavedSession = {
  id: string;
  partnerName: string;
  role: Role;
  checklistId: string;
  checklistTitle: string;
  tempoMin: number;
  notaTotal: number;
  notaMaxima: number;
  endedAt: string;
  area?: string | null;
};

export type TrainingUser = {
  id: string;
  nome: string;
  online: boolean;
  nota: number;
  favorito: boolean;
  estacoes: number;
  isReal: boolean;
  userStatus?: string;
};

type TrainingState = {
  users: TrainingUser[];
  search: string;
  setSearch: (v: string) => void;

  partnerId: string | null;
  partnerName: string | null;

  role: Role | null;
  status: SessionStatus;
  config: StationConfig | null;

  startedAt: number | null;
  endedAt: number | null;
  remainingSec: number;

  impressosLiberados: string[];
  pepRespostas: Record<string, PepResposta>;

  pendingInvite: IncomingInvite | null;
  outgoingInviteName: string | null;
  matchmakingActive: boolean;

  sessionSync: SessionSyncState;

  history: SavedSession[];
  isLoadingHistory: boolean;
  reloadHistory: () => Promise<void>;
  hasNetworkError: boolean;
  retryLoad: () => Promise<void>;

  activeSessionId: string | null;
  isHost: boolean;
  partnerDisconnected: boolean;
  disconnectCountdown: number;
  connectionState: ConnectionState;
  recoveryRoute: string | null;
  clearRecoveryRoute: () => void;

  pauseStation: () => void;
  resumeStation: () => void;
  pausedByName: string | null;

  isSolo: boolean;
  startSolo: () => void;
  startSoloStation: (cfg: StationConfig, role: Role) => void;

  toggleFavorito: (userId: string) => void;
  sendInvite: (userId: string) => void;
  cancelOutgoingInvite: () => void;
  acceptInvite: () => void;
  declineInvite: () => void;
  startInstaCheck: () => void;
  cancelInstaCheck: () => void;

  selectRole: (role: Role | "aleatorio") => void;
  setStationConfig: (config: StationConfig) => void;
  startStation: () => void;

  liberarImpresso: (impressoId: string) => void;
  marcarPep: (pepId: string, resposta: PepResposta) => void;
  encerrarEstacao: () => void;
  salvarEstacao: () => void;
  isSavingSession: boolean;
  exitTraining: () => void;

  repeatStation: (checklistId: string, role: Role, tempoMin: 8 | 9 | 10) => boolean;

  getActiveChecklist: () => Checklist | null;
  hydrateStation: (id: string) => Promise<Checklist | null>;
};

const TrainingCtx = createContext<TrainingState | null>(null);

// ── Constants & Helpers ────────────────────────────────────────────────────────

const FAVORITES_KEY = "revalida.training.favorites";
const DISCONNECT_GRACE_SECONDS = 120;

function loadFavorites(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveFavorites(map: Record<string, boolean>) {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(map));
}

function isRealPartnerId(id: string | null): boolean {
  return id !== null && id !== "__solo__";
}

function phaseToRoute(status: string, myRole: Role | null): string | null {
  switch (status) {
    case "invited": return null;
    case "roles_selection":
    case "waiting_roles": return "/treino/roles";
    case "configuring_station": return myRole === "paciente" ? "/treino/config" : "/treino/espera";
    case "waiting_start": return "/treino/espera";
    case "running":
    case "paused_disconnect":
    case "paused_manual": return "/treino/estacao";
    default: return null;
  }
}

// ── Provider ───────────────────────────────────────────────────────────────────

export function TrainingProvider({ children }: { children: React.ReactNode }) {
  const { user, reloadProfile } = useAuth();
  const userId = user?.id ?? null;

  const { onlineUsers, realtimeState, manager } = useRealtime();

  const pendingInvite = realtimeState.pendingInvite;
  const matchmakingActive = realtimeState.matchmakingActive;
  const outgoingInviteName = realtimeState.outgoingInviteTargetName ?? null;

  const checklistCacheRef = useRef<ChecklistSummary[]>([]);
  const [checklistCache, setChecklistCache] = useState<ChecklistSummary[]>([]);

  useEffect(() => {
    checklistCacheRef.current = checklistCache;
  }, [checklistCache]);

  const checklistDetailMapRef = useRef<Map<string, Checklist>>(new Map());

  useEffect(() => {
    if (!userId || !isSupabaseConfigured) return;
    listChecklistCatalog()
      .then((data) => {
        setChecklistCache(data);
        setHasNetworkError(false);
      })
      .catch((e) => {
        console.warn("[TrainingContext] loadChecklists error:", e);
        setHasNetworkError(true);
      });
  }, [userId]);

  // ── Carregamento de Perfis Reais do Supabase ──

  const [allProfiles, setAllProfiles] = useState<
    { id: string; name: string; display_name: string | null }[]
  >([]);
  const profilesLoadedRef = useRef(false);

  useEffect(() => {
    if (!userId || !isSupabaseConfigured || profilesLoadedRef.current) return;
    profilesLoadedRef.current = true;
    supabase
      .from("profiles_public")
      .select("id, name, display_name")
      .then(({ data }) => {
        if (data)
          setAllProfiles(
            data as { id: string; name: string; display_name: string | null }[],
          );
      });
  }, [userId]);

  const [users, setUsers] = useState<TrainingUser[]>([]);

  useEffect(() => {
    const favs = loadFavorites();
    const onlineMap = new Map(onlineUsers.map((u) => [u.user_id, u]));

    const profileMap = new Map<string, { id: string; name: string; display_name: string | null }>();
    for (const p of allProfiles) {
      if (p.id !== userId) profileMap.set(p.id, p);
    }

    for (const ou of onlineUsers) {
      if (!profileMap.has(ou.user_id) && ou.user_id !== userId) {
        profileMap.set(ou.user_id, { id: ou.user_id, name: ou.name, display_name: null });
      }
    }

    const realUsers: TrainingUser[] = Array.from(profileMap.values()).map((p) => {
      const presence = onlineMap.get(p.id);
      return {
        id: p.id,
        nome: p.display_name?.trim() || p.name?.trim() || "Usuário",
        online: onlineMap.has(p.id),
        nota: 0,
        favorito: favs[p.id] ?? false,
        estacoes: 0,
        isReal: true,
        userStatus: presence?.status ?? "available",
      };
    });

    setUsers(realUsers);
  }, [allProfiles, onlineUsers, userId]);

  const [search, setSearch] = useState("");

  // ── Estados da Sessão ──
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [partnerName, setPartnerName] = useState<string | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [status, setStatus] = useState<SessionStatus>("idle");
  const [config, setConfig] = useState<StationConfig | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [endedAt, setEndedAt] = useState<number | null>(null);
  const [remainingSec, setRemainingSec] = useState(0);
  const [impressosLiberados, setImpressosLiberados] = useState<string[]>([]);
  const [pepRespostas, setPepRespostas] = useState<Record<string, PepResposta>>({});
  const [history, setHistory] = useState<SavedSession[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [hasNetworkError, setHasNetworkError] = useState(false);
  const [isSavingSession, setIsSavingSession] = useState(false);

  // ── Resiliência ──
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [partnerDisconnected, setPartnerDisconnected] = useState(false);
  const [disconnectCountdown, setDisconnectCountdown] = useState(0);
  const [isRestoringSession, setIsRestoringSession] = useState(true);
  const [recoveryRoute, setRecoveryRoute] = useState<string | null>(null);
  const [pausedByName, setPausedByName] = useState<string | null>(null);
  const [partnerSuspected, setPartnerSuspected] = useState(false);

  // ── Refs ──
  const configRef = useRef<StationConfig | null>(null);
  configRef.current = config;
  const roleRef = useRef<Role | null>(null);
  roleRef.current = role;
  const partnerIdRef = useRef<string | null>(null);
  partnerIdRef.current = partnerId;
  const statusRef = useRef<SessionStatus>("idle");
  statusRef.current = status;
  const activeSessionIdRef = useRef<string | null>(null);
  activeSessionIdRef.current = activeSessionId;
  const isHostRef = useRef(false);
  isHostRef.current = isHost;
  const partnerDisconnectedRef = useRef(false);
  partnerDisconnectedRef.current = partnerDisconnected;
  const partnerNameRef = useRef<string | null>(null);
  partnerNameRef.current = partnerName;
  const remainingSecRef = useRef(0);
  remainingSecRef.current = remainingSec;
  const userIdRef = useRef<string | null>(null);
  userIdRef.current = userId;
  const isRestoringSessionRef = useRef(true);
  isRestoringSessionRef.current = isRestoringSession;

  const tickRef = useRef<number | null>(null);
  const disconnectTimerRef = useRef<number | null>(null);
  const timerBaseRef = useRef<{ startedAt: number; remainingBase: number } | null>(null);

  // ── Cronômetro Principal ──

  const startTimerAt = useCallback(
    (
      startedAtTs: number,
      opts?: {
        durationMin?: number;
        preserveSessionState?: boolean;
        remainingBase?: number;
      },
    ) => {
      const cfg = configRef.current;
      const durationMin = opts?.durationMin ?? cfg?.tempoMin;
      if (!durationMin) return;

      const totalSec = durationMin * 60;
      const elapsedSec = Math.max(0, Math.floor((Date.now() - startedAtTs) / 1000));
      const remaining = opts?.remainingBase !== undefined
        ? Math.max(0, opts.remainingBase - elapsedSec)
        : Math.max(0, totalSec - elapsedSec);

      if (remaining === 0) {
        setRemainingSec(0);
        setStartedAt(startedAtTs);
        timerBaseRef.current = null;
        setStatus("ended");
        setEndedAt(Date.now());
        return;
      }

      timerBaseRef.current = {
        startedAt: startedAtTs,
        remainingBase: opts?.remainingBase ?? totalSec,
      };

      setRemainingSec(remaining);
      setStartedAt(startedAtTs);
      setEndedAt(null);
      if (!opts?.preserveSessionState) {
        setImpressosLiberados([]);
        setPepRespostas({});
      }
      setStatus("running");
      manager.setStatus("in_session");

      if (tickRef.current) window.clearInterval(tickRef.current);
      tickRef.current = window.setInterval(() => {
        const base = timerBaseRef.current;
        if (!base) return;
        const elapsed = Math.floor((Date.now() - base.startedAt) / 1000);
        const rem = Math.max(0, base.remainingBase - elapsed);
        setRemainingSec(rem);
        if (rem === 0) {
          if (tickRef.current) window.clearInterval(tickRef.current);
          tickRef.current = null;
          timerBaseRef.current = null;
          setStatus("ended");
          setEndedAt(Date.now());
        }
      }, 1000);
    },
    [manager],
  );

  const startTimerAtRef = useRef(startTimerAt);
  startTimerAtRef.current = startTimerAt;

  // ── Heartbeat e Recuperação de Sessão ──

  useSessionHeartbeat(
    isRealPartnerId(partnerId) ? activeSessionId : null,
    isHost,
  );

  useEffect(() => {
    if (!userId || !isSupabaseConfigured) {
      setIsRestoringSession(false);
      return;
    }
    if (statusRef.current !== "idle") return;

    let cancelled = false;
    cleanupOrphanSessions(userId);

    setIsRestoringSession(true);
    getActiveSessionForUser(userId)
      .then(async (session) => {
        if (cancelled) return;
        if (!session || statusRef.current !== "idle") {
          if (!cancelled) setIsRestoringSession(false);
          return;
        }

        const amHost = session.host_user_id === userId;
        const partnerId = amHost ? session.guest_user_id : session.host_user_id;
        if (!partnerId) {
          if (!cancelled) setIsRestoringSession(false);
          return;
        }

        const partnerProfile = await fetchPublicProfile(partnerId);
        if (cancelled) return;

        const resolvedName =
          partnerProfile?.display_name || partnerProfile?.name || "Parceiro";

        const myRole = (amHost ? session.host_role : session.guest_role) as Role | null;
        const target = phaseToRoute(session.status, myRole);

        if (!target) {
          setIsRestoringSession(false);
          return;
        }

        setActiveSessionId(session.id);
        setIsHost(amHost);
        setPartnerId(partnerId);
        setPartnerName(resolvedName);

        if (session.checklist_id && session.duration_minutes) {
          setConfig({
            checklistId: session.checklist_id,
            tempoMin: session.duration_minutes as 8 | 9 | 10,
          });
          await hydrateStation(session.checklist_id);
          if (cancelled) return;
        }

        if (myRole) setRole(myRole);

        if (isRealPartnerId(partnerId)) {
          manager.openSession(partnerId);
        }

        switch (session.status) {
          case "roles_selection":
          case "waiting_roles":
            setStatus("role-select");
            break;
          case "configuring_station":
            setStatus(myRole === "paciente" ? "config" : "waiting");
            break;
          case "waiting_start":
            setStatus("waiting");
            break;
          case "running":
          case "paused_disconnect":
            if (session.timer_started_at && session.duration_minutes) {
              const remainingBase = session.timer_remaining_seconds
                ? (session.timer_remaining_seconds as number)
                : undefined;
              startTimerAtRef.current(new Date(session.timer_started_at).getTime(), {
                durationMin: session.duration_minutes as number,
                preserveSessionState: true,
                remainingBase,
              });
            } else {
              setStatus("running");
            }
            break;
          case "paused_manual":
            if (session.duration_minutes) {
              const rem = session.timer_remaining_seconds
                ? (session.timer_remaining_seconds as number)
                : (session.duration_minutes as number) * 60;
              setRemainingSec(rem);
              timerBaseRef.current = null;
              setStatus("paused_manual");
            }
            break;
          default:
            setIsRestoringSession(false);
            return;
        }

        setRecoveryRoute(target);
        setIsRestoringSession(false);

        trackEvent(userId, "session_recovered_after_refresh", session.status, {
          session_id: session.id,
        });
        toast.info("Sessão recuperada", {
          description: `Voltando para a sessão com ${resolvedName}`,
        });
      })
      .catch(() => { if (!cancelled) setIsRestoringSession(false); });

    return () => { cancelled = true; };
  }, [userId, manager]);

  // ── Watchdog e Desconexão ──

  useEffect(() => {
    if (status === "running" && isRealPartnerId(partnerId)) {
      manager.startPartnerWatchdog();
    } else {
      manager.stopPartnerWatchdog();
    }
    return () => { manager.stopPartnerWatchdog(); };
  }, [status, partnerId, manager]);

  useEffect(() => {
    if (!partnerDisconnected) {
      if (disconnectTimerRef.current) {
        window.clearInterval(disconnectTimerRef.current);
        disconnectTimerRef.current = null;
      }
      setDisconnectCountdown(0);
      return;
    }

    setDisconnectCountdown(DISCONNECT_GRACE_SECONDS);

    if (disconnectTimerRef.current) return;
    disconnectTimerRef.current = window.setInterval(() => {
      setDisconnectCountdown((prev) => {
        if (prev <= 1) {
          if (disconnectTimerRef.current) {
            window.clearInterval(disconnectTimerRef.current);
            disconnectTimerRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (disconnectTimerRef.current) {
        window.clearInterval(disconnectTimerRef.current);
        disconnectTimerRef.current = null;
      }
    };
  }, [partnerDisconnected]);

  // ── Callbacks de Tempo Real (Realtime Callbacks) ──

  useEffect(() => {
    manager.onInviteRejected((name) => {
      toast.info(`${name} recusou o convite`);
    });

    manager.onInviteExpired(() => {
      toast.info("O convite expirou sem resposta");
    });

    manager.onMatchmakingTimeout(() => {
      toast.info("Nenhum colega disponível no momento. Tente novamente.");
    });

    manager.onRolesComplete((myRole) => {
      if (isRestoringSessionRef.current) return;
      setRole(myRole);
      if (myRole === "paciente") {
        setStatus("config");
      } else {
        setStatus("waiting");
      }
      const sid = activeSessionIdRef.current;
      if (sid) {
        const partnerRole: Role = myRole === "medico" ? "paciente" : "medico";
        if (isHostRef.current) {
          updateMultiplayerSession(sid, {
            status: "configuring_station",
            current_phase: "configuring_station",
            host_role: myRole,
            guest_role: partnerRole,
          });
        } else {
          updateMultiplayerSession(sid, {
            status: "configuring_station",
            current_phase: "configuring_station",
            guest_role: myRole,
            host_role: partnerRole,
          });
        }
      }
    });

    manager.onPartnerConfigured((cfg) => {
      if (isRestoringSessionRef.current) return;
      setConfig({ checklistId: cfg.checklistId, tempoMin: cfg.tempoMin });
      void hydrateStation(cfg.checklistId);
      const sid = activeSessionIdRef.current;
      if (sid) {
        updateMultiplayerSession(sid, {
          checklist_id: cfg.checklistId,
          duration_minutes: cfg.tempoMin,
        });
      }
    });

    manager.onPartnerStartedSession((startedAtTs) => {
      if (isRestoringSessionRef.current) return;
      startTimerAtRef.current(startedAtTs);
      const sid = activeSessionIdRef.current;
      if (sid) {
        updateMultiplayerSession(sid, {
          status: "running",
          current_phase: "running",
          timer_started_at: new Date(startedAtTs).toISOString(),
          started_at: new Date(startedAtTs).toISOString(),
        });
      }
    });

    manager.onImpressoLiberado((impressoId) => {
      setImpressosLiberados((prev) =>
        prev.includes(impressoId) ? prev : [...prev, impressoId],
      );
    });

    manager.onSessionEnded(() => {
      if (isRestoringSessionRef.current) return;
      if (statusRef.current === "ended") return;
      if (tickRef.current) {
        window.clearInterval(tickRef.current);
        tickRef.current = null;
      }
      setStatus("ended");
      setEndedAt(Date.now());
      const sid = activeSessionIdRef.current;
      if (sid) {
        finishMultiplayerSession(sid);
      }
    });

    manager.onPepMark((pepId, resposta) => {
      setPepRespostas((prev) => ({ ...prev, [pepId]: resposta as PepResposta }));
    });

    manager.onPartnerDisconnected(() => {
      if (isRestoringSessionRef.current) return;
      const s = statusRef.current;
      if (s !== "running" && s !== "waiting") return;
      if (s === "waiting" && configRef.current === null) return;
      if (partnerDisconnectedRef.current) return;

      setPartnerSuspected(false);
      setPartnerDisconnected(true);

      let frozenRemaining = remainingSecRef.current;
      if (s === "running" && timerBaseRef.current) {
        const base = timerBaseRef.current;
        const elapsed = Math.floor((Date.now() - base.startedAt) / 1000);
        frozenRemaining = Math.max(0, base.remainingBase - elapsed);
      }

      if (s === "running" && tickRef.current) {
        window.clearInterval(tickRef.current);
        tickRef.current = null;
      }
      timerBaseRef.current = null;
      setRemainingSec(frozenRemaining);

      const sid = activeSessionIdRef.current;
      if (sid && s === "running") {
        pauseSession(sid, frozenRemaining, "paused_disconnect");
        manager.broadcastTimerPause(frozenRemaining);
      }

      toast.warning(
        `${partnerNameRef.current ?? "Parceiro"} desconectou. Aguardando reconexão…`,
      );
      const uid = userIdRef.current;
      if (uid) {
        trackEvent(uid, "session_disconnected", s, { session_id: sid ?? undefined });
      }
    });

    manager.onPartnerSuspected(() => {
      if (isRestoringSessionRef.current) return;
      if (statusRef.current !== "running") return;
      if (!isRealPartnerId(partnerIdRef.current)) return;
      setPartnerSuspected(true);
    });

    manager.onPartnerSuspectedResolved(() => {
      setPartnerSuspected(false);
    });

    manager.onPartnerReconnected(() => {
      if (isRestoringSessionRef.current) return;
      if (!partnerDisconnectedRef.current) return;
      const s = statusRef.current;
      if (s === "waiting" && configRef.current === null) return;

      setPartnerSuspected(false);
      setPartnerDisconnected(false);

      const sid = activeSessionIdRef.current;
      if (sid && s === "running" && remainingSecRef.current > 0) {
        resumeSession(sid).then((newStartedAtISO) => {
          if (!newStartedAtISO) return;
          const newStartedAt = new Date(newStartedAtISO).getTime();
          const remaining = remainingSecRef.current;

          timerBaseRef.current = { startedAt: newStartedAt, remainingBase: remaining };

          if (tickRef.current) window.clearInterval(tickRef.current);
          tickRef.current = window.setInterval(() => {
            const base = timerBaseRef.current;
            if (!base) return;
            const elapsed = Math.floor((Date.now() - base.startedAt) / 1000);
            const rem = Math.max(0, base.remainingBase - elapsed);
            setRemainingSec(rem);
            if (rem === 0) {
              if (tickRef.current) window.clearInterval(tickRef.current);
              tickRef.current = null;
              timerBaseRef.current = null;
              setStatus("ended");
              setEndedAt(Date.now());
            }
          }, 1000);

          manager.broadcastTimerResume(newStartedAt, remaining);
        });
      }

      toast.success(`${partnerNameRef.current ?? "Parceiro"} reconectou!`);
      const uid = userIdRef.current;
      if (uid) {
        trackEvent(uid, "session_reconnected", s ?? undefined, { session_id: sid ?? undefined });
      }
    });

    manager.onTimerPaused((remaining, pausedByUserId) => {
      if (isRestoringSessionRef.current) return;
      if (tickRef.current) {
        window.clearInterval(tickRef.current);
        tickRef.current = null;
      }
      timerBaseRef.current = null;
      setRemainingSec(remaining);
      setStatus("paused_manual");
      if (pausedByUserId && pausedByUserId !== userIdRef.current) {
        setPausedByName(partnerNameRef.current);
      }
    });

    manager.onTimerResumed((startedAt, remaining) => {
      if (isRestoringSessionRef.current) return;
      timerBaseRef.current = { startedAt, remainingBase: remaining };
      if (tickRef.current) window.clearInterval(tickRef.current);
      tickRef.current = window.setInterval(() => {
        const base = timerBaseRef.current;
        if (!base) return;
        const elapsed = Math.floor((Date.now() - base.startedAt) / 1000);
        const rem = Math.max(0, base.remainingBase - elapsed);
        setRemainingSec(rem);
        if (rem === 0) {
          if (tickRef.current) window.clearInterval(tickRef.current);
          tickRef.current = null;
          timerBaseRef.current = null;
          setStatus("ended");
          setEndedAt(Date.now());
        }
      }, 1000);
      setStatus("running");
    });
  }, [manager]);

  // ── Resultado de Matchmaking ──

  useEffect(() => {
    const result = realtimeState.matchResult;
    if (!result) return;

    setPartnerId(result.partnerId);
    setPartnerName(result.partnerName);
    setStatus("role-select");

    if (result.source === "matchmaking") {
      toast.success(`Parceiro encontrado: ${result.partnerName}!`);
    }

    if (isRealPartnerId(result.partnerId)) {
      manager.openSession(result.partnerId);
    }

    manager.clearMatchResult();

    if (userId && isRealPartnerId(result.partnerId)) {
      const ids = [userId, result.partnerId].sort();
      const amHost = userId === ids[0];
      setIsHost(amHost);

      createOrGetMultiplayerSession(userId, result.partnerId)
        .then((session) => {
          if (session) {
            setActiveSessionId(session.id);
            updateMultiplayerSession(session.id, {
              status: "roles_selection",
              current_phase: "roles_selection",
            });
          }
        })
        .catch(() => {});
    }
  }, [realtimeState.matchResult, manager, userId]);

  // ── Atualização de Status de Presença ──

  useEffect(() => {
    if (realtimeState.matchmakingActive) return;
    if (realtimeState.pendingInvite) return;
    if (realtimeState.outgoingInviteTargetId) return;

    if (status === "idle" || status === "ended") {
      manager.setStatus("available");
    } else if (status === "running") {
      manager.setStatus("in_session");
    } else {
      manager.setStatus("busy");
    }
  }, [
    status,
    manager,
    realtimeState.matchmakingActive,
    realtimeState.pendingInvite,
    realtimeState.outgoingInviteTargetId,
  ]);

  // ── Histórico e Banco de Dados ──

  const loadHistory = useCallback(async (uid: string) => {
    if (!isSupabaseConfigured) return;
    setIsLoadingHistory(true);
    try {
      const sessions = await fetchSessions(uid);
      setHistory(sessions);
      setHasNetworkError(false);
      processLoginMissionProgress(uid, sessions).catch(() => {});
      evaluateLoginAchievements(uid, sessions).catch(() => {});
    } catch (e) {
      console.warn("[TrainingContext] loadHistory error:", e);
      setHasNetworkError(true);
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  const reloadHistory = useCallback(async () => {
    if (userId) await loadHistory(userId);
  }, [userId, loadHistory]);

  const retryLoad = useCallback(async () => {
    if (!userId || !isSupabaseConfigured) return;
    setHasNetworkError(false);
    await loadHistory(userId);
    listChecklistCatalog()
      .then((data) => {
        setChecklistCache(data);
      })
      .catch((e) => {
        console.warn("[TrainingContext] retryLoad checklists error:", e);
        setHasNetworkError(true);
      });
  }, [userId, loadHistory]);

  useEffect(() => {
    if (!userId) {
      setHistory([]);
      setIsLoadingHistory(false);
      return;
    }
    loadHistory(userId);
  }, [userId, loadHistory]);

  // ── Auxiliares de Checklist ──

  const getActiveChecklist = (): Checklist | null => {
    if (!config) return null;
    return checklistDetailMapRef.current.get(config.checklistId) ?? null;
  };

  const hydrateStation = useCallback(async (id: string): Promise<Checklist | null> => {
    const cached = checklistDetailMapRef.current.get(id);
    if (cached) return cached;

    const detail = await fetchChecklistDetailsForTraining(id);
    if (detail) checklistDetailMapRef.current.set(id, detail);
    return detail;
  }, []);

  const clearRecoveryRoute = useCallback(() => setRecoveryRoute(null), []);

  const connectionState = useMemo<ConnectionState>(() => {
    if (isRestoringSession) return "restoring_session";
    const inMonitoredPhase =
      status === "running" || (status === "waiting" && config !== null);
    const hasRealPartner = isRealPartnerId(partnerId);

    if (hasRealPartner && onlineUsers.some((u) => u.user_id === partnerId)) {
      return "connected";
    }

    if (!realtimeState.isConnected && inMonitoredPhase && hasRealPartner) return "self_reconnecting";
    if (partnerDisconnected && inMonitoredPhase) return "partner_disconnected";
    if (partnerSuspected && inMonitoredPhase) return "partner_suspected";
    return "connected";
  }, [isRestoringSession, realtimeState.isConnected, partnerDisconnected, partnerSuspected, status, config, partnerId, onlineUsers]);

  const isSolo = partnerId === "__solo__";

  // ── Ações do Usuário (100% Reais) ──

  const toggleFavorito = (uid: string) => {
    setUsers((prev) => {
      const next = prev.map((u) => (u.id === uid ? { ...u, favorito: !u.favorito } : u));
      const favMap: Record<string, boolean> = {};
      for (const u of next) favMap[u.id] = u.favorito;
      saveFavorites(favMap);
      return next;
    });
  };

  const sendInvite = (uid: string) => {
    const u = users.find((x) => x.id === uid);
    if (!u || !u.online) return;
    manager.sendInvite(uid, u.nome);
  };

  const cancelOutgoingInvite = () => {
    manager.cancelOutgoingInvite();
  };

  const acceptInvite = () => {
    manager.acceptInvite();
  };

  const declineInvite = () => {
    manager.rejectInvite();
  };

  const startInstaCheck = () => {
    manager.joinMatchmaking();
  };

  const cancelInstaCheck = () => {
    manager.leaveMatchmaking();
  };

  const selectRole = (chosen: Role | "aleatorio") => {
    const actual: Role =
      chosen === "aleatorio"
        ? Math.random() < 0.5
          ? "medico"
          : "paciente"
        : chosen;

    if (isRealPartnerId(partnerIdRef.current)) {
      manager.broadcastRole(actual);
    }
  };

  const setStationConfig = (cfg: StationConfig) => {
    setConfig(cfg);

    if (isRealPartnerId(partnerIdRef.current) && roleRef.current === "paciente") {
      manager.broadcastConfig(cfg);
      setStatus("waiting");
      const sid = activeSessionIdRef.current;
      if (sid) {
        updateMultiplayerSession(sid, {
          status: "waiting_start",
          current_phase: "waiting_start",
          checklist_id: cfg.checklistId,
          duration_minutes: cfg.tempoMin,
        });
      }
    }
  };

  const startStation = () => {
    const cfg = configRef.current;
    if (!cfg) return;
    const ts = Date.now();

    if (isRealPartnerId(partnerIdRef.current) && roleRef.current === "medico") {
      manager.startSession(ts);
      const sid = activeSessionIdRef.current;
      if (sid) {
        const totalSec = (cfg.tempoMin as number) * 60;
        updateMultiplayerSession(sid, {
          status: "running",
          current_phase: "running",
          timer_started_at: new Date(ts).toISOString(),
          started_at: new Date(ts).toISOString(),
          timer_remaining_seconds: totalSec,
        });
      }
    } else {
      manager.startSession();
    }

    startTimerAt(ts);
  };

  const liberarImpresso = (impressoId: string) => {
    setImpressosLiberados((prev) =>
      prev.includes(impressoId) ? prev : [...prev, impressoId],
    );
    if (isRealPartnerId(partnerIdRef.current) && roleRef.current === "paciente") {
      manager.broadcastImpresso(impressoId);
    }
  };

  const marcarPep = (pepId: string, resposta: PepResposta) => {
    setPepRespostas((prev) => ({ ...prev, [pepId]: resposta }));
    if (isRealPartnerId(partnerIdRef.current) && roleRef.current === "paciente") {
      manager.broadcastPepMark(pepId, resposta);
    }
  };

  const encerrarEstacao = () => {
    if (statusRef.current === "ended") return;
    if (tickRef.current) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }

    setStatus("ended");
    setEndedAt(Date.now());
    if (isRealPartnerId(partnerIdRef.current)) {
      manager.endSession();
    }
    const sid = activeSessionIdRef.current;
    if (sid) {
      finishMultiplayerSession(sid);
    }
    if (partnerDisconnectedRef.current) {
      setPartnerDisconnected(false);
    }
    if (userIdRef.current && sid) {
      trackEvent(userIdRef.current, "session_completed", "estação", { session_id: sid });
    }
  };

  const salvarEstacao = () => {
    if (statusRef.current !== "ended") return;
    if (partnerIdRef.current === "__solo__") return;
    const cl = getActiveChecklist();
    if (!cl || !config || !partnerName || !role) return;

    const sid = activeSessionIdRef.current;

    if (sid && userId) {
      const markedItems = Object.entries(pepRespostas).map(([id, resposta]) => ({
        id,
        resposta,
      }));

      setIsSavingSession(true);
      void (async () => {
        try {
          const { data, error } = await supabase.rpc(
            "fn_submit_and_calculate_osce_grade",
            {
              p_session_id: sid,
              p_marked_items_json: markedItems,
            },
          );
          if (error) {
            console.warn("[TrainingContext] RPC grading error:", error.message);
            return;
          }
          const result = data as {
            session_record_id: string;
            nota: number;
            nota_total: number;
            nota_maxima: number;
          };
          const entry: SavedSession = {
            id: result.session_record_id,
            partnerName: partnerName!,
            role: role!,
            checklistId: cl.id,
            checklistTitle: cl.title,
            tempoMin: config!.tempoMin,
            notaTotal: result.nota_total,
            notaMaxima: result.nota_maxima,
            endedAt: new Date().toISOString(),
          };
          setHistory((prev) => [entry, ...prev].slice(0, 200));
          const historyForTitles = [entry, ...history].slice(0, 200);
          reloadProfile();
          evaluateAutomaticTitles(userId, historyForTitles).catch(() => {});
          processMissionProgressAfterSession(userId, historyForTitles).catch(() => {});
          evaluateAndUnlockAchievements(userId, historyForTitles).catch(() => {});
        } catch (e: unknown) {
          console.warn("[TrainingContext] Error calling grading RPC:", e);
        } finally {
          setIsSavingSession(false);
        }
      })();
    } else {
      let total = 0;
      let max = 0;
      for (const block of cl.pepBlocks) {
        max += Math.max(block.scoreAdequado, block.scoreParcial, 0);
        const r = pepRespostas[block.id];
        if (r === "adequado") total += block.scoreAdequado;
        else if (r === "parcial") total += block.scoreParcial;
      }
      const entry: SavedSession = {
        id:
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : Math.random().toString(36).slice(2),
        partnerName,
        role,
        checklistId: cl.id,
        checklistTitle: cl.title,
        tempoMin: config.tempoMin,
        notaTotal: Math.round(total * 100) / 100,
        notaMaxima: Math.round(max * 100) / 100,
        endedAt: new Date().toISOString(),
      };
      setHistory((prev) => [entry, ...prev].slice(0, 200));
      if (userId) {
        const historyForTitles = [entry, ...history].slice(0, 200);
        saveSession(entry, userId)
          .then(() => {
            reloadProfile();
            evaluateAutomaticTitles(userId, historyForTitles).catch(() => {});
            processMissionProgressAfterSession(userId, historyForTitles).catch(() => {});
            evaluateAndUnlockAchievements(userId, historyForTitles).catch(() => {});
          })
          .catch((e) => {
            console.warn("[TrainingContext] Error saving session to Supabase:", e);
          });
      }
    }
  };

  const repeatStation = (checklistId: string, chosenRole: Role, tempoMin: 8 | 9 | 10): boolean => {
    const exists =
      checklistDetailMapRef.current.has(checklistId) ||
      checklistCacheRef.current.some((c) => c.id === checklistId);
    if (!exists) return false;

    if (tickRef.current) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }

    manager.resetMultiplayerState();

    setPartnerId(null);
    setPartnerName("Treino solo");
    setRole(chosenRole);
    setConfig({ checklistId, tempoMin });
    setEndedAt(null);
    setImpressosLiberados([]);
    setPepRespostas({});
    setActiveSessionId(null);
    setIsHost(false);
    setPartnerDisconnected(false);

    const ts = Date.now();
    const totalSec = tempoMin * 60;
    timerBaseRef.current = { startedAt: ts, remainingBase: totalSec };
    setRemainingSec(totalSec);
    setStartedAt(ts);
    setStatus("running");
    manager.setStatus("in_session");

    tickRef.current = window.setInterval(() => {
      const base = timerBaseRef.current;
      if (!base) return;
      const elapsed = Math.floor((Date.now() - base.startedAt) / 1000);
      const rem = Math.max(0, base.remainingBase - elapsed);
      setRemainingSec(rem);
      if (rem === 0) {
        if (tickRef.current) window.clearInterval(tickRef.current);
        tickRef.current = null;
        timerBaseRef.current = null;
        setStatus("ended");
        setEndedAt(Date.now());
      }
    }, 1000);

    return true;
  };

  // ── Pause / Resume Manual ──

  const pauseStation = useCallback(() => {
    const s = statusRef.current;
    if (s !== "running") return;
    if (!isRealPartnerId(partnerIdRef.current)) return;

    let frozenRemaining = remainingSecRef.current;
    if (timerBaseRef.current) {
      const base = timerBaseRef.current;
      const elapsed = Math.floor((Date.now() - base.startedAt) / 1000);
      frozenRemaining = Math.max(0, base.remainingBase - elapsed);
    }

    if (tickRef.current) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
    timerBaseRef.current = null;
    setRemainingSec(frozenRemaining);
    setStatus("paused_manual");
    setPausedByName(null);

    const sid = activeSessionIdRef.current;
    if (sid) {
      pauseSession(sid, frozenRemaining, "paused_manual");
      manager.broadcastTimerPause(frozenRemaining, userIdRef.current ?? undefined);
    }
  }, [manager]);

  const resumeStation = useCallback(() => {
    const s = statusRef.current;
    if (s !== "paused_manual") return;
    if (!isRealPartnerId(partnerIdRef.current)) return;

    const sid = activeSessionIdRef.current;
    if (!sid) return;
    const remaining = remainingSecRef.current;
    if (remaining <= 0) return;

    resumeSession(sid).then((newStartedAtISO) => {
      if (!newStartedAtISO) return;
      const newStartedAt = new Date(newStartedAtISO).getTime();

      timerBaseRef.current = { startedAt: newStartedAt, remainingBase: remaining };

      if (tickRef.current) window.clearInterval(tickRef.current);
      tickRef.current = window.setInterval(() => {
        const base = timerBaseRef.current;
        if (!base) return;
        const elapsed = Math.floor((Date.now() - base.startedAt) / 1000);
        const rem = Math.max(0, base.remainingBase - elapsed);
        setRemainingSec(rem);
        if (rem === 0) {
          if (tickRef.current) window.clearInterval(tickRef.current);
          tickRef.current = null;
          timerBaseRef.current = null;
          setStatus("ended");
          setEndedAt(Date.now());
        }
      }, 1000);

      setStatus("running");
      setPausedByName(null);

      manager.broadcastTimerResume(newStartedAt, remaining);
    });
  }, [manager]);

  // ── Modo Solo e Saída ──

  const startSolo = () => {
    if (tickRef.current) { window.clearInterval(tickRef.current); tickRef.current = null; }
    manager.resetMultiplayerState();
    setPartnerId("__solo__");
    setPartnerName("Modo Solo");
    setRole(null);
    setConfig(null);
    setStartedAt(null);
    setEndedAt(null);
    setRemainingSec(0);
    setImpressosLiberados([]);
    setPepRespostas({});
    setActiveSessionId(null);
    setIsHost(false);
    setPartnerDisconnected(false);
    setDisconnectCountdown(0);
    setStatus("config");
  };

  const startSoloStation = (cfg: StationConfig, soloRole: Role) => {
    if (partnerIdRef.current !== "__solo__") return;
    setConfig(cfg);
    configRef.current = cfg;
    setRole(soloRole);
    roleRef.current = soloRole;
    startTimerAt(Date.now());
  };

  const exitTraining = () => {
    const sid = activeSessionIdRef.current;
    const s = statusRef.current;
    if (sid && s === "ended") {
      finishMultiplayerSession(sid);
    } else if (sid && s !== "idle") {
      abandonMultiplayerSession(sid);
      const uid = userIdRef.current;
      if (uid) {
        trackEvent(uid, "session_abandoned", s, { session_id: sid });
      }
    }

    if (tickRef.current) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
    if (disconnectTimerRef.current) {
      window.clearInterval(disconnectTimerRef.current);
      disconnectTimerRef.current = null;
    }

    manager.endSession();
    manager.resetMultiplayerState();

    setPartnerId(null);
    setPartnerName(null);
    setRole(null);
    setConfig(null);
    setStartedAt(null);
    setEndedAt(null);
    setRemainingSec(0);
    setImpressosLiberados([]);
    setPepRespostas({});
    setStatus("idle");
    setActiveSessionId(null);
    setIsHost(false);
    setPartnerDisconnected(false);
    setDisconnectCountdown(0);
  };

  useEffect(() => {
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
      if (disconnectTimerRef.current) window.clearInterval(disconnectTimerRef.current);
    };
  }, []);

  // ── Fechamento de Aba / Desconexão ──

  useEffect(() => {
    const handleBeforeUnload = () => {
      const sid = activeSessionIdRef.current;
      const s   = statusRef.current;
      const pid = partnerIdRef.current;

      if (!sid || !isRealPartnerId(pid)) return;
      if (s === "idle" || s === "ended") return;
      if (!SUPABASE_REST_URL || !SUPABASE_ANON_KEY) return;

      const isRunning = s === "running";
      const newStatus = isRunning ? "paused_disconnect" : "abandoned";

      const body: Record<string, unknown> = {
        status: newStatus,
        current_phase: newStatus,
      };

      if (isRunning) {
        let frozen = remainingSecRef.current;
        if (timerBaseRef.current) {
          const base = timerBaseRef.current;
          const elapsed = Math.floor((Date.now() - base.startedAt) / 1000);
          frozen = Math.max(0, base.remainingBase - elapsed);
        }
        body.timer_remaining_seconds = frozen;
        body.timer_started_at = null;
      } else {
        body.ended_at = new Date().toISOString();
      }

      const endpoint =
        `${SUPABASE_REST_URL}/rest/v1/multiplayer_sessions` +
        `?id=eq.${sid}&status=not.in.(finished,abandoned)`;

      void fetch(endpoint, {
        method: "PATCH",
        keepalive: true,
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${readJwtSync()}`,
          "Prefer": "return=minimal",
        },
        body: JSON.stringify(body),
      });
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  // ── Context Value ──

  const value = useMemo<TrainingState>(
    () => ({
      users,
      search,
      setSearch,
      partnerId,
      partnerName,
      role,
      status,
      config,
      startedAt,
      endedAt,
      remainingSec,
      impressosLiberados,
      pepRespostas,
      pendingInvite,
      outgoingInviteName,
      matchmakingActive,
      sessionSync: realtimeState.session,
      history,
      isLoadingHistory,
      reloadHistory,
      hasNetworkError,
      retryLoad,
      activeSessionId,
      isHost,
      partnerDisconnected,
      disconnectCountdown,
      connectionState,
      recoveryRoute,
      clearRecoveryRoute,
      isSolo,
      startSolo,
      startSoloStation,
      toggleFavorito,
      sendInvite,
      cancelOutgoingInvite,
      acceptInvite,
      declineInvite,
      startInstaCheck,
      cancelInstaCheck,
      selectRole,
      setStationConfig,
      startStation,
      liberarImpresso,
      marcarPep,
      encerrarEstacao,
      salvarEstacao,
      isSavingSession,
      exitTraining,
      repeatStation,
      getActiveChecklist,
      hydrateStation,
      pauseStation,
      resumeStation,
      pausedByName,
    }),
    [
      users,
      search,
      partnerId,
      partnerName,
      role,
      status,
      config,
      startedAt,
      endedAt,
      remainingSec,
      impressosLiberados,
      pepRespostas,
      pendingInvite,
      outgoingInviteName,
      matchmakingActive,
      realtimeState.session,
      history,
      isLoadingHistory,
      reloadHistory,
      hasNetworkError,
      retryLoad,
      activeSessionId,
      isHost,
      partnerDisconnected,
      disconnectCountdown,
      connectionState,
      recoveryRoute,
      clearRecoveryRoute,
      isSolo,
      isSavingSession,
      pauseStation,
      resumeStation,
      pausedByName,
      hydrateStation,
    ],
  );

  return <TrainingCtx.Provider value={value}>{children}</TrainingCtx.Provider>;
}

export function useTraining() {
  const ctx = useContext(TrainingCtx);
  if (!ctx) throw new Error("useTraining must be used within TrainingProvider");
  return ctx;
}