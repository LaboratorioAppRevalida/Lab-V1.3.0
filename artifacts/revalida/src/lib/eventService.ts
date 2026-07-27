/**
 * eventService.ts
 *
 * CRUD para as tabelas `events`, `event_rewards`, `event_missions`.
 * Fundação do sistema de eventos administráveis.
 *
 * Não implementado nesta versão:
 * - Battle pass / temporadas
 * - Cosméticos / loja
 */

import { supabase } from "./supabase";

export type EventType = "evento" | "especial" | "sazonal";
export type EventRewardType = "xp" | "title" | "badge";

export type DbEvent = {
  id:          string;
  name:        string;
  description: string;
  banner_url:  string | null;
  type:        EventType;
  is_active:   boolean;
  starts_at:   string | null;
  ends_at:     string | null;
  created_at:  string;
  updated_at:  string;
};

export type EventInput = Omit<DbEvent, "id" | "created_at" | "updated_at">;

export type DbEventReward = {
  id:           string;
  event_id:     string;
  reward_type:  EventRewardType;
  reward_value: string;
  title_id:     string | null;
  created_at:   string;
};

export type DbEventMission = {
  id:         string;
  event_id:   string;
  mission_id: string;
  created_at: string;
};

// ── Events CRUD ──────────────────────────────────────────────────────────────

