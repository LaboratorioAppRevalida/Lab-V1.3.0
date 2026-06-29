import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  ChevronLeft,
  Search,
  Loader2,
  Gem,
  CalendarDays,
  CreditCard,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  Minus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  fetchUsersWithSubscriptions,
  adminUpsertSubscription,
  adminRemoveSubscription,
  type UserWithSubscription,
  type SubscriptionUpsert,
} from "@/lib/adminSubscriptionService";
import type { SubscriptionStatus, PaymentMethod } from "@/lib/subscriptionService";
import { formatInitials } from "@/lib/format";
import { resolveImage } from "@/lib/storageService";

// ── Constants ──────────────────────────────────────────────────────────────

const PLANS = ["Mensal", "Semestral", "Anual", "Passaporte"] as const;

const STATUS_OPTIONS: { value: SubscriptionStatus; label: string }[] = [
  { value: "ativo",     label: "Ativo"     },
  { value: "pendente",  label: "Pendente"  },
  { value: "expirado",  label: "Expirado"  },
  { value: "cancelado", label: "Cancelado" },
];

const PAYMENT_OPTIONS: { value: string; label: string }[] = [
  { value: "cartao", label: "Cartão de Crédito" },
  { value: "pix",    label: "Pix"               },
  { value: "boleto", label: "Boleto"             },
  { value: "none",   label: "Não informado"      },
];

// ── Status badge config ────────────────────────────────────────────────────

const STATUS_BADGE: Record<
  string,
  { label: string; icon: typeof CheckCircle2; className: string }
> = {
  ativo:     { label: "Ativo",     icon: CheckCircle2, className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  pendente:  { label: "Pendente",  icon: Clock,        className: "bg-yellow-500/15  text-yellow-400  border-yellow-500/30"  },
  expirado:  { label: "Expirado",  icon: XCircle,      className: "bg-red-500/15     text-red-400     border-red-500/30"     },
  cancelado: { label: "Cancelado", icon: AlertCircle,  className: "bg-slate-500/15   text-slate-400   border-slate-500/30"   },
};

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
}

