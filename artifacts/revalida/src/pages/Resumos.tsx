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
  "Clínica médica": "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-300/40",
  Cirurgia: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-300/40",
  Pediatria: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-300/40",
  GO: "bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300 border-fuchsia-300/40",
  MFC: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-300/40",
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
    <div className="flex flex-col gap-5">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="px-1 pt-2"
      >
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider font-bold text-muted-foreground">
          <BookOpen className="w-3.5 h-3.5" /> Resumos
        </div>
        <h1 className="text-3xl font-bold tracking-tight mt-1">Conteúdo essencial</h1>
        <p className="text-muted-foreground mt-1 font-medium">
          Material teórico organizado por área para fortalecer seu estudo
        </p>
      </motion.div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por título, área ou subárea"
          className="pl-9 h-11 rounded-xl"
        />
      </div>

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
                  ? "bg-primary text-primary-foreground border-primary shadow-md"
                  : "bg-card text-muted-foreground border-border/60 hover:border-primary/40 hover:text-foreground",
              )}
            >
              {a}
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered.length === 0 && (
            <Card className="col-span-full p-10 flex flex-col items-center text-center border-dashed border-2 bg-card/40 rounded-2xl">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
                <Library className="w-7 h-7 text-primary" />
              </div>
              <h3 className="font-bold text-lg">
                {resumos.length === 0 ? "Nenhum resumo disponível" : "Nada encontrado"}
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm mt-1">
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
                className="p-5 rounded-2xl border-border/60 bg-card/80 hover:shadow-md transition-all cursor-pointer flex flex-col gap-3 h-full"
              >
                <div className="flex items-start gap-3">
                  <div className="shrink-0 w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-base leading-tight line-clamp-2">
                      {r.titulo || "Sem título"}
                    </h3>
                    <div className="flex items-center flex-wrap gap-2 mt-1.5">
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded-full text-[10px] font-bold border",
                          AREA_TONES[r.area] ??
                            "bg-muted text-muted-foreground border-border/60",
                        )}
                      >
                        {r.area}
                      </span>
                      {r.subarea && (
                        <span className="text-xs text-muted-foreground">{r.subarea}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground font-medium">
                  {r.blocks.length} bloco{r.blocks.length === 1 ? "" : "s"} de conteúdo
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

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
                  <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                    {opened.area}
                    {opened.subarea && ` · ${opened.subarea}`}
                  </div>
                  <h2 className="font-bold text-base truncate">{opened.titulo}</h2>
                </div>
              </header>
              <div className="overflow-y-auto p-5 sm:p-7 flex flex-col gap-5">
                {/* VÍDEO (campo top-level do Resumo) */}
                {(() => {
                  const embed = parseVideoUrl(opened.video_url ?? "");
                  if (!embed) return null;
                  return (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        <VideoIcon className="w-3.5 h-3.5" /> Vídeo
                      </div>
                      <div className="rounded-2xl overflow-hidden border border-border/60 bg-muted/30 aspect-video">
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
                  <p className="text-sm text-muted-foreground text-center py-10">
                    Este resumo ainda não tem conteúdo.
                  </p>
                )}
                {opened.blocks.map((b) => {
                  if (b.type === "titulo") {
                    return (
                      <h3
                        key={b.id}
                        className="text-xl font-extrabold tracking-tight border-b border-border/60 pb-2"
                      >
                        {b.content}
                      </h3>
                    );
                  }
                  if (b.type === "texto") {
                    return (
                      <p
                        key={b.id}
                        className="text-sm leading-relaxed whitespace-pre-line text-foreground/90"
                      >
                        {b.content}
                      </p>
                    );
                  }
                  if (b.type === "imagem") {
                    return (
                      <figure
                        key={b.id}
                        className="rounded-2xl overflow-hidden border border-border/60 bg-muted/30"
                      >
                        <img
                          src={resolveImage(b.content, "resumos-media")}
                          alt={b.alt ?? ""}
                          className="w-full max-h-[420px] object-contain bg-black/5"
                          onError={(e) => {
                            const img = e.target as HTMLImageElement;
                            img.style.display = "none";
                            const fb = img.nextElementSibling as HTMLElement | null;
                            if (fb) fb.style.display = "flex";
                          }}
                        />
                        <div
                          className="flex-col items-center justify-center gap-2 p-8 text-sm text-muted-foreground text-center"
                          style={{ display: "none" }}
                        >
                          <span className="text-2xl">🖼️</span>
                          <p>Imagem não disponível</p>
                          {b.content && (
                            <a
                              href={resolveImage(b.content, "resumos-media") || b.content}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs underline underline-offset-2 text-primary/70 hover:text-primary"
                            >
                              Abrir link direto
                            </a>
                          )}
                        </div>
                        {b.alt && (
                          <figcaption className="text-xs text-center text-muted-foreground p-2 italic">
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
