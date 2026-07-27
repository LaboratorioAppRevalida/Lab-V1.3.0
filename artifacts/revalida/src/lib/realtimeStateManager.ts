import { supabase, isSupabaseConfigured } from "./supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

// ── Types ──────────────────────────────────────────────────────────────────────

export type UserStatus = "available" | "matchmaking" | "busy" | "in_session";

export type OnlinePresenceUser = {
  user_id: string;
  name: string;
  status: UserStatus;
};

export type IncomingInvite = {
  fromUserId: string;
  fromName: string;
};

export type MatchResult = {
  partnerId: string;
  partnerName: string;
  source: "invite" | "matchmaking";
};

export type SessionRole = "medico" | "paciente";

export type SessionSyncConfig = {
  checklistId: string;
  tempoMin: 8 | 9 | 10;
};

/** Estado sincronizado de sessão entre os dois usuários. */
export type SessionSyncState = {
  /** ID do parceiro nesta sessão. */
  partnerId: string | null;
  /** Papel escolhido por mim nesta sessão. */
  myRole: SessionRole | null;
  /** Papel escolhido pelo parceiro nesta sessão. */
  partnerRole: SessionRole | null;
  /** true quando ambos os papéis foram atribuídos. */
  rolesComplete: boolean;
  /** Configuração da estação (definida pelo paciente, recebida pelo médico). */
  config: SessionSyncConfig | null;
  /** Timestamp do início sincronizado da estação (definido pelo médico). */
  startedAt: number | null;
};

export type RealtimeState = {
  isConnected: boolean;
  onlineUsers: OnlinePresenceUser[];
  pendingInvite: IncomingInvite | null;
  outgoingInviteTargetId: string | null;
  outgoingInviteTargetName: string | null;
  matchmakingActive: boolean;
  matchResult: MatchResult | null;
  /** Estado de sessão sincronizado em tempo real. */
  session: SessionSyncState;
};

export type RealtimeEventType =
  | "INVITE_USER"
  | "INVITE_ACCEPTED"
  | "INVITE_REJECTED"
  | "SESSION_START"
  | "SESSION_END"
  | "USER_STATUS_UPDATE"
  | "MATCHMAKING_JOIN"
  | "MATCHMAKING_MATCH"
  | "ROLE_SELECTED"
  | "SESSION_CONFIG_UPDATED"
  | "IMPRESSO_LIBERADO"
  | "PEP_MARK"
  | "TIMER_PAUSE"
  | "TIMER_RESUME"
  | "HEARTBEAT";

export type RealtimeEvent = {
  id?: string;
  type: RealtimeEventType;
  sender_id: string;
  sender_name?: string;
  target_id?: string;
  timestamp: string;
  payload?: Record<string, unknown>;
};

type StateListener = (state: RealtimeState) => void;

const INVITE_TIMEOUT_MS = 30_000;
const MATCHMAKING_TIMEOUT_MS = 20_000;
const MAX_DEDUP_SIZE = 200;

/**
 * Lightweight djb2 hash of a string — used to discriminate events that share
 * the same sender/type/timestamp but carry different payloads.
 * Returns a fixed-length hex string so the dedup key stays compact.
 */
function hashStr(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) ^ s.charCodeAt(i);
    h = h >>> 0; // keep unsigned 32-bit
  }
  return h.toString(16).padStart(8, "0");
}

function dedupKey(e: RealtimeEvent): string {
  if (e.id) return e.id;
  const payloadFingerprint = e.payload
    ? hashStr(JSON.stringify(e.payload))
    : "no-payload";
  return `${e.sender_id}:${e.type}:${e.timestamp}:${payloadFingerprint}`;
}

const EMPTY_SESSION: SessionSyncState = {
  partnerId: null,
  myRole: null,
  partnerRole: null,
  rolesComplete: false,
  config: null,
  startedAt: null,
};

// ── Manager ────────────────────────────────────────────────────────────────────

export class RealtimeStateManager {
  private _userId: string | null = null;
  private _userName = "Usuário";
  private _myStatus: UserStatus = "available";

  private _presenceChannel: RealtimeChannel | null = null;
  private _eventsChannel: RealtimeChannel | null = null;

  private _matchmakingLocked = false;
  private _matchmakingTimerId: number | null = null;
  private _inviteTimerId: number | null = null;

  private _processedIds = new Set<string>();
  private _listeners = new Set<StateListener>();

  // ── Notification callbacks ──
  private _onRejectCb: ((name: string) => void) | null = null;
  private _onExpiredCb: (() => void) | null = null;
  private _onTimeoutCb: (() => void) | null = null;
  private _onRolesCompleteCb: ((myRole: SessionRole) => void) | null = null;
  private _onPartnerConfiguredCb: ((config: SessionSyncConfig) => void) | null = null;
  private _onPartnerStartedSessionCb: ((startedAt: number) => void) | null = null;
  private _onImpressoLiberadoCb: ((impressoId: string) => void) | null = null;
  private _onSessionEndCb: (() => void) | null = null;
  private _onPepMarkCb: ((pepId: string, resposta: string) => void) | null = null;
  private _onPartnerDisconnectedCb: (() => void) | null = null;
  private _onPartnerReconnectedCb: (() => void) | null = null;
  private _onTimerPausedCb: ((remaining: number, pausedByUserId?: string) => void) | null = null;
  private _onTimerResumedCb: ((startedAt: number, remaining: number) => void) | null = null;