function toDateInputValue(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function AdminAssinaturas() {
  const [, setLocation] = useLocation();
  const [users, setUsers]       = useState<UserWithSubscription[]>([]);
  const [loading, setLoading]   = useState(true);
  const [query, setQuery]       = useState("");
  const [selected, setSelected] = useState<UserWithSubscription | null>(null);
  const [saving, setSaving]     = useState(false);
  const [removing, setRemoving] = useState(false);

  // edit form
  const [editPlan,   setEditPlan]   = useState("");
  const [editStatus, setEditStatus] = useState<SubscriptionStatus>("ativo");
  const [editMethod, setEditMethod] = useState<PaymentMethod>(null);
  const [editLast4,  setEditLast4]  = useState("");
  const [editExpiry, setEditExpiry] = useState("");

  // ── Load ──
  useEffect(() => {
    setLoading(true);
    fetchUsersWithSubscriptions()
      .then(setUsers)
      .catch((e: unknown) => {
        toast.error("Erro ao carregar usuários");
        console.error(e);
      })
      .finally(() => setLoading(false));
  }, []);

  // ── Filtered list ──
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.display_name?.toLowerCase().includes(q) ?? false),
    );
  }, [users, query]);

  // ── Summary stats ──
  const stats = useMemo(
    () => ({
      total:    users.length,
      ativos:   users.filter((u) => u.status === "ativo").length,
      sem:      users.filter((u) => !u.sub_id).length,
      expiring: users.filter((u) => {
        if (!u.expires_at || u.status !== "ativo") return false;
        const d = Math.ceil(
          (new Date(u.expires_at).getTime() - Date.now()) / 86_400_000,
        );
        return d >= 0 && d <= 7;
      }).length,
    }),
    [users],
  );

  // ── Open sheet ──
  function openEdit(u: UserWithSubscription) {
    setSelected(u);
    setEditPlan(u.plan_name ?? "");
    setEditStatus(u.status ?? "ativo");
    setEditMethod(u.payment_method ?? null);
    setEditLast4(u.payment_last4 ?? "");
    setEditExpiry(toDateInputValue(u.expires_at));
  }

  // ── Save ──
  async function handleSave() {
    if (!selected || !editPlan) {
      toast.error("Selecione um plano antes de salvar.");
      return;
    }
    setSaving(true);
    try {
      const data: SubscriptionUpsert = {
        plan_name:      editPlan,
        status:         editStatus,
        payment_method: editMethod,
        payment_last4:  editMethod === "cartao" ? (editLast4 || null) : null,
        expires_at:     editExpiry ? new Date(editExpiry).toISOString() : null,
      };
      await adminUpsertSubscription(selected.id, data);

      // Reflect change in local list immediately
      setUsers((prev) =>
        prev.map((u) =>
          u.id === selected.id
            ? {
                ...u,
                plan_name:      data.plan_name,
                status:         data.status,
                payment_method: data.payment_method,
                payment_last4:  data.payment_last4,
                expires_at:     data.expires_at,
                sub_id:         u.sub_id ?? "created",
              }
            : u,
        ),
      );
      toast.success(
        `Assinatura de ${selected.display_name ?? selected.name} atualizada!`,
      );
      setSelected(null);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar assinatura");
    } finally {
      setSaving(false);
    }
  }

  // ── Remove ──
  async function handleRemove() {
    if (!selected) return;
    setRemoving(true);
    try {
      await adminRemoveSubscription(selected.id);
      setUsers((prev) =>
        prev.map((u) =>
          u.id === selected.id
            ? {
                ...u,
                sub_id: null,
                plan_name: null,
                status: null,
                payment_method: null,
                payment_last4: null,
                expires_at: null,
              }
            : u,
        ),
      );
      toast.success("Assinatura removida.");
      setSelected(null);
    } catch (e: unknown) {
      toast.error(
        e instanceof Error ? e.message : "Erro ao remover assinatura",
      );
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3 pt-2 px-1"
      >
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLocation("/admin")}
          className="shrink-0 text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest font-bold text-muted-foreground">
            <Gem className="w-3.5 h-3.5" />
            Admin · Assinaturas
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white leading-tight mt-0.5">
            Gerenciar Assinaturas
          </h1>
        </div>
      </motion.div>

      {/* ── Stats row ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-1">
        {[
          { label: "Usuários",      value: stats.total,    color: "text-cyan-400"    },
          { label: "Ativos",        value: stats.ativos,   color: "text-emerald-400" },
          { label: "Sem plano",     value: stats.sem,      color: "text-slate-400"   },
          { label: "Vencendo (7d)", value: stats.expiring, color: "text-yellow-400"  },
        ].map((s) => (
          <Card
            key={s.label}
            className="rounded-2xl p-4 border-border/40 bg-card/60 backdrop-blur-sm"
          >
            <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
              {s.label}
            </p>
            <p className={`text-3xl font-extrabold tabular-nums mt-1 ${s.color}`}>
              {s.value}
            </p>
          </Card>
        ))}
      </div>

      {/* ── Search ─────────────────────────────────────────────────────── */}
      <div className="relative px-1">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nome ou e-mail…"
          className="pl-10 h-11 rounded-2xl bg-card/60 border-border/40"
        />
      </div>

      {/* ── User list ──────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col gap-2 px-1 pb-4"
        >
          {filtered.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-12">
              Nenhum usuário encontrado.
            </p>
          )}
          {filtered.map((u, i) => (
            <UserRow key={u.id} user={u} index={i} onClick={() => openEdit(u)} />
          ))}
        </motion.div>
      )}

      {/* ── Edit sheet ─────────────────────────────────────────────────── */}
      <Sheet
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <SheetContent
          side="right"
          className="w-full sm:max-w-md flex flex-col gap-0 p-0 overflow-y-auto"
        >
          {/* Sheet header */}
          <SheetHeader className="px-6 pt-6 pb-4 border-b border-border/50 shrink-0">
            <div className="flex items-center gap-3">
              {selected && (
                <Avatar className="w-10 h-10 shrink-0">
                  {selected.avatar_url && (
                    <AvatarImage
                      src={resolveImage(selected.avatar_url, "avatars")}
                    />
                  )}
                  <AvatarFallback className="text-sm font-bold">
                    {formatInitials(selected.display_name ?? selected.name)}
                  </AvatarFallback>
                </Avatar>
              )}
              <div className="min-w-0">
                <SheetTitle className="text-base leading-tight truncate">
                  {selected?.display_name ?? selected?.name}
                </SheetTitle>
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {selected?.email}
                </p>
              </div>
            </div>
          </SheetHeader>

          {/* Form fields */}
          <div className="flex flex-col gap-5 p-6 flex-1">
            {/* Plan */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Plano
              </Label>
              <Select value={editPlan} onValueChange={setEditPlan}>
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue placeholder="Selecionar plano…" />
                </SelectTrigger>
                <SelectContent>
                  {PLANS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Status
              </Label>
              <Select
                value={editStatus}
                onValueChange={(v) => setEditStatus(v as SubscriptionStatus)}
              >
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Expiry date */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5" />
                Data de Expiração
              </Label>
              <Input
                type="date"
                value={editExpiry}
                onChange={(e) => setEditExpiry(e.target.value)}
                className="h-11 rounded-xl"
              />
              {editExpiry && (
                <p className="text-xs text-muted-foreground">
                  {fmtDate(editExpiry)}
                </p>
              )}
            </div>

            {/* Payment method */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5" />
                Forma de Pagamento
              </Label>
              <Select
                value={editMethod ?? "none"}
                onValueChange={(v) =>
                  setEditMethod((v === "none" ? null : v) as PaymentMethod)
                }
              >
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue placeholder="Não informado" />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Last 4 digits — only when cartao */}
            {editMethod === "cartao" && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Últimos 4 dígitos
                </Label>
                <Input
                  value={editLast4}
                  onChange={(e) =>
                    setEditLast4(e.target.value.replace(/\D/g, "").slice(0, 4))
                  }
                  placeholder="0000"
                  maxLength={4}
                  className="h-11 rounded-xl font-mono tracking-widest"
                />
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="px-6 pb-8 pt-4 border-t border-border/50 flex flex-col gap-2 shrink-0">
            <Button
              onClick={handleSave}
              disabled={saving || removing || !editPlan}
              className="h-11 rounded-xl gradient-primary text-white border-0 glow-primary font-bold"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Gem className="w-4 h-4 mr-2" />
              )}
              Salvar Assinatura
            </Button>

            {selected?.sub_id && (
              <Button
                variant="ghost"
                onClick={handleRemove}
                disabled={saving || removing}
                className="h-10 rounded-xl text-destructive hover:bg-destructive/10 text-sm font-medium"
              >
                {removing && (
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                )}
                Remover assinatura
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ── User row component ─────────────────────────────────────────────────────

function UserRow({
  user,
  index,
  onClick,
}: {
  user: UserWithSubscription;
  index: number;
  onClick: () => void;
}) {
  const badgeCfg = user.status ? STATUS_BADGE[user.status] : null;
  const BadgeIcon = badgeCfg?.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: Math.min(index * 0.015, 0.3) }}
    >
      <Card
        onClick={onClick}
        className="flex items-center gap-4 p-4 rounded-2xl border-border/40 bg-card/60 backdrop-blur-sm cursor-pointer hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[0_0_16px_rgba(6,182,212,0.08)] transition-all"
      >
        {/* Avatar */}
        <Avatar className="w-9 h-9 shrink-0">
          {user.avatar_url && (
            <AvatarImage src={resolveImage(user.avatar_url, "avatars")} />
          )}
          <AvatarFallback className="text-xs font-bold">
            {formatInitials(user.display_name ?? user.name)}
          </AvatarFallback>
        </Avatar>

        {/* Name / email */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate leading-tight">
            {user.display_name ?? user.name}
          </p>
          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
        </div>

        {/* Desktop columns */}
        <div className="hidden sm:flex items-center gap-4 shrink-0">
          <span className="text-xs font-semibold text-muted-foreground w-[72px] text-right truncate">
            {user.plan_name ?? "—"}
          </span>

          {badgeCfg && BadgeIcon ? (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold border ${badgeCfg.className}`}
            >
              <BadgeIcon className="w-3 h-3" />
              {badgeCfg.label}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold border border-border/40 text-muted-foreground/50">
              <Minus className="w-3 h-3" />
              Sem plano
            </span>
          )}

          <span className="text-xs text-muted-foreground w-[88px] text-right tabular-nums">
            {fmtDate(user.expires_at)}
          </span>
        </div>

        {/* Mobile: status only */}
        <div className="sm:hidden shrink-0">
          {badgeCfg && BadgeIcon ? (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border ${badgeCfg.className}`}
            >
              <BadgeIcon className="w-2.5 h-2.5" />
              {badgeCfg.label}
            </span>
          ) : (
            <span className="text-[10px] text-muted-foreground/50 font-medium">
              Sem plano
            </span>
          )}
        </div>
      </Card>
    </motion.div>
  );
}
