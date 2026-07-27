import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  NotebookPen,
  Plus,
  Search,
  Trash2,
  Save,
  X,
  ChevronLeft,
  Calendar,
  Loader2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  listNotes,
  createNote,
  updateNote,
  deleteNote,
  type Nota,
} from "@/lib/notesService";

function formatDateBR(iso: string) {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

type EditingNote = {
  id: string | null;
  titulo: string;
  conteudo: string;
  createdAt: string;
  updatedAt: string;
};

function newDraft(): EditingNote {
  return { id: null, titulo: "", conteudo: "", createdAt: "", updatedAt: "" };
}

export default function Notas() {
  const { user } = useAuth();
  const [notas, setNotas] = useState<Nota[]>([]);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<EditingNote | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadNotas = useCallback(async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      const data = await listNotes(user.id);
      setNotas(data);
    } catch (e) {
      console.warn("[Notas] erro ao carregar:", e);
      toast.error("Não foi possível carregar as notas.");
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadNotas();
  }, [loadNotas]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return notas;
    return notas.filter(
      (n) =>
        n.titulo.toLowerCase().includes(q) ||
        n.conteudo.toLowerCase().includes(q),
    );
  }, [notas, search]);

  const handleNew = () => {
    setEditing(newDraft());
  };

  const handleEditExisting = (n: Nota) => {
    setEditing({
      id: n.id,
      titulo: n.titulo,
      conteudo: n.conteudo,
      createdAt: n.createdAt,
      updatedAt: n.updatedAt,
    });
  };

  const handleSave = async () => {
    if (!editing || !user?.id) return;
    const titulo = editing.titulo.trim() || "Nota sem título";
    const conteudo = editing.conteudo.trim();
    if (!conteudo) {
      toast.error("Adicione algum conteúdo antes de salvar.");
      return;
    }
    setIsSaving(true);
    try {
      if (editing.id) {
        const updated = await updateNote(editing.id, user.id, titulo, conteudo);
        setNotas((prev) =>
          prev.map((n) => (n.id === updated.id ? updated : n))
              .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
        );
      } else {
        const created = await createNote(user.id, titulo, conteudo);
        setNotas((prev) => [created, ...prev]);
      }
      setEditing(null);
      toast.success("Nota salva");
    } catch (e) {
      console.warn("[Notas] erro ao salvar:", e);
      toast.error("Erro ao salvar a nota. Tente novamente.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!user?.id) return;
    setIsDeleting(true);
    try {
      await deleteNote(id, user.id);
      setNotas((prev) => prev.filter((n) => n.id !== id));
      setConfirmDelete(null);
      toast.success("Nota excluída");
    } catch (e) {
      console.warn("[Notas] erro ao excluir:", e);
      toast.error("Erro ao excluir a nota. Tente novamente.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 text-slate-800">
      {/* Cabeçalho */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-3 px-1 pt-2"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
              Notas pessoais
            </h1>
            <p className="text-slate-500 mt-1 font-medium">
              Anotações rápidas para revisitar quando precisar
            </p>
          </div>
          <Button
            onClick={handleNew}
            className="bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl shadow-[0_4px_14px_rgba(0,0,0,0.12)] shrink-0 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus className="w-4 h-4 mr-1.5" /> Nova nota
          </Button>
        </div>
      </motion.div>

      {/* Input de Busca */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar nas notas"
          className="pl-10 h-12 rounded-2xl bg-white border border-slate-200 text-slate-800 placeholder:text-slate-400 shadow-[0_4px_12px_rgba(0,0,0,0.02)] focus-visible:ring-cyan-500/20 focus-visible:border-cyan-500 transition-all"
        />
      </div>

      {/* Lista de Notas */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-cyan-600" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filtered.length === 0 && (
            <Card className="col-span-full p-10 flex flex-col items-center justify-center text-center border-2 border-dashed border-slate-200 bg-white/80 rounded-3xl shadow-[0_10px_30px_rgba(0,0,0,0.03)]">
              <div className="w-14 h-14 rounded-2xl bg-cyan-50 border border-cyan-100 flex items-center justify-center mb-3 text-cyan-600">
                <NotebookPen className="w-7 h-7" />
              </div>
              <h3 className="font-bold text-lg text-slate-900">
                {notas.length === 0 ? "Nenhuma nota ainda" : "Nada encontrado"}
              </h3>
              <p className="text-sm text-slate-500 max-w-sm mt-1">
                {notas.length === 0
                  ? "Crie sua primeira nota para guardar dúvidas, fluxogramas ou lembretes pré-prova."
                  : "Tente outra palavra-chave na busca."}
              </p>
              {notas.length === 0 && (
                <Button
                  onClick={handleNew}
                  className="mt-4 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold shadow-md"
                >
                  <Plus className="w-4 h-4 mr-1.5" /> Criar primeira nota
                </Button>
              )}
            </Card>
          )}

          {filtered.map((n, i) => (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: i * 0.03 }}
              whileHover={{ y: -2 }}
            >
              <Card
                className="p-5 rounded-3xl border border-slate-100 bg-white hover:border-slate-200 shadow-[0_10px_30px_rgba(0,0,0,0.04)] hover:shadow-[0_15px_35px_rgba(0,0,0,0.07)] transition-all cursor-pointer flex flex-col gap-3 h-full"
                onClick={() => handleEditExisting(n)}
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold text-base leading-snug text-slate-900 line-clamp-2 flex-1 min-w-0">
                    {n.titulo}
                  </h3>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmDelete(n.id);
                    }}
                    className="shrink-0 p-1.5 rounded-xl text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                    aria-label="Excluir"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-sm text-slate-600 line-clamp-4 leading-relaxed whitespace-pre-line">
                  {n.conteudo}
                </p>
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400 mt-auto pt-3 border-t border-slate-100">
                  <Calendar className="w-3 h-3 text-cyan-600" />
                  {formatDateBR(n.updatedAt)}
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* MODAL DO EDITOR DE NOTA */}
      <AnimatePresence>
        {editing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4"
          >
            <motion.div
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 30, opacity: 0 }}
              className="w-full sm:max-w-2xl bg-white border border-slate-100 rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-[0_25px_60px_rgba(0,0,0,0.15)] flex flex-col max-h-[90vh] overflow-hidden"
            >
              <header className="flex items-center justify-between gap-2 px-6 py-4 border-b border-slate-100 bg-white/95 backdrop-blur-md">
                <button
                  onClick={() => setEditing(null)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                  aria-label="Fechar"
                  disabled={isSaving}
                >
                  <ChevronLeft className="w-5 h-5 sm:hidden" />
                  <X className="w-5 h-5 hidden sm:block" />
                </button>
                <div className="flex-1 min-w-0">
                  <h2 className="font-bold text-base text-slate-900">
                    {editing.id ? "Editar nota" : "Nova nota"}
                  </h2>
                  {editing.updatedAt && (
                    <p className="text-[11px] text-slate-400">
                      Atualizada em {formatDateBR(editing.updatedAt)}
                    </p>
                  )}
                </div>
                <Button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold shadow-md"
                >
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-1.5" />
                  )}
                  Salvar
                </Button>
              </header>

              <div className="p-6 sm:p-8 flex flex-col gap-4 overflow-y-auto">
                <Input
                  value={editing.titulo}
                  onChange={(e) => setEditing({ ...editing, titulo: e.target.value })}
                  placeholder="Título da nota"
                  className="h-12 text-lg font-bold rounded-2xl bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400 shadow-sm focus-visible:ring-cyan-500/20 focus-visible:border-cyan-500"
                  disabled={isSaving}
                />
                <Textarea
                  value={editing.conteudo}
                  onChange={(e) => setEditing({ ...editing, conteudo: e.target.value })}
                  placeholder="Escreva sua nota aqui. Pode ser um fluxograma, dúvidas para revisar, lembretes..."
                  className="min-h-[320px] text-base leading-relaxed rounded-2xl bg-white border border-slate-200 text-slate-800 placeholder:text-slate-400 shadow-sm focus-visible:ring-cyan-500/20 focus-visible:border-cyan-500 resize-y p-4"
                  disabled={isSaving}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* DIÁLOGO DE CONFIRMAÇÃO DE EXCLUSÃO */}
      <AlertDialog
        open={!!confirmDelete}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
      >
        <AlertDialogContent className="bg-white border border-slate-100 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.1)]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-slate-900 font-bold">Excluir esta nota?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-500">
              Esta ação não pode ser desfeita. A nota será removida permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting} className="rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDelete && handleDelete(confirmDelete)}
              disabled={isDeleting}
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-md"
            >
              {isDeleting ? (
                <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
              ) : null}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}