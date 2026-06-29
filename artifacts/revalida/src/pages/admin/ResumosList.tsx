import { useEffect, useMemo, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  ChevronLeft,
  BookOpen,
  Library,
  Loader2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { type Resumo } from "@/lib/resumosStorage";
import { listAllResumos, deleteResumoById } from "@/lib/resumosService";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const AREA_COLORS: Record<string, string> = {
  "Clínica médica": "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-300/40",
  Cirurgia: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-300/40",
  Pediatria: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-300/40",
  GO: "bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300 border-fuchsia-300/40",
  MFC: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-300/40",
};

export default function ResumosList() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [resumos, setResumos] = useState<Resumo[]>([]);
  const [search, setSearch] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadResumos = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await listAllResumos();
      setResumos(data);
    } catch (e) {
      console.warn("[ResumosList] load error:", e);
      toast.error("Não foi possível carregar os resumos.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadResumos();
  }, [loadResumos]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return resumos;
    return resumos.filter(
      (r) =>
        r.titulo.toLowerCase().includes(q) ||
        r.area.toLowerCase().includes(q) ||
        r.subarea.toLowerCase().includes(q),
    );
  }, [resumos, search]);

  const handleDelete = async (id: string) => {
    if (!user?.id) return;
    setIsDeleting(true);
    try {
      await deleteResumoById(id, user.id);
      setResumos((prev) => prev.filter((r) => r.id !== id));
      setConfirmDelete(null);
      toast.success("Resumo excluído");
    } catch (e) {
      console.warn("[ResumosList] delete error:", e);
      toast.error("Erro ao excluir. Você só pode excluir resumos criados por você.");
    } finally {
      setIsDeleting(false);
    }
  };

  const summary = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of resumos) {
      map[r.area] = (map[r.area] ?? 0) + 1;
    }
    return map;
  }, [resumos]);

  return (
    <div className="flex flex-col gap-5">
      <button
        onClick={() => setLocation("/admin")}
        className="self-start inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronLeft className="w-4 h-4" /> Voltar ao painel
      </button>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start justify-between gap-3 px-1"
      >
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Resumos</h1>
          <p className="text-muted-foreground mt-1 font-medium">
            Conteúdos teóricos disponíveis para os médicos
          </p>
        </div>
        <Button
          onClick={() => setLocation("/admin/resumos/novo")}
          className="rounded-xl gradient-primary text-white border-0 glow-primary shrink-0"
        >
          <Plus className="w-4 h-4 mr-1.5" /> Novo resumo
        </Button>
      </motion.div>

      {Object.keys(summary).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(summary).map(([area, count]) => (
            <span
              key={area}
              className={`px-3 py-1 rounded-full text-xs font-bold border ${
                AREA_COLORS[area] ?? "bg-muted text-muted-foreground border-border/60"
              }`}
            >
              {area} · {count}
            </span>
          ))}
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por título, área ou subárea"
          className="pl-9 h-11 rounded-xl"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : (
        <Card className="rounded-2xl border-border/60 overflow-hidden divide-y divide-border/60">
          {filtered.length === 0 && (
            <div className="p-12 flex flex-col items-center text-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Library className="w-7 h-7 text-primary" />
              </div>
              <h3 className="font-bold text-lg">
                {resumos.length === 0 ? "Nenhum resumo cadastrado" : "Nada encontrado"}
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                {resumos.length === 0
                  ? "Crie o primeiro resumo para que os médicos possam estudar."
                  : "Tente outra palavra-chave na busca."}
              </p>
              {resumos.length === 0 && (
                <Button
                  onClick={() => setLocation("/admin/resumos/novo")}
                  className="rounded-xl gradient-primary text-white border-0 mt-2"
                >
                  <Plus className="w-4 h-4 mr-1.5" /> Criar primeiro resumo
                </Button>
              )}
            </div>
          )}
          {filtered.map((r, i) => (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25, delay: i * 0.03 }}
              className="flex items-center gap-3 p-4 sm:p-5 hover:bg-muted/40 transition-colors"
            >
              <div className="shrink-0 w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <BookOpen className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm sm:text-base leading-tight truncate">
                  {r.titulo || "Sem título"}
                </div>
                <div className="flex items-center flex-wrap gap-2 mt-1.5">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                      AREA_COLORS[r.area] ??
                      "bg-muted text-muted-foreground border-border/60"
                    }`}
                  >
                    {r.area}
                  </span>
                  {r.subarea && (
                    <span className="text-xs text-muted-foreground">{r.subarea}</span>
                  )}
                  <span className="text-xs text-muted-foreground opacity-70">
                    · {r.blocks.length} bloco{r.blocks.length === 1 ? "" : "s"}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setLocation(`/admin/resumos/editar/${r.id}`)}
                className="shrink-0 p-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                aria-label="Editar"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                onClick={() => setConfirmDelete(r.id)}
                className="shrink-0 p-2 rounded-lg text-muted-foreground hover:bg-rose-500/10 hover:text-rose-600 transition-colors"
                aria-label="Excluir"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </motion.div>
          ))}
        </Card>
      )}

      <AlertDialog
        open={!!confirmDelete}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir este resumo?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Todos os blocos do resumo serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDelete && handleDelete(confirmDelete)}
              disabled={isDeleting}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              {isDeleting && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
