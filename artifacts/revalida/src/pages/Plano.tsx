import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTraining } from "@/contexts/TrainingContext";
import {
  CalendarRange,
  Plus,
  Pencil,
  Trash2,
  Sparkles,
  Activity,
  Flame,
  TrendingDown,
  TrendingUp,
  Clock,
  X,
  Save,
  ChevronLeft,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  PLANO_DIAS,
  PLANO_AREAS,
  PLANO_TIPOS,
  AREA_TONES,
  TIPO_TONES,
  listBlocos,
  addBloco,
  updateBloco,
  deleteBloco,
  newBloco,
  seedPlanoIfEmpty,
  type PlanoBloco,
  type PlanoDia,
} from "@/lib/planoStorage";
import { avgPercent, inferArea } from "@/lib/gamificationStorage";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function Plano() {
  const { history } = useTraining();
  const [blocos, setBlocos] = useState<PlanoBloco[]>([]);
  const [editing, setEditing] = useState<{
    bloco: Omit<PlanoBloco, "id"> & { id?: string };
    isNew: boolean;
  } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    seedPlanoIfEmpty();
    setBlocos(listBlocos());
  }, []);

  const refresh = () => setBlocos(listBlocos());

  // ============== PROFILE ==============
  const profile = useMemo(() => {
    const total = history.length;
    const mediaPct = avgPercent(history);
    const media10 = mediaPct / 10;
    const areaScores: Record<string, { soma: number; n: number }> = {};
    const dayMap: Record<string, number> = {};
    for (const s of history) {
      const a = inferArea(s.checklistTitle) ?? "Outras";
      const pct = s.notaMaxima > 0 ? (s.notaTotal / s.notaMaxima) * 100 : 0;
      areaScores[a] = areaScores[a] ?? { soma: 0, n: 0 };
      areaScores[a].soma += pct;
      areaScores[a].n += 1;
      const day = s.endedAt.slice(0, 10);
      dayMap[day] = (dayMap[day] ?? 0) + 1;
    }
    const areaList = Object.entries(areaScores)
      .map(([area, v]) => ({ area, mediaPct: v.soma / v.n, n: v.n }))
      .sort((a, b) => b.mediaPct - a.mediaPct);
    const fortes = areaList.slice(0, 2);
    const fracas = [...areaList].reverse().slice(0, 2);
    const diasAtivos = Object.keys(dayMap).length;
    return { total, media10, mediaPct, areaList, fortes, fracas, diasAtivos };
  }, [history]);

  // ============== RECOMMENDATIONS ==============
  const recomendacoes = useMemo(() => {
    const recs: { icon: typeof Sparkles; tone: string; text: string }[] = [];
    if (profile.fracas.length && profile.fracas[0].mediaPct < 70) {
      recs.push({
        icon: TrendingDown,
        tone: "from-rose-500/15 to-rose-500/5 border-rose-400/40 text-rose-700 dark:text-rose-300",
        text: `Foque mais em ${profile.fracas[0].area} (média ${(profile.fracas[0].mediaPct / 10).toFixed(1)}). Adicione 2 blocos de revisão esta semana.`,
      });
    }
    if (profile.fortes.length) {
      recs.push({
        icon: TrendingUp,
        tone: "from-emerald-500/15 to-emerald-500/5 border-emerald-400/40 text-emerald-700 dark:text-emerald-300",
        text: `Você vai bem em ${profile.fortes[0].area}. Mantenha o ritmo com 1 estação semanal.`,
      });
    }
    if (profile.total < 7) {
      recs.push({
        icon: Activity,
        tone: "from-blue-500/15 to-blue-500/5 border-blue-400/40 text-blue-700 dark:text-blue-300",
        text: "Aumente o número de estações semanais. Tente fazer pelo menos 1 por dia.",
      });
    }
    if (profile.media10 > 0 && profile.media10 < 7) {
      recs.push({
        icon: Sparkles,
        tone: "from-violet-500/15 to-violet-500/5 border-violet-400/40 text-violet-700 dark:text-violet-300",
        text: "Combine resumo + treino na mesma semana para fixar o conteúdo.",
      });
    }
    if (recs.length === 0) {
      recs.push({
        icon: Flame,
        tone: "from-amber-500/15 to-amber-500/5 border-amber-400/40 text-amber-700 dark:text-amber-300",
        text: "Excelente progresso! Mantenha a regularidade nos próximos dias.",
      });
    }
    return recs;
  }, [profile]);

  const blocosByDay = useMemo(() => {
    const map: Record<number, PlanoBloco[]> = {};
    for (const b of blocos) {
      map[b.dia] = map[b.dia] ?? [];
      map[b.dia].push(b);
    }
    for (const k of Object.keys(map)) {
      map[Number(k)].sort((a, b) => a.horario.localeCompare(b.horario));
    }
    return map;
  }, [blocos]);

  const handleSave = () => {
    if (!editing) return;
    const b = editing.bloco;
    if (!b.horario.match(/^\d{1,2}:\d{2}$/)) {
      toast.error("Horário inválido. Use HH:MM.");
      return;
    }
    if (editing.isNew) {
      addBloco(b);
      toast.success("Bloco adicionado");
    } else if (b.id) {
      updateBloco(b as PlanoBloco);
      toast.success("Bloco atualizado");
    }
    refresh();
    setEditing(null);
  };

  const handleDelete = (id: string) => {
    deleteBloco(id);
    refresh();
    setConfirmDelete(null);
    toast.success("Bloco removido");
  };

  return (
    <div className="flex flex-col gap-6">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="px-1 pt-2"
      >
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider font-bold text-muted-foreground">
          <CalendarRange className="w-3.5 h-3.5" /> Plano de estudos
        </div>
        <h1 className="text-3xl font-bold tracking-tight mt-1">Sua rotina semanal</h1>
        <p className="text-muted-foreground mt-1 font-medium">
          Combine treinos, revisões e resumos para evoluir de forma constante
        </p>
      </motion.div>

      {/* PERFIL */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Média" value={profile.media10.toFixed(1)} suffix="/10" tone="primary" />
        <StatCard label="Estações" value={profile.total.toString()} tone="cyan" />
        <StatCard label="Dias ativos" value={profile.diasAtivos.toString()} tone="violet" />
        <StatCard label="Áreas" value={profile.areaList.length.toString()} tone="emerald" />
      </section>

      {/* FORTES & FRACAS */}
      {profile.areaList.length > 0 && (
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <AreaListCard
            title="Áreas fortes"
            icon={TrendingUp}
            tone="emerald"
            items={profile.fortes}
          />
          <AreaListCard
            title="Áreas a revisar"
            icon={TrendingDown}
            tone="rose"
            items={profile.fracas}
          />
        </section>
      )}

      {/* RECOMENDAÇÕES */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2 px-1">
          <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <Sparkles className="w-4 h-4" />
          </div>
          <h2 className="font-bold text-lg">Recomendações inteligentes</h2>
        </div>
        <div className="flex flex-col gap-2.5">
          {recomendacoes.map((r, i) => {
            const Icon = r.icon;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.25, delay: i * 0.05 }}
              >
                <Card className={cn("rounded-2xl p-4 border bg-gradient-to-br backdrop-blur-md flex items-start gap-3", r.tone)}>
                  <Icon className="w-5 h-5 shrink-0 mt-0.5" />
                  <p className="text-sm font-medium leading-relaxed">{r.text}</p>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* CALENDÁRIO */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <CalendarRange className="w-4 h-4" />
            </div>
            <h2 className="font-bold text-lg">Calendário semanal</h2>
          </div>
          <Button
            onClick={() => setEditing({ bloco: newBloco(1), isNew: true })}
            size="sm"
            className="rounded-xl gradient-primary text-white border-0 glow-primary"
          >
            <Plus className="w-4 h-4 sm:mr-1.5" />
            <span className="hidden sm:inline">Adicionar bloco</span>
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-7 gap-3">
          {PLANO_DIAS.map((dia, idx) => {
            const items = blocosByDay[dia.value] ?? [];
            return (
              <motion.div
                key={dia.value}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: idx * 0.03 }}
              >
                <Card className="rounded-2xl border-border/60 bg-card/60 backdrop-blur-sm p-3 h-full flex flex-col gap-2 min-h-[140px]">
                  <header className="flex items-center justify-between">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                        {dia.short}
                      </div>
                      <div className="text-sm font-bold lg:hidden">{dia.full}</div>
                    </div>
                    <button
                      onClick={() =>
                        setEditing({ bloco: newBloco(dia.value), isNew: true })
                      }
                      className="p-1 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      aria-label="Adicionar bloco"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </header>
                  <div className="flex-1 flex flex-col gap-2">
                    {items.length === 0 && (
                      <div className="flex-1 rounded-xl border border-dashed border-border/60 flex items-center justify-center text-[11px] text-muted-foreground/70 py-4 px-2 text-center">
                        Sem blocos
                      </div>
                    )}
                    {items.map((b) => (
                      <BlocoCard
                        key={b.id}
                        bloco={b}
                        onEdit={() => setEditing({ bloco: b, isNew: false })}
                        onDelete={() => setConfirmDelete(b.id)}
                      />
                    ))}
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* EDITOR MODAL */}
      <AnimatePresence>
        {editing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          >
            <motion.div
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 30, opacity: 0 }}
              className="w-full sm:max-w-md bg-card border border-border/60 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col"
            >
              <header className="flex items-center justify-between p-4 border-b border-border/60">
                <button
                  onClick={() => setEditing(null)}
                  className="p-2 rounded-lg hover:bg-muted transition-colors"
                  aria-label="Fechar"
                >
                  <ChevronLeft className="w-5 h-5 sm:hidden" />
                  <X className="w-5 h-5 hidden sm:block" />
                </button>
                <h2 className="font-bold text-base">
                  {editing.isNew ? "Novo bloco" : "Editar bloco"}
                </h2>
                <Button
                  onClick={handleSave}
                  className="rounded-xl gradient-primary text-white border-0"
                  size="sm"
                >
                  <Save className="w-4 h-4 mr-1.5" /> Salvar
                </Button>
              </header>
              <div className="p-5 flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground">
                      Dia
                    </Label>
                    <Select
                      value={String(editing.bloco.dia)}
                      onValueChange={(v) =>
                        setEditing({
                          ...editing,
                          bloco: { ...editing.bloco, dia: Number(v) as PlanoDia },
                        })
                      }
                    >
                      <SelectTrigger className="mt-1.5 h-11 rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PLANO_DIAS.map((d) => (
                          <SelectItem key={d.value} value={String(d.value)}>
                            {d.full}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground">
                      Horário
                    </Label>
                    <Input
                      type="time"
                      value={editing.bloco.horario}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          bloco: { ...editing.bloco, horario: e.target.value },
                        })
                      }
                      className="mt-1.5 h-11 rounded-xl"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground">
                    Área
                  </Label>
                  <Select
                    value={editing.bloco.area}
                    onValueChange={(v) =>
                      setEditing({
                        ...editing,
                        bloco: { ...editing.bloco, area: v },
                      })
                    }
                  >
                    <SelectTrigger className="mt-1.5 h-11 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PLANO_AREAS.map((a) => (
                        <SelectItem key={a} value={a}>
                          {a}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground">
                    Tipo
                  </Label>
                  <Select
                    value={editing.bloco.tipo}
                    onValueChange={(v) =>
                      setEditing({
                        ...editing,
                        bloco: { ...editing.bloco, tipo: v as PlanoBloco["tipo"] },
                      })
                    }
                  >
                    <SelectTrigger className="mt-1.5 h-11 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PLANO_TIPOS.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground">
                    Título (opcional)
                  </Label>
                  <Input
                    value={editing.bloco.titulo ?? ""}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        bloco: { ...editing.bloco, titulo: e.target.value },
                      })
                    }
                    placeholder="Ex.: ECG e arritmias"
                    className="mt-1.5 h-11 rounded-xl"
                  />
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover este bloco?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDelete && handleDelete(confirmDelete)}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatCard({
  label,
  value,
  suffix,
  tone,
}: {
  label: string;
  value: string;
  suffix?: string;
  tone: "primary" | "cyan" | "violet" | "emerald";
}) {
  const tones: Record<string, string> = {
    primary: "from-blue-500/15 to-blue-500/5 border-blue-400/30",
    cyan: "from-cyan-500/15 to-cyan-500/5 border-cyan-400/30",
    violet: "from-violet-500/15 to-violet-500/5 border-violet-400/30",
    emerald: "from-emerald-500/15 to-emerald-500/5 border-emerald-400/30",
  };
  return (
    <Card className={cn("rounded-2xl p-4 border bg-gradient-to-br backdrop-blur-sm", tones[tone])}>
      <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-1">
        <div className="text-2xl font-extrabold tabular-nums">{value}</div>
        {suffix && <div className="text-xs text-muted-foreground font-bold">{suffix}</div>}
      </div>
    </Card>
  );
}

