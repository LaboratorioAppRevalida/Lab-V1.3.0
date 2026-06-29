import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  ChevronLeft,
  Newspaper,
  Calendar,
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
import {
  listNoticias,
  deleteNoticia,
  type Noticia,
} from "@/lib/noticiasStorage";
import { toast } from "sonner";

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

export default function NoticiasList() {
  const [, setLocation] = useLocation();
  const [noticias, setNoticias] = useState<Noticia[]>([]);
  const [search, setSearch] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    listNoticias().then(setNoticias);
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return noticias;
    return noticias.filter(
      (n) =>
        n.titulo.toLowerCase().includes(q) ||
        n.resumo.toLowerCase().includes(q),
    );
  }, [noticias, search]);

  const handleDelete = async (id: string) => {
    try {
      await deleteNoticia(id);
      setNoticias(await listNoticias());
      setConfirmDelete(null);
      toast.success("Notícia excluída");
    } catch {
      toast.error("Erro ao excluir notícia. Tente novamente.");
    }
  };

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
          <h1 className="text-3xl font-bold tracking-tight">Notícias</h1>
          <p className="text-muted-foreground mt-1 font-medium">
            Comunique novidades, editais e dicas para a comunidade
          </p>
        </div>
        <Button
          onClick={() => setLocation("/admin/noticias/novo")}
          className="rounded-xl gradient-primary text-white border-0 glow-primary shrink-0"
        >
          <Plus className="w-4 h-4 mr-1.5" /> Nova notícia
        </Button>
      </motion.div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por título ou resumo"
          className="pl-9 h-11 rounded-xl"
        />
      </div>

      <Card className="rounded-2xl border-border/60 overflow-hidden divide-y divide-border/60">
        {filtered.length === 0 && (
          <div className="p-12 flex flex-col items-center text-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Newspaper className="w-7 h-7 text-primary" />
            </div>
            <h3 className="font-bold text-lg">
              {noticias.length === 0 ? "Nenhuma notícia publicada" : "Nada encontrado"}
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              {noticias.length === 0
                ? "Crie a primeira notícia para que apareça no feed dos médicos."
                : "Tente outra palavra-chave na busca."}
            </p>
            {noticias.length === 0 && (
              <Button
                onClick={() => setLocation("/admin/noticias/novo")}
                className="rounded-xl gradient-primary text-white border-0 mt-2"
              >
                <Plus className="w-4 h-4 mr-1.5" /> Criar primeira notícia
              </Button>
            )}
          </div>
        )}
        {filtered.map((n, i) => (
          <motion.div
            key={n.id}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.25, delay: i * 0.03 }}
            className="flex items-center gap-3 p-4 sm:p-5 hover:bg-muted/40 transition-colors"
          >
            <div className="shrink-0 w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Newspaper className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm sm:text-base leading-tight truncate">
                {n.titulo || "Sem título"}
              </div>
              <div className="flex items-center gap-2 mt-1.5 text-[11px] text-muted-foreground font-bold">
                <Calendar className="w-3 h-3" />
                {formatDateBR(n.publishedAt)}
                <span className="opacity-70">
                  · {n.blocks.length} bloco{n.blocks.length === 1 ? "" : "s"}
                </span>
              </div>
            </div>
            <button
              onClick={() => setLocation(`/admin/noticias/editar/${n.id}`)}
              className="shrink-0 p-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              aria-label="Editar"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              onClick={() => setConfirmDelete(n.id)}
              className="shrink-0 p-2 rounded-lg text-muted-foreground hover:bg-rose-500/10 hover:text-rose-600 transition-colors"
              aria-label="Excluir"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </motion.div>
        ))}
      </Card>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir esta notícia?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A notícia sairá do feed dos médicos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDelete && handleDelete(confirmDelete)}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
