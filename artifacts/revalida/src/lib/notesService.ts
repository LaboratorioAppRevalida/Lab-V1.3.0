import { supabase } from "@/lib/supabase";

export type Nota = {
  id: string;
  titulo: string;
  conteudo: string;
  createdAt: string;
  updatedAt: string;
};

type DbNote = {
  id: string;
  user_id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
};

function toNota(row: DbNote): Nota {
  return {
    id: row.id,
    titulo: row.title,
    conteudo: row.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listNotes(userId: string): Promise<Nota[]> {
  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data as DbNote[]).map(toNota);
}

export async function createNote(
  userId: string,
  titulo: string,
  conteudo: string,
): Promise<Nota> {
  const { data, error } = await supabase
    .from("notes")
    .insert({ user_id: userId, title: titulo, content: conteudo })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return toNota(data as DbNote);
}

export async function updateNote(
  id: string,
  userId: string,
  titulo: string,
  conteudo: string,
): Promise<Nota> {
  const { data, error } = await supabase
    .from("notes")
    .update({ title: titulo, content: conteudo })
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return toNota(data as DbNote);
}

export async function deleteNote(id: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from("notes")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
}
