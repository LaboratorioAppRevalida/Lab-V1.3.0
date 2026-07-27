import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen,
  Search,
  ChevronLeft,
  X,
  Library,
  Loader2,
  Video as VideoIcon,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { type Resumo, parseVideoUrl } from "@/lib/resumosStorage";
import { resolveImage } from "@/lib/storageService";
import { listAllResumos } from "@/lib/resumosService";
import { cn } from "@/lib/utils";

const AREAS = ["Todas", "Clínica médica", "Cirurgia", "Pediatria", "GO", "MFC"];

const AREA_TONES: Record<string, string> = {
  "Clínica médica": "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/50",
  Cirurgia: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/50",
  Pediatria: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/50",
  GO: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200 dark:bg-fuchsia-950/40 dark:text-fuchsia-300 dark:border-fuchsia-800/50",
  MFC: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/50",
};

export default function Resumos() {
  const [resumos, setResumos] = useState<Resumo[]>([]);
  const [search, setSearch] = useState("");
  const [areaFilter, setAreaFilter] = useState<string>("Todas");
  const [opened, setOpened] = useState<Resumo | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    listAllResumos()
      .then(setResumos)
      .catch((e) => console.warn("[Resumos] load error:", e))
      .finally(() => setIsLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return resumos.filter((r) => {
      if (areaFilter !== "Todas" && r.area !== areaFilter) return false;
      if (!q) return true;
      return (
        r.titulo.toLowerCase().includes(q) ||
        r.subarea.toLowerCase().includes(q) ||
        r.area.toLowerCase().includes(q)
      );
    });
  }, [resumos, search, areaFilter]);

  return (
    <div className="flex flex-col gap-5 text-slate-800 dark:text-slate-100">
      {/* Cabeçalho */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="px-1 pt-2"
      >
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider font-bold text-slate-400 dark:text-slate-400">
          <BookOpen className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" /> Resumos
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight mt-1 text-slate-900 dark:text-white">
          Conteúdo essencial
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium">
          Material teórico organizado por área para fortalecer seu estudo
        </p>
      </motion.div>

      {/* Input de Busca */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500 pointer-events-none" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por título, área ou subárea"
          className="pl-10 h-12 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-[0_4px_12px_rgba(0,0,0,0.02)] focus-visible:ring-cyan-500/20 focus-visible:border-cyan-500 transition-all"
        />
      </div>

      {/* Filtro por Especialidade */}
      <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1 scrollbar-none">
        {AREAS.map((a) => {
          const active = areaFilter === a;
          return (
            <button
              key={a}
              onClick={() => setAreaFilter(a)}
              className={cn(
                "shrink-0 px-4 py-2 rounded-full text-xs font-bold transition-all border",
                active
                  ? "bg-slate-900 text-white border-slate-900 dark:bg-cyan-500 dark:border-cyan-500 dark:text-slate-950 shadow-md"
                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:text-slate-900 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800 dark:hover:border-slate-700 dark:hover:text-white shadow-[0_2px_8px_rgba(0,0,0,0.02)]"
              )}
            >
              {a}
            </button>
          );
        })}
      </div>

      {/* Lista de Resumos */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-cyan-600 dark:text-cyan-400" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filtered.length === 0 && (
            <Card className="col-span-full p-10 flex flex-col items-center text-center border-2 border-dashed border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/50 rounded-3xl shadow-[0_10px_30px_rgba(0,0,0,0.03)]">
              <div className="w-14 h-14 rounded-2xl bg-cyan-50 dark:bg-cyan-950/50 border border-cyan-100 dark:border-cyan-800 flex items-center justify-center mb-3 text-cyan-600 dark:text-cyan-400">
                <Library className="w-7 h-7" />
              </div>
              <h3 className="font-bold text-lg text-slate-900 dark:text-white">
                {resumos.length === 0 ? "Nenhum resumo disponível" : "Nada encontrado"}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mt-1">
                {resumos.length === 0
                  ? "Os administradores ainda não publicaram resumos. Volte em breve."
                  : "Tente outra palavra-chave ou outro filtro de área."}
              </p>
            </Card>
          )}

          {filtered.map((r, i) => (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: i * 0.03 }}
              whileHover={{ y: -2 }}
            >
              <Card
                onClick={() => setOpened(r)}
                className="p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-gradient-to-r from-cyan-100/60 via-sky-100/40 to-purple-100/60 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900 hover:border-slate-300 dark:hover:border-slate-700 shadow-[0_10px_30px_rgba(0,0,0,0.04)] hover:shadow-[0_15px_35px_rgba(0,0,0,0.07)] transition-all cursor-pointer flex flex-col justify-between gap-4 h-full"
              >
                <div className="flex items-start gap-3.5">
                  <div className="shrink-0 w-11 h-11 rounded-2xl bg-white/80 dark:bg-slate-800 border border-cyan-200/60 dark:border-slate-700 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shadow-sm">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-base leading-tight text-slate-900 dark:text-white line-clamp-2">
                      {r.titulo || "Sem título"}
                    </h3>
                    <div className="flex items-center flex-wrap gap-2 mt-2">
                      <span
                        className={cn(
                          "px-2.5 py-0.5 rounded-full text-[10px] font-bold border",
                          AREA_TONES[r.area] ?? "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                        )}
                      >
                        {r.area}
                      </span>
                      {r.subarea && (
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{r.subarea}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 font-medium border-t border-slate-200/60 dark:border-slate-800 pt-3">
                  {r.blocks.length} bloco{r.blocks.length === 1 ? "" : "s"} de conteúdo
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Modal de Leitura / Detalhes */}
      <AnimatePresence>
        {opened && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={() => setOpened(null)}
          >
            <motion.div
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 30, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full sm:max-w-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-[0_25px_60px_rgba(0,0,0,0.25)] flex flex-col max-h-[90vh] overflow-hidden"
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
                  <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500">
                    {opened.area}
                    {opened.subarea && ` · ${opened.subarea}`}
                  </div>
                  <h2 className="font-bold text-base text-slate-900 dark:text-white truncate">{opened.titulo}</h2>
                </div>
              </header>

              <div className="overflow-y-auto p-6 sm:p-8 flex flex-col gap-6 text-slate-800 dark:text-slate-200">
                {/* VÍDEO incorporado */}
                {(() => {
                  const embed = parseVideoUrl(opened.video_url ?? "");
                  if (!embed) return null;
                  return (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        <VideoIcon className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" /> Vídeo da Aula
                      </div>
                      <div className="rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-800 bg-black aspect-video shadow-md">
                        <iframe
                          src={embed}
                          className="w-full h-full"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          title={opened.titulo}
                        />
                      </div>
                    </div>
                  );
                })()}

                {opened.blocks.length === 0 && !parseVideoUrl(opened.video_url ?? "") && (
                  <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-10">
                    Este resumo ainda não tem conteúdo.
                  </p>
                )}

                {/* Blocos de Conteúdo */}
                {opened.blocks.map((b) => {
                  if (b.type === "titulo") {
                    return (
                      <h3
                        key={b.id}
                        className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-2 mt-2"
                      >
                        {b.content}
                      </h3>
                    );
                  }
                  if (b.type === "texto") {
                    return (
                      <p
                        key={b.id}
                        className="text-sm sm:text-base leading-relaxed whitespace-pre-line text-slate-700 dark:text-slate-300"
                      >
                        {b.content}
                      </p>
                    );
                  }
                  if (b.type === "imagem") {
                    return (
                      <figure
                        key={b.id}
                        className="rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 shadow-inner"
                      >
                        <img
                          src={resolveImage(b.content, "resumos-media")}
                          alt={b.alt ?? ""}
                          className="w-full max-h-[420px] object-contain bg-slate-100/50 dark:bg-slate-900/50"
                          onError={(e) => {
                            const img = e.target as HTMLImageElement;
                            img.style.display = "none";
                            const fb = img.nextElementSibling as HTMLElement | null;
                            if (fb) fb.style.display = "flex";
                          }}
                        />
                        <div
                          className="flex-col items-center justify-center gap-2 p-8 text-sm text-slate-400 dark:text-slate-500 text-center"
                          style={{ display: "none" }}
                        >
                          <span className="text-2xl">🖼️</span>
                          <p>Imagem não disponível</p>
                          {b.content && (
                            <a
                              href={resolveImage(b.content, "resumos-media") || b.content}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs underline underline-offset-2 text-cyan-600 dark:text-cyan-400 hover:text-cyan-700"
                            >
                              Abrir link direto
                            </a>
                          )}
                        </div>
                        {b.alt && (
                          <figcaption className="text-xs text-center text-slate-500 dark:text-slate-400 p-2.5 italic bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
                            {b.alt}
                          </figcaption>
                        )}
                      </figure>
                    );
                  }
                  return null;
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}