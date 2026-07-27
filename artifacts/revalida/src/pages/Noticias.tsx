import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Newspaper,
  Calendar,
  ChevronLeft,
  X,
  ExternalLink,
  Image as ImageIcon,
  Video as VideoIcon,
  Link as LinkIcon,
  BookOpen,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  listNoticias,
  type Noticia,
  type NoticiaBlock,
} from "@/lib/noticiasStorage";
import { resolveImage } from "@/lib/storageService";

function formatDateBR(iso: string) {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function getVideoEmbedUrl(rawUrl?: string | null): string | null {
  if (!rawUrl || typeof rawUrl !== "string") return null;

  try {
    let normalized = rawUrl.trim();
    if (!normalized.startsWith("http")) normalized = `https://${normalized}`;

    const url = new URL(normalized);
    const host = url.hostname.replace("www.", "");

    // YouTube short link (youtu.be)
    if (host === "youtu.be") {
      const id = url.pathname.replace("/", "").split("?")[0].trim();
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }

    // YouTube normal/mobile/music
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

function getCoverImage(n: Noticia): string | null {
  const block = n.blocks.find((b) => b.type === "imagem" && b.content);
  return block?.content ?? null;
}

function getFirstVideoEmbed(n: Noticia): string | null {
  const block = n.blocks.find((b) => b.type === "video" && b.content);
  if (!block) return null;
  return getVideoEmbedUrl(block.content);
}

export default function Noticias() {
  const [noticias, setNoticias] = useState<Noticia[]>([]);
  const [opened, setOpened] = useState<Noticia | null>(null);

  useEffect(() => {
    listNoticias().then(setNoticias);
  }, []);

  return (
    <div className="flex flex-col gap-5">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="px-1 pt-2"
      >
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider font-bold text-muted-foreground">
          <Newspaper className="w-3.5 h-3.5" /> Notícias
        </div>
        <h1 className="text-3xl font-bold tracking-tight mt-1">Atualizações da plataforma</h1>
        <p className="text-muted-foreground mt-1 font-medium">
          Novidades, conteúdos e informações sobre o Revalida
        </p>
      </motion.div>

      {noticias.length === 0 && (
        <Card className="p-10 flex flex-col items-center justify-center text-center min-h-[280px] border-dashed border-2 bg-card/40 rounded-2xl">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
            <Newspaper className="w-7 h-7 text-primary" />
          </div>
          <h2 className="text-xl font-bold mb-1">Sem novidades no momento</h2>
          <p className="text-sm text-muted-foreground max-w-sm">
            Em breve traremos aqui informações sobre editais, cronogramas e dicas para a prova prática.
          </p>
        </Card>
      )}

      <div className="flex flex-col gap-4">
        {noticias.map((n, i) => {
          const cover = getCoverImage(n);
          const videoEmbed = getFirstVideoEmbed(n);
          return (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: i * 0.04 }}
              whileHover={{ y: -2 }}
            >
              <Card
                onClick={() => setOpened(n)}
                className="rounded-2xl border-border/60 bg-card/80 hover:shadow-md transition-all cursor-pointer overflow-hidden flex flex-col"
              >
                {/* Cover image */}
                {cover && (
                  <div className="h-44 sm:h-52 bg-muted/30 overflow-hidden">
                    <img
                      src={resolveImage(cover, "news-media")}
                      alt={n.titulo}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).closest<HTMLElement>(".h-44")!.style.display = "none";
                      }}
                    />
                  </div>
                )}

                <div className="p-5 flex flex-col gap-3">
                  {/* Author row */}
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <BookOpen className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold leading-none">Equipe Revalida</div>
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
                        <Calendar className="w-3 h-3" />
                        {formatDateBR(n.publishedAt)}
                      </div>
                    </div>
                  </div>

                  {/* Title + summary */}
                  <div>
                    <h3 className="font-bold text-lg leading-tight">{n.titulo}</h3>
                    {n.resumo && (
                      <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed mt-1">
                        {n.resumo}
                      </p>
                    )}
                  </div>

                  {/* Video embed — inline player, stopPropagation keeps modal closed while interacting */}
                  {videoEmbed && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="rounded-xl overflow-hidden border border-border/60 aspect-video bg-black"
                    >
                      <iframe
                        src={videoEmbed}
                        title="Vídeo"
                        allow="autoplay; encrypted-media; picture-in-picture"
                        allowFullScreen
                        className="w-full h-full"
                      />
                    </div>
                  )}

                  {/* Footer */}
                  <div className="flex items-center pt-0.5 text-xs text-muted-foreground/70">
                    <span>
                      {n.blocks.length} bloco{n.blocks.length === 1 ? "" : "s"}
                    </span>
                    <span className="ml-auto text-primary font-semibold">Ler mais →</span>
                  </div>
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>

      <AnimatePresence>
        {opened && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={() => setOpened(null)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full sm:max-w-3xl bg-card border border-border/60 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92vh]"
            >
              <header className="flex items-center justify-between gap-3 p-4 border-b border-border/60 sticky top-0 bg-card/95 backdrop-blur-md z-10">
                <button
                  onClick={() => setOpened(null)}
                  className="p-2 rounded-lg hover:bg-muted transition-colors"
                  aria-label="Fechar"
                >
                  <ChevronLeft className="w-5 h-5 sm:hidden" />
                  <X className="w-5 h-5 hidden sm:block" />
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                    <Calendar className="w-3 h-3" />
                    {formatDateBR(opened.publishedAt)}
                  </div>
                  <h2 className="font-bold text-base truncate">{opened.titulo}</h2>
                </div>
              </header>
              <div className="overflow-y-auto p-5 sm:p-7 flex flex-col gap-5">
                {/* Author in detail */}
                <div className="flex items-center gap-2.5 pb-1 border-b border-border/40">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <BookOpen className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">Equipe Revalida</div>
                    <div className="text-xs text-muted-foreground">
                      {formatDateBR(opened.publishedAt)}
                    </div>
                  </div>
                </div>
                {opened.resumo && (
                  <p className="text-base font-medium text-muted-foreground leading-relaxed border-l-4 border-primary/40 pl-4 italic">
                    {opened.resumo}
                  </p>
                )}
                {opened.blocks.map((b) => (
                  <NoticiaBlockView key={b.id} block={b} />
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function NoticiaBlockView({ block }: { block: NoticiaBlock }) {
  if (block.type === "texto") {
    return (
      <div className="space-y-2">
        {block.titulo && (
          <h3 className="text-lg font-extrabold tracking-tight">{block.titulo}</h3>
        )}
        <p className="text-sm leading-relaxed whitespace-pre-line text-foreground/90">
          {block.content}
        </p>
      </div>
    );
  }
  if (block.type === "imagem") {
    if (!block.content) {
      return (
        <div className="rounded-2xl border border-dashed border-border/60 bg-muted/30 p-8 text-center text-xs text-muted-foreground">
          <ImageIcon className="w-6 h-6 mx-auto mb-2 opacity-60" />
          Imagem não carregada
        </div>
      );
    }
    return (
      <figure className="rounded-2xl overflow-hidden border border-border/60 bg-muted/30">
        <img
          src={resolveImage(block.content, "news-media")}
          alt={block.legenda ?? ""}
          className="w-full max-h-[460px] object-contain bg-black/5"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
        {block.legenda && (
          <figcaption className="text-xs text-center text-muted-foreground p-2 italic">
            {block.legenda}
          </figcaption>
        )}
      </figure>
    );
  }
  if (block.type === "video") {
    const embed = getVideoEmbedUrl(block.content);
    if (!embed) {
      return (
        <div className="rounded-2xl border border-dashed border-border/60 bg-muted/30 p-8 text-center text-xs text-muted-foreground">
          <VideoIcon className="w-6 h-6 mx-auto mb-2 opacity-60" />
          URL de vídeo inválida
        </div>
      );
    }
    return (
      <div className="rounded-2xl overflow-hidden border border-border/60 aspect-video bg-black">
        <iframe
          src={embed}
          title="Vídeo"
          className="w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }
  if (block.type === "link") {
    return (
      <a
        href={block.content}
        target="_blank"
        rel="noopener noreferrer"
        className="block rounded-2xl border border-border/60 bg-gradient-to-br from-primary/5 to-transparent backdrop-blur-sm p-4 hover:border-primary/40 hover:shadow-md transition-all"
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <LinkIcon className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-sm">{block.titulo || "Link"}</div>
            {block.descricao && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                {block.descricao}
              </p>
            )}
            <div className="text-[11px] text-primary mt-1.5 truncate inline-flex items-center gap-1">
              {block.content}
              <ExternalLink className="w-3 h-3" />
            </div>
          </div>
        </div>
      </a>
    );
  }
  return null;
}

// Re-export useMemo to suppress lint warning in some bundlers
void useMemo;
