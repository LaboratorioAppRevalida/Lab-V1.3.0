/**
 * missionService.ts
 *
 * CRUD para a tabela `missions` (Supabase).
 * FASE 2: inclui suporte ao campo conditions (JSONB).
 */

import { supabase } from "./supabase";
import type { Mission, MissionPeriod } from "./gamificationStorage";
import type { MissionConditions } from "@/types/missions";

export type MissionType   = "diaria" | "semanal" | "especial" | "evento" | "secreta";
export type MissionRarity = "common" | "rare" | "epic" | "legendary" | "exclusive" | "event";

export type DbMission = {
  id:            string;
  slug:          string;
  name:          string;
  description:   string;
  xp_reward:     number;
  type:          MissionType;
  category:      string;
  rarity:        MissionRarity;
  is_active:     boolean;
  hidden:        boolean;
  icon:          string | null;
  trigger_type:  string;
  trigger_value: number;
  conditions:    MissionConditions | null;
  created_at:    string;
  updated_at:    string;
};

export type MissionInput = Omit<DbMission, "id" | "created_at" | "updated_at">;

export const MISSION_TYPES: { value: MissionType; label: string }[] = [
  { value: "diaria",   label: "Diária"   },
  { value: "semanal",  label: "Semanal"  },
  { value: "especial", label: "Especial" },
  { value: "evento",   label: "Evento"   },
  { value: "secreta",  label: "Secreta"  },
];

export const MISSION_RARITIES: { value: MissionRarity; label: string }[] = [
  { value: "common",    label: "Comum"     },
  { value: "rare",      label: "Raro"      },
  { value: "epic",      label: "Épico"     },
  { value: "legendary", label: "Lendário"  },
  { value: "exclusive", label: "Exclusivo" },
  { value: "event",     label: "Evento"    },
];

export const TRIGGER_TYPES = [
  "completar_estacao",
  "completar_estacao_paciente",
  "login",
  "streak",
  "completar_checklist",
  "finalizar_multiplayer",
  "media_nota",
  "manual",
] as const;

// ── Adapters legado → Mission ─────────────────────────────────────────────────

function mapTypeToPeriod(type: MissionType): MissionPeriod {
  switch (type) {
    case "diaria":   return "diario";
    case "semanal":  return "semanal";
    case "especial":
    case "evento":
    case "secreta":  return "especial";
  }
}

function mapTriggerToMetric(
  triggerType: string,
  missionType: MissionType,
): Mission["metric"] {
  switch (triggerType) {
    case "login":                      return "loginDiario";
    case "streak":                     return "streak7";
    case "media_nota":                 return "media8";
    case "completar_estacao_paciente": return "papelPaciente";
    case "completar_checklist":        return "areasUnicasSemana";
    case "completar_estacao":
      if (missionType === "diaria")   return "estacoesHoje";
      if (missionType === "semanal")  return "estacoesSemana";
      return "marathonMes";
    default:
      return "estacoesHoje";
  }
}

export function dbMissionToMission(db: DbMission): Mission {
  return {
    id:       db.slug || db.id,
    titulo:   db.name,
    descricao: db.description,
    xp:       db.xp_reward,
    period:   mapTypeToPeriod(db.type),
    goal:     db.trigger_value,
    metric:   mapTriggerToMetric(db.trigger_type, db.type),
  };
}

// ── Queries ───────────────────────────────────────────────────────────────────

/**
 * Missões ativas e visíveis — converte para tipo Mission legado.
 * Usado como fallback / compatibilidade no Conquistas.tsx.
 */
export async function fetchActiveMissions(): Promise<Mission[]> {
  const { data, error } = await supabase
    .from("missions")
    .select("*")
    .eq("is_active", true)
    .eq("hidden",    false)
    .order("type",        { ascending: true })
    .order("xp_reward",   { ascending: true })
    .order("created_at",  { ascending: true });
  if (error) throw error;
  return (data ?? []).map(dbMissionToMission);
}

/**
 * Missões ativas e visíveis como DbMission[] — inclui o campo conditions.
 * Usado pelo Conquistas.tsx para renderizar missões compostas.
 */
export async function fetchActiveDbMissions(): Promise<DbMission[]> {
  const { data, error } = await supabase
    .from("missions")
    .select("*")
    .eq("is_active", true)
    .eq("hidden",    false)
    .order("type",        { ascending: true })
    .order("xp_reward",   { ascending: true })
    .order("created_at",  { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/** Todas as missões (admin panel). */
export async function fetchMissions(): Promise<DbMission[]> {
  const { data, error } = await supabase
    .from("missions")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createMission(m: MissionInput): Promise<DbMission> {
  const { data, error } = await supabase
    .from("missions")
    .insert(m)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateMission(
  id: string,
  updates: Partial<MissionInput>,
): Promise<void> {
  const { error } = await supabase.from("missions").update(updates).eq("id", id);
  if (error) throw error;
}

export async function deleteMission(id: string): Promise<void> {
  const { error } = await supabase.from("missions").delete().eq("id", id);
  if (error) throw error;
}

export async function toggleMissionActive(id: string, isActive: boolean): Promise<void> {
  const { error } = await supabase
    .from("missions")
    .update({ is_active: isActive })
    .eq("id", id);
  if (error) throw error;
}
