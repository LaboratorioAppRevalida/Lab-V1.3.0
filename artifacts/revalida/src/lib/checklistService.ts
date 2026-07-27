import { supabase } from "@/lib/supabase";
import type { Checklist, ChecklistSummary, ImpressoItem, PepBlock } from "@/lib/checklistStorage";

// ── Internal DB row types ────────────────────────────────────────────────────

/** Full row shape — used for admin CRUD and training detail fetch. */
type DbChecklist = {
  id: string;
  user_id: string;
  created_by: string | null;
  is_approved: boolean;
  title: string;
  grande_area: string;
  subarea: string;
  cenario_atuacao: string;
  descricao_caso: string;
  tarefas: string;
  impressos: ImpressoItem[];
  roteiro_paciente: string;
  pep_blocks: PepBlock[];
  created_at: string;
  updated_at: string;
};

/**
 * Catalog row shape — lightweight subset for listing/filtering.
 * Heavy fields (descricao_caso, tarefas, roteiro_paciente, impressos) are
 * intentionally excluded from the query. pep_blocks is fetched only to derive
 * the block count; the content is discarded in the mapper.
 */
type DbChecklistCatalogRow = {
  id: string;
  title: string;
  grande_area: string;
  subarea: string;
  cenario_atuacao: string;
  pep_blocks: unknown[] | null;
  created_at: string;
  updated_at: string;
};

// ── Mappers ──────────────────────────────────────────────────────────────────

function toChecklist(row: DbChecklist): Checklist {
  return {
    id: row.id,
    title: row.title,
    grandeArea: row.grande_area,
    subarea: row.subarea,
    cenarioAtuacao: row.cenario_atuacao,
    descricaoCaso: row.descricao_caso,
    tarefas: row.tarefas,
    impressos: (row.impressos as ImpressoItem[]) ?? [],
    roteiroPaciente: row.roteiro_paciente,
    pepBlocks: (row.pep_blocks as PepBlock[]) ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by ?? undefined,
    isApproved: row.is_approved,
  };
}

function toDbPayload(cl: Checklist, userId: string) {
  return {
    user_id: userId,
    title: cl.title.trim() || "Checklist sem título",
    grande_area: cl.grandeArea,
    subarea: cl.subarea,
    cenario_atuacao: cl.cenarioAtuacao,
    descricao_caso: cl.descricaoCaso,
    tarefas: cl.tarefas,
    impressos: cl.impressos,
    roteiro_paciente: cl.roteiroPaciente,
    pep_blocks: cl.pepBlocks,
  };
}

// ── Catalog (lightweight listing — students & matchmaking) ───────────────────

/**
 * Returns a lightweight summary list for the student station catalog UI.
 *
 * Security/performance split: only the columns needed for card rendering are
 * requested. Heavy exam-content fields are intentionally omitted.
 *
 * Content gate (Phase 6): only is_approved = true rows are returned so
 * collaborator-submitted stations pending admin review never appear in the
 * student catalog or the multiplayer matchmaking pool.
 */
export async function listChecklistCatalog(): Promise<ChecklistSummary[]> {
  const { data, error } = await supabase
    .from("checklists")
    .select("id, title, grande_area, subarea, cenario_atuacao, pep_blocks, created_at, updated_at")
    .eq("is_approved", true)
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data as DbChecklistCatalogRow[]).map((row) => ({
    id: row.id,
    title: row.title,
    grandeArea: row.grande_area,
    subarea: row.subarea,
    cenarioAtuacao: row.cenario_atuacao,
    pepBlockCount: Array.isArray(row.pep_blocks) ? row.pep_blocks.length : 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

// ── Detail fetch (deferred — only on station start) ──────────────────────────

/**
 * Fetches the complete station dataset for a single checklist.
 * Called once per session immediately before countdown begins.
 */
export async function fetchChecklistDetailsForTraining(
  id: string,
): Promise<Checklist | null> {
  const { data, error } = await supabase
    .from("checklists")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(error.message);
  }
  return toChecklist(data as DbChecklist);
}

// ── Admin CRUD (full data — bypasses is_approved filter) ─────────────────────

/** Lista todos os checklists com dados completos — uso exclusivo do painel admin. */
export async function listAllChecklists(): Promise<Checklist[]> {
  const { data, error } = await supabase
    .from("checklists")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data as DbChecklist[]).map(toChecklist);
}

/** Busca um checklist por ID. */
export async function getChecklistById(id: string): Promise<Checklist | null> {
  const { data, error } = await supabase
    .from("checklists")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(error.message);
  }
  return toChecklist(data as DbChecklist);
}

