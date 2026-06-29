import { useEffect, useRef } from "react";
import { heartbeatSession } from "@/lib/multiplayerSessionService";

const HEARTBEAT_INTERVAL_MS = 15_000;

/**
 * Sends a heartbeat every 15 seconds while a multiplayer session is active.
 *
 * Also detects tab visibility changes and beforeunload to mark the user
 * as disconnected before the browser closes.
 *
 * Cleanup on unmount marks the user as disconnected.
 */
export function useSessionHeartbeat(
  sessionId: string | null,
  isHost: boolean,
): void {
  const sessionIdRef = useRef(sessionId);
  const isHostRef = useRef(isHost);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  useEffect(() => {
    isHostRef.current = isHost;
  }, [isHost]);

  useEffect(() => {
    if (!sessionId) return;

    // Immediate heartbeat on session activation
    heartbeatSession(sessionId, isHost, true);

    const intervalId = window.setInterval(() => {
      if (sessionIdRef.current) {
        heartbeatSession(sessionIdRef.current, isHostRef.current, true);
      }
    }, HEARTBEAT_INTERVAL_MS);

    const handleVisibilityChange = () => {
      if (!sessionIdRef.current) return;
      const connected = document.visibilityState !== "hidden";
      heartbeatSession(sessionIdRef.current, isHostRef.current, connected);
    };

    const handleBeforeUnload = () => {
      if (sessionIdRef.current) {
        heartbeatSession(sessionIdRef.current, isHostRef.current, false);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      // Mark disconnected on unmount (navigated away / component destroyed)
      if (sessionIdRef.current) {
        heartbeatSession(sessionIdRef.current, isHostRef.current, false);
      }
    };
  }, [sessionId, isHost]);
}
