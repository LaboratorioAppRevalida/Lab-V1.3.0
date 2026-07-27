import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { RealtimeStateManager } from "@/lib/realtimeStateManager";
import type { OnlinePresenceUser, RealtimeState, UserStatus } from "@/lib/realtimeStateManager";

// Re-export types so consumers only import from this module
export type { UserStatus, OnlinePresenceUser, RealtimeState };
export type {
  MatchResult,
  IncomingInvite,
  RealtimeEvent,
  RealtimeEventType,
} from "@/lib/realtimeStateManager";

// ── Context type ───────────────────────────────────────────────────────────────

interface RealtimeContextType {
  /** Usuários online (excluindo o próprio usuário). */
  onlineUsers: OnlinePresenceUser[];
  /** true quando o canal de presença está ativo. */
  isConnected: boolean;
  /** Estado completo do manager — presença, convites, matchmaking. */
  realtimeState: RealtimeState;
  /**
   * Instância do RealtimeStateManager.
   * Use para chamar ações: manager.sendInvite(), manager.joinMatchmaking(), etc.
   * Toda lógica multiplayer passa por aqui — nunca chame o Supabase diretamente.
   */
  manager: RealtimeStateManager;
}

const RealtimeCtx = createContext<RealtimeContextType | null>(null);

// ── Provider ───────────────────────────────────────────────────────────────────

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const userName = user?.displayName || user?.name || "Usuário";

  // Manager instance lives for the entire React tree lifecycle
  const managerRef = useRef<RealtimeStateManager | null>(null);
  if (!managerRef.current) {
    managerRef.current = new RealtimeStateManager();
  }
  const manager = managerRef.current;

  // Mirror manager state into React state so consumers re-render on changes
  const [realtimeState, setRealtimeState] = useState<RealtimeState>(() =>
    manager.getState(),
  );

  // Subscribe to manager pub-sub on mount, unsubscribe on unmount
  useEffect(() => {
    return manager.subscribe(setRealtimeState);
  }, [manager]);

  // Initialize / destroy channels when auth user changes
  useEffect(() => {
    if (userId) {
      manager.init(userId, userName);
    } else {
      manager.destroy();
    }
  }, [userId, userName, manager]);

  // Full teardown when provider unmounts
  useEffect(() => {
    return () => {
      manager.destroy();
    };
  }, [manager]);

  const value: RealtimeContextType = {
    onlineUsers: realtimeState.onlineUsers,
    isConnected: realtimeState.isConnected,
    realtimeState,
    manager,
  };

  return <RealtimeCtx.Provider value={value}>{children}</RealtimeCtx.Provider>;
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useRealtime(): RealtimeContextType {
  const ctx = useContext(RealtimeCtx);
  if (!ctx) throw new Error("useRealtime must be used within RealtimeProvider");
  return ctx;
}
