import { supabase } from "./supabase";

export type NoticiaBlockType = "texto" | "imagem" | "video" | "link";

export type NoticiaBlock = {
  id: string;
  type: NoticiaBlockType;
  titulo?: string;
  content: string;
  legenda?: string;
  descricao?: string;
};

export type Noticia = {
  id: string;
  titulo: string;
  resumo: string;
  blocks: NoticiaBlock[];
  publishedAt: string;
  createdAt: string;
  updatedAt: string;
};

type NoticiaRow = {
  id: string;
  titulo: string;
  resumo: string;
  blocks: NoticiaBlock[];
  published_at: string;
  created_at: string;
  updated_at: string;
};

function rowToNoticia(r: NoticiaRow): Noticia {
  return {
    id: r.id,
    titulo: r.titulo,
    resumo: r.resumo,
    blocks: Array.isArray(r.blocks) ? r.blocks : [],
    publishedAt: r.published_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function listNoticias(): Promise<Noticia[]> {
  const { data, error } = await supabase
    .from("noticias")
    .select("*")
    .order("published_at", { ascending: false });
  if (error) {
    console.error("[noticiasStorage] listNoticias:", error.message);
    return [];
  }
  return (data as NoticiaRow[]).map(rowToNoticia);
}

export async function getNoticia(id: string): Promise<Noticia | undefined> {
  const { data, error } = await supabase
    .from("noticias")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !data) return undefined;
  return rowToNoticia(data as NoticiaRow);
}

export async function saveNoticia(n: Noticia): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase.from("noticias").upsert(
    {
      id: n.id,
      titulo: n.titulo,
      resumo: n.resumo,
      blocks: n.blocks,
      published_at: n.publishedAt || now,
      updated_at: now,
      created_at: n.createdAt || now,
    },
    { onConflict: "id" },
  );
  if (error) {
    console.error("[noticiasStorage] saveNoticia:", error.message);
    throw error;
  }
}

export async function deleteNoticia(id: string): Promise<void> {
  const { error } = await supabase.from("noticias").delete().eq("id", id);
  if (error) {
    console.error("[noticiasStorage] deleteNoticia:", error.message);
    throw error;
  }
}

function genId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2, 10);
}

export function newNoticia(): Noticia {
  return {
    id: genId(),
    titulo: "",
    resumo: "",
    blocks: [],
    publishedAt: new Date().toISOString(),
    createdAt: "",
    updatedAt: "",
  };
}

export function newNoticiaBlock(type: NoticiaBlockType): NoticiaBlock {
  const base = { id: genId(), type, content: "" };
  if (type === "texto") return { ...base, titulo: "" };
  if (type === "imagem") return { ...base, legenda: "" };
  if (type === "link") return { ...base, titulo: "", descricao: "" };
  return base;
}

export async function seedNoticiasIfEmpty(): Promise<void> {
  // no-op: Supabase é a fonte única da verdade.
  // Notícias são criadas pelo admin no painel.
}
