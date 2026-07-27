import { supabase } from "@/lib/supabase";
import { inferArea } from "@/lib/gamificationStorage";
import type { SavedSession } from "@/contexts/TrainingContext";

export interface SessionRow {
  id: string;
  user_id: string;
  parceiro_nome: string;
  checklist_nome: string;
  area: string | null;
  papel: "medico" | "paciente";
  nota: number;
  ended_at: string;
}

export interface SessionsPage {
  data: SavedSession[];
  hasMore: boolean;
  totalCount: number;
}

function rowToSavedSession(row: SessionRow): SavedSession {
  return {
    id: row.id,
    partnerName: row.parceiro_nome,
    role: row.papel,
    checklistId: "",
    checklistTitle: row.checklist_nome,
    tempoMin: 10,
    notaTotal: row.nota,
    notaMaxima: 10,
    endedAt: row.ended_at,
    area: row.area ?? null,
  };
}

function nota10(s: SavedSession): number {
  if (s.notaMaxima <= 0) return 0;
  return Math.round((s.notaTotal / s.notaMaxima) * 10 * 100) / 100;
}

/**
 * Fetches up to 200 most-recent sessions for a user.
 * Used by TrainingContext for stats, charts, and gamification engines
 * (mission progress, achievements) that require the full dataset.
 * This function is NOT used for the paginated history list in Progresso.tsx.
 */
export async function fetchSessions(userId: string): Promise<SavedSession[]> {
  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("user_id", userId)
    .order("ended_at", { ascending: false })
    .limit(200);

  if (error) {
    console.warn("[sessionService] fetchSessions error:", error.message);
    throw new Error(error.message);
  }

  return ((data ?? []) as SessionRow[]).map(rowToSavedSession);
}

/**
 * Server-side paginated fetch for the history list UI.
 *
 * Uses Supabase `.range(from, to)` with `count: 'exact'` so only
 * `pageSize` rows travel over the wire per request, eliminating
 * the client-side render freeze that occurs when all 200+ rows are
 * inserted into the DOM at once.
 *
 * Optional role and area filters are applied server-side so every
 * page returned is fully meaningful — no client-side post-filtering
 * required and no wasted network bytes on rows that would be hidden.
 *
 * @param userId    - auth uid
 * @param page      - 0-indexed page number
 * @param pageSize  - rows per page (default 10)
 * @param role      - optional server-side role filter ("medico" | "paciente")
 * @param area      - optional server-side area filter (grande_area exact value)
 */
export async function fetchSessionsPage(
  userId: string,
  page: number,
  pageSize = 10,
  role?: "medico" | "paciente",
  area?: string,
): Promise<SessionsPage> {
  const from = page * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("sessions")
    .select("*", { count: "exact" })
    .eq("user_id", userId)
    .order("ended_at", { ascending: false })
    .range(from, to);

  if (role) query = query.eq("papel", role);
  if (area) query = query.eq("area", area);

  const { data, error, count } = await query;

  if (error) {
    console.warn("[sessionService] fetchSessionsPage error:", error.message);
    throw new Error(error.message);
  }

  const total = count ?? 0;
  const rows = ((data ?? []) as SessionRow[]).map(rowToSavedSession);

  return {
    data: rows,
    hasMore: from + rows.length < total,
    totalCount: total,
  };
}

export async function saveSession(
  s: SavedSession,
  userId: string,
): Promise<boolean> {
  // Determina a área a partir do campo grande_area do checklist (fonte autoritativa).
  // Fallback: inferência por palavras-chave no título (para sessões antigas sem checklistId).
  let area: string | null = null;
  if (s.checklistId) {
    const { data } = await supabase
      .from("checklists")
      .select("grande_area")
      .eq("id", s.checklistId)
      .maybeSingle();
    area = (data as { grande_area: string } | null)?.grande_area ?? null;
  }
  if (!area) area = inferArea(s.checklistTitle);

  const row: SessionRow = {
    id: s.id,
    user_id: userId,
    parceiro_nome: s.partnerName,
    checklist_nome: s.checklistTitle,
    area,
    papel: s.role,
    nota: nota10(s),
    ended_at: s.endedAt,
  };

  const { error } = await supabase.from("sessions").upsert(row, {
    onConflict: "id",
    ignoreDuplicates: false,
  });

  if (error) {
    console.warn("[sessionService] saveSession error:", error.message);
    return false;
  }
  return true;
}
