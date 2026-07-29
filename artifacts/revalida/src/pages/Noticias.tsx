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
  TrendingUp,
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
      month: "short",
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

    if (host === "youtu.be") {
      const id = url.pathname.replace("/", "").split("?")[0].trim();
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }

    if (
      host === "youtube.com" ||
      host === "m.youtube.com" ||
      host === "music.youtube.com"
    ) {
      if (url.pathname.startsWith("/embed/")) return normalized;
      const id = url.searchParams.get("v");
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }

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

export default function Noticias() {
  const [noticias, setNoticias] = useState<Noticia[]>([]);
  const [opened, setOpened] = useState<Noticia | null>(null);

  useEffect(() => {
    listNoticias().then(setNoticias);
  }, []);

  const featuredNotice = noticias.length > 0 ? noticias[0] : null;
  const remainingNotices = noticias.length > 1 ? noticias.slice(1) : [];

  return (
    <div className="flex flex-col gap-6 text-slate-800 dark:text-slate-100 max-w-7xl mx-auto pb-10">
      {/* Top Header */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="px-1 pt-2 flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200/60 dark:border-slate-800 pb-5"
      >
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider font-extrabold text-cyan-600 dark:text-cyan-400">
            <Newspaper className="w-4 h-4" /> Editorial Revalida
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mt-1 text-slate-900 dark:text-white">
            Notícias & Atualizações
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium text-sm sm:text-base">
            Acompanhe as últimas diretrizes médicas, editais e conteúdos essenciais.
          </p>
        </div>
      </motion.div>

      {noticias.length === 0 && (
        <Card className="p-12 flex flex-col items-center justify-center text-center min-h-[320px] border-2 border-dashed border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 rounded-3xl shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-cyan-50 dark:bg-cyan-950/50 text-cyan-600 dark:text-cyan-400 flex items-center justify-center mb-4 border border-cyan-100 dark:border-cyan-900/50">
            <Newspaper className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold mb-1 text-slate-800 dark:text-slate-100">Sem novidades no momento</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">
            Em breve traremos informações e atualizações estratégicas para a sua preparação.
          </p>
        </Card>
      )}

      {/* Hero Banner (Destaque Principal Corrigido) */}
      {featuredNotice && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div
            onClick={() => setOpened(featuredNotice)}
            className="relative group rounded-[2.5rem] overflow-hidden border border-slate-200/80 dark:border-slate-800 bg-slate-900 shadow-xl cursor-pointer min-h-[420px] sm:min-h-[480px] flex flex-col justify-end transition-all duration-300 hover:scale-[1.01] hover:shadow-2xl"
          >
            {getCoverImage(featuredNotice) ? (
              <div className="absolute inset-0">
                <img
                  src={resolveImage(getCoverImage(featuredNotice)!, "news-media")}
                  alt={featuredNotice.titulo}
                  className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700 opacity-75 dark:opacity-60"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent" />
              </div>
            ) : (
              <div className="absolute inset-0 bg-gradient-to-tr from-cyan-950 to-slate-900" />
            )}

            <div className="relative p-6 sm:p-10 flex flex-col gap-3 z-10 max-w-4xl">
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 rounded-full bg-cyan-500 text-slate-950 text-xs font-black uppercase tracking-wider shadow-sm">
                  Destaque Principal
                </span>
                <span className="flex items-center gap-1.5 text-xs text-slate-300 font-medium bg-black/40 backdrop-blur-md px-3 py-1 rounded-full border border-white/10">
                  <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                  {formatDateBR(featuredNotice.publishedAt)}
                </span>
              </div>

              <h2 className="text-2xl sm:text-4xl font-extrabold text-white leading-tight tracking-tight drop-shadow-sm">
                {featuredNotice.titulo}
              </h2>

              {featuredNotice.resumo && (
                <p className="text-slate-300 text-sm sm:text-base line-clamp-2 leading-relaxed font-normal max-w-3xl">
                  {featuredNotice.resumo}
                </p>
              )}

              <div className="flex items-center gap-2 pt-2 text-xs font-bold text-cyan-400 group-hover:translate-x-1 transition-transform">
                <span>Ler artigo completo</span>
                <span>→</span>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Grid Inferior (Demais Notícias + Lateral de Tendências) */}
      {remainingNotices.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pt-4">
          <div className="lg:col-span-2 flex flex-col gap-6">
            <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
              <TrendingUp className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
              <h3 className="text-lg font-bold text-slate-900 dark:text-white uppercase tracking-wider text-xs">
                Últimas Publicações
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {remainingNotices.map((n, i) => {
                const cover = getCoverImage(n);
                return (
                  <motion.div
                    key={n.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: i * 0.05 }}
                  >
                    <Card
                      onClick={() => setOpened(n)}
                      className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-cyan-500/50 shadow-sm hover:shadow-md transition-all cursor-pointer overflow-hidden flex flex-col h-full"
                    >
                      {cover ? (
                        <div className="h-40 bg-slate-100 dark:bg-slate-950 overflow-hidden border-b border-slate-100 dark:border-slate-800">
                          <img
                            src={resolveImage(cover, "news-media")}
                            alt={n.titulo}
                            className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                          />
                        </div>
                      ) : (
                        <div className="h-40 bg-cyan-950/20 dark:bg-cyan-950/40 flex items-center justify-center text-cyan-600 dark:text-cyan-400 border-b border-slate-100 dark:border-slate-800">
                          <Newspaper className="w-8 h-8 opacity-40" />
                        </div>
                      )}

                      <div className="p-5 flex flex-col flex-1 justify-between gap-3">
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-semibold">
                            <Calendar className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
                            {formatDateBR(n.publishedAt)}
                          </div>
                          <h4 className="font-bold text-base text-slate-900 dark:text-white leading-snug line-clamp-2">
                            {n.titulo}
                          </h4>
                          {n.resumo && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                              {n.resumo}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80 text-xs font-bold text-cyan-600 dark:text-cyan-400">
                          <span>Ler mais</span>
                          <span>→</span>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Coluna Lateral */}
          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
              <BookOpen className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
              <h3 className="text-lg font-bold text-slate-900 dark:text-white uppercase tracking-wider text-xs">
                Em Destaque Rápido
              </h3>
            </div>

            <Card className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm flex flex-col gap-4">
              {noticias.slice(0, 4).map((item, idx) => (
                <div
                  key={item.id}
                  onClick={() => setOpened(item)}
                  className="group cursor-pointer pb-4 border-b border-slate-100 dark:border-slate-800/80 last:border-0 last:pb-0"
                >
                  <div className="text-[10px] uppercase font-bold text-cyan-600 dark:text-cyan-400 tracking-wider mb-1">
                    #{idx + 1} • {formatDateBR(item.publishedAt)}
                  </div>
                  <h5 className="text-sm font-bold text-slate-800 dark:text-slate-200 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors line-clamp-2 leading-snug">
                    {item.titulo}
                  </h5>
                </div>
              ))}
            </Card>
          </div>
        </div>
      )}

      {/* Modal de Leitura Detalhada */}
      <AnimatePresence>
        {opened && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={() => setOpened(null)}
          >
            <motion.div
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 30, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full sm:max-w-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
            >
              <header className="flex items-center justify-between gap-3 px-6 py-4 border-b border-slate-100 dark:border-slate-800 sticky top-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md z-10">
                <button
                  onClick={() => setOpened(null)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  aria-label="Fechar"
                >
                  <ChevronLeft className="w-5 h-5 sm:hidden" />
                  <X className="w-5 h-5 hidden sm:block" />
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-slate-400">
                    <Calendar className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
                    {formatDateBR(opened.publishedAt)}
                  </div>
                  <h2 className="font-bold text-base text-slate-900 dark:text-white truncate">{opened.titulo}</h2>
                </div>
              </header>

              <div className="overflow-y-auto p-6 sm:p-8 flex flex-col gap-6 text-slate-800 dark:text-slate-200">
                <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="w-10 h-10 rounded-full bg-cyan-50 dark:bg-cyan-950/50 border border-cyan-100 dark:border-cyan-900/50 flex items-center justify-center shrink-0">
                    <BookOpen className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white">Equipe Revalida</div>
                    <div className="text-xs text-slate-400 dark:text-slate-500">
                      {formatDateBR(opened.publishedAt)}
                    </div>
                  </div>
                </div>

                {opened.resumo && (
                  <p className="text-base font-medium text-slate-600 dark:text-slate-300 leading-relaxed border-l-4 border-cyan-500 bg-cyan-50/40 dark:bg-cyan-950/20 p-4 rounded-r-2xl italic">
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
          <h3 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">{block.titulo}</h3>
        )}
        <p className="text-sm sm:text-base leading-relaxed whitespace-pre-line text-slate-700 dark:text-slate-300">
          {block.content}
        </p>
      </div>
    );
  }
  if (block.type === "imagem") {
    if (!block.content) return null;
    return (
      <figure className="rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 shadow-inner">
        <img
          src={resolveImage(block.content, "news-media")}
          alt={block.legenda ?? ""}
          className="w-full max-h-[460px] object-contain bg-slate-100/50 dark:bg-slate-900/50"
        />
        {block.legenda && (
          <figcaption className="text-xs text-center text-slate-500 dark:text-slate-400 p-2.5 italic bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
            {block.legenda}
          </figcaption>
        )}
      </figure>
    );
  }
  if (block.type === "video") {
    const embed = getVideoEmbedUrl(block.content);
    if (!embed) return null;
    return (
      <div className="rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-800 aspect-video bg-black shadow-md">
        <iframe src={embed} title="Vídeo" className="w-full h-full" allowFullScreen />
      </div>
    );
  }
  if (block.type === "link") {
    return (
      <a
        href={block.content}
        target="_blank"
        rel="noopener noreferrer"
        className="block rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 p-4 hover:border-cyan-200 dark:hover:border-cyan-800 hover:bg-cyan-50/20 dark:hover:bg-cyan-950/20 transition-all"
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-100 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-300 flex items-center justify-center shrink-0">
            <LinkIcon className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-sm text-slate-900 dark:text-white">{block.titulo || "Link"}</div>
            {block.descricao && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">{block.descricao}</p>
            )}
            <div className="text-[11px] text-cyan-600 dark:text-cyan-400 font-semibold mt-1.5 truncate inline-flex items-center gap-1">
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