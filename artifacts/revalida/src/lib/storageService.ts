import { supabase } from "./supabase";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type StorageBucket = "avatars" | "resumos-media" | "news-media";

export type UploadResult =
  | { storagePath: string; publicUrl: string; error: null }
  | { storagePath: null; publicUrl: null; error: string };

type UploadInput = {
  file: File;
  bucket: StorageBucket;
  userId: string;
  /**
   * Com slug: path = `{bucket}/{userId}/{slug}.{ext}`, upsert: true (avatares)
   * Sem slug: path = `{bucket}/{userId}/{ts}-{rand}.{ext}`, upsert: false (mídias)
   */
  slug?: string;
};

// ─── Constantes ───────────────────────────────────────────────────────────────

const MAX_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"];

const MAX_VIDEO_SIZE_BYTES = 200 * 1024 * 1024;
const ALLOWED_VIDEO_MIME_TYPES = ["video/mp4", "video/webm"];

// ─── Upload de imagem ─────────────────────────────────────────────────────────

/**
 * Sistema único de upload. Salva o arquivo em `{bucket}/{userId}/{filename}`.
 *
 * Retorna:
 *   storagePath — formato "bucket/userId/filename.ext" para salvar no banco
 *   publicUrl   — URL pública pronta para exibição imediata pós-upload
 */
export async function uploadFile({
  file,
  bucket,
  userId,
  slug,
}: UploadInput): Promise<UploadResult> {
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return { storagePath: null, publicUrl: null, error: "Tipo não permitido. Use JPEG, PNG, WebP ou GIF." };
  }
  if (file.size > MAX_SIZE_BYTES) {
    return { storagePath: null, publicUrl: null, error: "Imagem muito grande. Máximo: 5 MB." };
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const filename = slug
    ? `${slug}.${ext}`
    : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const filePath = `${userId}/${filename}`;
  const storagePath = `${bucket}/${filePath}`;
  const upsert = !!slug;

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(filePath, file, { cacheControl: "3600", upsert, contentType: file.type });

  if (uploadError) {
    return { storagePath: null, publicUrl: null, error: uploadError.message };
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
  return { storagePath, publicUrl: data.publicUrl, error: null };
}

// ─── Upload de vídeo ──────────────────────────────────────────────────────────

/**
 * Upload dedicado para arquivos de vídeo (.mp4, .webm).
 * Limite: 200 MB. Usa o mesmo padrão de path do uploadFile.
 */
export async function uploadVideoFile({
  file,
  bucket,
  userId,
  slug,
}: UploadInput): Promise<UploadResult> {
  if (!ALLOWED_VIDEO_MIME_TYPES.includes(file.type)) {
    return { storagePath: null, publicUrl: null, error: "Tipo não permitido. Use MP4 ou WebM." };
  }
  if (file.size > MAX_VIDEO_SIZE_BYTES) {
    return { storagePath: null, publicUrl: null, error: "Vídeo muito grande. Máximo: 200 MB." };
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "mp4";
  const filename = slug
    ? `${slug}.${ext}`
    : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const filePath = `${userId}/${filename}`;
  const storagePath = `${bucket}/${filePath}`;

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(filePath, file, { cacheControl: "3600", upsert: false, contentType: file.type });

  if (uploadError) {
    return { storagePath: null, publicUrl: null, error: uploadError.message };
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
  return { storagePath, publicUrl: data.publicUrl, error: null };
}

// ─── Render ───────────────────────────────────────────────────────────────────

/**
 * Converte qualquer referência de imagem armazenada no banco em URL pública válida.
 *
 * Suporta três formatos automaticamente:
 *   1. Novo formato:  "bucket/userId/filename.ext"        → split no primeiro "/" e gera URL
 *   2. URL completa:  "https://xxx.supabase.co/..."       → reextrai bucket+path e regera URL
 *                     (corrige URLs de projeto antigo após migração de LAB)
 *   3. Filename puro: "1779416642328-ixqm3i.jpg"          → usa fallbackBucket
 *
 * Nunca retorna null/undefined — retorna "" se não houver path.
 */
export function resolveImage(
  path: string | null | undefined,
  fallbackBucket?: StorageBucket,
): string {
  if (!path) return "";

  // Caso 2: URL completa (legado — projeto antigo ou URL hardcoded)
  if (path.startsWith("http://") || path.startsWith("https://")) {
    const match = path.match(/\/object\/public\/([^/?#]+)\/(.+?)(\?[^#]*)?$/);
    if (match) {
      const bucket = match[1] as StorageBucket;
      const filePath = decodeURIComponent(match[2]);
      const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
      return data.publicUrl;
    }
    return path; // URL não-Supabase — retorna como está
  }

  // Caso 3: filename puro sem nenhuma barra (legado sem bucket prefixado)
  if (!path.includes("/")) {
    if (!fallbackBucket) return "";
    const { data } = supabase.storage.from(fallbackBucket).getPublicUrl(path);
    return data.publicUrl;
  }

  // Caso 1: formato padrão "bucket/resto/do/path"
  const slashIdx = path.indexOf("/");
  const bucket = path.substring(0, slashIdx) as StorageBucket;
  const filePath = path.substring(slashIdx + 1);
  const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
  return data.publicUrl;
}
