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
import { MOCK_USERS, type TrainingUser } from "@/lib/trainingData";
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
  /** Grande área populated from the sessions table (server-authoritative). */
  area?: string | null;
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

  /**
   * Estado de sessão sincronizado em tempo real.
   * Útil para componentes que precisam saber se papéis foram atribuídos.
   */
  sessionSync: SessionSyncState;

  history: SavedSession[];
  isLoadingHistory: boolean;
  reloadHistory: () => Promise<void>;
  hasNetworkError: boolean;
  retryLoad: () => Promise<void>;

  /** Resiliência multiplayer */
  activeSessionId: string | null;
  isHost: boolean;
  partnerDisconnected: boolean;
  disconnectCountdown: number;
  connectionState: ConnectionState;
  /** Rota para qual o app deve navegar após recovery automático. */
  recoveryRoute: string | null;
  clearRecoveryRoute: () => void;

  /** Manual pause/resume (multiplayer only) */
  pauseStation: () => void;
  resumeStation: () => void;
  pausedByName: string | null;

  /** Modo solo (sem parceiro) */
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

  /**
   * Fetches and caches the full station dataset for the given checklist ID.
   * Must be called (and awaited) before startSoloStation / setStationConfig
   * so that getActiveChecklist() is populated when the station screen mounts.
   * Returns the full Checklist or null if not found.
   */
  hydrateStation: (id: string) => Promise<Checklist | null>;
};

const TrainingCtx = createContext<TrainingState | null>(null);

// ── Constants ──────────────────────────────────────────────────────────────────

const FAVORITES_KEY = "revalida.training.favorites";
const DISCONNECT_GRACE_SECONDS = 120;

// ── Helpers ────────────────────────────────────────────────────────────────────

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

