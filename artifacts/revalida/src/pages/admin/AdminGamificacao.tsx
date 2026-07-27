import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import {
  ChevronLeft, Plus, Pencil, Trash2, Zap, Trophy, Calendar,
  Star, ToggleLeft, ToggleRight, Sparkles, Medal, Target,
  Settings2, Loader2, X,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { cn } from "@/lib/utils";

import {
  fetchMissions, createMission, updateMission, deleteMission,
  toggleMissionActive,
  type DbMission, type MissionInput, type MissionType, type MissionRarity,
  MISSION_TYPES, MISSION_RARITIES, TRIGGER_TYPES,
} from "@/lib/missionService";
import {
  fetchLevels, upsertLevel, deleteLevel,
  type DbLevel,
} from "@/lib/levelService";
import {
  fetchTitles, createTitle, updateTitle, deleteTitle,
  type DbTitle, type TitleInput, type TitleRarity,
  TITLE_RARITIES,
} from "@/lib/titleService";
import {
  fetchEvents, createEvent, updateEvent, deleteEvent,
  toggleEventActive,
  fetchEventMissions, fetchEventRewards,
  linkMissionToEvent, unlinkMissionFromEvent,
  createEventReward, updateEventReward, deleteEventReward,
  fetchEventCountsForAll,
  type DbEvent, type EventInput, type EventType,
  type EventMissionRow, type EventRewardWithTitle,
  type EventRewardInput, type EventRewardType,
} from "@/lib/eventService";
import type { MissionConditions, MissionRule, MissionRuleType } from "@/types/missions";
import { MISSION_AREAS, RULE_TYPE_LABELS } from "@/types/missions";

// ── Helpers para o editor de condições ───────────────────────────────────────

const RULE_TYPE_OPTIONS = Object.entries(RULE_TYPE_LABELS) as [MissionRuleType, string][];

function defaultRule(type: MissionRuleType): MissionRule {
  switch (type) {
    case "station_completed":  return { type, count: 1 };
    case "session_count":      return { type, count: 5 };
    case "login_streak":       return { type, days: 7 };
    case "average_score":      return { type, minimum: 8, count: 3 };
    case "min_score":          return { type, minimum: 8, count: 3 };
    case "multiplayer_count":  return { type, count: 5 };
    case "time_spent_minutes": return { type, minutes: 60 };
  }
}

const SEL_CLS =
  "mt-1 w-full h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring";

// ── Editor de condições reutilizável (Missões + Títulos) ─────────────────────

function ConditionsEditor({
  rules,
  onChange,
  emptyHint = "Sem condições dinâmicas.",
}: {
  rules: MissionRule[];
  onChange: (rules: MissionRule[]) => void;
  emptyHint?: string;
}) {
  return (
    <div className="mt-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-bold uppercase tracking-wider">
          Condições dinâmicas{" "}
          <span className="text-muted-foreground font-normal normal-case">(opcional)</span>
        </Label>
        <Button
          type="button" size="sm" variant="outline" className="h-7 gap-1 text-xs"
          onClick={() => onChange([...rules, defaultRule("station_completed")])}
        >
          <Plus className="w-3 h-3" /> Adicionar Regra
        </Button>
      </div>

      {rules.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">{emptyHint}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {rules.map((rule, i) => {
            const update = (patch: MissionRule) => {
              const next = [...rules];
              next[i] = patch;
              onChange(next);
            };
            const remove = () => onChange(rules.filter((_, j) => j !== i));

            return (
              <div key={i} className="flex flex-col gap-2 p-3 rounded-xl border border-border/60 bg-muted/30">
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <Label className="text-[10px]">Tipo de regra</Label>
                    <select
                      value={rule.type}
                      onChange={(e) => update(defaultRule(e.target.value as MissionRuleType))}
                      className={SEL_CLS}
                    >
                      {RULE_TYPE_OPTIONS.map(([v, label]) => (
                        <option key={v} value={v}>{label}</option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button" onClick={remove}
                    className="self-end pb-1 text-destructive hover:text-destructive/70 transition-colors"
                    title="Remover regra"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {rule.type === "station_completed" && (
                  <div className="grid grid-cols-[1fr_1fr_auto_72px] gap-2 items-end">
                    <div>
                      <Label className="text-[10px]">Área</Label>
                      <select value={rule.area ?? ""} className={SEL_CLS}
                        onChange={(e) => update({ ...rule, area: e.target.value || undefined })}>
                        <option value="">Qualquer</option>
                        {MISSION_AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
                      </select>
                    </div>
                    <div>
                      <Label className="text-[10px]">Papel</Label>
                      <select value={rule.role ?? ""} className={SEL_CLS}
                        onChange={(e) => update({ ...rule, role: (e.target.value as "medico" | "paciente") || undefined })}>
                        <option value="">Qualquer</option>
                        <option value="medico">Médico</option>
                        <option value="paciente">Paciente</option>
                      </select>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <Label className="text-[10px]">Multi</Label>
                      <input type="checkbox" checked={rule.multiplayer ?? false} className="rounded mt-1"
                        onChange={(e) => update({ ...rule, multiplayer: e.target.checked || undefined })} />
                    </div>
                    <div>
                      <Label className="text-[10px]">Qtd.</Label>
                      <Input type="number" min={1} value={rule.count} className="mt-1 h-8 text-xs"
                        onChange={(e) => update({ ...rule, count: Math.max(1, Number(e.target.value)) })} />
                    </div>
                  </div>
                )}

                {rule.type === "session_count" && (
                  <div className="grid grid-cols-2 gap-2 items-end">
                    <div>
                      <Label className="text-[10px]">Área</Label>
                      <select value={rule.area ?? ""} className={SEL_CLS}
                        onChange={(e) => update({ ...rule, area: e.target.value || undefined })}>
                        <option value="">Qualquer</option>
                        {MISSION_AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
                      </select>
                    </div>
                    <div>
                      <Label className="text-[10px]">Qtd. sessões</Label>
                      <Input type="number" min={1} value={rule.count} className="mt-1 h-8 text-xs"
                        onChange={(e) => update({ ...rule, count: Math.max(1, Number(e.target.value)) })} />
                    </div>
                  </div>
                )}

                {rule.type === "login_streak" && (
                  <div className="w-1/2">
                    <Label className="text-[10px]">Dias consecutivos</Label>
                    <Input type="number" min={1} value={rule.days} className="mt-1 h-8 text-xs"
                      onChange={(e) => update({ ...rule, days: Math.max(1, Number(e.target.value)) })} />
                  </div>
                )}

                {rule.type === "average_score" && (
                  <div className="grid grid-cols-3 gap-2 items-end">
                    <div>
                      <Label className="text-[10px]">Área</Label>
                      <select value={rule.area ?? ""} className={SEL_CLS}
                        onChange={(e) => update({ ...rule, area: e.target.value || undefined })}>
                        <option value="">Qualquer</option>
                        {MISSION_AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
                      </select>
                    </div>
                    <div>
                      <Label className="text-[10px]">Nota mín. (0–10)</Label>
                      <Input type="number" min={0} max={10} step={0.5} value={rule.minimum} className="mt-1 h-8 text-xs"
                        onChange={(e) => update({ ...rule, minimum: Math.min(10, Math.max(0, Number(e.target.value))) })} />
                    </div>
                    <div>
                      <Label className="text-[10px]">Qtd. sessões</Label>
                      <Input type="number" min={1} value={rule.count} className="mt-1 h-8 text-xs"
                        onChange={(e) => update({ ...rule, count: Math.max(1, Number(e.target.value)) })} />
                    </div>
                  </div>
                )}

                {rule.type === "min_score" && (
                  <div className="grid grid-cols-2 gap-2 items-end">
                    <div>
                      <Label className="text-[10px]">Nota mín. (0–10)</Label>
                      <Input type="number" min={0} max={10} step={0.5} value={rule.minimum} className="mt-1 h-8 text-xs"
                        onChange={(e) => update({ ...rule, minimum: Math.min(10, Math.max(0, Number(e.target.value))) })} />
                    </div>
                    <div>
                      <Label className="text-[10px]">Qtd. sessões</Label>
                      <Input type="number" min={1} value={rule.count} className="mt-1 h-8 text-xs"
                        onChange={(e) => update({ ...rule, count: Math.max(1, Number(e.target.value)) })} />
                    </div>
                  </div>
                )}

                {rule.type === "multiplayer_count" && (
                  <div className="w-1/2">
                    <Label className="text-[10px]">Qtd. sessões multiplayer</Label>
                    <Input type="number" min={1} value={rule.count} className="mt-1 h-8 text-xs"
                      onChange={(e) => update({ ...rule, count: Math.max(1, Number(e.target.value)) })} />
                  </div>
                )}

                {rule.type === "time_spent_minutes" && (
                  <div className="grid grid-cols-2 gap-2 items-end">
                    <div>
                      <Label className="text-[10px]">Área</Label>
                      <select value={rule.area ?? ""} className={SEL_CLS}
                        onChange={(e) => update({ ...rule, area: e.target.value || undefined })}>
                        <option value="">Qualquer</option>
                        {MISSION_AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
                      </select>
                    </div>
                    <div>
                      <Label className="text-[10px]">Minutos totais</Label>
                      <Input type="number" min={1} value={rule.minutes} className="mt-1 h-8 text-xs"
                        onChange={(e) => update({ ...rule, minutes: Math.max(1, Number(e.target.value)) })} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

type Tab = "missoes" | "niveis" | "titulos" | "eventos";

const RARITY_BADGE: Record<string, string> = {
  common:    "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
  rare:      "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  epic:      "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  legendary: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  exclusive: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  event:     "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
};

const TYPE_BADGE: Record<string, string> = {
  diaria:   "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  semanal:  "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  especial: "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/40 dark:text-fuchsia-300",
  evento:   "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  secreta:  "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
};

function SmallBadge({ cls, label }: { cls: string; label: string }) {
  return (
    <span className={cn("inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide", cls)}>
      {label}
    </span>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AdminGamificacao() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<Tab>("missoes");

  const tabs: { id: Tab; label: string; icon: typeof Sparkles }[] = [
    { id: "missoes",  label: "Missões",  icon: Sparkles },
    { id: "niveis",   label: "Níveis",   icon: Zap      },
    { id: "titulos",  label: "Títulos",  icon: Trophy   },
    { id: "eventos",  label: "Eventos",  icon: Calendar },
  ];

  return (
    <div className="flex flex-col gap-5">
      <button
        onClick={() => setLocation("/admin")}
        className="self-start inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronLeft className="w-4 h-4" /> Painel admin
      </button>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="px-1"
      >
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider font-bold text-muted-foreground mb-1">
          <Medal className="w-3.5 h-3.5" /> Gamificação
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Gerenciar gamificação</h1>
        <p className="text-muted-foreground mt-1 font-medium">
          Missões, níveis, títulos e eventos — tudo administrável
        </p>
      </motion.div>

      {/* Tab bar */}
      <div className="flex gap-2 overflow-x-auto -mx-4 px-4 scrollbar-none">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={cn(
                "shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all border",
                active
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-card text-muted-foreground border-border/60 hover:border-primary/40 hover:text-foreground",
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        {activeTab === "missoes"  && <MissoesTab />}
        {activeTab === "niveis"   && <NiveisTab  />}
        {activeTab === "titulos"  && <TitulosTab />}
        {activeTab === "eventos"  && <EventosTab />}
      </motion.div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MISSÕES TAB
// ═══════════════════════════════════════════════════════════════════════════════

const BLANK_MISSION: MissionInput = {
  slug: "", name: "", description: "",
  xp_reward: 50, type: "diaria", category: "geral",
  rarity: "common", is_active: true, hidden: false,
  icon: null, trigger_type: "completar_estacao", trigger_value: 1,
  conditions: null,
};

function MissoesTab() {
  const [missions, setMissions]   = useState<DbMission[]>([]);
  const [loading, setLoading]     = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing]     = useState<DbMission | null>(null);
  const [form, setForm]           = useState<MissionInput>(BLANK_MISSION);
  const [saving, setSaving]       = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [conditionRules, setConditionRules] = useState<MissionRule[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try { setMissions(await fetchMissions()); }
    catch { toast.error("Erro ao carregar missões"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(BLANK_MISSION);
    setConditionRules([]);
    setDialogOpen(true);
  };
  const openEdit = (m: DbMission) => {
    setEditing(m);
    setForm({ ...m });
    setConditionRules((m.conditions as MissionConditions | null)?.rules ?? []);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.slug || !form.name) { toast.error("Slug e nome são obrigatórios"); return; }
    setSaving(true);
    const missionData: MissionInput = {
      ...form,
      conditions: conditionRules.length > 0 ? { rules: conditionRules } : null,
    };
    try {
      if (editing) {
        await updateMission(editing.id, missionData);
        toast.success("Missão atualizada");
      } else {
        await createMission(missionData);
        toast.success("Missão criada");
      }
      setDialogOpen(false);
      await load();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao salvar missão";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMission(id);
      toast.success("Missão removida");
      setConfirmId(null);
      await load();
    } catch { toast.error("Erro ao remover missão"); }
  };

  const handleToggle = async (m: DbMission) => {
    try {
      await toggleMissionActive(m.id, !m.is_active);
      setMissions((prev) => prev.map((x) => x.id === m.id ? { ...x, is_active: !m.is_active } : x));
    } catch { toast.error("Erro ao alterar status"); }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground font-medium">
          {missions.length} {missions.length === 1 ? "missão" : "missões"} cadastradas
        </div>
        <Button size="sm" className="gap-2" onClick={openCreate}>
          <Plus className="w-4 h-4" /> Nova missão
        </Button>
      </div>

      {loading ? (
        <div className="text-center text-sm text-muted-foreground py-10">Carregando…</div>
      ) : missions.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground rounded-2xl">
          Nenhuma missão cadastrada ainda.
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {missions.map((m) => (
            <Card key={m.id} className={cn("p-4 rounded-2xl border-border/60 flex items-start gap-3", !m.is_active && "opacity-60")}>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="font-semibold text-sm">{m.name}</span>
                  <SmallBadge cls={TYPE_BADGE[m.type] ?? ""} label={m.type} />
                  <SmallBadge cls={RARITY_BADGE[m.rarity] ?? ""} label={m.rarity} />
                  <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-primary">
                    <Zap className="w-3 h-3" /> +{m.xp_reward} XP
                  </span>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-1">{m.description}</p>
                <div className="mt-1.5 flex flex-wrap gap-2 text-[10px] text-muted-foreground">
                  <span>trigger: <b>{m.trigger_type}</b> × {m.trigger_value}</span>
                  <span>slug: <b>{m.slug}</b></span>
                  {m.conditions && (m.conditions as MissionConditions).rules?.length > 0 && (
                    <span className="text-violet-600 dark:text-violet-400 font-bold">
                      ⚙ {(m.conditions as MissionConditions).rules.length} regra{(m.conditions as MissionConditions).rules.length > 1 ? "s" : ""} dinâmica{(m.conditions as MissionConditions).rules.length > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => handleToggle(m)}
                  className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                  title={m.is_active ? "Desativar" : "Ativar"}
                >
                  {m.is_active
                    ? <ToggleRight className="w-5 h-5 text-emerald-500" />
                    : <ToggleLeft  className="w-5 h-5 text-muted-foreground" />}
                </button>
                <button
                  onClick={() => openEdit(m)}
                  className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                >
                  <Pencil className="w-4 h-4 text-muted-foreground" />
                </button>
                <button
                  onClick={() => setConfirmId(m.id)}
                  className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors"
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar missão" : "Nova missão"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 mt-2">
            <div className="col-span-2">
              <Label className="text-xs">Slug (ID único)</Label>
              <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })}
                placeholder="diario-login" className="mt-1" />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Nome</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Login diário" className="mt-1" />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Descrição</Label>
              <Textarea value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Abra a plataforma hoje" rows={2} className="mt-1 resize-none" />
            </div>
            <div>
              <Label className="text-xs">XP de recompensa</Label>
              <Input type="number" min={0} value={form.xp_reward}
                onChange={(e) => setForm({ ...form, xp_reward: Number(e.target.value) })}
                className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Tipo</Label>
              <select value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as MissionType })}
                className="mt-1 w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                {MISSION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs">Raridade</Label>
              <select value={form.rarity}
                onChange={(e) => setForm({ ...form, rarity: e.target.value as MissionRarity })}
                className="mt-1 w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                {MISSION_RARITIES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs">Categoria</Label>
              <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="geral" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Trigger</Label>
              <select value={form.trigger_type}
                onChange={(e) => setForm({ ...form, trigger_type: e.target.value })}
                className="mt-1 w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                {TRIGGER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs">Valor do trigger</Label>
              <Input type="number" min={1} value={form.trigger_value}
                onChange={(e) => setForm({ ...form, trigger_value: Number(e.target.value) })}
                className="mt-1" />
            </div>
            <div className="col-span-2 flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  className="rounded" />
                Ativa
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.hidden}
                  onChange={(e) => setForm({ ...form, hidden: e.target.checked })}
                  className="rounded" />
                Oculta (secreta)
              </label>
            </div>
          </div>

          {/* ── Condições dinâmicas ── */}
          <div className="mt-4 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold uppercase tracking-wider">
                Condições dinâmicas{" "}
                <span className="text-muted-foreground font-normal normal-case">(opcional)</span>
              </Label>
              <Button
                type="button" size="sm" variant="outline" className="h-7 gap-1 text-xs"
                onClick={() => setConditionRules([...conditionRules, defaultRule("station_completed")])}
              >
                <Plus className="w-3 h-3" /> Adicionar Regra
              </Button>
            </div>

            {conditionRules.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">
                Sem condições — usa trigger_type / trigger_value acima.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {conditionRules.map((rule, i) => {
                  const update = (patch: MissionRule) => {
                    const next = [...conditionRules];
                    next[i] = patch;
                    setConditionRules(next);
                  };
                  const remove = () => setConditionRules(conditionRules.filter((_, j) => j !== i));

                  return (
                    <div key={i} className="flex flex-col gap-2 p-3 rounded-xl border border-border/60 bg-muted/30">
                      {/* Tipo da regra + Remover */}
                      <div className="flex items-end gap-2">
                        <div className="flex-1">
                          <Label className="text-[10px]">Tipo de regra</Label>
                          <select
                            value={rule.type}
                            onChange={(e) => update(defaultRule(e.target.value as MissionRuleType))}
                            className={SEL_CLS}
                          >
                            {RULE_TYPE_OPTIONS.map(([v, label]) => (
                              <option key={v} value={v}>{label}</option>
                            ))}
                          </select>
                        </div>
                        <button
                          type="button" onClick={remove}
                          className="self-end pb-1 text-destructive hover:text-destructive/70 transition-colors"
                          title="Remover regra"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Campos dinâmicos por tipo */}
                      {rule.type === "station_completed" && (
                        <div className="grid grid-cols-[1fr_1fr_auto_72px] gap-2 items-end">
                          <div>
                            <Label className="text-[10px]">Área</Label>
                            <select value={rule.area ?? ""} className={SEL_CLS}
                              onChange={(e) => update({ ...rule, area: e.target.value || undefined })}>
                              <option value="">Qualquer</option>
                              {MISSION_AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
                            </select>
                          </div>
                          <div>
                            <Label className="text-[10px]">Papel</Label>
                            <select value={rule.role ?? ""} className={SEL_CLS}
                              onChange={(e) => update({ ...rule, role: (e.target.value as "medico" | "paciente") || undefined })}>
                              <option value="">Qualquer</option>
                              <option value="medico">Médico</option>
                              <option value="paciente">Paciente</option>
                            </select>
                          </div>
                          <div className="flex flex-col items-center gap-1">
                            <Label className="text-[10px]">Multi</Label>
                            <input type="checkbox" checked={rule.multiplayer ?? false} className="rounded mt-1"
                              onChange={(e) => update({ ...rule, multiplayer: e.target.checked || undefined })} />
                          </div>
                          <div>
                            <Label className="text-[10px]">Qtd.</Label>
                            <Input type="number" min={1} value={rule.count} className="mt-1 h-8 text-xs"
                              onChange={(e) => update({ ...rule, count: Math.max(1, Number(e.target.value)) })} />
                          </div>
                        </div>
                      )}

                      {rule.type === "session_count" && (
                        <div className="grid grid-cols-2 gap-2 items-end">
                          <div>
                            <Label className="text-[10px]">Área</Label>
                            <select value={rule.area ?? ""} className={SEL_CLS}
                              onChange={(e) => update({ ...rule, area: e.target.value || undefined })}>
                              <option value="">Qualquer</option>
                              {MISSION_AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
                            </select>
                          </div>
                          <div>
                            <Label className="text-[10px]">Qtd. sessões</Label>
                            <Input type="number" min={1} value={rule.count} className="mt-1 h-8 text-xs"
                              onChange={(e) => update({ ...rule, count: Math.max(1, Number(e.target.value)) })} />
                          </div>
                        </div>
                      )}

                      {rule.type === "login_streak" && (
                        <div className="w-1/2">
                          <Label className="text-[10px]">Dias consecutivos</Label>
                          <Input type="number" min={1} value={rule.days} className="mt-1 h-8 text-xs"
                            onChange={(e) => update({ ...rule, days: Math.max(1, Number(e.target.value)) })} />
                        </div>
                      )}

                      {rule.type === "average_score" && (
                        <div className="grid grid-cols-3 gap-2 items-end">
                          <div>
                            <Label className="text-[10px]">Área</Label>
                            <select value={rule.area ?? ""} className={SEL_CLS}
                              onChange={(e) => update({ ...rule, area: e.target.value || undefined })}>
                              <option value="">Qualquer</option>
                              {MISSION_AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
                            </select>
                          </div>
                          <div>
                            <Label className="text-[10px]">Nota mín. (0–10)</Label>
                            <Input type="number" min={0} max={10} step={0.5} value={rule.minimum} className="mt-1 h-8 text-xs"
                              onChange={(e) => update({ ...rule, minimum: Math.min(10, Math.max(0, Number(e.target.value))) })} />
                          </div>
                          <div>
                            <Label className="text-[10px]">Qtd. sessões</Label>
                            <Input type="number" min={1} value={rule.count} className="mt-1 h-8 text-xs"
                              onChange={(e) => update({ ...rule, count: Math.max(1, Number(e.target.value)) })} />
                          </div>
                        </div>
                      )}

                      {rule.type === "min_score" && (
                        <div className="grid grid-cols-2 gap-2 items-end">
                          <div>
                            <Label className="text-[10px]">Nota mín. (0–10)</Label>
                            <Input type="number" min={0} max={10} step={0.5} value={rule.minimum} className="mt-1 h-8 text-xs"
                              onChange={(e) => update({ ...rule, minimum: Math.min(10, Math.max(0, Number(e.target.value))) })} />
                          </div>
                          <div>
                            <Label className="text-[10px]">Qtd. sessões</Label>
                            <Input type="number" min={1} value={rule.count} className="mt-1 h-8 text-xs"
                              onChange={(e) => update({ ...rule, count: Math.max(1, Number(e.target.value)) })} />
                          </div>
                        </div>
                      )}

                      {rule.type === "multiplayer_count" && (
                        <div className="w-1/2">
                          <Label className="text-[10px]">Qtd. sessões multiplayer</Label>
                          <Input type="number" min={1} value={rule.count} className="mt-1 h-8 text-xs"
                            onChange={(e) => update({ ...rule, count: Math.max(1, Number(e.target.value)) })} />
                        </div>
                      )}

                      {rule.type === "time_spent_minutes" && (
                        <div className="grid grid-cols-2 gap-2 items-end">
                          <div>
                            <Label className="text-[10px]">Área</Label>
                            <select value={rule.area ?? ""} className={SEL_CLS}
                              onChange={(e) => update({ ...rule, area: e.target.value || undefined })}>
                              <option value="">Qualquer</option>
                              {MISSION_AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
                            </select>
                          </div>
                          <div>
                            <Label className="text-[10px]">Minutos totais</Label>
                            <Input type="number" min={1} value={rule.minutes} className="mt-1 h-8 text-xs"
                              onChange={(e) => update({ ...rule, minutes: Math.max(1, Number(e.target.value)) })} />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Salvando…" : editing ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!confirmId} onOpenChange={(o) => !o && setConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover missão?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é permanente. Usuários que já completaram a missão não perdem o XP concedido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => confirmId && handleDelete(confirmId)}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// NÍVEIS TAB
// ═══════════════════════════════════════════════════════════════════════════════

function NiveisTab() {
  const [levels, setLevels]       = useState<DbLevel[]>([]);
  const [loading, setLoading]     = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLevel, setEditingLevel] = useState<DbLevel | null>(null);
  const [form, setForm] = useState({ level: 1, xp_required: 0, reward_type: "title", reward_value: "" });
  const [saving, setSaving]       = useState(false);
  const [confirmLevel, setConfirmLevel] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setLevels(await fetchLevels()); }
    catch { toast.error("Erro ao carregar níveis"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openEdit = (l: DbLevel) => {
    setEditingLevel(l);
    setForm({ level: l.level, xp_required: l.xp_required, reward_type: l.reward_type, reward_value: l.reward_value ?? "" });
    setDialogOpen(true);
  };

  const openCreate = () => {
    const maxLevel = levels.length > 0 ? Math.max(...levels.map((l) => l.level)) : 0;
    setEditingLevel(null);
    setForm({ level: maxLevel + 1, xp_required: 0, reward_type: "title", reward_value: "" });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await upsertLevel({
        level: Number(form.level),
        xp_required: Number(form.xp_required),
        reward_type: form.reward_type as DbLevel["reward_type"],
        reward_value: form.reward_value || null,
        title_id: null,
      });
      toast.success(editingLevel ? "Nível atualizado" : "Nível criado");
      setDialogOpen(false);
      await load();
    } catch { toast.error("Erro ao salvar nível"); }
    finally { setSaving(false); }
  };

  const handleDelete = async (level: number) => {
    try {
      await deleteLevel(level);
      toast.success("Nível removido");
      setConfirmLevel(null);
      await load();
    } catch { toast.error("Erro ao remover nível"); }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground font-medium">
          {levels.length} níveis definidos · nível {levels.length + 1}+ usa fórmula +900 XP/nível
        </div>
        <Button size="sm" className="gap-2" onClick={openCreate}>
          <Plus className="w-4 h-4" /> Novo nível
        </Button>
      </div>

      {loading ? (
        <div className="text-center text-sm text-muted-foreground py-10">Carregando…</div>
      ) : (
        <Card className="rounded-2xl border-border/60 overflow-hidden divide-y divide-border/60">
          <div className="grid grid-cols-[48px_1fr_1fr_1fr_80px] px-4 py-2 text-[10px] uppercase tracking-widest font-bold text-muted-foreground bg-muted/40">
            <span>Nível</span>
            <span>XP acum.</span>
            <span>Recompensa</span>
            <span>Valor</span>
            <span className="text-right">Ações</span>
          </div>
          {levels.map((l) => (
            <div key={l.level}
              className="grid grid-cols-[48px_1fr_1fr_1fr_80px] px-4 py-3 text-sm items-center hover:bg-muted/30 transition-colors">
              <span className="font-bold tabular-nums">{l.level}</span>
              <span className="tabular-nums font-medium">{l.xp_required.toLocaleString("pt-BR")} XP</span>
              <span className="text-muted-foreground text-xs">{l.reward_type}</span>
              <span className="text-xs truncate">{l.reward_value ?? "—"}</span>
              <div className="flex justify-end gap-1">
                <button onClick={() => openEdit(l)}
                  className="p-1 rounded hover:bg-muted transition-colors">
                  <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
                <button onClick={() => setConfirmLevel(l.level)}
                  className="p-1 rounded hover:bg-destructive/10 transition-colors">
                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                </button>
              </div>
            </div>
          ))}
        </Card>
      )}

      <Card className="rounded-2xl p-4 border-border/60 bg-muted/30">
        <p className="text-xs text-muted-foreground leading-relaxed">
          <b>Nota:</b> Alterações na curva de XP afetam somente novos cálculos de nível no frontend.
          O trigger DB <code className="text-[10px] bg-muted px-1 rounded">update_xp_nivel_on_session</code> usa
          os thresholds hardcoded — atualize-o separadamente se necessário para manter consistência.
          Os níveis existentes dos usuários (<code className="text-[10px] bg-muted px-1 rounded">profiles.nivel</code>) não são alterados automaticamente.
        </p>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingLevel ? `Editar Nível ${editingLevel.level}` : "Novo nível"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 mt-2">
            <div>
              <Label className="text-xs">Número do nível</Label>
              <Input type="number" min={1} value={form.level}
                onChange={(e) => setForm({ ...form, level: Number(e.target.value) })}
                className="mt-1" disabled={!!editingLevel} />
            </div>
            <div>
              <Label className="text-xs">XP total acumulado</Label>
              <Input type="number" min={0} value={form.xp_required}
                onChange={(e) => setForm({ ...form, xp_required: Number(e.target.value) })}
                className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Tipo de recompensa</Label>
              <select value={form.reward_type}
                onChange={(e) => setForm({ ...form, reward_type: e.target.value })}
                className="mt-1 w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="title">Título</option>
                <option value="xp_bonus">Bônus XP</option>
                <option value="badge">Badge</option>
                <option value="none">Nenhum</option>
              </select>
            </div>
            <div>
              <Label className="text-xs">Valor (ex.: nome do título)</Label>
              <Input value={form.reward_value}
                onChange={(e) => setForm({ ...form, reward_value: e.target.value })}
                placeholder="Lenda" className="mt-1" />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Salvando…" : editingLevel ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmLevel !== null} onOpenChange={(o) => !o && setConfirmLevel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover nível {confirmLevel}?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não afeta os níveis atuais dos usuários na base de dados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => confirmLevel !== null && handleDelete(confirmLevel)}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TÍTULOS TAB
// ═══════════════════════════════════════════════════════════════════════════════

const BLANK_TITLE: TitleInput = {
  name: "", description: "", rarity: "common",
  color: "#6366f1", icon: null, unlock_level: null,
  event_id: null, is_active: true, conditions: null,
};

function TitulosTab() {
  const [titles, setTitles]       = useState<DbTitle[]>([]);
  const [loading, setLoading]     = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing]     = useState<DbTitle | null>(null);
  const [form, setForm]           = useState<TitleInput>(BLANK_TITLE);
  const [conditionRules, setConditionRules] = useState<MissionRule[]>([]);
  const [saving, setSaving]       = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const [grantDialog, setGrantDialog] = useState(false);
  const [grantTitleId, setGrantTitleId] = useState<string>("");
  const [grantUserId, setGrantUserId]   = useState("");
  const [granting, setGranting]         = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setTitles(await fetchTitles()); }
    catch { toast.error("Erro ao carregar títulos"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(BLANK_TITLE);
    setConditionRules([]);
    setDialogOpen(true);
  };
  const openEdit = (t: DbTitle) => {
    setEditing(t);
    setForm({ ...t });
    setConditionRules(t.conditions?.rules ?? []);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name) { toast.error("Nome é obrigatório"); return; }
    setSaving(true);
    const payload: TitleInput = {
      ...form,
      conditions: conditionRules.length > 0 ? { rules: conditionRules } : null,
    };
    try {
      if (editing) {
        await updateTitle(editing.id, payload);
        toast.success("Título atualizado");
      } else {
        await createTitle(payload);
        toast.success("Título criado");
      }
      setDialogOpen(false);
      await load();
    } catch { toast.error("Erro ao salvar título"); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteTitle(id);
      toast.success("Título removido");
      setConfirmId(null);
      await load();
    } catch { toast.error("Erro ao remover título"); }
  };

  const handleGrant = async () => {
    if (!grantUserId.trim() || !grantTitleId) { toast.error("Informe o UUID do usuário"); return; }
    setGranting(true);
    try {
      const { grantTitleToUser } = await import("@/lib/titleService");
      await grantTitleToUser(grantUserId.trim(), grantTitleId);
      toast.success("Título concedido com sucesso");
      setGrantDialog(false);
      setGrantUserId("");
    } catch { toast.error("Erro ao conceder título"); }
    finally { setGranting(false); }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground font-medium">
          {titles.length} títulos cadastrados
        </div>
        <Button size="sm" className="gap-2" onClick={openCreate}>
          <Plus className="w-4 h-4" /> Novo título
        </Button>
      </div>

      {loading ? (
        <div className="text-center text-sm text-muted-foreground py-10">Carregando…</div>
      ) : titles.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground rounded-2xl">
          Nenhum título cadastrado ainda.
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {titles.map((t) => (
            <Card key={t.id} className={cn("p-4 rounded-2xl border-border/60 flex items-start gap-3", !t.is_active && "opacity-60")}>
              <div
                className="w-8 h-8 rounded-lg shrink-0 border border-white/20"
                style={{ backgroundColor: t.color }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-0.5">
                  <span className="font-semibold text-sm">{t.name}</span>
                  <SmallBadge cls={RARITY_BADGE[t.rarity] ?? ""} label={t.rarity} />
                  {t.unlock_level && (
                    <span className="text-[10px] text-muted-foreground font-medium">
                      nível {t.unlock_level}
                    </span>
                  )}
                  {t.conditions && t.conditions.rules.length > 0 && (
                    <span className="text-[10px] text-violet-600 dark:text-violet-400 font-medium">
                      <Target className="inline w-2.5 h-2.5 mr-0.5" />
                      {t.conditions.rules.length} regra{t.conditions.rules.length !== 1 ? "s" : ""}
                    </span>
                  )}
                  {!t.is_active && (
                    <SmallBadge cls="bg-gray-100 text-gray-500 dark:bg-gray-800" label="inativo" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground line-clamp-1">{t.description}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => { setGrantTitleId(t.id); setGrantDialog(true); }}
                  className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                  title="Conceder a usuário"
                >
                  <Star className="w-4 h-4 text-amber-500" />
                </button>
                <button onClick={() => openEdit(t)}
                  className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                  <Pencil className="w-4 h-4 text-muted-foreground" />
                </button>
                <button onClick={() => setConfirmId(t.id)}
                  className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors">
                  <Trash2 className="w-4 h-4 text-destructive" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar título" : "Novo título"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 mt-2">
            <div className="col-span-2">
              <Label className="text-xs">Nome</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Lenda" className="mt-1" />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Descrição</Label>
              <Textarea value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Título do nível 10" rows={2} className="mt-1 resize-none" />
            </div>
            <div>
              <Label className="text-xs">Raridade</Label>
              <select value={form.rarity}
                onChange={(e) => setForm({ ...form, rarity: e.target.value as TitleRarity })}
                className="mt-1 w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                {TITLE_RARITIES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs">Cor</Label>
              <div className="mt-1 flex gap-2 items-center">
                <input type="color" value={form.color}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
                  className="h-9 w-14 rounded cursor-pointer border border-input" />
                <Input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })}
                  placeholder="#6366f1" className="flex-1" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Nível de desbloqueio</Label>
              <Input type="number" min={1}
                value={form.unlock_level ?? ""}
                onChange={(e) => setForm({ ...form, unlock_level: e.target.value ? Number(e.target.value) : null })}
                placeholder="Opcional" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Ícone (emoji ou nome)</Label>
              <Input value={form.icon ?? ""}
                onChange={(e) => setForm({ ...form, icon: e.target.value || null })}
                placeholder="⭐ ou star" className="mt-1" />
            </div>
            <div className="col-span-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  className="rounded" />
                Ativo
              </label>
            </div>
          </div>
          <ConditionsEditor
            rules={conditionRules}
            onChange={setConditionRules}
            emptyHint="Sem condições automáticas — concedido manualmente ou por nível."
          />
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Salvando…" : editing ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Grant title dialog */}
      <Dialog open={grantDialog} onOpenChange={(o) => { if (!o) { setGrantDialog(false); setGrantUserId(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conceder título a usuário</DialogTitle>
          </DialogHeader>
          <div className="mt-2 space-y-3">
            <div>
              <Label className="text-xs">UUID do usuário (profiles.id)</Label>
              <Input value={grantUserId}
                onChange={(e) => setGrantUserId(e.target.value)}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                className="mt-1 font-mono text-xs" />
            </div>
            <p className="text-xs text-muted-foreground">
              Você pode obter o UUID em <b>Gerenciar usuários → Admin</b>.
            </p>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setGrantDialog(false)}>Cancelar</Button>
            <Button onClick={handleGrant} disabled={granting || !grantUserId.trim()}>
              {granting ? "Concedendo…" : "Conceder"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!confirmId} onOpenChange={(o) => !o && setConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover título?</AlertDialogTitle>
            <AlertDialogDescription>
              Títulos já concedidos a usuários também serão removidos da tabela user_titles.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => confirmId && handleDelete(confirmId)}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// EVENTOS TAB
// ═══════════════════════════════════════════════════════════════════════════════

// ── Helpers de status e formulário de recompensa (FASE 1F) ───────────────────

function getEventStatus(e: DbEvent): { label: string; cls: string } {
  const now = new Date();
  if (!e.is_active) return { label: "Inativo", cls: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300" };
  if (e.starts_at && new Date(e.starts_at) > now) return { label: "Agendado", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" };
  if (e.ends_at   && new Date(e.ends_at)   < now) return { label: "Encerrado", cls: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300" };
  return { label: "Ativo", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" };
}

type RewardFormState = { type: EventRewardType; value: string; titleId: string };
const BLANK_REWARD_FORM: RewardFormState = { type: "xp", value: "", titleId: "" };
const REWARD_TYPE_LABEL_ADMIN: Record<EventRewardType, string> = {
  xp: "XP", title: "Título", badge: "Badge",
};

// ── EventManageDialog — missões e recompensas de um evento ────────────────────

function EventManageDialog({
  event,
  onClose,
  onRefresh,
}: {
  event:     DbEvent | null;
  onClose:   () => void;
  onRefresh: () => void;
}) {
  const [linkedMissions,    setLinkedMissions]   = useState<EventMissionRow[]>([]);
  const [allMissions,       setAllMissions]      = useState<import("@/lib/missionService").DbMission[]>([]);
  const [allTitles,         setAllTitles]        = useState<DbTitle[]>([]);
  const [rewards,           setRewards]          = useState<EventRewardWithTitle[]>([]);
  const [loadingData,       setLoadingData]      = useState(false);

  const [selectedMissionId, setSelectedMissionId] = useState("");
  const [linkingMission,    setLinkingMission]    = useState(false);
  const [unlinkingId,       setUnlinkingId]       = useState<string | null>(null);

  const [rewardDialog,      setRewardDialog]      = useState(false);
  const [editingRw,         setEditingRw]         = useState<EventRewardWithTitle | null>(null);
  const [rewardForm,        setRewardForm]        = useState<RewardFormState>(BLANK_REWARD_FORM);
  const [savingRw,          setSavingRw]          = useState(false);
  const [deletingRwId,      setDeletingRwId]      = useState<string | null>(null);
  const [deleteRwConfirm,   setDeleteRwConfirm]   = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    if (!event) return;
    setLoadingData(true);
    try {
      const [ms, em, rw, tl] = await Promise.all([
        fetchMissions(),
        fetchEventMissions(event.id),
        fetchEventRewards(event.id),
        fetchTitles(),
      ]);
      setAllMissions(ms);
      setLinkedMissions(em);
      setRewards(rw);
      setAllTitles(tl);
    } catch {
      toast.error("Erro ao carregar dados do evento");
    } finally {
      setLoadingData(false);
    }
  }, [event]);

  useEffect(() => { if (event) loadAll(); }, [event, loadAll]);

  // ── Missões ──────────────────────────────────────────────────────────────────

  const linkedIds       = new Set(linkedMissions.map((m) => m.mission_id));
  const availableMissions = allMissions.filter((m) => !linkedIds.has(m.id));

  const handleLinkMission = async () => {
    if (!event || !selectedMissionId) return;
    setLinkingMission(true);
    try {
      await linkMissionToEvent(event.id, selectedMissionId);
      setSelectedMissionId("");
      await loadAll();
      onRefresh();
    } catch { toast.error("Erro ao vincular missão"); }
    finally   { setLinkingMission(false); }
  };

  const handleUnlinkMission = async (missionId: string) => {
    if (!event) return;
    setUnlinkingId(missionId);
    try {
      await unlinkMissionFromEvent(event.id, missionId);
      await loadAll();
      onRefresh();
    } catch { toast.error("Erro ao desvincular missão"); }
    finally   { setUnlinkingId(null); }
  };

  // ── Recompensas ──────────────────────────────────────────────────────────────

  const openAddReward  = () => { setEditingRw(null); setRewardForm(BLANK_REWARD_FORM); setRewardDialog(true); };
  const openEditReward = (rw: EventRewardWithTitle) => {
    setEditingRw(rw);
    setRewardForm({ type: rw.reward_type, value: rw.reward_type === "xp" ? rw.reward_value : "", titleId: rw.title_id ?? "" });
    setRewardDialog(true);
  };

  const handleSaveReward = async () => {
    if (!event) return;
    if (rewardForm.type === "xp"    && (!rewardForm.value || Number(rewardForm.value) <= 0)) { toast.error("Informe um valor de XP válido"); return; }
    if (rewardForm.type === "title" && !rewardForm.titleId)                                  { toast.error("Selecione um título");           return; }
    if (rewardForm.type === "badge" && !rewardForm.value)                                    { toast.error("Informe o nome do badge");         return; }

    const titleObj = allTitles.find((t) => t.id === rewardForm.titleId);
    const input: EventRewardInput = {
      event_id:     event.id,
      reward_type:  rewardForm.type,
      reward_value: rewardForm.type === "title" ? (titleObj?.name ?? rewardForm.titleId) : rewardForm.value,
      title_id:     rewardForm.type === "title" ? (rewardForm.titleId || null) : null,
    };

    setSavingRw(true);
    try {
      if (editingRw) {
        await updateEventReward(editingRw.id, { reward_type: input.reward_type, reward_value: input.reward_value, title_id: input.title_id });
        toast.success("Recompensa atualizada");
      } else {
        await createEventReward(input);
        toast.success("Recompensa adicionada");
      }
      setRewardDialog(false);
      await loadAll();
      onRefresh();
    } catch { toast.error("Erro ao salvar recompensa"); }
    finally   { setSavingRw(false); }
  };

  const handleDeleteReward = async (id: string) => {
    setDeletingRwId(id);
    try {
      await deleteEventReward(id);
      toast.success("Recompensa removida");
      setDeleteRwConfirm(null);
      await loadAll();
      onRefresh();
    } catch { toast.error("Erro ao remover recompensa"); }
    finally   { setDeletingRwId(null); }
  };

  if (!event) return null;

  return (
    <>
      {/* Dialog principal */}
      <Dialog open={!!event} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Settings2 className="w-4 h-4 text-muted-foreground" />
              {event.name}
            </DialogTitle>
          </DialogHeader>

          {loadingData ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="flex flex-col gap-5 mt-1 max-h-[60vh] overflow-y-auto pr-1">

              {/* ── Missões ────────────────────────────────────────── */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Target className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs font-bold uppercase tracking-wider">Missões vinculadas</span>
                  <Badge variant="secondary" className="text-[10px]">{linkedMissions.length}</Badge>
                </div>

                {linkedMissions.length > 0 ? (
                  <div className="flex flex-col gap-1.5 mb-2">
                    {linkedMissions.map((em) => (
                      <div key={em.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-muted/40 border border-border/40">
                        <div className="flex-1 min-w-0 flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-medium truncate">{em.mission?.name ?? em.mission_id}</span>
                          {em.mission?.type && <SmallBadge cls={TYPE_BADGE[em.mission.type] ?? ""} label={em.mission.type} />}
                        </div>
                        <button
                          onClick={() => handleUnlinkMission(em.mission_id)}
                          disabled={unlinkingId !== null}
                          className="p-1 rounded-md hover:bg-destructive/10 text-destructive transition-colors shrink-0"
                          title="Desvincular"
                        >
                          {unlinkingId === em.mission_id
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <X className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground mb-2">Nenhuma missão vinculada.</p>
                )}

                <div className="flex gap-2">
                  <select
                    value={selectedMissionId}
                    onChange={(e) => setSelectedMissionId(e.target.value)}
                    disabled={availableMissions.length === 0 || linkingMission}
                    className={cn(SEL_CLS, "flex-1 mt-0")}
                  >
                    <option value="">
                      {availableMissions.length === 0 ? "Todas as missões já vinculadas" : "Adicionar missão…"}
                    </option>
                    {availableMissions.map((m) => (
                      <option key={m.id} value={m.id}>{m.name} ({m.type})</option>
                    ))}
                  </select>
                  <Button
                    size="sm" className="shrink-0 h-8 px-3"
                    disabled={!selectedMissionId || linkingMission}
                    onClick={handleLinkMission}
                  >
                    {linkingMission ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  </Button>
                </div>
              </div>

              <div className="border-t border-border/40" />

              {/* ── Recompensas ────────────────────────────────────── */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs font-bold uppercase tracking-wider">Recompensas</span>
                  <Badge variant="secondary" className="text-[10px]">{rewards.length}</Badge>
                  <Button size="sm" variant="outline" className="ml-auto h-7 gap-1 text-xs" onClick={openAddReward}>
                    <Plus className="w-3 h-3" /> Adicionar
                  </Button>
                </div>

                {rewards.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground">Nenhuma recompensa configurada.</p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {rewards.map((rw) => (
                      <div key={rw.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-muted/40 border border-border/40">
                        {rw.reward_type === "xp"
                          ? <Zap    className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          : rw.reward_type === "title"
                            ? <Trophy className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                            : <Star   className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <span className="text-xs font-medium">
                            {rw.reward_type === "xp" ? `+${rw.reward_value} XP` : rw.reward_value}
                          </span>
                          <span className="ml-1.5 text-[10px] text-muted-foreground">
                            {REWARD_TYPE_LABEL_ADMIN[rw.reward_type] ?? rw.reward_type}
                          </span>
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0">
                          <button onClick={() => openEditReward(rw)}
                            className="p-1 rounded-md hover:bg-muted transition-colors" title="Editar">
                            <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                          </button>
                          <button onClick={() => setDeleteRwConfirm(rw.id)}
                            disabled={deletingRwId === rw.id}
                            className="p-1 rounded-md hover:bg-destructive/10 transition-colors" title="Remover">
                            {deletingRwId === rw.id
                              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              : <Trash2  className="w-3.5 h-3.5 text-destructive" />}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={onClose}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sub-dialog: formulário de recompensa */}
      <Dialog open={rewardDialog} onOpenChange={(o) => !o && setRewardDialog(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingRw ? "Editar recompensa" : "Nova recompensa"}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 mt-2">
            <div>
              <Label className="text-xs">Tipo</Label>
              <select
                value={rewardForm.type}
                onChange={(e) => setRewardForm({ ...BLANK_REWARD_FORM, type: e.target.value as EventRewardType })}
                className={cn(SEL_CLS, "mt-1")}
              >
                <option value="xp">XP</option>
                <option value="title">Título</option>
                <option value="badge">Badge</option>
              </select>
            </div>

            {rewardForm.type === "xp" && (
              <div>
                <Label className="text-xs">Quantidade de XP</Label>
                <Input type="number" min={1}
                  value={rewardForm.value}
                  onChange={(e) => setRewardForm({ ...rewardForm, value: e.target.value })}
                  placeholder="500" className="mt-1" />
              </div>
            )}

            {rewardForm.type === "title" && (
              <div>
                <Label className="text-xs">Título</Label>
                <select
                  value={rewardForm.titleId}
                  onChange={(e) => setRewardForm({ ...rewardForm, titleId: e.target.value })}
                  className={cn(SEL_CLS, "mt-1")}
                >
                  <option value="">Selecione um título…</option>
                  {allTitles.map((t) => (
                    <option key={t.id} value={t.id}>{t.name} ({t.rarity})</option>
                  ))}
                </select>
              </div>
            )}

            {rewardForm.type === "badge" && (
              <div>
                <Label className="text-xs">Nome do badge</Label>
                <Input
                  value={rewardForm.value}
                  onChange={(e) => setRewardForm({ ...rewardForm, value: e.target.value })}
                  placeholder="Badge especial" className="mt-1" />
              </div>
            )}
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setRewardDialog(false)}>Cancelar</Button>
            <Button onClick={handleSaveReward} disabled={savingRw}>
              {savingRw ? "Salvando…" : editingRw ? "Salvar" : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sub-dialog: confirmação de remoção de recompensa */}
      <AlertDialog open={!!deleteRwConfirm} onOpenChange={(o) => !o && setDeleteRwConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover recompensa?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Usuários que já resgataram não serão afetados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteRwConfirm && handleDeleteReward(deleteRwConfirm)}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

const BLANK_EVENT: EventInput = {
  name: "", description: "", banner_url: null,
  type: "evento", is_active: false, starts_at: null, ends_at: null,
};

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  try { return new Date(iso).toISOString().slice(0, 16); } catch { return ""; }
}

function EventosTab() {
  const [events, setEvents]         = useState<DbEvent[]>([]);
  const [countsMap, setCountsMap]   = useState<Map<string, { missions: number; rewards: number }>>(new Map());
  const [loading, setLoading]       = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing]       = useState<DbEvent | null>(null);
  const [form, setForm]             = useState<EventInput>(BLANK_EVENT);
  const [saving, setSaving]         = useState(false);
  const [confirmId, setConfirmId]   = useState<string | null>(null);
  const [managingEvent, setManagingEvent] = useState<DbEvent | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [evs, counts] = await Promise.all([fetchEvents(), fetchEventCountsForAll()]);
      setEvents(evs);
      setCountsMap(counts);
    } catch { toast.error("Erro ao carregar eventos"); }
    finally   { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); setForm(BLANK_EVENT); setDialogOpen(true); };
  const openEdit   = (e: DbEvent) => {
    setEditing(e);
    setForm({ ...e });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name) { toast.error("Nome é obrigatório"); return; }
    if (form.starts_at && form.ends_at && new Date(form.ends_at) <= new Date(form.starts_at)) {
      toast.error("A data de fim deve ser posterior ao início");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateEvent(editing.id, form);
        toast.success("Evento atualizado");
      } else {
        await createEvent(form);
        toast.success("Evento criado");
      }
      setDialogOpen(false);
      await load();
    } catch { toast.error("Erro ao salvar evento"); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteEvent(id);
      toast.success("Evento removido");
      setConfirmId(null);
      await load();
    } catch { toast.error("Erro ao remover evento"); }
  };

  const handleToggle = async (e: DbEvent) => {
    try {
      await toggleEventActive(e.id, !e.is_active);
      setEvents((prev) => prev.map((x) => x.id === e.id ? { ...x, is_active: !e.is_active } : x));
    } catch { toast.error("Erro ao alterar status"); }
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return "—";
    try { return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso)); }
    catch { return iso; }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground font-medium">
          {events.length} {events.length === 1 ? "evento" : "eventos"} cadastrados
        </div>
        <Button size="sm" className="gap-2" onClick={openCreate}>
          <Plus className="w-4 h-4" /> Novo evento
        </Button>
      </div>

      <Card className="rounded-2xl p-4 border-border/60 bg-amber-50/50 dark:bg-amber-900/10 border-amber-200/60 dark:border-amber-700/30">
        <div className="flex items-start gap-2">
          <Target className="w-4 h-4 mt-0.5 text-amber-600 dark:text-amber-400 shrink-0" />
          <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
            <b>Fundação estrutural.</b> Esta versão permite criar e gerenciar eventos. Battle pass, temporadas e cosméticos serão implementados em versões futuras.
          </p>
        </div>
      </Card>

      {loading ? (
        <div className="text-center text-sm text-muted-foreground py-10">Carregando…</div>
      ) : events.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground rounded-2xl">
          Nenhum evento cadastrado ainda.
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {events.map((e) => {
            const counts = countsMap.get(e.id) ?? { missions: 0, rewards: 0 };
            const status = getEventStatus(e);
            return (
              <Card key={e.id} className={cn("p-4 rounded-2xl border-border/60 flex items-start gap-3", !e.is_active && "opacity-70")}>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="font-semibold text-sm">{e.name}</span>
                    <SmallBadge cls={TYPE_BADGE[e.type] ?? ""} label={e.type} />
                    <SmallBadge cls={status.cls} label={status.label} />
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-1">{e.description}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
                    <span>{formatDate(e.starts_at)} → {formatDate(e.ends_at)}</span>
                    <span className="flex items-center gap-1">
                      <Target className="w-3 h-3" />{counts.missions} missões
                    </span>
                    <span className="flex items-center gap-1">
                      <Zap className="w-3 h-3" />{counts.rewards} recomp.
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => handleToggle(e)}
                    className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                    title={e.is_active ? "Desativar" : "Ativar"}>
                    {e.is_active
                      ? <ToggleRight className="w-5 h-5 text-emerald-500" />
                      : <ToggleLeft  className="w-5 h-5 text-muted-foreground" />}
                  </button>
                  <button onClick={() => setManagingEvent(e)}
                    className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                    title="Gerenciar missões e recompensas">
                    <Settings2 className="w-4 h-4 text-muted-foreground" />
                  </button>
                  <button onClick={() => openEdit(e)}
                    className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                    <Pencil className="w-4 h-4 text-muted-foreground" />
                  </button>
                  <button onClick={() => setConfirmId(e.id)}
                    className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors">
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar evento" : "Novo evento"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 mt-2">
            <div className="col-span-2">
              <Label className="text-xs">Nome</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Semana Intensa" className="mt-1" />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Descrição</Label>
              <Textarea value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2} className="mt-1 resize-none" />
            </div>
            <div>
              <Label className="text-xs">Tipo</Label>
              <select value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as EventType })}
                className="mt-1 w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="evento">Evento</option>
                <option value="especial">Especial</option>
                <option value="sazonal">Sazonal</option>
              </select>
            </div>
            <div>
              <Label className="text-xs">Banner URL (opcional)</Label>
              <Input value={form.banner_url ?? ""}
                onChange={(e) => setForm({ ...form, banner_url: e.target.value || null })}
                placeholder="https://…" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Início</Label>
              <Input type="datetime-local"
                value={toLocalInput(form.starts_at)}
                onChange={(e) => setForm({ ...form, starts_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
                className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Fim</Label>
              <Input type="datetime-local"
                value={toLocalInput(form.ends_at)}
                onChange={(e) => setForm({ ...form, ends_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
                className="mt-1" />
            </div>
            <div className="col-span-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  className="rounded" />
                Ativo
              </label>
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Salvando…" : editing ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmId} onOpenChange={(o) => !o && setConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover evento?</AlertDialogTitle>
            <AlertDialogDescription>
              Missões e recompensas vinculadas a este evento também serão removidas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => confirmId && handleDelete(confirmId)}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <EventManageDialog
        event={managingEvent}
        onClose={() => setManagingEvent(null)}
        onRefresh={load}
      />
    </div>
  );
}
