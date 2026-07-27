import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ClipboardList, ArrowRight, Trophy } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { countMyChecklistsThisMonth } from "@/lib/checklistService";

const MONTHLY_GOAL = 50;

export default function ColaboradorHome() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [monthCount, setMonthCount] = useState<number | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    countMyChecklistsThisMonth(user.id)
      .then(setMonthCount)
      .catch(() => setMonthCount(0));
  }, [user?.id]);

  const pct = monthCount != null ? Math.min((monthCount / MONTHLY_GOAL) * 100, 100) : 0;
  const remaining = monthCount != null ? Math.max(MONTHLY_GOAL - monthCount, 0) : null;

  return (
    <div className="flex flex-col gap-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="px-1 pt-2 pb-1"
      >
        <h1 className="text-3xl font-bold tracking-tight">Portal do Colaborador</h1>
        <p className="text-muted-foreground mt-1 font-medium">
          Contribua com estações OSCE para a plataforma Revalida
        </p>
      </motion.div>

      {/* Progress counter widget — Phase 7 */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
      >
        <Card className="p-5 rounded-2xl shadow-sm border-border/50 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-400" />
              <span className="font-semibold text-sm">Contribuição mensal</span>
            </div>
            <span className="text-xs text-muted-foreground font-medium">
              {monthCount != null ? `${monthCount} / ${MONTHLY_GOAL} este mês` : "carregando…"}
            </span>
          </div>

          <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
            <div
              className="h-2.5 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 transition-all duration-700"
              style={{ width: `${pct}%` }}
            />
          </div>

          <p className="text-sm font-medium text-muted-foreground">
            {monthCount != null && remaining != null ? (
              monthCount >= MONTHLY_GOAL ? (
                <span className="text-emerald-500 font-semibold">
                  🎉 Meta atingida! Próximo mês grátis desbloqueado.
                </span>
              ) : (
                <>
                  <span className="text-foreground font-semibold">
                    Estações Carregadas: {monthCount} / {MONTHLY_GOAL}
                  </span>
                  {" "}— faltam{" "}
                  <span className="text-amber-400 font-semibold">{remaining}</span> para o próximo mês grátis!
                </>
              )
            ) : (
              "Carregando progresso…"
            )}
          </p>
        </Card>
      </motion.div>

      {/* Navigation cards */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <Card
          className="relative p-6 flex flex-col hover:-translate-y-0.5 hover:shadow-md hover:border-primary/30 transition-all cursor-pointer group"
          onClick={() => setLocation("/colaborador/checklists")}
        >
          <div className="flex justify-between items-start mb-2">
            <div className="flex items-center gap-3">
              <ClipboardList className="w-6 h-6 text-blue-500" strokeWidth={1.5} />
              <h2 className="text-lg font-medium leading-tight">Minhas Estações</h2>
            </div>
            <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
          </div>
          <p className="text-sm font-medium text-muted-foreground mt-2">
            Crie, edite e acompanhe suas estações OSCE enviadas para revisão
          </p>
        </Card>
      </motion.div>
    </div>
  );
}