function pickRandomOnlineUser(exclude?: string | null): TrainingUser | null {
  const candidates = MOCK_USERS.filter((u) => u.online && u.id !== exclude);
  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

/** true quando o parceiro é um usuário Supabase real (IDs mock começam com "u-"; solo usa "__solo__"). */
function isRealPartnerId(id: string | null): boolean {
  return id !== null && !id.startsWith("u-") && id !== "__solo__";
}

/** Mapeia fase da sessão no DB para a rota correspondente.
 *  Retorna null quando a fase é inicial demais para recovery (invited). */
function phaseToRoute(
  status: string,
  myRole: "medico" | "paciente" | null,
): string | null {
  switch (status) {
    case "invited": return null; // muito cedo — não redirecionar
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

  // ── Realtime (single source of truth for multiplayer) ──
  const { onlineUsers, realtimeState, manager } = useRealtime();

  // Derived multiplayer state
  const pendingInvite = realtimeState.pendingInvite;
  const matchmakingActive = realtimeState.matchmakingActive;
  const [mockOutgoingInviteName, setMockOutgoingInviteName] = useState<string | null>(null);
  const outgoingInviteName = realtimeState.outgoingInviteTargetName ?? mockOutgoingInviteName;

  // ── Checklist catalog cache (lightweight summaries for listing/filtering) ──
  const checklistCacheRef = useRef<ChecklistSummary[]>([]);
  const [checklistCache, setChecklistCache] = useState<ChecklistSummary[]>([]);

  useEffect(() => {
    checklistCacheRef.current = checklistCache;
  }, [checklistCache]);

  // Full station details, keyed by checklist ID.
  // Populated by hydrateStation() when the user confirms station selection.
  // getActiveChecklist() reads exclusively from this map so heavy exam content
  // (case scenarios, actor scripts, PEP texts) is never present in memory
  // until training is actively running.
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

  // ── Users list ──

  // Todos os perfis reais do banco — base da lista online/offline.
  const [allProfiles, setAllProfiles] = useState<
    { id: string; name: string; display_name: string | null }[]
  >([]);
  const profilesLoadedRef = useRef(false);

  // Carrega todos os perfis cadastrados uma vez por sessão autenticada.
  // Uses profiles_public (security-barrier view) so only safe, non-sensitive
  // columns are read — the direct profiles table is restricted to own-row after
  // migration 012.
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

  const [users, setUsers] = useState<TrainingUser[]>(() => {
    const favs = loadFavorites();
    return MOCK_USERS.map((u) => ({ ...u, favorito: favs[u.id] ?? u.favorito }));
  });

  // Deriva a lista fundindo perfis do banco com presença realtime.
  // Regra:
  //   online  → perfil em allProfiles E presente no canal realtime
  //   offline → perfil em allProfiles e NÃO presente no canal realtime
  // Fallback: mocks apenas se nenhum perfil real disponível (ex.: Supabase offline).
  useEffect(() => {
    const favs = loadFavorites();
    const onlineMap = new Map(onlineUsers.map((u) => [u.user_id, u]));

    // Base: todos os perfis do banco, excluindo o próprio usuário logado
    const profileMap = new Map<string, { id: string; name: string; display_name: string | null }>();
    for (const p of allProfiles) {
      if (p.id !== userId) profileMap.set(p.id, p);
    }

    // Adiciona usuários online que ainda não estão em allProfiles
    // (edge case: novo cadastro antes do próximo fetch de perfis)
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

    if (realUsers.length > 0) {
      setUsers(realUsers);
    } else {
      // Fallback somente se nenhum perfil real disponível
      setUsers(
        MOCK_USERS.map((u) => ({ ...u, favorito: favs[u.id] ?? u.favorito, isReal: false })),
      );
    }
  }, [allProfiles, onlineUsers, userId]);

  const [search, setSearch] = useState("");

  // ── Session state ──
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

  // ── Resilience state ──
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [partnerDisconnected, setPartnerDisconnected] = useState(false);
  const [disconnectCountdown, setDisconnectCountdown] = useState(0);
  const [isRestoringSession, setIsRestoringSession] = useState(true);
  const [recoveryRoute, setRecoveryRoute] = useState<string | null>(null);
  const [pausedByName, setPausedByName] = useState<string | null>(null);
  const [partnerSuspected, setPartnerSuspected] = useState(false);

  // ── Refs (always current, safe in stale closures) ──
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
  // Ref síncrono do recovery — consultado em callbacks registrados no mount
  const isRestoringSessionRef = useRef(true);
  isRestoringSessionRef.current = isRestoringSession;

  // ── Timer refs ──
  const tickRef = useRef<number | null>(null);
  const simulatedPacienteTimerRef = useRef<number | null>(null);
  const simulatedMedicoMarksRef = useRef<number | null>(null);
  const mockInviteTimerRef = useRef<number | null>(null);
  const disconnectTimerRef = useRef<number | null>(null);
  const guestSessionPollRef = useRef<number | null>(null);
  /**
   * Dead-reckoning base for the authoritative countdown.
   * remaining = remainingBase - floor((now - startedAt) / 1000)
   */
  const timerBaseRef = useRef<{ startedAt: number; remainingBase: number } | null>(null);

  const clearSimulatedPacienteTimer = () => {
    if (simulatedPacienteTimerRef.current) {
      window.clearTimeout(simulatedPacienteTimerRef.current);
      simulatedPacienteTimerRef.current = null;
    }
  };
  const clearSimulatedMedicoMarks = () => {
    if (simulatedMedicoMarksRef.current) {
      window.clearInterval(simulatedMedicoMarksRef.current);
      simulatedMedicoMarksRef.current = null;
    }
  };
  const clearMockInviteTimer = () => {
    if (mockInviteTimerRef.current) {
      window.clearTimeout(mockInviteTimerRef.current);
      mockInviteTimerRef.current = null;
    }
  };

  // ── Core timer logic (extracted for sync reuse) ────────────────────────────

  /**
   * Inicia o timer da estação a partir de um timestamp.
   * Usado tanto pelo médico (timestamp local) quanto pelo paciente (timestamp recebido).
   * Compensa automaticamente latência de rede.
   *
   * @param opts.durationMin — sobrescreve cfg.tempoMin; necessário durante recovery,
   *   quando setConfig() ainda não foi commitado pelo React e configRef.current é null.
   * @param opts.preserveSessionState — se true, não reseta impressosLiberados/pepRespostas
   *   nem inicia marks simulados (usado em recovery de sessão em andamento).
   */
  const startTimerAt = useCallback(
    (
      startedAtTs: number,
      opts?: {
        durationMin?: number;
        preserveSessionState?: boolean;
        /** Authoritative remaining-seconds base. When provided, overrides the
         *  elapsed-from-zero calculation. Used during resume-from-pause recovery. */
        remainingBase?: number;
      },
    ) => {
      const cfg = configRef.current;
      const r = roleRef.current;
      const durationMin = opts?.durationMin ?? cfg?.tempoMin;
      if (!durationMin) return;

      const totalSec = durationMin * 60;
      // Authoritative remaining: use provided base or derive from elapsed time
      const elapsedSec = Math.max(0, Math.floor((Date.now() - startedAtTs) / 1000));
      const remaining = opts?.remainingBase !== undefined
        ? Math.max(0, opts.remainingBase - elapsedSec)
        : Math.max(0, totalSec - elapsedSec);

      // Edge case: timer already expired during recovery gap
      if (remaining === 0) {
        setRemainingSec(0);
        setStartedAt(startedAtTs);
        timerBaseRef.current = null;
        setStatus("ended");
        setEndedAt(Date.now());
        return;
      }

      // Anchor for dead-reckoning — elapsed is re-computed each tick
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
          clearSimulatedMedicoMarks();
        }
      }, 1000);

      // Simulated PEP marks — only for mock multiplayer, skipped on recovery
      if (!opts?.preserveSessionState && r === "medico" && partnerIdRef.current !== "__solo__") {
        const cl = cfg?.checklistId
          ? checklistDetailMapRef.current.get(cfg.checklistId) ?? null
          : null;
        if (cl && cl.pepBlocks.length > 0) {
          const pending = [...cl.pepBlocks];
          clearSimulatedMedicoMarks();
          simulatedMedicoMarksRef.current = window.setInterval(() => {
            if (pending.length === 0) return;
            const idx = Math.floor(Math.random() * pending.length);
            const block = pending.splice(idx, 1)[0];
            const rv = Math.random();
            const resposta: PepResposta =
              rv < 0.55 ? "adequado" : rv < 0.85 ? "parcial" : "inadequado";
            setPepRespostas((prev) => ({ ...prev, [block.id]: resposta }));
          }, Math.max(8000, (durationMin * 60 * 1000) / Math.max(cl.pepBlocks.length, 1)));
        }
      }
    },
    [manager],
  );

  // Ref para evitar closure stale no callback do manager
  const startTimerAtRef = useRef(startTimerAt);
  startTimerAtRef.current = startTimerAt;

  // ── Session heartbeat (fires while a real multiplayer session is active) ────

  useSessionHeartbeat(
    isRealPartnerId(partnerId) ? activeSessionId : null,
    isHost,
  );

  // ── Session recovery (once per auth, only when idle) ──────────────────────

  useEffect(() => {
    if (!userId || !isSupabaseConfigured) {
      // Sem auth ou Supabase desabilitado — nada para recuperar
      setIsRestoringSession(false);
      return;
    }
    if (statusRef.current !== "idle") return;

    // Cancellation token: se o efeito re-executar (userId mudou, logout, etc.)
    // antes da promise resolver, nenhum estado stale é commitado.
    let cancelled = false;

    // Clean up zombie sessions from previous tabs/crashes
    cleanupOrphanSessions(userId);

    setIsRestoringSession(true);
    getActiveSessionForUser(userId)
      .then(async (session) => {
        // ── IMPORTANTE: NÃO chamar setIsRestoringSession(false) aqui.
        // O await abaixo (fetchProfile) quebra o batch do React 18.
        // Liberar o recovery SOMENTE depois de todos os estados estarem definidos.

        if (cancelled) return;

        if (!session) {
          if (!cancelled) setIsRestoringSession(false);
          return;
        }
        // Safety: não sobrescrever sessão local ativa
        if (statusRef.current !== "idle") {
          if (!cancelled) setIsRestoringSession(false);
          return;
        }

        const amHost = session.host_user_id === userId;
        const partnerId = amHost ? session.guest_user_id : session.host_user_id;
        if (!partnerId) {
          if (!cancelled) setIsRestoringSession(false);
          return;
        }

        // Resolve partner name via profiles_public (SECURITY DEFINER view) so
        // the cross-user read works after migration 012 locked the profiles
        // table to own-row only.  fetchPublicProfile never throws — it returns
        // null on error, which is handled gracefully below.
        const partnerProfile = await fetchPublicProfile(partnerId);

        // Verificar cancelamento APÓS o await (ponto de risco de race condition)
        if (cancelled) return;

        const resolvedName =
          partnerProfile?.display_name || partnerProfile?.name || "Parceiro";

        const myRole = (amHost ? session.host_role : session.guest_role) as Role | null;

        // Restore to correct route (verificar antes de commitar estado)
        const target = phaseToRoute(session.status, myRole);

        // Fase inicial (invited) ou não reconhecida — não restaurar
        if (!target) {
          setIsRestoringSession(false);
          return;
        }

        // ── Restaurar todos os estados de uma vez (mesmo microtask) ──
        setActiveSessionId(session.id);
        setIsHost(amHost);
        setPartnerId(partnerId);
        setPartnerName(resolvedName);

        if (session.checklist_id && session.duration_minutes) {
          setConfig({
            checklistId: session.checklist_id,
            tempoMin: session.duration_minutes as 8 | 9 | 10,
          });
          // CRITICAL: populate checklistDetailMapRef before the station
          // renders.  Without this await, getActiveChecklist() returns null
          // → Estacao.tsx line `if (!checklist || !role) return null` fires
          // → blank dark screen.  hydrateStation is idempotent (cached after
          // first fetch) so calling it here is safe and fast on re-entry.
          await hydrateStation(session.checklist_id);
          if (cancelled) return;
        }

        if (myRole) setRole(myRole);

        // Re-abrir rastreio Realtime
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
              // timer_remaining_seconds is the authoritative base from DB.
              // If null (legacy rows), fall back to full-duration calculation.
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
            // Restore frozen timer — no interval started, timer stays paused
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
            // finished / abandoned — não restaurar
            setIsRestoringSession(false);
            return;
        }

        setRecoveryRoute(target);

        // Liberar recovery DEPOIS de todos os estados e rota definidos.
        // O toast e a navegação ocorrem no próximo ciclo de render.
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
  }, [userId, manager]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Partner watchdog lifecycle (start when running, stop otherwise) ───────

  useEffect(() => {
    if (status === "running" && isRealPartnerId(partnerId)) {
      manager.startPartnerWatchdog();
    } else {
      manager.stopPartnerWatchdog();
    }
    return () => { manager.stopPartnerWatchdog(); };
  }, [status, partnerId, manager]);

  // ── Disconnect countdown timer ─────────────────────────────────────────────

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

  // ── Register manager callbacks (once on mount) ─────────────────────────────

  useEffect(() => {
    // Convite rejeitado
    manager.onInviteRejected((name) => {
      toast.info(`${name} recusou o convite`);
    });

    // Convite expirou sem resposta
    manager.onInviteExpired(() => {
      toast.info("O convite expirou sem resposta");
    });

    // Matchmaking expirou — fallback para usuário mock
    manager.onMatchmakingTimeout(() => {
      const partner = pickRandomOnlineUser(null);
      if (partner) {
        setPartnerId(partner.id);
        setPartnerName(partner.nome);
        setStatus("role-select");
        toast.success(`Parceiro encontrado: ${partner.nome}!`);
      } else {
        toast.info("Nenhum colega disponível no momento. Tente novamente.");
      }
    });

    // Ambos os papéis atribuídos — avançar para a próxima fase
    manager.onRolesComplete((myRole) => {
      if (isRestoringSessionRef.current) return;
      setRole(myRole);
      if (myRole === "paciente") {
        setStatus("config");
      } else {
        setStatus("waiting");
      }
      // Persist roles in DB
      const sid = activeSessionIdRef.current;
      if (sid) {
        const partnerRole: "medico" | "paciente" = myRole === "medico" ? "paciente" : "medico";
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

    // Paciente enviou configuração — médico recebe e pode iniciar
    manager.onPartnerConfigured((cfg) => {
      if (isRestoringSessionRef.current) return;
      setConfig({ checklistId: cfg.checklistId, tempoMin: cfg.tempoMin });
      // Pre-load checklist so getActiveChecklist() is populated when Estacao
      // mounts. Without this, the médico sees a blank screen until hard refresh
      // because checklistDetailMapRef is empty and the station guard
      // `if (!checklist || !role) return null` short-circuits the render.
      void hydrateStation(cfg.checklistId);
      // Persist checklist info for recovery
      const sid = activeSessionIdRef.current;
      if (sid) {
        updateMultiplayerSession(sid, {
          checklist_id: cfg.checklistId,
          duration_minutes: cfg.tempoMin,
        });
      }
    });

    // Médico iniciou a estação — paciente recebe e inicia com mesmo timestamp
    manager.onPartnerStartedSession((startedAtTs) => {
      if (isRestoringSessionRef.current) return;
      startTimerAtRef.current(startedAtTs);
      // Sync timer start in DB
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

    // Paciente liberou um impresso — médico recebe e exibe em tempo real
    manager.onImpressoLiberado((impressoId) => {
      setImpressosLiberados((prev) =>
        prev.includes(impressoId) ? prev : [...prev, impressoId],
      );
    });

    // Parceiro encerrou a estação — encerrar localmente SEM re-broadcast
    manager.onSessionEnded(() => {
      if (isRestoringSessionRef.current) return;
      if (statusRef.current === "ended") return;
      if (tickRef.current) {
        window.clearInterval(tickRef.current);
        tickRef.current = null;
      }
      if (simulatedMedicoMarksRef.current) {
        window.clearInterval(simulatedMedicoMarksRef.current);
        simulatedMedicoMarksRef.current = null;
      }
      setStatus("ended");
      setEndedAt(Date.now());
      // Sync finished state in DB (partner side)
      const sid = activeSessionIdRef.current;
      if (sid) {
        finishMultiplayerSession(sid);
      }
    });

    // Paciente marcou bloco PEP — médico sincroniza pepRespostas
    manager.onPepMark((pepId, resposta) => {
      setPepRespostas((prev) => ({ ...prev, [pepId]: resposta as PepResposta }));
    });

    // ── Disconnect / reconnect detection ──

    manager.onPartnerDisconnected(() => {
      // Bloquear eventos durante recovery — evita banners falsos de desconexão
      if (isRestoringSessionRef.current) return;
      // Só actuar nas fases activas da estação (running ou waiting_start)
      const s = statusRef.current;
      if (s !== "running" && s !== "waiting") return;
      // Bloquear durante configuring_station: médico ainda aguardando config do paciente
      if (s === "waiting" && configRef.current === null) return;
      if (partnerDisconnectedRef.current) return; // already handling

      // Clear suspected banner — we're now in full disconnect
      setPartnerSuspected(false);
      setPartnerDisconnected(true);

      // Compute authoritative remaining via dead-reckoning before stopping the interval
      let frozenRemaining = remainingSecRef.current;
      if (s === "running" && timerBaseRef.current) {
        const base = timerBaseRef.current;
        const elapsed = Math.floor((Date.now() - base.startedAt) / 1000);
        frozenRemaining = Math.max(0, base.remainingBase - elapsed);
      }

      // Freeze interval
      if (s === "running" && tickRef.current) {
        window.clearInterval(tickRef.current);
        tickRef.current = null;
      }
      // Freeze dead-reckoning origin so both sides stay in sync
      timerBaseRef.current = null;
      setRemainingSec(frozenRemaining);

      // Persist disconnect + authoritative remaining to DB
      const sid = activeSessionIdRef.current;
      if (sid && s === "running") {
        pauseSession(sid, frozenRemaining, "paused_disconnect");
        // Broadcast frozen remaining to the partner so their side also freezes
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

    // ── Partner watchdog callbacks ──

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
      // Ignorar eventos de reconexão durante recovery
      if (isRestoringSessionRef.current) return;
      if (!partnerDisconnectedRef.current) return;
      // Bloquear durante configuring_station
      const s = statusRef.current;
      if (s === "waiting" && configRef.current === null) return;

      setPartnerSuspected(false);
      setPartnerDisconnected(false);

      // Resume timer with authoritative DB timestamp so both sides are in sync
      const sid = activeSessionIdRef.current;
      if (sid && s === "running" && remainingSecRef.current > 0) {
        resumeSession(sid).then((newStartedAtISO) => {
          if (!newStartedAtISO) return;
          const newStartedAt = new Date(newStartedAtISO).getTime();
          const remaining = remainingSecRef.current;

          // Re-anchor dead-reckoning base
          timerBaseRef.current = { startedAt: newStartedAt, remainingBase: remaining };

          // Start dead-reckoning interval
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
              clearSimulatedMedicoMarks();
            }
          }, 1000);

          // Broadcast authoritative resume origin to the partner
          manager.broadcastTimerResume(newStartedAt, remaining);
        });
      }

      toast.success(`${partnerNameRef.current ?? "Parceiro"} reconectou!`);
      const uid = userIdRef.current;
      if (uid) {
        trackEvent(uid, "session_reconnected", s ?? undefined, { session_id: sid ?? undefined });
      }
    });

    // Partner broadcast-paused the timer (manual pause from partner side)
    manager.onTimerPaused((remaining, pausedByUserId) => {
      if (isRestoringSessionRef.current) return;
      if (tickRef.current) {
        window.clearInterval(tickRef.current);
        tickRef.current = null;
      }
      timerBaseRef.current = null;
      setRemainingSec(remaining);
      setStatus("paused_manual");
      // Show who paused: if the sender is the partner, use their name
      if (pausedByUserId && pausedByUserId !== userIdRef.current) {
        setPausedByName(partnerNameRef.current);
      }
    });

    // Partner broadcast-resumed the timer (e.g. reconnect from their side)
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
          clearSimulatedMedicoMarks();
        }
      }, 1000);
      setStatus("running");
    });
  }, [manager]);

  // ── React to successful match (invite accepted or matchmaking paired) ──────

  useEffect(() => {
    const result = realtimeState.matchResult;
    if (!result) return;

    setPartnerId(result.partnerId);
    setPartnerName(result.partnerName);
    setStatus("role-select");

    if (result.source === "matchmaking") {
      toast.success(`Parceiro encontrado: ${result.partnerName}!`);
    }

    // Se for parceiro real, abre rastreio de sessão no manager
    if (isRealPartnerId(result.partnerId)) {
      manager.openSession(result.partnerId);
    }

    manager.clearMatchResult();

    // ── Persist session in DB (real partners only) ──
    if (userId && isRealPartnerId(result.partnerId)) {
      const ids = [userId, result.partnerId].sort();
      const amHost = userId === ids[0];
      setIsHost(amHost);

      createOrGetMultiplayerSession(userId, result.partnerId)
        .then((session) => {
          if (session) {
            setActiveSessionId(session.id);
            // Avançar fase invited → roles_selection (ambos agora estão na tela de papéis)
            updateMultiplayerSession(session.id, {
              status: "roles_selection",
              current_phase: "roles_selection",
            });
            // session_started dispara só quando a estação começa (Estacao.tsx)
          }
        })
        .catch(() => {
          // Non-critical: session will be created on next phase transition
        });
    }
  }, [realtimeState.matchResult, manager, userId]);

  // ── Presence status sync ───────────────────────────────────────────────────

  useEffect(() => {
    // Manager controla o status durante matchmaking e fluxo de convites
    if (realtimeState.matchmakingActive) return;
    if (realtimeState.pendingInvite) return;
    if (realtimeState.outgoingInviteTargetId) return;

    if (status === "idle") {
      manager.setStatus("available");
    } else if (status === "running") {
      manager.setStatus("in_session");
    } else if (status === "ended") {
      manager.setStatus("available");
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

  // ── History ────────────────────────────────────────────────────────────────

  const loadHistory = useCallback(async (uid: string) => {
    if (!isSupabaseConfigured) return;
    setIsLoadingHistory(true);
    try {
      const sessions = await fetchSessions(uid);
      setHistory(sessions);
      setHasNetworkError(false);
      processLoginMissionProgress(uid, sessions).catch(() => {/* silencioso */});
      evaluateLoginAchievements(uid, sessions).catch(() => {/* silencioso */});
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

  // ── Checklist helpers ──────────────────────────────────────────────────────

  const getActiveChecklist = (): Checklist | null => {
    if (!config) return null;
    return checklistDetailMapRef.current.get(config.checklistId) ?? null;
  };

  /**
   * Fetches and caches the full station dataset for a given checklist ID.
   *
   * Call and await this BEFORE startSoloStation / setStationConfig so that
   * getActiveChecklist() is populated when the station screen mounts. Subsequent
   * calls for the same ID are instant (served from the in-memory detail map).
   */
  const hydrateStation = useCallback(async (id: string): Promise<Checklist | null> => {
    const cached = checklistDetailMapRef.current.get(id);
    if (cached) return cached;

    const detail = await fetchChecklistDetailsForTraining(id);
    if (detail) checklistDetailMapRef.current.set(id, detail);
    return detail;
  }, []);

  // ── Recovery route helper ──────────────────────────────────────────────────

  const clearRecoveryRoute = useCallback(() => setRecoveryRoute(null), []);

  // ── Computed connection state ──────────────────────────────────────────────

  const connectionState = useMemo<ConnectionState>(() => {
    if (isRestoringSession) return "restoring_session";
    // Só exibir alertas de conexão nas fases ativas onde eles são relevantes:
    //   - "running"              → estação em andamento
    //   - "waiting" + config set → waiting_start (médico pronto para iniciar)
    // Suprimir durante configuring_station (config/waiting sem config) e role-select.
    const inMonitoredPhase =
      status === "running" || (status === "waiting" && config !== null);
    // Nunca mostrar alertas para sessões solo/mock (IDs não-Supabase)
    const hasRealPartner = isRealPartnerId(partnerId);

    // REGRA PRINCIPAL: se o parceiro está visível na lista de presença realtime,
    // a conexão está CLARAMENTE funcionando — limpar qualquer banner imediatamente.
    // A presença do parceiro em onlineUsers é a evidência mais forte de canal saudável.
    if (hasRealPartner && onlineUsers.some((u) => u.user_id === partnerId)) {
      return "connected";
    }

    if (!realtimeState.isConnected && inMonitoredPhase && hasRealPartner) return "self_reconnecting";
    if (partnerDisconnected && inMonitoredPhase) return "partner_disconnected";
    if (partnerSuspected && inMonitoredPhase) return "partner_suspected";
    return "connected";
  }, [isRestoringSession, realtimeState.isConnected, partnerDisconnected, partnerSuspected, status, config, partnerId, onlineUsers]);

  const isSolo = partnerId === "__solo__";

  // ── Actions ────────────────────────────────────────────────────────────────

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

    const isRealUser = onlineUsers.some((ou) => ou.user_id === uid);

    if (isRealUser) {
      manager.sendInvite(uid, u.nome);
    } else {
      clearMockInviteTimer();
      setMockOutgoingInviteName(u.nome);
      mockInviteTimerRef.current = window.setTimeout(() => {
        setMockOutgoingInviteName(null);
        setPartnerId(u.id);
        setPartnerName(u.nome);
        setStatus("role-select");
      }, 1500 + Math.random() * 1500);
    }
  };

  const cancelOutgoingInvite = () => {
    manager.cancelOutgoingInvite();
    clearMockInviteTimer();
    setMockOutgoingInviteName(null);
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
      // Sessão real: broadcast do papel; aguardar onRolesComplete para avançar
      // Não muda status nem role aqui — isso é feito pelo callback do manager
      manager.broadcastRole(actual);
    } else {
      // Sessão mock: fluxo local com simulação
      setRole(actual);
      if (actual === "paciente") {
        setStatus("config");
      } else {
        setStatus("waiting");
        clearSimulatedPacienteTimer();
        const partnerSetupDelay = 4000 + Math.random() * 3000;
        simulatedPacienteTimerRef.current = window.setTimeout(() => {
          const latest = checklistCacheRef.current;
          if (latest.length === 0) return;
          const pick = latest[Math.floor(Math.random() * latest.length)];
          const tempos: (8 | 9 | 10)[] = [8, 9, 10];
          const tempo = tempos[Math.floor(Math.random() * tempos.length)];
          // Pre-load full details so getActiveChecklist() is populated
          // when the doctor initiates (fire-and-forget; 4-8s head start).
          void fetchChecklistDetailsForTraining(pick.id).then((d) => {
            if (d) checklistDetailMapRef.current.set(pick.id, d);
          });
          setConfig({ checklistId: pick.id, tempoMin: tempo });
        }, partnerSetupDelay);
      }
    }
  };

  const setStationConfig = (cfg: StationConfig) => {
    setConfig(cfg);

    if (isRealPartnerId(partnerIdRef.current) && roleRef.current === "paciente") {
      // Sessão real: paciente transmite configuração ao médico e entra em espera
      manager.broadcastConfig(cfg);
      setStatus("waiting");
      // Persist waiting_start phase in DB
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
    // Sessão mock: config salva localmente, médico inicia quando quiser
  };

  const startStation = () => {
    const cfg = configRef.current;
    if (!cfg) return;
    const ts = Date.now();

    if (isRealPartnerId(partnerIdRef.current) && roleRef.current === "medico") {
      // Sessão real, médico: broadcast SESSION_START com timestamp sincronizado
      manager.startSession(ts);
      // Persist running phase in DB with authoritative timer_started_at
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
      // Mock session ou edge cases: apenas atualiza presença
      manager.startSession();
    }

    startTimerAt(ts);
  };

  const liberarImpresso = (impressoId: string) => {
    setImpressosLiberados((prev) =>
      prev.includes(impressoId) ? prev : [...prev, impressoId],
    );
    // Sessão real com parceiro real: transmite ao médico via Realtime
    if (isRealPartnerId(partnerIdRef.current) && roleRef.current === "paciente") {
      manager.broadcastImpresso(impressoId);
    }
  };

  const marcarPep = (pepId: string, resposta: PepResposta) => {
    setPepRespostas((prev) => ({ ...prev, [pepId]: resposta }));
    // Paciente transmite marcação ao médico em sessão real
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
    clearSimulatedMedicoMarks();
    setStatus("ended");
    setEndedAt(Date.now());
    // Broadcast ao parceiro real para encerrar simultaneamente
    if (isRealPartnerId(partnerIdRef.current)) {
      manager.endSession();
    }
    // Persist finish in DB
    const sid = activeSessionIdRef.current;
    if (sid) {
      finishMultiplayerSession(sid);
    }
    // Clear disconnect state if it was active
    if (partnerDisconnectedRef.current) {
      setPartnerDisconnected(false);
    }
    if (userIdRef.current && sid) {
      trackEvent(userIdRef.current, "session_completed", "estação", { session_id: sid });
    }
  };

  const salvarEstacao = () => {
    if (statusRef.current !== "ended") return;
    // Treino solo não gera histórico competitivo nem persistência no banco
    if (partnerIdRef.current === "__solo__") return;
    const cl = getActiveChecklist();
    if (!cl || !config || !partnerName || !role) return;

    const sid = activeSessionIdRef.current;

    if (sid && userId) {
      // ── Real multiplayer session: route through secure server-side RPC ──
      // Grade arithmetic is performed entirely by the DB using authoritative
      // pep_blocks weights, preventing client-side score tampering.
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
          evaluateAutomaticTitles(userId, historyForTitles).catch(() => {/* silencioso */});
          processMissionProgressAfterSession(userId, historyForTitles).catch(() => {/* silencioso */});
          evaluateAndUnlockAchievements(userId, historyForTitles).catch(() => {/* silencioso */});
        } catch (e: unknown) {
          console.warn("[TrainingContext] Error calling grading RPC:", e);
        } finally {
          setIsSavingSession(false);
        }
      })();
    } else {
      // ── Mock / no active session: client-side path (unchanged) ──
      // Used for mock training partners (IDs starting with "u-") where
      // there is no multiplayer_sessions row to validate against.
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
            evaluateAutomaticTitles(userId, historyForTitles).catch(() => {/* silencioso */});
            processMissionProgressAfterSession(userId, historyForTitles).catch(() => {/* silencioso */});
            evaluateAndUnlockAchievements(userId, historyForTitles).catch(() => {/* silencioso */});
          })
          .catch((e) => {
            console.warn("[TrainingContext] Error saving session to Supabase:", e);
          });
      }
    }
  };

  const repeatStation = (checklistId: string, chosenRole: Role, tempoMin: 8 | 9 | 10): boolean => {
    // Detail map is populated from the original session; fall back to summary list
    // as existence check if the page was refreshed between sessions.
    const exists =
      checklistDetailMapRef.current.has(checklistId) ||
      checklistCacheRef.current.some((c) => c.id === checklistId);
    if (!exists) return false;

    if (tickRef.current) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
    clearSimulatedPacienteTimer();
    clearSimulatedMedicoMarks();
    clearMockInviteTimer();

    manager.resetMultiplayerState();
    setMockOutgoingInviteName(null);

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
        clearSimulatedMedicoMarks();
      }
    }, 1000);

    const clDetail = checklistDetailMapRef.current.get(checklistId) ?? null;
    if (chosenRole === "medico" && clDetail && clDetail.pepBlocks.length > 0) {
      const pending = [...clDetail.pepBlocks];
      simulatedMedicoMarksRef.current = window.setInterval(() => {
        if (pending.length === 0) return;
        const idx = Math.floor(Math.random() * pending.length);
        const block = pending.splice(idx, 1)[0];
        const rv = Math.random();
        const resposta: PepResposta =
          rv < 0.55 ? "adequado" : rv < 0.85 ? "parcial" : "inadequado";
        setPepRespostas((prev) => ({ ...prev, [block.id]: resposta }));
      }, Math.max(8000, (tempoMin * 60 * 1000) / Math.max(clDetail.pepBlocks.length, 1)));
    }

    return true;
  };

  // ── Manual pause / resume (multiplayer only) ──────────────────────────────

  const pauseStation = useCallback(() => {
    const s = statusRef.current;
    if (s !== "running") return;
    if (!isRealPartnerId(partnerIdRef.current)) return;

    // Compute authoritative remaining via dead-reckoning before stopping interval
    let frozenRemaining = remainingSecRef.current;
    if (timerBaseRef.current) {
      const base = timerBaseRef.current;
      const elapsed = Math.floor((Date.now() - base.startedAt) / 1000);
      frozenRemaining = Math.max(0, base.remainingBase - elapsed);
    }

    // Stop interval and freeze base
    if (tickRef.current) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
    timerBaseRef.current = null;
    setRemainingSec(frozenRemaining);
    setStatus("paused_manual");
    setPausedByName(null); // self-paused

    // Persist + broadcast
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

      // Re-anchor dead-reckoning
      timerBaseRef.current = { startedAt: newStartedAt, remainingBase: remaining };

      // Start interval
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
          clearSimulatedMedicoMarks();
        }
      }, 1000);

      setStatus("running");
      setPausedByName(null);

      // Broadcast authoritative resume to partner
      manager.broadcastTimerResume(newStartedAt, remaining);
    });
  }, [manager]);

  // ── Solo mode actions ─────────────────────────────────────────────────────

  const startSolo = () => {
    if (tickRef.current) { window.clearInterval(tickRef.current); tickRef.current = null; }
    clearSimulatedPacienteTimer();
    clearSimulatedMedicoMarks();
    clearMockInviteTimer();
    manager.resetMultiplayerState();
    setMockOutgoingInviteName(null);
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
    // Sync DB session to its terminal state before clearing local state.
    const sid = activeSessionIdRef.current;
    const s = statusRef.current;
    if (sid && s === "ended") {
      // Session completed normally — ensure the DB row is marked "finished".
      // finishMultiplayerSession was already called fire-and-forget when the
      // timer expired (lines ~862, ~1372) but that call may have failed due
      // to RLS, network latency, or a race with the partner.  Calling it again
      // here is idempotent (the DB guard .in("status", ACTIVE_STATUSES)
      // prevents double-finishing) and ensures the row is never left in
      // "running" status — which would cause createOrGetMultiplayerSession to
      // return the same stale UUID for the next match between the same pair.
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
    clearSimulatedPacienteTimer();
    clearSimulatedMedicoMarks();
    clearMockInviteTimer();
    if (disconnectTimerRef.current) {
      window.clearInterval(disconnectTimerRef.current);
      disconnectTimerRef.current = null;
    }
    if (guestSessionPollRef.current) {
      window.clearTimeout(guestSessionPollRef.current);
      guestSessionPollRef.current = null;
    }

    manager.endSession();
    // Full local reset: clears watchdog, anti-thrash timers, partner-disconnect
    // flags, and explicitly re-tracks "available" in Supabase Presence.
    // Without this, the user can appear stuck as "Ocupado/Em sessão" in the
    // lobby until the next heartbeat fires (~5 s) because endSession() alone
    // may silently skip track() if the channel was momentarily disconnected
    // during the session teardown.
    manager.resetMultiplayerState();
    setMockOutgoingInviteName(null);

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
      clearSimulatedPacienteTimer();
      clearSimulatedMedicoMarks();
      clearMockInviteTimer();
      if (disconnectTimerRef.current) window.clearInterval(disconnectTimerRef.current);
      if (guestSessionPollRef.current) window.clearTimeout(guestSessionPollRef.current);
    };
  }, []);

  // ── Tab-close / hard-navigation cleanup ───────────────────────────────────
  //
  // Problem: when a user closes the tab or navigates away while a multiplayer
  // session is active, the Supabase SDK's async calls are aborted by the browser
  // before they complete. The DB row stays in "running" state for up to
  // ORPHAN_MINUTES, leaving the partner locked in a paused-disconnect banner.
  //
  // Solution: register a `beforeunload` handler that sends a PATCH to the
  // Supabase REST API using `fetch({ keepalive: true })`. Keepalive fetches
  // survive page unload — the browser queues them at the OS network layer
  // even after the JS context is destroyed.
  //
  // Transition rules:
  //   running  → paused_disconnect  (partner can resume; timer state is saved)
  //   any other active status → abandoned  (session was in setup; unrecoverable)
  //
  // The server-side atomic guard (status=not.in.(finished,abandoned)) prevents
  // this write from overwriting a session that was already cleanly terminated.
  useEffect(() => {
    const handleBeforeUnload = () => {
      const sid = activeSessionIdRef.current;
      const s   = statusRef.current;
      const pid = partnerIdRef.current;

      // Only act on active real-partner multiplayer sessions
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
        // Freeze authoritative remaining via dead-reckoning before the tick stops
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

      // Atomic server-side guard: skip rows already in a terminal state
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
  }, []); // empty deps: handler reads only refs, never stale

  // ── Context value ──────────────────────────────────────────────────────────

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
      startTimerAt,
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
    ],
  );

  return <TrainingCtx.Provider value={value}>{children}</TrainingCtx.Provider>;
}

export function useTraining() {
  const ctx = useContext(TrainingCtx);
  if (!ctx) throw new Error("useTraining must be used within TrainingProvider");
  return ctx;
}
