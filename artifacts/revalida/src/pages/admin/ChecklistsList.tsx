import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import {
  Plus,
  Search,
  ClipboardList,
  Pencil,
  Trash2,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  ThumbsUp,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { type Checklist } from "@/lib/checklistStorage";
import {
  listAllChecklists,
  deleteChecklistById,
  approveChecklist,
  adminDeleteChecklist,
} from "@/lib/checklistService";
import { useAuth } from "@/contexts/AuthContext";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type Tab = "all" | "pending";

export default function ChecklistsList() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [tab, setTab] = useState<Tab>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Checklist | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  const loadChecklists = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await listAllChecklists();
      setChecklists(data);
    } catch (e) {
      console.warn("[ChecklistsList] load error:", e);
      toast.error("Não foi possível carregar os checklists.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadChecklists();
  }, [loadChecklists]);

  // ── Delete (own checklist) ────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!itemToDelete || !user?.id) return;
    setIsDeleting(true);
    try {
      await deleteChecklistById(itemToDelete, user.id);
      setChecklists((prev) => prev.filter((c) => c.id !== itemToDelete));
      toast.success("Checklist excluído com sucesso");
      setItemToDelete(null);
    } catch (e) {
      console.warn("[ChecklistsList] delete error:", e);
      toast.error("Erro ao excluir. Você só pode excluir checklists criados por você.");
    } finally {
      setIsDeleting(false);
    }
  };

  // ── Approve ───────────────────────────────────────────────────────────────

  const handleApprove = async (c: Checklist) => {
    setApprovingId(c.id);
    try {
      await approveChecklist(c.id);
      setChecklists((prev) =>
        prev.map((x) => (x.id === c.id ? { ...x, isApproved: true } : x)),
      );
      toast.success(`"${c.title}" aprovado e publicado`);
    } catch (e) {
      console.warn("[ChecklistsList] approve error:", e);
      toast.error("Erro ao aprovar estação");
    } finally {
      setApprovingId(null);
    }
  };

  // ── Reject (admin delete) ─────────────────────────────────────────────────

  const handleReject = async () => {
    if (!rejectTarget) return;
    setRejectingId(rejectTarget.id);
    try {
      await adminDeleteChecklist(rejectTarget.id);
      setChecklists((prev) => prev.filter((x) => x.id !== rejectTarget.id));
      toast.success(`"${rejectTarget.title}" removido da fila`);
      setRejectTarget(null);
    } catch (e) {
      console.warn("[ChecklistsList] reject error:", e);
      toast.error("Erro ao rejeitar estação");
    } finally {
      setRejectingId(null);
    }
  };

  // ── Derived lists ─────────────────────────────────────────────────────────

  const allChecklists = checklists;
  const pendingChecklists = checklists.filter((c) => !c.isApproved);

  const baseList = tab === "pending" ? pendingChecklists : allChecklists;

  const filteredChecklists = baseList.filter((c) => {
    const q = searchQuery.toLowerCase();
    return (
      c.title.toLowerCase().includes(q) ||
      c.grandeArea.toLowerCase().includes(q) ||
      c.subarea.toLowerCase().includes(q)
    );
  });

  const grandeAreaCounts = allChecklists.reduce(
    (acc, c) => {
      acc[c.grandeArea] = (acc[c.grandeArea] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col md:flex-row md:items-end justify-between gap-4 px-1 pt-2 pb-1"
      >
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Checklists</h1>
          <p className="text-muted-foreground mt-1 font-medium">
            Estações de avaliação prática
          </p>
        </div>
        <Button
          onClick={() => setLocation("/admin/checklists/novo")}
          className="gradient-primary text-white border-0 shadow-sm whitespace-nowrap"
        >
          <Plus className="w-4 h-4 mr-2" />
          Criar novo checklist
        </Button>
      </motion.div>

      {/* Tabs: All | Pending */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setTab("all")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            tab === "all"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          <ClipboardList className="w-3.5 h-3.5" />
          Todas
          <span
            className={`ml-0.5 text-[11px] font-bold px-1.5 py-0 rounded-full ${
              tab === "all" ? "bg-white/20" : "bg-muted-foreground/20"
            }`}
          >
            {allChecklists.length}
          </span>
        </button>

        <button
          onClick={() => setTab("pending")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            tab === "pending"
              ? "bg-amber-500 text-white shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          Aguardando revisão
          {pendingChecklists.length > 0 && (
            <span
              className={`ml-0.5 text-[11px] font-bold px-1.5 py-0 rounded-full ${
                tab === "pending"
                  ? "bg-white/20"
                  : "bg-amber-500 text-white"
              }`}
            >
              {pendingChecklists.length}
            </span>
          )}
        </button>
      </div>

      {/* Search + area chips */}
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por título ou área..."
            className="pl-9 h-11 bg-card rounded-xl border-border/50 shadow-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {tab === "all" && allChecklists.length > 0 && (
          <div className="flex flex-wrap gap-2 px-1">
            <span className="inline-flex items-center rounded-full bg-muted/50 px-2.5 py-0.5 text-xs font-semibold text-muted-foreground border">
              {allChecklists.length} checklists
            </span>
            {Object.entries(grandeAreaCounts).map(([area, count]) => (
              <span
                key={area}
                className="inline-flex items-center rounded-full bg-muted/50 px-2.5 py-0.5 text-xs font-semibold text-muted-foreground border"
              >
                {count} {area}
              </span>
            ))}
          </div>
        )}

        {tab === "pending" && (
          <p className="text-xs text-muted-foreground px-1">
            Estações enviadas por colaboradores, aguardando publicação. Aprove para torná-las visíveis no catálogo e no matchmaking.
          </p>
        )}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredChecklists.length === 0 ? (
            <Card className="flex flex-col items-center justify-center p-12 text-center rounded-2xl shadow-sm border-border/50 mt-4">
              <div
                className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 opacity-90 shadow-md ${
                  tab === "pending" ? "bg-amber-100" : "gradient-primary"
                }`}
              >
                {tab === "pending" ? (
                  <Clock className="w-8 h-8 text-amber-600" />
                ) : (
                  <ClipboardList className="w-8 h-8 text-white" />
                )}
              </div>
              <h3 className="text-xl font-bold mb-2">
                {tab === "pending"
                  ? "Nenhuma estação pendente"
                  : "Nenhum checklist encontrado"}
              </h3>
              <p className="text-muted-foreground mb-6 max-w-sm">
                {tab === "pending"
                  ? "Todas as estações estão revisadas. Boa trabalho!"
                  : searchQuery
                  ? "Sua busca não retornou resultados."
                  : "Comece criando o primeiro checklist para a prova prática."}
              </p>
              {!searchQuery && tab === "all" && (
                <Button
                  onClick={() => setLocation("/admin/checklists/novo")}
                  className="gradient-primary text-white border-0"
                >
                  Criar primeiro checklist
                </Button>
              )}
            </Card>
          ) : (
            <AnimatePresence initial={false}>
              {filteredChecklists.map((c, i) => {
                const totalScore = c.pepBlocks.reduce(
                  (sum, block) => sum + block.scoreAdequado,
                  0,
                );
                const isPending = !c.isApproved;
                const isApprovingThis = approvingId === c.id;
                const isRejectingThis = rejectingId === c.id;

                return (
                  <motion.div
                    key={c.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    transition={{ duration: 0.25, delay: i * 0.04 }}
                  >
                    <Card
                      className={`p-4 sm:p-5 flex flex-col sm:flex-row gap-4 justify-between sm:items-center rounded-2xl shadow-sm border-border/50 hover:shadow-md hover:-translate-y-0.5 transition-all ${
                        isPending ? "border-amber-300/60 dark:border-amber-700/40 bg-amber-50/30 dark:bg-amber-950/10" : ""
                      }`}
                    >
                      {/* Info */}
                      <div
                        className="flex flex-col gap-1 cursor-pointer flex-1 min-w-0"
                        onClick={() => setLocation(`/admin/checklists/editar/${c.id}`)}
                      >
                        <div className="flex items-start gap-2 flex-wrap">
                          <h3 className="font-bold text-lg leading-tight hover:text-primary transition-colors line-clamp-2">
                            {c.title}
                          </h3>
                          {isPending && (
                            <Badge className="shrink-0 text-[10px] px-1.5 py-0 h-4 mt-1 bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 border border-amber-300 dark:border-amber-700">
                              <Clock className="w-2.5 h-2.5 mr-1" />
                              Pendente
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm font-medium text-muted-foreground">
                          {c.grandeArea} • {c.subarea}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          <span className="text-xs font-semibold px-2 py-0.5 bg-primary/10 text-primary rounded-md border border-primary/20">
                            {c.pepBlocks.length} blocos PEP
                          </span>
                          <span className="text-xs font-semibold px-2 py-0.5 bg-muted rounded-md border">
                            {totalScore.toFixed(1)} pts
                          </span>
                          <span className="text-xs text-muted-foreground">
                            atualizado em{" "}
                            {new Date(c.updatedAt).toLocaleDateString("pt-BR")}
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 self-end sm:self-center shrink-0">
                        {/* Approve button — shown for pending stations */}
                        {isPending && (
                          <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 px-3 gap-1.5"
                            onClick={() => handleApprove(c)}
                            disabled={isApprovingThis || isRejectingThis}
                            title="Aprovar e publicar"
                          >
                            {isApprovingThis ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <ThumbsUp className="w-3.5 h-3.5" />
                            )}
                            Aprovar
                          </Button>
                        )}

                        {/* Reject button — shown for pending stations */}
                        {isPending && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 px-3 gap-1.5"
                            onClick={() => setRejectTarget(c)}
                            disabled={isApprovingThis || isRejectingThis}
                            title="Rejeitar e excluir"
                          >
                            {isRejectingThis ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <XCircle className="w-3.5 h-3.5" />
                            )}
                            Rejeitar
                          </Button>
                        )}

                        {/* Edit — always shown */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 text-muted-foreground hover:text-foreground"
                          onClick={() => setLocation(`/admin/checklists/editar/${c.id}`)}
                          title="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>

                        {/* Delete own checklist — only for approved (admin-created) stations */}
                        {!isPending && (
                          <AlertDialog
                            open={itemToDelete === c.id}
                            onOpenChange={(open) => !open && setItemToDelete(null)}
                          >
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 text-muted-foreground hover:text-destructive"
                                onClick={() => setItemToDelete(c.id)}
                                title="Excluir"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir checklist?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta ação não pode ser desfeita. O checklist "{c.title}" será
                                  removido permanentemente.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel disabled={isDeleting}>
                                  Cancelar
                                </AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={handleDelete}
                                  disabled={isDeleting}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  {isDeleting && (
                                    <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                                  )}
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>
      )}

      {/* Reject confirmation dialog */}
      <AlertDialog open={!!rejectTarget} onOpenChange={(o) => !o && setRejectTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-destructive" />
              Rejeitar estação?
            </AlertDialogTitle>
            <AlertDialogDescription>
              A estação <strong>"{rejectTarget?.title}"</strong> será excluída
              permanentemente. O colaborador poderá reenviar uma versão corrigida.
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!rejectingId}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReject}
              disabled={!!rejectingId}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {rejectingId && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
              Rejeitar e excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
