// Tipos e helpers puros do módulo de Resumos.
// O armazenamento foi migrado para Supabase; use src/lib/resumosService.ts para CRUD.

export type ResumoBlockType = "titulo" | "texto" | "imagem";

export type ResumoBlock = {
  id: string;
  type: ResumoBlockType;
  content: string;
  alt?: string;
};

export type Resumo = {
  id: string;
  titulo: string;
  area: string;
  subarea: string;
  blocks: ResumoBlock[];
  video_url?: string;
  createdAt: string;
  updatedAt: string;
};

export const RESUMO_AREAS = [
  "Clínica médica",
  "Cirurgia",
  "Pediatria",
  "GO",
  "MFC",
] as const;

function generateId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).substring(2, 9);
}

export function newResumo(): Resumo {
  return {
    id: generateId(),
    titulo: "",
    area: "Clínica médica",
    subarea: "",
    blocks: [],
    video_url: "",
    createdAt: "",
    updatedAt: "",
  };
}

export function newBlock(type: ResumoBlockType): ResumoBlock {
  return { id: generateId(), type, content: "" };
}

/** Extrai embed URL de YouTube ou Vimeo a partir de qualquer formato de link. */
export function parseVideoUrl(raw: string): string | null {
  if (!raw || typeof raw !== "string") return null;

  try {
    let normalized = raw.trim();
    if (!normalized) return null;
    if (!normalized.startsWith("http")) normalized = `https://${normalized}`;

    const url = new URL(normalized);
    const host = url.hostname.replace("www.", "");

    // YouTube short link (youtu.be)
    if (host === "youtu.be") {
      const id = url.pathname.replace("/", "").split("?")[0].trim();
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }

    // YouTube normal / mobile / music
    if (
      host === "youtube.com" ||
      host === "m.youtube.com" ||
      host === "music.youtube.com"
    ) {
      if (url.pathname.startsWith("/embed/")) return normalized;
      const id = url.searchParams.get("v");
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }

    // Vimeo
    if (host.endsWith("vimeo.com")) {
      const id = url.pathname.split("/").filter(Boolean)[0];
      return id ? `https://player.vimeo.com/video/${id}` : null;
    }

    return null;
  } catch {
    return null;
  }
}
