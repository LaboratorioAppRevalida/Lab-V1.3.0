import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { Plus, Search, ClipboardList, Pencil, Loader2, Trophy, Clock, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { type Checklist } from "@/lib/checklistStorage";
import { listMyChecklists, countMyChecklistsThisMonth } from "@/lib/checklistService";
import { useAuth } from "@/contexts/AuthContext";

const MONTHLY_GOAL = 50;

export default function ColaboradorChecklistsList() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [monthCount, setMonthCount] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      const [data, count] = await Promise.all([
        listMyChecklists(user.id),
        countMyChecklistsThisMonth(user.id),
      ]);
      setChecklists(data);
      setMonthCount(count);
    } catch (e) {
      console.warn("[ColaboradorChecklistsList] load error:", e);
      toast.error("Não foi possível carregar suas estações.");
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredChecklists = checklists.filter((c) => {
    const q = searchQuery.toLowerCase();
    return (
      c.title.toLowerCase().includes(q) ||
      c.grandeArea.toLowerCase().includes(q) ||
      c.subarea.toLowerCase().includes(q)
    );
  });

  const pct = monthCount != null ? Math.min((monthCount / MONTHLY_GOAL) * 100, 100) : 0;

  return (
    <div className="flex flex-col gap-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col md:flex-row md:items-end justify-between gap-4 px-1 pt-2 pb-1"
      >
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Minhas Estações</h1>
          <p className="text-muted-foreground mt-1 font-medium">
            Estações OSCE enviadas por você para revisão
          </p>
        </div>
        <Button
          onClick={() => setLocation("/colaborador/checklists/nova")}
          className="gradient-primary text-white border-0 shadow-sm whitespace-nowrap"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nova estação
        </Button>
      </motion.div>

      {/* Monthly progress widget */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
      >
        <Card className="p-4 rounded-2xl shadow-sm border-border/50 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-semibold">
                {monthCount != null && monthCount >= MONTHLY_GOAL ? (
                  <span className="text-emerald-500">🎉 Meta do mês atingida!</span>
                ) : (
                  <>
                    Estações Carregadas:{" "}
                    <span className="text-amber-400">
                      {monthCount ?? "…"} / {MONTHLY_GOAL}
                    </span>{" "}
                    para o próximo mês grátis!
                  </>
                )}
              </span>
            </div>
            <span className="text-xs text-muted-foreground">{Math.round(pct)}%</span>
          </div>
          <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
            <div
              className="h-1.5 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 transition-all duration-700"
              style={{ width: `${pct}%` }}
            />
          </div>
        </Card>
      </motion.div>

      {/* Search bar */}
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por título ou área…"
            className="pl-9 h-11 bg-card rounded-xl border-border/50 shadow-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {checklists.length > 0 && (
          <div className="flex flex-wrap gap-2 px-1">
            <span className="inline-flex items-center rounded-full bg-muted/50 px-2.5 py-0.5 text-xs font-semibold text-muted-foreground border">
              {checklists.length} {checklists.length === 1 ? "estação" : "estações"}
            </span>
          </div>
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
              <div className="w-16 h-16 rounded-full gradient-primary flex items-center justify-center mb-4 opacity-90 shadow-md">
                <ClipboardList className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold mb-2">Nenhuma estação encontrada</h3>
              <p className="text-muted-foreground mb-6 max-w-sm">
                {searchQuery
                  ? "Sua busca não retornou resultados."
                  : "Comece criando sua primeira estação OSCE para contribuir com a plataforma."}
              </p>
              {!searchQuery && (
                <Button
                  onClick={() => setLocation("/colaborador/checklists/nova")}
                  className="gradient-primary text-white border-0"
                >
                  Criar primeira estação
                </Button>
              )}
            </Card>
          ) : (
            filteredChecklists.map((c, i) => {
              const totalScore = c.pepBlocks.reduce(
                (sum, block) => sum + block.scoreAdequado,
                0,
              );
              const approved = c.isApproved === true;

              return (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.05 }}
                >
                  <Card className="p-4 sm:p-5 flex flex-col sm:flex-row gap-4 justify-between sm:items-center rounded-2xl shadow-sm border-border/50 hover:shadow-md hover:-translate-y-0.5 transition-all">
                    <div
                      className="flex flex-col gap-1 cursor-pointer flex-1"
                      onClick={() => setLocation(`/colaborador/checklists/editar/${c.id}`)}
                    >
                      <h3 className="font-bold text-lg leading-tight hover:text-primary transition-colors line-clamp-2">
                        {c.title}
                      </h3>
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
                        {/* Approval status badge */}
                        {approved ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 bg-emerald-500/10 text-emerald-500 rounded-md border border-emerald-500/20">
                            <CheckCircle2 className="w-3 h-3" />
                            Aprovada
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 bg-amber-500/10 text-amber-500 rounded-md border border-amber-500/20">
                            <Clock className="w-3 h-3" />
                            Aguardando revisão
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          atualizado em{" "}
                          {new Date(c.updatedAt).toLocaleDateString("pt-BR")}
                        </span>
                      </div>
                    </div>

                    {/* Edit — no Delete button (feature stripped for colaboradores) */}
                    <div className="flex items-center gap-1 self-end sm:self-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-muted-foreground hover:text-foreground"
                        onClick={() => setLocation(`/colaborador/checklists/editar/${c.id}`)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                  </Card>
                </motion.div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