export async function fetchEvents(): Promise<DbEvent[]> {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createEvent(e: EventInput): Promise<DbEvent> {
  const { data, error } = await supabase
    .from("events")
    .insert(e)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateEvent(
  id: string,
  updates: Partial<EventInput>,
): Promise<void> {
  const { error } = await supabase.from("events").update(updates).eq("id", id);
  if (error) throw error;
}

export async function deleteEvent(id: string): Promise<void> {
  const { error } = await supabase.from("events").delete().eq("id", id);
  if (error) throw error;
}

export async function toggleEventActive(id: string, isActive: boolean): Promise<void> {
  const { error } = await supabase
    .from("events")
    .update({ is_active: isActive })
    .eq("id", id);
  if (error) throw error;
}

// ── Read-only queries (FASE EVENTOS 1A) ──────────────────────────────────────

export type EventMissionRow = {
  id: string;
  event_id: string;
  mission_id: string;
  created_at: string;
  mission: import("./missionService").DbMission | null;
};

export type EventRewardWithTitle = DbEventReward & {
  title: {
    id:     string;
    name:   string;
    rarity: string;
    color:  string;
    icon:   string | null;
  } | null;
};

/**
 * Retorna o primeiro evento ativo cujo período engloba agora.
 * Filtra: is_active = true, starts_at <= now (ou null), ends_at >= now (ou null).
 */
export async function fetchActiveEvent(): Promise<DbEvent | null> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("is_active", true)
    .or(`starts_at.is.null,starts_at.lte.${now}`)
    .or(`ends_at.is.null,ends_at.gte.${now}`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

/**
 * Retorna o evento ativo com contagem de missões e recompensas.
 * Usado no card de Conquistas.tsx.
 */
export async function fetchActiveEventWithCounts(): Promise<{
  event: DbEvent;
  missionCount: number;
  rewardCount: number;
} | null> {
  const event = await fetchActiveEvent();
  if (!event) return null;
  const [{ count: mc }, { count: rc }] = await Promise.all([
    supabase.from("event_missions").select("id", { count: "exact", head: true }).eq("event_id", event.id),
    supabase.from("event_rewards").select("id", { count: "exact", head: true }).eq("event_id", event.id),
  ]);
  return { event, missionCount: mc ?? 0, rewardCount: rc ?? 0 };
}

/** Retorna um evento pelo id. */
export async function fetchEventById(eventId: string): Promise<DbEvent | null> {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("id", eventId)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

/** Retorna as missões vinculadas ao evento com dados completos da missão. */
export async function fetchEventMissions(eventId: string): Promise<EventMissionRow[]> {
  const { data, error } = await supabase
    .from("event_missions")
    .select("*, mission:missions(*)")
    .eq("event_id", eventId);
  if (error) throw error;
  return (data ?? []) as unknown as EventMissionRow[];
}

/** Retorna as recompensas do evento com dados do título associado (se existir). */
export async function fetchEventRewards(eventId: string): Promise<EventRewardWithTitle[]> {
  const { data, error } = await supabase
    .from("event_rewards")
    .select("*, title:titles(id, name, rarity, color, icon)")
    .eq("event_id", eventId);
  if (error) throw error;
  return (data ?? []) as unknown as EventRewardWithTitle[];
}

// ── Progresso por evento (FASE 1B) ────────────────────────────────────────────

export type EventProgressRow = {
  missionId: string;
  progress: number;
  target: number;
  completed: boolean;
  claimed: boolean;
};

/** Map<mission_id (UUID), EventProgressRow> */
export type EventProgressMap = Map<string, EventProgressRow>;

/**
 * Retorna o progresso persistido do usuário para as missões de um evento.
 * Executa exatamente 2 queries:
 *   1. event_missions → obtém os mission_id do evento
 *   2. user_mission_progress → filtra por user_id + mission_id IN (...)
 * Sem cálculos, sem writes, sem alteração de estado global.
 */
export async function fetchEventMissionProgress(
  userId: string,
  eventId: string,
): Promise<EventProgressMap> {
  // Query 1: IDs das missões vinculadas ao evento
  const { data: emData, error: emError } = await supabase
    .from("event_missions")
    .select("mission_id")
    .eq("event_id", eventId);
  if (emError) throw emError;

  const missionIds = (emData ?? []).map((r) => r.mission_id as string);
  if (missionIds.length === 0) return new Map();

  // Query 2: progresso persistido para essas missões
  const { data: prData, error: prError } = await supabase
    .from("user_mission_progress")
    .select("mission_id, progress, target, completed, claimed")
    .eq("user_id", userId)
    .in("mission_id", missionIds);
  if (prError) throw prError;

  const map: EventProgressMap = new Map();
  for (const row of prData ?? []) {
    map.set(row.mission_id as string, {
      missionId: row.mission_id as string,
      progress:  (row.progress  as number)  ?? 0,
      target:    (row.target    as number)  ?? 1,
      completed: (row.completed as boolean) ?? false,
      claimed:   (row.claimed   as boolean) ?? false,
    });
  }
  return map;
}

// ── Claims de recompensas de eventos (FASE 1E) ───────────────────────────────

/**
 * Retorna o Set de event_reward_ids já resgatados pelo usuário neste evento.
 * 2 queries internas: event_rewards IDs → user_event_rewards filtrado.
 * Sem writes, sem efeitos colaterais.
 */
export async function fetchUserEventClaims(
  userId: string,
  eventId: string,
): Promise<Set<string>> {
  // Query 1: reward IDs deste evento
  const { data: rds, error: rErr } = await supabase
    .from("event_rewards")
    .select("id")
    .eq("event_id", eventId);
  if (rErr) throw rErr;

  const rewardIds = (rds ?? []).map((r) => r.id as string);
  if (rewardIds.length === 0) return new Set();

  // Query 2: claims do usuário para esses rewards
  const { data, error } = await supabase
    .from("user_event_rewards")
    .select("event_reward_id")
    .eq("user_id", userId)
    .in("event_reward_id", rewardIds);
  if (error) throw error;

  return new Set((data ?? []).map((r) => r.event_reward_id as string));
}

/**
 * Registra o resgate de uma recompensa de evento via RPC segura.
 *
 * Post-migration 013: direct INSERT on user_event_rewards is blocked by RLS
 * for regular users. fn_claim_event_reward() is a SECURITY DEFINER function
 * that validates the parent event is still active (not past end_date) before
 * inserting — preventing post-event reward claims.
 *
 * Returns "claimed" if new, "already_claimed" if already registered (idempotent).
 */
export async function claimEventReward(
  _userId: string,      // kept for call-site compat; RPC uses auth.uid()
  eventRewardId: string,
): Promise<"claimed" | "already_claimed"> {
  const { data, error } = await supabase.rpc("fn_claim_event_reward", {
    p_event_reward_id: eventRewardId,
  });

  if (error) {
    // Treat unique-violation surface as already_claimed (defensive)
    if (String(error.code ?? "").startsWith("23505") || error.message?.includes("already"))
      return "already_claimed";
    throw error;
  }

  return (data as "claimed" | "already_claimed") ?? "claimed";
}

// ── Event Missions (admin write) ──────────────────────────────────────────────

export async function linkMissionToEvent(
  eventId: string,
  missionId: string,
): Promise<void> {
  const { error } = await supabase
    .from("event_missions")
    .insert({ event_id: eventId, mission_id: missionId });
  if (error && !error.code?.startsWith("23505")) throw error;
}

export async function unlinkMissionFromEvent(
  eventId: string,
  missionId: string,
): Promise<void> {
  const { error } = await supabase
    .from("event_missions")
    .delete()
    .eq("event_id", eventId)
    .eq("mission_id", missionId);
  if (error) throw error;
}

// ── Admin CRUD para recompensas de eventos (FASE 1F) ─────────────────────────

export type EventRewardInput = {
  event_id:     string;
  reward_type:  EventRewardType;
  reward_value: string;
  title_id:     string | null;
};

export async function createEventReward(
  input: EventRewardInput,
): Promise<DbEventReward> {
  const { data, error } = await supabase
    .from("event_rewards")
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateEventReward(
  id: string,
  patch: Partial<Omit<EventRewardInput, "event_id">>,
): Promise<void> {
  const { error } = await supabase
    .from("event_rewards")
    .update(patch)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteEventReward(id: string): Promise<void> {
  const { error } = await supabase.from("event_rewards").delete().eq("id", id);
  if (error) throw error;
}

/**
 * Contagens de missões e recompensas para todos os eventos.
 * 2 queries flat (sem N+1) — cada uma retorna todos os event_id.
 */
export async function fetchEventCountsForAll(): Promise<
  Map<string, { missions: number; rewards: number }>
> {
  const [mRes, rRes] = await Promise.all([
    supabase.from("event_missions").select("event_id"),
    supabase.from("event_rewards").select("event_id"),
  ]);
  const map = new Map<string, { missions: number; rewards: number }>();
  const ensure = (id: string) => {
    if (!map.has(id)) map.set(id, { missions: 0, rewards: 0 });
    return map.get(id)!;
  };
  for (const row of mRes.data ?? []) ensure(row.event_id as string).missions++;
  for (const row of rRes.data ?? []) ensure(row.event_id as string).rewards++;
  return map;
}