function AreaListCard({
  title,
  icon: Icon,
  tone,
  items,
}: {
  title: string;
  icon: typeof Sparkles;
  tone: "emerald" | "rose";
  items: { area: string; mediaPct: number; n: number }[];
}) {
  const toneClass =
    tone === "emerald"
      ? "from-emerald-500/10 to-emerald-500/0 border-emerald-400/30"
      : "from-rose-500/10 to-rose-500/0 border-rose-400/30";
  const iconColor = tone === "emerald" ? "text-emerald-600" : "text-rose-500";
  return (
    <Card className={cn("rounded-2xl p-4 border bg-gradient-to-br backdrop-blur-sm", toneClass)}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={cn("w-4 h-4", iconColor)} />
        <h3 className="text-sm font-bold">{title}</h3>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">Sem dados ainda</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {items.map((it) => (
            <li key={it.area} className="flex items-center justify-between text-sm">
              <span className="font-medium truncate">{it.area}</span>
              <span className="text-xs font-bold tabular-nums text-muted-foreground">
                {(it.mediaPct / 10).toFixed(1)} · {it.n} est.
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function BlocoCard({
  bloco,
  onEdit,
  onDelete,
}: {
  bloco: PlanoBloco;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const tone = AREA_TONES[bloco.area] ?? AREA_TONES["Clínica médica"];
  const tipoLabel = PLANO_TIPOS.find((t) => t.value === bloco.tipo)?.label ?? bloco.tipo;
  return (
    <motion.div
      whileHover={{ y: -1 }}
      onClick={() => setOpen(!open)}
      className={cn(
        "rounded-xl border p-2.5 cursor-pointer bg-gradient-to-br backdrop-blur-sm transition-all",
        tone,
        open && "ring-2 ring-primary/40 shadow-lg",
      )}
    >
      <div className="flex items-center gap-1.5 text-[11px] font-bold tabular-nums">
        <Clock className="w-3 h-3 opacity-70" />
        {bloco.horario}
        <span
          className={cn(
            "ml-auto px-1.5 py-0.5 rounded-full text-[9px] uppercase tracking-wider border font-bold",
            TIPO_TONES[bloco.tipo],
          )}
        >
          {tipoLabel}
        </span>
      </div>
      <div className="mt-1 text-xs font-bold leading-snug">{bloco.area}</div>
      {bloco.titulo && (
        <div className="text-[11px] opacity-80 leading-snug mt-0.5 line-clamp-2">
          {bloco.titulo}
        </div>
      )}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-1 mt-2 pt-2 border-t border-current/20"
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-white/40 dark:bg-black/30 text-[10px] font-bold hover:bg-white/60 dark:hover:bg-black/40 transition-colors"
            >
              <Pencil className="w-3 h-3" /> Editar
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="inline-flex items-center justify-center px-2 py-1.5 rounded-lg bg-white/40 dark:bg-black/30 text-rose-600 hover:bg-rose-500/20 transition-colors"
              aria-label="Remover"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