  // Debounce partner disconnect to ignore transient presence leave/join events
  // (e.g. Supabase fires leave+join when a user calls track() to update their status)
  private _partnerDisconnectTimer: number | null = null;
  private _partnerKnownDisconnected = false;

  // ── Heartbeat & reconnect ────────────────────────────────────────────────────

  /** Periodic presence heartbeat — re-tracks every 25 s to keep state fresh. */
  private _heartbeatTimer: number | null = null;

  /** Scheduled reconnect timer (exponential backoff). */
  private _reconnectTimer: number | null = null;

  /** Number of reconnect attempts since last successful connection. */
  private _reconnectAttempts = 0;

  /** Registered visibilitychange handler (kept for cleanup). */
  private _visibilityHandler: (() => void) | null = null;

  private readonly _HEARTBEAT_MS = 25_000;

  // ── Partner watchdog (soft-disconnect detection) ─────────────────────────────

  /** Timestamp of the last heartbeat or presence event received from the partner. */
  private _partnerLastSeen: number | null = null;

  /** Periodic watchdog that evaluates partner liveness. */
  private _watchdogInterval: number | null = null;

  /** Periodic outgoing heartbeat broadcast to the partner during active sessions. */
  private _heartbeatBroadcastInterval: number | null = null;

  /**
   * 3-state soft-disconnect phase for the partner.
   *   connected    — all good
   *   suspected    — 8–15 s without heartbeat; yellow banner, timer keeps running
   *   disconnected — 15+ s without heartbeat; pause timer
   */
  private _partnerPhase: "connected" | "suspected" | "disconnected" = "connected";

  /** Epoch-ms until which automatic watchdog-based disconnect is suppressed (anti-thrash). */
  private _antiThrashUntil: number = 0;

  private _onPartnerSuspectedCb: (() => void) | null = null;
  private _onPartnerSuspectedResolvedCb: (() => void) | null = null;

  private readonly _RECONNECT_BASE_MS = 2_000;
  private readonly _RECONNECT_MAX_MS = 60_000;
  private readonly _WATCHDOG_INTERVAL_MS = 2_000;
  private readonly _HEARTBEAT_BROADCAST_MS = 5_000;
  private readonly _SUSPECTED_THRESHOLD_MS = 8_000;
  private readonly _DISCONNECTED_THRESHOLD_MS = 15_000;
  private readonly _ANTI_THRASH_MS = 10_000;

  /**
   * Rastreia se o canal de presença já conectou ao menos uma vez.
   * isConnected só vira false DEPOIS de uma conexão estabelecida — nunca no estado
   * inicial — para evitar banners de "reconectando" antes de qualquer tentativa real.
   */
  private _wasEverConnected = false;

  private _state: RealtimeState = {
    isConnected: true, // Otimista: não mostrar banner de reconexão antes de conectar
    onlineUsers: [],
    pendingInvite: null,
    outgoingInviteTargetId: null,
    outgoingInviteTargetName: null,
    matchmakingActive: false,
    matchResult: null,
    session: { ...EMPTY_SESSION },
  };

  // ── State management ────────────────────────────────────────────────────────

  private _notify(partial: Partial<RealtimeState>) {
    this._state = { ...this._state, ...partial };
    for (const l of this._listeners) {
      try {
        l(this._state);
      } catch {}
    }
  }

  getState(): RealtimeState {
    return this._state;
  }