/** Cria um checklist novo (admin). Marca is_approved = true automaticamente. */
export async function createChecklist(
  userId: string,
  cl: Checklist,
): Promise<Checklist> {
  const { data, error } = await supabase
    .from("checklists")
    .insert({
      id: cl.id || undefined,
      ...toDbPayload(cl, userId),
      created_by: userId,
      is_approved: true,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return toChecklist(data as DbChecklist);
}

/** Atualiza um checklist existente. */
export async function updateChecklist(
  id: string,
  userId: string,
  cl: Checklist,
): Promise<Checklist> {
  const { data, error } = await supabase
    .from("checklists")
    .update(toDbPayload(cl, userId))
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return toChecklist(data as DbChecklist);
}

/** Exclui um checklist. Só o dono pode excluir (reforçado pela RLS). */
export async function deleteChecklistById(
  id: string,
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from("checklists")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
}

// ── Admin: approve / reject colaborador submissions ──────────────────────────

/** Aprova uma estação pendente (torna visível no catálogo e no matchmaking). */
export async function approveChecklist(id: string): Promise<void> {
  const { error } = await supabase
    .from("checklists")
    .update({ is_approved: true })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

/** Rejeita/despublica uma estação (remove do catálogo sem excluir o registro). */
export async function rejectChecklist(id: string): Promise<void> {
  const { error } = await supabase
    .from("checklists")
    .update({ is_approved: false })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

/**
 * Exclui qualquer estação — uso exclusivo do admin.
 * Não filtra por user_id; depende da RLS policy de admin (is_admin = true).
 */
export async function adminDeleteChecklist(id: string): Promise<void> {
  const { error } = await supabase
    .from("checklists")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
}

/**
 * Lista apenas estações pendentes de revisão (is_approved = false).
 * Uso exclusivo do painel admin.
 */
export async function listPendingChecklists(): Promise<Checklist[]> {
  const { data, error } = await supabase
    .from("checklists")
    .select("*")
    .eq("is_approved", false)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data as DbChecklist[]).map(toChecklist);
}

// ── Colaborador CRUD (row-isolated — only own stations) ──────────────────────

/**
 * Lista apenas as estações criadas pelo colaborador autenticado.
 * Row isolation: filters by created_by = userId before sending to Supabase.
 */
export async function listMyChecklists(userId: string): Promise<Checklist[]> {
  const { data, error } = await supabase
    .from("checklists")
    .select("*")
    .eq("created_by", userId)
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data as DbChecklist[]).map(toChecklist);
}

/**
 * Conta as estações enviadas pelo colaborador neste mês calendário.
 * Usado no widget de progresso "Estações Carregadas: X / 50".
 */
export async function countMyChecklistsThisMonth(userId: string): Promise<number> {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const { count, error } = await supabase
    .from("checklists")
    .select("id", { count: "exact", head: true })
    .eq("created_by", userId)
    .gte("created_at", firstDay);

  if (error) throw new Error(error.message);
  return count ?? 0;
}

/**
 * Conta o total de estações criadas pelo colaborador (todos os meses).
 */
export async function countMyChecklistsTotal(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from("checklists")
    .select("id", { count: "exact", head: true })
    .eq("created_by", userId);

  if (error) throw new Error(error.message);
  return count ?? 0;
}

/**
 * Cria uma estação como colaborador.
 * Diferenças em relação a createChecklist():
 *   · created_by = userId (authorship signature)
 *   · is_approved = false (content gate — aguarda revisão do admin)
 */
export async function createChecklistAsColaborador(
  userId: string,
  cl: Checklist,
): Promise<Checklist> {
  const { data, error } = await supabase
    .from("checklists")
    .insert({
      id: cl.id || undefined,
      ...toDbPayload(cl, userId),
      created_by: userId,
      is_approved: false,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return toChecklist(data as DbChecklist);
}

/**
 * Atualiza uma estação do colaborador — mutation guard: only own rows.
 * The RLS UPDATE policy enforces created_by = auth.uid() at DB level as well.
 */
export async function updateChecklistAsColaborador(
  id: string,
  userId: string,
  cl: Checklist,
): Promise<Checklist> {
  const { data, error } = await supabase
    .from("checklists")
    .update(toDbPayload(cl, userId))
    .eq("id", id)
    .eq("created_by", userId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return toChecklist(data as DbChecklist);
}
