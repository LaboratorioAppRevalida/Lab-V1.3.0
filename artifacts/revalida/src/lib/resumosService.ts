import { supabase } from "@/lib/supabase";
import type { Resumo, ResumoBlock } from "@/lib/resumosStorage";

type DbResumo = {
  id: string;
  user_id: string;
  titulo: string;
  area: string;
  subarea: string;
  blocks: ResumoBlock[];
  video_url?: string;
  created_at: string;
  updated_at: string;
};

function toResumo(row: DbResumo): Resumo {
  return {
    id: row.id,
    titulo: row.titulo,
    area: row.area,
    subarea: row.subarea,
    blocks: (row.blocks as ResumoBlock[]) ?? [],
    video_url: row.video_url ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toDbPayload(r: Resumo, userId: string) {
  return {
    user_id: userId,
    titulo: r.titulo.trim(),
    area: r.area,
    subarea: r.subarea,
    blocks: r.blocks,
    video_url: r.video_url ?? "",
  };
}

/** Lista todos os resumos — qualquer usuário autenticado pode ler. */
export async function listAllResumos(): Promise<Resumo[]> {
  const { data, error } = await supabase
    .from("resumos")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data as DbResumo[]).map(toResumo);
}

/** Busca um resumo por ID. */
export async function getResumoById(id: string): Promise<Resumo | null> {
  const { data, error } = await supabase
    .from("resumos")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(error.message);
  }
  return toResumo(data as DbResumo);
}

/** Cria um novo resumo. */
export async function createResumo(userId: string, r: Resumo): Promise<Resumo> {
  const { data, error } = await supabase
    .from("resumos")
    .insert(toDbPayload(r, userId))
    .select()
    .single();

  if (error) throw new Error(error.message);
  return toResumo(data as DbResumo);
}

/** Atualiza um resumo existente. */
export async function updateResumo(
  id: string,
  userId: string,
  r: Resumo,
): Promise<Resumo> {
  const { data, error } = await supabase
    .from("resumos")
    .update(toDbPayload(r, userId))
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return toResumo(data as DbResumo);
}

/** Exclui um resumo. Só o dono pode excluir. */
export async function deleteResumoById(id: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from("resumos")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
}
