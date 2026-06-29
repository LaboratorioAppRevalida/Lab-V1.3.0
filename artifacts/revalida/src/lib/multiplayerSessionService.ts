import { supabase, isSupabaseConfigured } from "@/lib/supabase";

// ── Types ───────────────────────────────────────────────────────────────────

export type MultiplayerSessionStatus =
  | "invited"
  | "roles_selection"
  | "waiting_roles"          // legacy alias for roles_selection
  | "configuring_station"
  | "waiting_start"
  | "running"
  | "paused_disconnect"
  | "paused_manual"
  | "finished"
  | "abandoned";

export interface MultiplayerSessionRow {
  id: string;
  session_code: string;
  status: MultiplayerSessionStatus;
  host_user_id: string;
  guest_user_id: string | null;
  host_role: "medico" | "paciente" | null;
  guest_role: "medico" | "paciente" | null;
  specialty: string | null;
  checklist_id: string | null;
  checklist_title: string | null;
  duration_minutes: number | null;
  started_at: string | null;
  ended_at: string | null;
  current_phase: string;
  timer_started_at: string | null;
  timer_remaining_seconds: number | null;
  host_connected: boolean;
  guest_connected: boolean;
  last_event: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

export const ACTIVE_STATUSES: MultiplayerSessionStatus[] = [
  "invited",
  "roles_selection",
  "waiting_roles",
  "configuring_station",
  "waiting_start",
  "running",
  "paused_disconnect",
  "paused_manual",
];

/** Terminal statuses — transitions into these are one-way. */
const TERMINAL_STATUSES: MultiplayerSessionStatus[] = ["finished", "abandoned"];

/**
 * Statuses that indicate a stale previous session when seen inside
 * createOrGetMultiplayerSession.
 *
 * The session-restore flow (page-reload recovery) is a completely separate
 * code path that never calls createOrGetMultiplayerSession.  Therefore, any
 * row in a status beyond the initial invitation/role-selection phases that is
 * returned by the unique-conflict fallback path belongs to a previous match —
 * not the current one — and must be replaced with a fresh row.
 *
 * Statuses that are safe to keep (current in-progress match):
 *   invited | roles_selection | waiting_roles | configuring_station | waiting_start
 *
 * Statuses that signal a stale session (finishMultiplayerSession may have
 * failed, been slow, or not yet called when the next match is established):
 *   running | paused_disconnect | paused_manual | finished | abandoned
 */
const STALE_FOR_REMATCH_STATUSES: MultiplayerSessionStatus[] = [
  "running",
  "paused_disconnect",
  "paused_manual",
  "finished",
  "abandoned",
];

/** Statuses from which a pause is valid (must be actively running). */
const PAUSABLE_STATUSES: MultiplayerSessionStatus[] = ["running"];

/** Statuses from which a resume is valid. */
const RESUMABLE_STATUSES: MultiplayerSessionStatus[] = ["paused_disconnect", "paused_manual"];

const ORPHAN_MINUTES = 30;

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Deterministic session code for two users (sorted by ID).
 * Both sides compute the same code, enabling race-safe upsert.
 */
function buildSessionCode(userId1: string, userId2: string): string {
  const ids = [userId1, userId2].sort();
  return `mp_${ids[0].slice(0, 8)}_${ids[1].slice(0, 8)}`;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Creates or fetches an existing multiplayer session for two users.
 * Both users call this concurrently — the second call fetches the existing row.
 * Host is always the user with the lexicographically smaller ID.
 */
export async function createOrGetMultiplayerSession(
  userId: string,
  partnerId: string,
): Promise<MultiplayerSessionRow | null> {
  if (!isSupabaseConfigured) return null;

  const ids = [userId, partnerId].sort();
  const hostId = ids[0];
  const guestId = ids[1];
  const sessionCode = buildSessionCode(userId, partnerId);

  // Try insert — second caller will hit unique violation on session_code
  const { data: inserted, error: insertErr } = await supabase
    .from("multiplayer_sessions")
    .insert({
      session_code: sessionCode,
      host_user_id: hostId,
      guest_user_id: guestId,
      status: "invited",
      current_phase: "invited",
      host_connected: true,
      guest_connected: true,
    })
    .select()
    .maybeSingle();

  if (inserted) return inserted as MultiplayerSessionRow;

  // Row already existed or insert failed — fetch it
  const isUniqueViolation =
    insertErr?.code === "23505" || insertErr?.message?.includes("unique");

  if (insertErr && !isUniqueViolation) {
    console.warn("[multiplayerSessionService] createOrGet insert error:", insertErr.message);
  }

  const { data: existing, error: fetchErr } = await supabase
    .from("multiplayer_sessions")
    .select("*")
    .eq("session_code", sessionCode)
    .maybeSingle();

  if (fetchErr) {
    console.warn("[multiplayerSessionService] createOrGet fetch error:", fetchErr.message);
    return null;
  }

  const row = existing as MultiplayerSessionRow | null;
  if (!row) return null;

  // ── Stale session guard ───────────────────────────────────────────────────
  // createOrGetMultiplayerSession is ONLY called after a new match is
  // established (invite accepted or matchmaking success).  The session-restore
  // path (page-reload recovery) is a separate useEffect that never reaches
  // here.  Therefore any row whose status is beyond the initial invitation
  // phases (invited / roles_selection / waiting_roles / configuring_station /
  // waiting_start) belongs to a PREVIOUS match and must be replaced so that
  // every new match gets its own fresh UUID.
  //
  // Common stale statuses and why they appear:
  //   "running"          — finishMultiplayerSession fire-and-forget call failed
  //                        or was slow, leaving the old row in running state
  //   "paused_*"         — same as above for a paused mid-session
  //   "finished"/"abandoned" — terminal rows from a prior session
  if ((STALE_FOR_REMATCH_STATUSES as string[]).includes(row.status)) {
    console.info(
      "[multiplayerSessionService] createOrGet: existing session is stale (%s), replacing with fresh row",
      row.status,
    );

    // Delete the terminal row so the unique constraint on session_code is freed.
    await supabase.from("multiplayer_sessions").delete().eq("id", row.id);

    // Insert a fresh row. If the partner wins the race first, fall back to
    // fetching the row they just created (same logic as the original path).
    const { data: fresh, error: freshErr } = await supabase
      .from("multiplayer_sessions")
      .insert({
        session_code: sessionCode,
        host_user_id: hostId,
        guest_user_id: guestId,
        status: "invited",
        current_phase: "invited",
        host_connected: true,
        guest_connected: true,
      })
      .select()
      .maybeSingle();

    if (fresh) return fresh as MultiplayerSessionRow;

    // Partner beat us to the insert — fetch their row
    const isFreshUniqueViolation =
      freshErr?.code === "23505" || freshErr?.message?.includes("unique");
    if (!isFreshUniqueViolation) {
      console.warn("[multiplayerSessionService] createOrGet fresh insert error:", freshErr?.message);
      return null;
    }

    const { data: partnerRow } = await supabase
      .from("multiplayer_sessions")
      .select("*")
      .eq("session_code", sessionCode)
      .maybeSingle();

    return (partnerRow as MultiplayerSessionRow) ?? null;
  }

  // Active session — return as-is (same match, mid-flow recovery)
  return row;
}

/**
 * Update arbitrary fields on a session.
 * Always bumps updated_at (handled by DB trigger).
 *
 * This is the unrestricted variant — callers that need atomic state-transition
 * safety should use the purpose-built functions below instead.
 */
export async function updateMultiplayerSession(
  sessionId: string,
  partial: Partial<Omit<MultiplayerSessionRow, "id" | "created_at">>,
): Promise<boolean> {
  if (!isSupabaseConfigured || !sessionId) return false;

  const { error } = await supabase
    .from("multiplayer_sessions")
    .update(partial)
    .eq("id", sessionId);

  if (error) {
    console.warn("[multiplayerSessionService] update error:", error.message);
    return false;
  }
  return true;
}

/**
 * Heartbeat: marks the caller as connected and bumps updated_at.
 * Fire-and-forget — never throws.
 */
export function heartbeatSession(
  sessionId: string,
  isHost: boolean,
  connected = true,
): void {
  if (!isSupabaseConfigured || !sessionId) return;
  const field = isHost ? "host_connected" : "guest_connected";
  void supabase
    .from("multiplayer_sessions")
    .update({ [field]: connected })
    .eq("id", sessionId);
}

/**
 * Find an active (non-finished, non-abandoned) session for a user.
 * Returns the most recently updated active session within ORPHAN_MINUTES.
 */
export async function getActiveSessionForUser(
  userId: string,
): Promise<MultiplayerSessionRow | null> {
  if (!isSupabaseConfigured) return null;

  const cutoff = new Date(Date.now() - ORPHAN_MINUTES * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("multiplayer_sessions")
    .select("*")
    .or(`host_user_id.eq.${userId},guest_user_id.eq.${userId}`)
    .in("status", ACTIVE_STATUSES)
    .gte("updated_at", cutoff)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn("[multiplayerSessionService] getActive error:", error.message);
    return null;
  }
  return (data as MultiplayerSessionRow) ?? null;
}

/**
 * Mark a session as finished (normal encerramento).
 *
 * ATOMIC GUARD: The update only applies when the session is currently in an
 * active (non-terminal) state. If both sides call this simultaneously, the
 * second write targets 0 rows — preventing double-commit races. A session
 * already "abandoned" is never accidentally overwritten with "finished".
 */
export async function finishMultiplayerSession(
  sessionId: string,
  endedAt?: string,
): Promise<void> {
  if (!isSupabaseConfigured || !sessionId) return;

  const { error } = await supabase
    .from("multiplayer_sessions")
    .update({
      status: "finished",
      current_phase: "finished",
      ended_at: endedAt ?? new Date().toISOString(),
      host_connected: false,
      guest_connected: false,
    })
    .eq("id", sessionId)
    .in("status", ACTIVE_STATUSES); // ← only transitions from active states

  if (error) {
    console.warn("[multiplayerSessionService] finishMultiplayerSession error:", error.message);
  }
}

/**
 * Mark a session as abandoned (exit without completing).
 *
 * ATOMIC GUARD: Only applies when the session is in an active state.
 * Already-finished sessions are never downgraded to abandoned.
 */
export async function abandonMultiplayerSession(sessionId: string): Promise<void> {
  if (!isSupabaseConfigured || !sessionId) return;

  const { error } = await supabase
    .from("multiplayer_sessions")
    .update({
      status: "abandoned",
      current_phase: "abandoned",
      ended_at: new Date().toISOString(),
    })
    .eq("id", sessionId)
    .in("status", ACTIVE_STATUSES); // ← only transitions from active states

  if (error) {
    console.warn("[multiplayerSessionService] abandonMultiplayerSession error:", error.message);
  }
}

/**
 * Pause a running session (manual or due to disconnect).
 * Saves the authoritative remaining time so both sides recover without drift.
 *
 * ATOMIC GUARD: Only applies when the session is currently "running".
 * Pausing an already-paused, finished, or abandoned session is a no-op.
 */
export async function pauseSession(
  sessionId: string,
  remainingSeconds: number,
  mode: "paused_manual" | "paused_disconnect",
): Promise<boolean> {
  if (!isSupabaseConfigured || !sessionId) return false;

  const { error } = await supabase
    .from("multiplayer_sessions")
    .update({
      status: mode,
      current_phase: mode,
      timer_remaining_seconds: Math.max(0, Math.round(remainingSeconds)),
      timer_started_at: null,
    })
    .eq("id", sessionId)
    .in("status", PAUSABLE_STATUSES); // ← only pause a running session

  if (error) {
    console.warn("[multiplayerSessionService] pauseSession error:", error.message);
    return false;
  }
  return true;
}

/**
 * Resume a paused session.
 * Sets timer_started_at = now() so both sides dead-reckon from the same origin.
 * Returns the ISO timestamp used, or null on failure.
 *
 * ATOMIC GUARD: Only applies when the session is in a paused state.
 * Resuming a finished or running session is a no-op.
 */
export async function resumeSession(sessionId: string): Promise<string | null> {
  if (!isSupabaseConfigured || !sessionId) return null;

  const now = new Date().toISOString();

  const { error } = await supabase
    .from("multiplayer_sessions")
    .update({
      status: "running",
      current_phase: "running",
      timer_started_at: now,
    })
    .eq("id", sessionId)
    .in("status", RESUMABLE_STATUSES); // ← only resume from a paused state

  if (error) {
    console.warn("[multiplayerSessionService] resumeSession error:", error.message);
    return null;
  }
  return now;
}

/**
 * Mark stale sessions (older than ORPHAN_MINUTES) as abandoned.
 * Call on startup to clean up zombie sessions from previous tabs.
 */
export async function cleanupOrphanSessions(userId: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  const cutoff = new Date(Date.now() - ORPHAN_MINUTES * 60 * 1000).toISOString();
  void supabase
    .from("multiplayer_sessions")
    .update({ status: "abandoned", current_phase: "abandoned" })
    .or(`host_user_id.eq.${userId},guest_user_id.eq.${userId}`)
    .in("status", ACTIVE_STATUSES)
    .lt("updated_at", cutoff);
}

// ── Re-export terminal status list for external consumers ────────────────────
export { TERMINAL_STATUSES };