  subscribe(listener: StateListener): () => void {
    this._listeners.add(listener);
    return () => {
      this._listeners.delete(listener);
    };
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  init(userId: string, userName: string) {
    if (this._userId === userId) {
      if (this._userName !== userName) this._userName = userName;
      return;
    }
    this._teardown();
    this._userId = userId;
    this._userName = userName;
    this._myStatus = "available";
    this._reconnectAttempts = 0;
    this._setupPresence();
    this._setupEvents();
    this._registerVisibilityHandler();
  }

  destroy() {
    this._teardown();
    this._userId = null;
    this._myStatus = "available";
    this._matchmakingLocked = false;
    this._wasEverConnected = false;
    this._processedIds.clear();
    this._notify({
      isConnected: false,
      onlineUsers: [],
      pendingInvite: null,
      outgoingInviteTargetId: null,
      outgoingInviteTargetName: null,
      matchmakingActive: false,
      matchResult: null,
      session: { ...EMPTY_SESSION },
    });
  }

  private _teardown() {
    this._clearTimer("invite");
    this._clearTimer("matchmaking");
    this._cancelPartnerDisconnectDebounce();
    this._partnerKnownDisconnected = false;
    this._stopHeartbeat();
    this._stopPartnerWatchdog();
    this._cancelReconnect();
    this._removeVisibilityHandler();
    if (this._presenceChannel) {
      try { supabase.removeChannel(this._presenceChannel); } catch {}
      this._presenceChannel = null;
    }
    if (this._eventsChannel) {
      try { this._eventsChannel.unsubscribe(); } catch {}
      this._eventsChannel = null;
    }
  }

  private _cancelPartnerDisconnectDebounce() {
    if (this._partnerDisconnectTimer !== null) {
      window.clearTimeout(this._partnerDisconnectTimer);
      this._partnerDisconnectTimer = null;
    }
  }

  // ── Presence channel ────────────────────────────────────────────────────────

  private _setupPresence() {
    if (!isSupabaseConfigured || !this._userId) return;

    const uid = this._userId;
    const ch = supabase.channel("online-users", {
      config: { presence: { key: uid } },
    });
    this._presenceChannel = ch;

    const extract = (): OnlinePresenceUser[] => {
      const st = ch.presenceState<OnlinePresenceUser>();
      const list: OnlinePresenceUser[] = [];
      for (const arr of Object.values(st)) {
        if (Array.isArray(arr) && arr.length > 0) {
          const p = arr[0] as OnlinePresenceUser;
          if (p.user_id && p.user_id !== uid) list.push(p);
        }
      }
      return list;
    };

    ch
      .on("presence", { event: "sync" }, () => {
        const users = extract();
        this._notify({ onlineUsers: users });
        // Refresh partner last-seen if they appear in the sync snapshot
        const pid = this._state.session.partnerId;
        if (pid && users.some((u) => u.user_id === pid)) {
          this._refreshPartnerSeen(pid);
        }
      })
      .on("presence", { event: "join" }, ({ newPresences }) => {
        const incoming = (newPresences as unknown as OnlinePresenceUser[]).filter(
          (p) => p.user_id && p.user_id !== uid,
        );
        const map = new Map(this._state.onlineUsers.map((u) => [u.user_id, u]));
        incoming.forEach((u) => map.set(u.user_id, u));
        this._notify({ onlineUsers: Array.from(map.values()) });

        // Partner reconnect — let _refreshPartnerSeen handle all state transitions
        const partnerId = this._state.session.partnerId;
        if (partnerId && incoming.some((p) => p.user_id === partnerId)) {
          if (this._partnerDisconnectTimer !== null) {
            // Transient leave/join (e.g. track() call) — cancel debounce immediately
            this._cancelPartnerDisconnectDebounce();
          }
          // Always refresh; _refreshPartnerSeen decides whether to fire reconnect cb
          this._refreshPartnerSeen(partnerId);
        }
      })
      .on("presence", { event: "leave" }, ({ leftPresences }) => {
        const left = new Set(
          (leftPresences as unknown as OnlinePresenceUser[]).map((p) => p.user_id),
        );
        this._notify({
          onlineUsers: this._state.onlineUsers.filter((u) => !left.has(u.user_id)),
        });

        // Partner disconnect debounce — wait 6 s before treating as a real disconnect.
        // Supabase fires leave+join in quick succession when track() is called or
        // when the channel resubscribes; the debounce filters those out.
        // The watchdog also fires disconnect at 15 s; whichever comes first wins
        // (TrainingContext guards against double-fire with partnerDisconnectedRef).
        // Anti-thrash: after a recent reconnect we also suppress the debounce callback
        // so that presence flapping (rapid leave→join→leave cycles) does not spam
        // disconnect notifications within the 10 s anti-thrash window.
        const partnerId = this._state.session.partnerId;
        if (partnerId && left.has(partnerId)) {
          if (this._partnerDisconnectTimer === null && !this._partnerKnownDisconnected) {
            this._partnerDisconnectTimer = window.setTimeout(() => {
              this._partnerDisconnectTimer = null;
              if (!this._partnerKnownDisconnected) {
                // Honor anti-thrash window: suppress if we recently had a reconnect.
                // This is the same guard the watchdog uses, applied here so that the
                // presence-leave path cannot spam disconnect notifications during
                // rapid leave→reconnect→leave flapping cycles.
                if (Date.now() < this._antiThrashUntil) return;
                this._partnerKnownDisconnected = true;
                if (this._partnerPhase !== "disconnected") {
                  this._partnerPhase = "disconnected";
                }
                this._onPartnerDisconnectedCb?.();
              }
            }, 6000);
          }
        }
      })
      .subscribe(async (subStatus) => {
        if (subStatus === "SUBSCRIBED") {
          this._wasEverConnected = true;
          this._reconnectAttempts = 0;
          this._cancelReconnect();
          this._notify({ isConnected: true });
          try {
            await ch.track({ user_id: uid, name: this._userName, status: this._myStatus });
            // Força releitura imediata após track — captura usuários que já estavam presentes
            // antes da nossa subscrição (sync pode ter chegado antes do track completar)
            this._notify({ onlineUsers: extract() });
          } catch {}
          // Segunda releitura com delay: Supabase pode levar até ~2s para propagar
          // presença existente ao novo subscriber
          window.setTimeout(() => {
            if (this._presenceChannel === ch) {
              this._notify({ onlineUsers: extract() });
            }
          }, 2000);
          // Start heartbeat to keep presence alive across network hiccups
          this._startHeartbeat();
        } else if (subStatus === "CLOSED" || subStatus === "CHANNEL_ERROR") {
          // Só marcar como desconectado se já teve uma conexão estabelecida.
          // Isso evita o banner "reconectando" durante o carregamento inicial.
          if (this._wasEverConnected) {
            this._notify({ isConnected: false });
          }
          this._stopHeartbeat();
          // Schedule automatic reconnect with exponential backoff
          this._scheduleReconnect();
        }
      });
  }

  // ── Events channel ──────────────────────────────────────────────────────────

  private _setupEvents() {
    if (!isSupabaseConfigured || !this._userId) return;

    const uid = this._userId;
    const ch = supabase.channel("global-events");
    this._eventsChannel = ch;

    ch
      .on("broadcast", { event: "*" }, ({ payload }) => {
        const e = payload as RealtimeEvent | undefined;
        if (!e?.type || !e?.sender_id) return;
        if (e.target_id && e.target_id !== uid) return;
        if (e.sender_id === uid) return;

        const key = dedupKey(e);
        if (this._processedIds.has(key)) return;
        this._processedIds.add(key);
        if (this._processedIds.size > MAX_DEDUP_SIZE) {
          const oldest = this._processedIds.values().next().value;
          if (oldest) this._processedIds.delete(oldest);
        }

        this._handleEvent(e);
      })
      .subscribe();
  }

  private _handleEvent(e: RealtimeEvent) {
    switch (e.type) {
      case "INVITE_USER":            this._onReceiveInvite(e); break;
      case "INVITE_ACCEPTED":        this._onInviteAccepted(e); break;
      case "INVITE_REJECTED":        this._onInviteRejected(e); break;
      case "MATCHMAKING_JOIN":       this._onMatchmakingJoin(e); break;
      case "MATCHMAKING_MATCH":      this._onMatchmakingMatch(e); break;
      case "ROLE_SELECTED":          this._onRoleSelectedEvent(e); break;
      case "SESSION_CONFIG_UPDATED": this._onSessionConfigUpdatedEvent(e); break;
      case "SESSION_START":          this._onSessionStartEvent(e); break;
      case "IMPRESSO_LIBERADO":      this._onImpressoLiberadoEvent(e); break;
      case "SESSION_END":            this._onSessionEndEvent(e); break;
      case "PEP_MARK":               this._onPepMarkEvent(e); break;
      case "TIMER_PAUSE":            this._onTimerPauseEvent(e); break;
      case "TIMER_RESUME":           this._onTimerResumeEvent(e); break;
      case "HEARTBEAT":              this._refreshPartnerSeen(e.sender_id); break;
    }
  }

  // ── Broadcast helper ────────────────────────────────────────────────────────

  private _broadcast(
    partial: Omit<RealtimeEvent, "id" | "sender_id" | "sender_name" | "timestamp">,
  ) {
    if (!this._userId || !this._eventsChannel) return;
    const event: RealtimeEvent = {
      ...partial,
      id: `${this._userId}:${partial.type}:${Date.now()}`,
      sender_id: this._userId,
      sender_name: this._userName,
      timestamp: new Date().toISOString(),
    };
    this._eventsChannel
      .send({ type: "broadcast", event: event.type, payload: event })
      .catch(() => {});
  }

  // ── Status ──────────────────────────────────────────────────────────────────

  setStatus(status: UserStatus) {
    this._myStatus = status;
    if (!this._presenceChannel || !this._state.isConnected || !this._userId) return;
    this._presenceChannel
      .track({ user_id: this._userId, name: this._userName, status })
      .catch(() => {});
  }

  // ── Invites ─────────────────────────────────────────────────────────────────

  sendInvite(targetId: string, targetName: string) {
    this._notify({ outgoingInviteTargetId: targetId, outgoingInviteTargetName: targetName });
    this._broadcast({ type: "INVITE_USER", target_id: targetId });
    this._clearTimer("invite");
    this._inviteTimerId = window.setTimeout(() => {
      this._notify({ outgoingInviteTargetId: null, outgoingInviteTargetName: null });
      this._onExpiredCb?.();
    }, INVITE_TIMEOUT_MS);
  }

  cancelOutgoingInvite() {
    this._clearTimer("invite");
    this._notify({ outgoingInviteTargetId: null, outgoingInviteTargetName: null });
  }

  acceptInvite() {
    const invite = this._state.pendingInvite;
    if (!invite) return;
    this._broadcast({ type: "INVITE_ACCEPTED", target_id: invite.fromUserId });
    const result: MatchResult = {
      partnerId: invite.fromUserId,
      partnerName: invite.fromName,
      source: "invite",
    };
    this._notify({ pendingInvite: null, matchResult: result });
    this.setStatus("in_session");
  }

  rejectInvite() {
    const invite = this._state.pendingInvite;
    if (invite) {
      this._broadcast({ type: "INVITE_REJECTED", target_id: invite.fromUserId });
    }
    this._notify({ pendingInvite: null });
    this.setStatus("available");
  }

  private _onReceiveInvite(e: RealtimeEvent) {
    this._notify({
      pendingInvite: { fromUserId: e.sender_id, fromName: e.sender_name ?? "Usuário" },
    });
    this.setStatus("busy");
  }

  private _onInviteAccepted(e: RealtimeEvent) {
    this._clearTimer("invite");
    const result: MatchResult = {
      partnerId: e.sender_id,
      partnerName: e.sender_name ?? "Usuário",
      source: "invite",
    };
    this._notify({
      outgoingInviteTargetId: null,
      outgoingInviteTargetName: null,
      matchResult: result,
    });
    this.setStatus("in_session");
  }

  private _onInviteRejected(e: RealtimeEvent) {
    this._clearTimer("invite");
    this._notify({ outgoingInviteTargetId: null, outgoingInviteTargetName: null });
    this._onRejectCb?.(e.sender_name ?? "Usuário");
  }

  // ── Matchmaking ─────────────────────────────────────────────────────────────

  joinMatchmaking() {
    this._matchmakingLocked = false;
    this._notify({ matchmakingActive: true });
    this.setStatus("matchmaking");
    this._broadcast({ type: "MATCHMAKING_JOIN" });
    this._clearTimer("matchmaking");
    this._matchmakingTimerId = window.setTimeout(() => {
      if (this._matchmakingLocked) return;
      this._notify({ matchmakingActive: false });
      this.setStatus("available");
      this._onTimeoutCb?.();
    }, MATCHMAKING_TIMEOUT_MS);
  }

  leaveMatchmaking() {
    this._clearTimer("matchmaking");
    this._matchmakingLocked = false;
    this._notify({ matchmakingActive: false });
    this.setStatus("available");
  }

  private _onMatchmakingJoin(e: RealtimeEvent) {
    if (!this._state.matchmakingActive) return;
    if (this._matchmakingLocked) return;
    this._matchmakingLocked = true;
    this._clearTimer("matchmaking");
    const result: MatchResult = {
      partnerId: e.sender_id,
      partnerName: e.sender_name ?? "Colega",
      source: "matchmaking",
    };
    this._notify({ matchmakingActive: false, matchResult: result });
    this.setStatus("in_session");
    this._broadcast({ type: "MATCHMAKING_MATCH", target_id: e.sender_id });
  }

  private _onMatchmakingMatch(e: RealtimeEvent) {
    if (!this._state.matchmakingActive) return;
    if (this._matchmakingLocked) return;
    this._matchmakingLocked = true;
    this._clearTimer("matchmaking");
    const result: MatchResult = {
      partnerId: e.sender_id,
      partnerName: e.sender_name ?? "Colega",
      source: "matchmaking",
    };
    this._notify({ matchmakingActive: false, matchResult: result });
    this.setStatus("in_session");
  }

  // ── Session role sync ───────────────────────────────────────────────────────

  /**
   * Inicializa o estado de sessão quando um parceiro real é encontrado.
   * Chamado logo após matchResult ser processado no TrainingContext.
   */
  openSession(partnerId: string) {
    // Reset all disconnect tracking whenever a new session opens
    this._cancelPartnerDisconnectDebounce();
    this._partnerKnownDisconnected = false;
    this._stopPartnerWatchdog();
    this._antiThrashUntil = 0;
    this._notify({
      session: { ...EMPTY_SESSION, partnerId },
    });
  }

  /**
   * Transmite o papel escolhido pelo usuário.
   * O parceiro recebe automaticamente o papel oposto.
   * Regra anti-conflito: se ambos escolherem o mesmo papel,
   * o user com ID lexicograficamente menor mantém o escolhido.
   */
  broadcastRole(role: SessionRole) {
    this._notify({ session: { ...this._state.session, myRole: role } });
    this._broadcast({
      type: "ROLE_SELECTED",
      target_id: this._state.session.partnerId ?? undefined,
      payload: { role },
    });
    this._checkRolesComplete();
  }

  private _onRoleSelectedEvent(e: RealtimeEvent) {
    const partnerRole = e.payload?.role as SessionRole | undefined;
    if (!partnerRole) return;

    const currentMyRole = this._state.session.myRole;
    let myRole: SessionRole;
    let shouldBroadcastBack = false;

    if (!currentMyRole) {
      // Ainda não escolhi: recebo o papel oposto automaticamente e aviso o parceiro
      myRole = partnerRole === "medico" ? "paciente" : "medico";
      shouldBroadcastBack = true;
    } else if (currentMyRole === partnerRole) {
      // Race condition: ambos escolheram o mesmo papel
      // Tiebreaker determinístico: ID lexicograficamente maior cede o papel
      myRole =
        (this._userId ?? "") > e.sender_id
          ? (partnerRole === "medico" ? "paciente" : "medico")
          : currentMyRole;
    } else {
      // Papéis diferentes → sem conflito, mantenho o meu
      myRole = currentMyRole;
    }

    this._notify({
      session: { ...this._state.session, partnerRole, myRole },
    });

    // Broadcast de volta o papel auto-atribuído para que o parceiro (que escolheu
    // primeiro) receba partnerRole e _checkRolesComplete dispare para ele também.
    if (shouldBroadcastBack) {
      this._broadcast({
        type: "ROLE_SELECTED",
        target_id: e.sender_id,
        payload: { role: myRole },
      });
    }

    this._checkRolesComplete();
  }

  private _checkRolesComplete() {
    const s = this._state.session;
    if (s.myRole && s.partnerRole && !s.rolesComplete) {
      this._notify({ session: { ...this._state.session, rolesComplete: true } });
      this._onRolesCompleteCb?.(s.myRole);
    }
  }

  // ── Session config sync (paciente → médico) ─────────────────────────────────

  /**
   * Paciente envia a configuração da estação.
   * Médico recebe via onPartnerConfigured callback.
   */
  broadcastConfig(config: SessionSyncConfig) {
    this._notify({ session: { ...this._state.session, config } });
    this._broadcast({
      type: "SESSION_CONFIG_UPDATED",
      target_id: this._state.session.partnerId ?? undefined,
      payload: config as unknown as Record<string, unknown>,
    });
  }

  private _onSessionConfigUpdatedEvent(e: RealtimeEvent) {
    const checklistId = e.payload?.checklistId as string | undefined;
    const tempoMin = e.payload?.tempoMin as number | undefined;
    if (!checklistId || tempoMin === undefined) return;
    const config: SessionSyncConfig = {
      checklistId,
      tempoMin: tempoMin as 8 | 9 | 10,
    };
    this._notify({ session: { ...this._state.session, config } });
    this._onPartnerConfiguredCb?.(config);
  }

  // ── Session start sync (médico → paciente) ──────────────────────────────────

  /**
   * Médico inicia a estação com timestamp sincronizado.
   * Paciente recebe via onPartnerStartedSession callback.
   * @param startedAt — timestamp local do médico (Date.now())
   */
  startSession(startedAt?: number) {
    const ts = startedAt ?? Date.now();
    this.setStatus("in_session");

    if (startedAt !== undefined) {
      // Sessão real: persiste timestamp e broadcast para o parceiro
      this._notify({ session: { ...this._state.session, startedAt: ts } });
      this._broadcast({
        type: "SESSION_START",
        target_id: this._state.session.partnerId ?? undefined,
        payload: { startedAt: ts },
      });
    }
    // Sessão mock: só atualiza presença, sem broadcast
  }

  private _onSessionStartEvent(e: RealtimeEvent) {
    const startedAt = e.payload?.startedAt as number | undefined;
    if (!startedAt) return;
    this._notify({ session: { ...this._state.session, startedAt } });
    this.setStatus("in_session");
    this._onPartnerStartedSessionCb?.(startedAt);
  }

  // ── PEP mark sync (paciente → médico) ──────────────────────────────────────

  /**
   * Paciente transmite cada marcação PEP ao médico em tempo real.
   * O médico armazena pepRespostas mas só vê o PEP após encerramento.
   */
  broadcastPepMark(pepId: string, resposta: string) {
    this._broadcast({
      type: "PEP_MARK",
      target_id: this._state.session.partnerId ?? undefined,
      payload: { pepId, resposta },
    });
  }

  private _onPepMarkEvent(e: RealtimeEvent) {
    const pepId = e.payload?.pepId as string | undefined;
    const resposta = e.payload?.resposta as string | undefined;
    if (!pepId || !resposta) return;
    this._onPepMarkCb?.(pepId, resposta);
  }

  // ── Impresso sync (paciente → médico) ──────────────────────────────────────

  /**
   * Paciente libera um impresso e transmite ao médico em tempo real.
   */
  broadcastImpresso(impressoId: string) {
    this._broadcast({
      type: "IMPRESSO_LIBERADO",
      target_id: this._state.session.partnerId ?? undefined,
      payload: { impressoId },
    });
  }

  private _onImpressoLiberadoEvent(e: RealtimeEvent) {
    const impressoId = e.payload?.impressoId as string | undefined;
    if (!impressoId) return;
    this._onImpressoLiberadoCb?.(impressoId);
  }

  // ── Session end ─────────────────────────────────────────────────────────────

  /**
   * Encerra a sessão: faz broadcast do SESSION_END ao parceiro e atualiza presença.
   * O estado de sessão do manager é limpo; TrainingContext mantém suas próprias cópias.
   */
  endSession() {
    this._broadcast({ type: "SESSION_END" });
    this.setStatus("available");
    this._notify({ matchResult: null, session: { ...EMPTY_SESSION } });
  }

  private _onSessionEndEvent(_e: RealtimeEvent) {
    this.setStatus("available");
    this._onSessionEndCb?.();
  }

  clearMatchResult() {
    this._notify({ matchResult: null });
  }

  /**
   * Reseta todo o estado multiplayer sem broadcasts.
   * Usado em exitTraining / repeatStation para reset local.
   */
  resetMultiplayerState() {
    this._clearTimer("invite");
    this._clearTimer("matchmaking");
    this._cancelPartnerDisconnectDebounce();
    this._partnerKnownDisconnected = false;
    this._matchmakingLocked = false;
    this._stopPartnerWatchdog();
    this._antiThrashUntil = 0;
    this._notify({
      pendingInvite: null,
      outgoingInviteTargetId: null,
      outgoingInviteTargetName: null,
      matchmakingActive: false,
      matchResult: null,
      session: { ...EMPTY_SESSION },
    });
    this.setStatus("available");
  }

  // ── Notification callbacks ──────────────────────────────────────────────────

  onInviteRejected(cb: (name: string) => void) { this._onRejectCb = cb; }
  onInviteExpired(cb: () => void) { this._onExpiredCb = cb; }
  onMatchmakingTimeout(cb: () => void) { this._onTimeoutCb = cb; }

  /** Ambos os papéis foram atribuídos — avançar para a próxima fase. */
  onRolesComplete(cb: (myRole: SessionRole) => void) { this._onRolesCompleteCb = cb; }

  /** Paciente enviou a configuração — médico pode iniciar a estação. */
  onPartnerConfigured(cb: (config: SessionSyncConfig) => void) { this._onPartnerConfiguredCb = cb; }

  /** Médico iniciou a estação — paciente deve iniciar com o mesmo timestamp. */
  onPartnerStartedSession(cb: (startedAt: number) => void) { this._onPartnerStartedSessionCb = cb; }

  /** Paciente liberou um impresso — médico deve exibi-lo. */
  onImpressoLiberado(cb: (impressoId: string) => void) { this._onImpressoLiberadoCb = cb; }

  /** Parceiro encerrou a estação — encerrar localmente sem re-broadcast. */
  onSessionEnded(cb: () => void) { this._onSessionEndCb = cb; }

  /** Paciente marcou um bloco PEP — médico sincroniza pepRespostas. */
  onPepMark(cb: (pepId: string, resposta: string) => void) { this._onPepMarkCb = cb; }

  /** Parceiro saiu do canal de presença durante uma sessão ativa. */
  onPartnerDisconnected(cb: () => void) { this._onPartnerDisconnectedCb = cb; }

  /** Parceiro voltou ao canal de presença após desconexão. */
  onPartnerReconnected(cb: () => void) { this._onPartnerReconnectedCb = cb; }

  // ── Timer pause / resume broadcasts ─────────────────────────────────────────

  /**
   * Broadcasts a timer pause to the partner.
   * @param remaining       Authoritative remaining seconds at pause time.
   * @param pausedByUserId  Who triggered the pause (omitted for disconnect-pauses).
   */
  broadcastTimerPause(remaining: number, pausedByUserId?: string) {
    this._broadcast({
      type: "TIMER_PAUSE",
      target_id: this._state.session.partnerId ?? undefined,
      payload: { remaining, pausedByUserId: pausedByUserId ?? null },
    });
  }

  /**
   * Broadcasts a timer resume to the partner.
   * @param startedAt  Authoritative epoch-ms of the new timer origin.
   * @param remaining  The remaining-seconds base at that origin.
   */
  broadcastTimerResume(startedAt: number, remaining: number) {
    this._broadcast({
      type: "TIMER_RESUME",
      target_id: this._state.session.partnerId ?? undefined,
      payload: { startedAt, remaining },
    });
  }

  private _onTimerPauseEvent(e: RealtimeEvent) {
    const remaining = e.payload?.remaining as number | undefined;
    const pausedByUserId = e.payload?.pausedByUserId as string | undefined;
    if (remaining === undefined) return;
    this._onTimerPausedCb?.(remaining, pausedByUserId ?? undefined);
  }

  private _onTimerResumeEvent(e: RealtimeEvent) {
    const startedAt = e.payload?.startedAt as number | undefined;
    const remaining = e.payload?.remaining as number | undefined;
    if (startedAt === undefined || remaining === undefined) return;
    this._onTimerResumedCb?.(startedAt, remaining);
  }

  /** Partner paused the timer — freeze locally at the provided remaining. */
  onTimerPaused(cb: (remaining: number, pausedByUserId?: string) => void) {
    this._onTimerPausedCb = cb;
  }

  /** Partner resumed the timer — start dead-reckoning from the provided origin. */
  onTimerResumed(cb: (startedAt: number, remaining: number) => void) {
    this._onTimerResumedCb = cb;
  }

  // ── Partner watchdog — public interface ─────────────────────────────────────

  /**
   * Start the partner heartbeat watchdog + outgoing HEARTBEAT broadcasts.
   * Call when the station becomes "running" with a real partner.
   */
  startPartnerWatchdog() { this._startPartnerWatchdog(); }

  /**
   * Stop the partner heartbeat watchdog.
   * Call when the session ends, pauses, or the partner ID changes.
   */
  stopPartnerWatchdog() { this._stopPartnerWatchdog(); }

  /**
   * Fired when the partner has been silent for 8–15 s (soft disconnect suspected).
   * The timer must NOT be paused in response — only show a yellow banner.
   */
  onPartnerSuspected(cb: () => void) { this._onPartnerSuspectedCb = cb; }

  /**
   * Fired when the partner becomes reachable again after being in "suspected" state
   * (but before a full disconnect was confirmed). No timer action needed.
   */
  onPartnerSuspectedResolved(cb: () => void) { this._onPartnerSuspectedResolvedCb = cb; }

  // ── Partner watchdog — private implementation ────────────────────────────────

  /**
   * Starts the partner connectivity watchdog + outgoing heartbeat broadcast.
   * Call when a real multiplayer session becomes "running".
   */
  private _startPartnerWatchdog() {
    this._stopPartnerWatchdog();
    this._partnerLastSeen = Date.now();
    this._partnerPhase = "connected";

    // Outgoing heartbeat to partner every 5 s so they can track our liveness too
    this._heartbeatBroadcastInterval = window.setInterval(() => {
      const pid = this._state.session.partnerId;
      if (!pid || !this._userId) return;
      this._broadcast({ type: "HEARTBEAT", target_id: pid });
    }, this._HEARTBEAT_BROADCAST_MS);

    // Watchdog polling every 2 s
    this._watchdogInterval = window.setInterval(() => {
      this._runWatchdog();
    }, this._WATCHDOG_INTERVAL_MS);
  }

  private _stopPartnerWatchdog() {
    if (this._watchdogInterval !== null) {
      window.clearInterval(this._watchdogInterval);
      this._watchdogInterval = null;
    }
    if (this._heartbeatBroadcastInterval !== null) {
      window.clearInterval(this._heartbeatBroadcastInterval);
      this._heartbeatBroadcastInterval = null;
    }
    this._partnerLastSeen = null;
    this._partnerPhase = "connected";
  }

  /**
   * Core watchdog logic — evaluates the gap since the last partner heartbeat.
   *
   *  < 8 s  → CONNECTED   (heal any degraded state)
   *  8–15 s → SUSPECTED   (yellow banner; timer keeps running)
   *  > 15 s → DISCONNECTED (freeze timer — only if anti-thrash window has expired)
   */
  private _runWatchdog() {
    if (!this._partnerLastSeen || !this._state.session.partnerId) return;

    const gap = Date.now() - this._partnerLastSeen;

    if (gap < this._SUSPECTED_THRESHOLD_MS) {
      // Partner is healthy — heal any degraded state
      if (this._partnerPhase !== "connected") {
        const wasDisconnected =
          this._partnerPhase === "disconnected" && this._partnerKnownDisconnected;
        this._partnerPhase = "connected";
        if (wasDisconnected) {
          this._partnerKnownDisconnected = false;
          this._cancelPartnerDisconnectDebounce();
          this._markAntiThrash();
          this._onPartnerReconnectedCb?.();
        } else {
          // Was only suspected — clear yellow banner; no timer change
          this._onPartnerSuspectedResolvedCb?.();
        }
      }
    } else if (gap < this._DISCONNECTED_THRESHOLD_MS) {
      // Suspected — show yellow banner; do NOT touch the timer
      if (this._partnerPhase === "connected") {
        this._partnerPhase = "suspected";
        this._onPartnerSuspectedCb?.();
      }
    } else {
      // Confirmed disconnect — freeze timer (anti-thrash guards rapid loops)
      if (this._partnerPhase !== "disconnected" && !this._partnerKnownDisconnected) {
        if (Date.now() >= this._antiThrashUntil) {
          this._partnerPhase = "disconnected";
          this._partnerKnownDisconnected = true;
          this._cancelPartnerDisconnectDebounce();
          this._markAntiThrash();
          this._onPartnerDisconnectedCb?.();
        }
      }
    }
  }

  /**
   * Records that the partner was just seen (HEARTBEAT event or presence join/sync).
   * Heals suspected / disconnected state if appropriate — never blocked by anti-thrash
   * so that genuine reconnects always surface immediately.
   */
  private _refreshPartnerSeen(senderId?: string) {
    const pid = this._state.session.partnerId;
    if (!pid) return;
    if (senderId && senderId !== pid) return;

    this._partnerLastSeen = Date.now();

    if (this._partnerPhase === "suspected") {
      this._partnerPhase = "connected";
      this._onPartnerSuspectedResolvedCb?.();
    } else if (this._partnerPhase === "disconnected" && this._partnerKnownDisconnected) {
      this._partnerKnownDisconnected = false;
      this._partnerPhase = "connected";
      this._cancelPartnerDisconnectDebounce();
      this._markAntiThrash();
      this._onPartnerReconnectedCb?.();
    }
  }

  /** Stamps the anti-thrash window: next auto-disconnect is blocked for _ANTI_THRASH_MS. */
  private _markAntiThrash() {
    this._antiThrashUntil = Date.now() + this._ANTI_THRASH_MS;
  }

  // ── Heartbeat helpers ───────────────────────────────────────────────────────

  /**
   * Starts a periodic presence heartbeat.
   * Calls track() every _HEARTBEAT_MS to keep the user's status fresh across
   * silent WebSocket drops, network changes, and tab switches.
   */
  private _startHeartbeat() {
    this._stopHeartbeat();
    this._heartbeatTimer = window.setInterval(() => {
      if (!this._presenceChannel || !this._userId || !this._state.isConnected) return;
      this._presenceChannel
        .track({ user_id: this._userId, name: this._userName, status: this._myStatus })
        .catch(() => {});
    }, this._HEARTBEAT_MS);
  }

  private _stopHeartbeat() {
    if (this._heartbeatTimer !== null) {
      window.clearInterval(this._heartbeatTimer);
      this._heartbeatTimer = null;
    }
  }

  // ── Reconnect helpers ───────────────────────────────────────────────────────

  private _cancelReconnect() {
    if (this._reconnectTimer !== null) {
      window.clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
  }

  /**
   * Schedules a presence-channel reconnect with exponential backoff.
   * Only the presence channel is rebuilt; the events channel is left intact.
   * Resets after a successful SUBSCRIBED event.
   */
  private _scheduleReconnect() {
    this._cancelReconnect();
    if (!this._userId) return;

    const delay = Math.min(
      this._RECONNECT_BASE_MS * Math.pow(2, this._reconnectAttempts),
      this._RECONNECT_MAX_MS,
    );
    this._reconnectAttempts++;

    this._reconnectTimer = window.setTimeout(() => {
      this._reconnectTimer = null;
      if (!this._userId) return;
      // Remove existing presence channel before creating a new one
      if (this._presenceChannel) {
        const old = this._presenceChannel;
        this._presenceChannel = null;
        try { supabase.removeChannel(old); } catch {}
      }
      this._setupPresence();
    }, delay);
  }

  // ── Visibility handler ──────────────────────────────────────────────────────

  /**
   * Registers a visibilitychange listener that:
   * - Re-tracks presence immediately when the tab becomes visible (keeps
   *   status current after the browser suspends the WebSocket while hidden).
   * - Triggers an immediate reconnect attempt if the channel is already down.
   */
  private _registerVisibilityHandler() {
    this._removeVisibilityHandler();
    this._visibilityHandler = () => {
      if (document.visibilityState !== "visible" || !this._userId) return;

      if (this._presenceChannel && this._state.isConnected) {
        // Re-track to refresh presence state after the tab was hidden
        this._presenceChannel
          .track({ user_id: this._userId, name: this._userName, status: this._myStatus })
          .catch(() => {});
      } else if (!this._state.isConnected) {
        // Channel is down — attempt immediate reconnect instead of waiting for backoff
        this._cancelReconnect();
        this._reconnectAttempts = 0;
        this._scheduleReconnect();
      }
    };
    document.addEventListener("visibilitychange", this._visibilityHandler);
  }

  private _removeVisibilityHandler() {
    if (this._visibilityHandler) {
      document.removeEventListener("visibilitychange", this._visibilityHandler);
      this._visibilityHandler = null;
    }
  }

  // ── Timer helpers ───────────────────────────────────────────────────────────

  private _clearTimer(which: "invite" | "matchmaking") {
    if (which === "invite" && this._inviteTimerId !== null) {
      window.clearTimeout(this._inviteTimerId);
      this._inviteTimerId = null;
    } else if (which === "matchmaking" && this._matchmakingTimerId !== null) {
      window.clearTimeout(this._matchmakingTimerId);
      this._matchmakingTimerId = null;
    }
  }
}
