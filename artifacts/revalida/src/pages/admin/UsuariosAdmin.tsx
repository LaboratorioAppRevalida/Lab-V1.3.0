import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  ChevronLeft,
  Search,
  Loader2,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  ShieldOff,
  ShieldX,
  ShieldCheck,
  UserX,
  AlertTriangle,
  History,
  Star,
  CheckCircle2,
  Wifi,
  WifiOff,
  Briefcase,
  BriefcaseIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/AuthContext";
import { useRealtime } from "@/contexts/RealtimeContext";
import {
  fetchAllUsersAdmin,
  fetchUserSessions,
  fetchUserWarnings,
  adminUpdateProfile,
  adminResetMetrics,
  adminSuspendUser,
  adminUnsuspendUser,
  adminWarnUser,
  adminPromoteToAdmin,
  adminDemoteFromAdmin,
  adminPromoteToColaborador,
  adminDemoteFromColaborador,
  type AdminUser,
  type AdminSession,
  type AdminWarning,
} from "@/lib/adminUserService";

// ── Helpers ───────────────────────────────────────────────────────────────────

function initialsOf(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

const PALETTE = [
  "bg-blue-500",
  "bg-violet-500",
  "bg-emerald-500",
  "bg-orange-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-amber-500",
  "bg-pink-500",
];

function avatarColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

function fmt(dt: string) {
  return new Date(dt).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function fmtFull(dt: string) {
  return new Date(dt).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

const SUSPEND_OPTIONS = [
  { value: "1", label: "1 dia" },
  { value: "3", label: "3 dias" },
  { value: "7", label: "7 dias" },
  { value: "15", label: "15 dias" },
  { value: "30", label: "30 dias" },
  { value: "0", label: "Permanente" },
];

// ── Avatar ────────────────────────────────────────────────────────────────────

function Avatar({ user, size = "md" }: { user: AdminUser; size?: "sm" | "md" | "lg" }) {
  const sz = size === "sm" ? "w-8 h-8 text-xs" : size === "lg" ? "w-12 h-12 text-base" : "w-10 h-10 text-sm";
  return (
    <div
      className={`${sz} ${avatarColor(user.id)} rounded-full flex items-center justify-center text-white font-bold shrink-0`}
    >
      {initialsOf(user.display_name || user.name)}
    </div>
  );
}

// ── UserRow ───────────────────────────────────────────────────────────────────

function UserRow({
  user,
  isOnline,
  onEdit,
  onReset,
  onSuspend,
  onUnsuspend,
  onWarn,
  onHistory,
  onPromote,
  onDemote,
  onPromoteColaborador,
  onDemoteColaborador,
}: {
  user: AdminUser;
  isOnline: boolean;
  onEdit: () => void;
  onReset: () => void;
  onSuspend: () => void;
  onUnsuspend: () => void;
  onWarn: () => void;
  onHistory: () => void;
  onPromote: () => void;
  onDemote: () => void;
  onPromoteColaborador: () => void;
  onDemoteColaborador: () => void;
}) {
  return (
    <Card className="p-3 flex items-center gap-3 hover:bg-muted/30 transition-colors">
      <div className="relative shrink-0">
        <Avatar user={user} />
        {isOnline && (
          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-background rounded-full" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-semibold text-sm truncate">
            {user.display_name || user.name}
          </span>
          {user.is_admin && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
              admin
            </Badge>
          )}
          {!user.is_admin && user.is_colaborador && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              colaborador
            </Badge>
          )}
          {user.is_suspended && (
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">
              suspenso
            </Badge>
          )}
          {user.warningCount > 0 && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-amber-400 text-amber-600 dark:text-amber-400">
              {user.warningCount} adv.
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
        <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
          <span>Nv. {user.nivel}</span>
          <span>{user.xp_total.toLocaleString("pt-BR")} XP</span>
          <span>{user.sessionCount} est.</span>
          <span className="hidden sm:inline">{fmt(user.created_at)}</span>
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <Button
          size="icon"
          variant="ghost"
          className="w-7 h-7"
          title="Editar perfil"
          onClick={onEdit}
        >
          <Pencil className="w-3.5 h-3.5" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" className="w-7 h-7" title="Mais ações">
              <MoreHorizontal className="w-3.5 h-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={onHistory}>
              <History className="w-4 h-4 mr-2" />
              Ver histórico
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onWarn}>
              <AlertTriangle className="w-4 h-4 mr-2 text-amber-500" />
              Advertir
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            {/* ── Admin role ─────────────────────────────────────── */}
            {user.is_admin ? (
              <DropdownMenuItem onClick={onDemote} className="text-destructive focus:text-destructive">
                <UserX className="w-4 h-4 mr-2" />
                Remover admin
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={onPromote} className="text-violet-600 focus:text-violet-600">
                <ShieldCheck className="w-4 h-4 mr-2" />
                Promover para admin
              </DropdownMenuItem>
            )}

            {/* ── Colaborador role (hidden for admins) ───────────── */}
            {!user.is_admin && (
              user.is_colaborador ? (
                <DropdownMenuItem onClick={onDemoteColaborador} className="text-amber-600 focus:text-amber-600">
                  <BriefcaseIcon className="w-4 h-4 mr-2" />
                  Remover colaborador
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={onPromoteColaborador} className="text-amber-600 focus:text-amber-600">
                  <Briefcase className="w-4 h-4 mr-2" />
                  Tornar colaborador
                </DropdownMenuItem>
              )
            )}

            <DropdownMenuSeparator />

            {/* ── Suspension ─────────────────────────────────────── */}
            {user.is_suspended ? (
              <DropdownMenuItem onClick={onUnsuspend}>
                <ShieldOff className="w-4 h-4 mr-2 text-emerald-500" />
                Remover suspensão
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={onSuspend} className="text-destructive focus:text-destructive">
                <ShieldX className="w-4 h-4 mr-2" />
                Suspender
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onClick={onReset}
              className="text-destructive focus:text-destructive"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Resetar métricas
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Card>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function UsuariosAdmin() {
  const { user: adminUser } = useAuth();
  const { onlineUsers } = useRealtime();
  const [, setLocation] = useLocation();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  // Dialog targets
  const [editTarget, setEditTarget] = useState<AdminUser | null>(null);
  const [resetTarget, setResetTarget] = useState<AdminUser | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<AdminUser | null>(null);
  const [warnTarget, setWarnTarget] = useState<AdminUser | null>(null);
  const [historyTarget, setHistoryTarget] = useState<AdminUser | null>(null);
  const [promoteTarget, setPromoteTarget] = useState<AdminUser | null>(null);
  const [demoteTarget, setDemoteTarget] = useState<AdminUser | null>(null);
  const [promoteColaboradorTarget, setPromoteColaboradorTarget] = useState<AdminUser | null>(null);
  const [demoteColaboradorTarget, setDemoteColaboradorTarget] = useState<AdminUser | null>(null);

  // Form state
  const [editForm, setEditForm] = useState({
    name: "",
    display_name: "",
    city_uf: "",
    phone: "",
    birth_date: "",
  });
  const [suspendReason, setSuspendReason] = useState("");
  const [suspendDays, setSuspendDays] = useState("7");
  const [warnReason, setWarnReason] = useState("");

  // History data
  const [sessions, setSessions] = useState<AdminSession[]>([]);
  const [warnings, setWarnings] = useState<AdminWarning[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const onlineSet = useMemo(
    () => new Set(onlineUsers.map((u) => u.user_id)),
    [onlineUsers],
  );

  // Load
  async function loadUsers() {
    setLoading(true);
    const data = await fetchAllUsersAdmin();
    setUsers(data);
    setLoading(false);
  }

  useEffect(() => {
    loadUsers();
  }, []);

  // Filter + sort
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return users
      .filter(
        (u) =>
          !q ||
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (u.display_name?.toLowerCase().includes(q) ?? false) ||
          (u.city_uf?.toLowerCase().includes(q) ?? false),
      )
      .sort((a, b) => {
        // Online primeiro, depois por data de criação (mais recente primeiro)
        const ao = onlineSet.has(a.id) ? 1 : 0;
        const bo = onlineSet.has(b.id) ? 1 : 0;
        return bo - ao || new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [users, search, onlineSet]);

  // ── Edit ──────────────────────────────────────────────────────────────────

  function openEdit(u: AdminUser) {
    setEditForm({
      name: u.name,
      display_name: u.display_name ?? "",
      city_uf: u.city_uf ?? "",
      phone: u.phone ?? "",
      birth_date: u.birth_date ?? "",
    });
    setEditTarget(u);
  }

  async function handleSaveEdit() {
    if (!editTarget) return;
    setSaving(true);
    const ok = await adminUpdateProfile(editTarget.id, {
      name: editForm.name || editTarget.name,
      display_name: editForm.display_name || null,
      city_uf: editForm.city_uf || null,
      phone: editForm.phone || null,
      birth_date: editForm.birth_date || null,
    });
    setSaving(false);
    if (ok) {
      toast.success("Perfil atualizado");
      setEditTarget(null);
      loadUsers();
    } else {
      toast.error("Erro ao atualizar perfil");
    }
  }

  // ── Reset ─────────────────────────────────────────────────────────────────

  async function handleReset() {
    if (!resetTarget) return;
    setSaving(true);
    const ok = await adminResetMetrics(resetTarget.id);
    setSaving(false);
    if (ok) {
      toast.success("Métricas resetadas com sucesso");
      setResetTarget(null);
      loadUsers();
    } else {
      toast.error("Erro ao resetar métricas");
    }
  }

  // ── Suspend ───────────────────────────────────────────────────────────────

  function openSuspend(u: AdminUser) {
    setSuspendTarget(u);
    setSuspendReason("");
    setSuspendDays("7");
  }

  async function handleSuspend() {
    if (!suspendTarget) return;
    setSaving(true);
    let until: Date | null = null;
    const days = parseInt(suspendDays);
    if (days > 0) {
      until = new Date();
      until.setDate(until.getDate() + days);
    }
    const ok = await adminSuspendUser(suspendTarget.id, suspendReason, until);
    setSaving(false);
    if (ok) {
      toast.success(
        days === 0 ? "Usuário suspenso permanentemente" : `Usuário suspenso por ${days} dia(s)`,
      );
      setSuspendTarget(null);
      loadUsers();
    } else {
      toast.error("Erro ao suspender usuário");
    }
  }

  async function handleUnsuspend(userId: string) {
    const ok = await adminUnsuspendUser(userId);
    if (ok) {
      toast.success("Suspensão removida");
      loadUsers();
    } else {
      toast.error("Erro ao remover suspensão");
    }
  }

  // ── Warn ──────────────────────────────────────────────────────────────────

  async function handleWarn() {
    if (!warnTarget || !adminUser) return;
    setSaving(true);
    const ok = await adminWarnUser(warnTarget.id, adminUser.id, warnReason);
    setSaving(false);
    if (ok) {
      toast.success("Advertência registrada");
      setWarnTarget(null);
      setWarnReason("");
      loadUsers();
    } else {
      toast.error("Erro ao registrar advertência");
    }
  }

  // ── Promote / Demote ──────────────────────────────────────────────────────

  async function handlePromote() {
    if (!promoteTarget) return;
    setSaving(true);
    const ok = await adminPromoteToAdmin(promoteTarget.id);
    setSaving(false);
    if (ok) {
      toast.success(`${promoteTarget.display_name || promoteTarget.name} agora é administrador`);
      setPromoteTarget(null);
      loadUsers();
    } else {
      toast.error("Erro ao promover usuário");
    }
  }

  async function handleDemote() {
    if (!demoteTarget || !adminUser) return;
    setSaving(true);
    const result = await adminDemoteFromAdmin(demoteTarget.id, adminUser.id);
    setSaving(false);
    if (result.ok) {
      toast.success(`Privilégios de admin removidos de ${demoteTarget.display_name || demoteTarget.name}`);
      setDemoteTarget(null);
      loadUsers();
    } else {
      toast.error(result.reason ?? "Erro ao remover privilégios");
      setDemoteTarget(null);
    }
  }

  // ── Promote / Demote Colaborador ──────────────────────────────────────────

  async function handlePromoteColaborador() {
    if (!promoteColaboradorTarget) return;
    setSaving(true);
    const ok = await adminPromoteToColaborador(promoteColaboradorTarget.id);
    setSaving(false);
    if (ok) {
      toast.success(`${promoteColaboradorTarget.display_name || promoteColaboradorTarget.name} agora é colaborador`);
      setPromoteColaboradorTarget(null);
      loadUsers();
    } else {
      toast.error("Erro ao tornar usuário colaborador");
    }
  }

  async function handleDemoteColaborador() {
    if (!demoteColaboradorTarget) return;
    setSaving(true);
    const ok = await adminDemoteFromColaborador(demoteColaboradorTarget.id);
    setSaving(false);
    if (ok) {
      toast.success(`Acesso de colaborador removido de ${demoteColaboradorTarget.display_name || demoteColaboradorTarget.name}`);
      setDemoteColaboradorTarget(null);
      loadUsers();
    } else {
      toast.error("Erro ao remover acesso de colaborador");
    }
  }

  // ── History ───────────────────────────────────────────────────────────────

  async function openHistory(u: AdminUser) {
    setHistoryTarget(u);
    setHistoryLoading(true);
    setSessions([]);
    setWarnings([]);
    const [sess, warns] = await Promise.all([
      fetchUserSessions(u.id),
      fetchUserWarnings(u.id),
    ]);
    setSessions(sess);
    setWarnings(warns);
    setHistoryLoading(false);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const onlineCount = users.filter((u) => onlineSet.has(u.id)).length;

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="px-1 pt-2 pb-1 flex flex-col gap-0.5"
      >
        <button
          onClick={() => setLocation("/admin")}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit mb-1"
        >
          <ChevronLeft className="w-4 h-4" />
          Painel admin
        </button>
        <h1 className="text-2xl font-bold tracking-tight">Gerenciar usuários</h1>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Wifi className="w-3.5 h-3.5 text-emerald-500" />
            {onlineCount} online
          </span>
          <span className="flex items-center gap-1">
            <WifiOff className="w-3.5 h-3.5" />
            {users.length - onlineCount} offline
          </span>
          <span>{users.length} total</span>
        </div>
      </motion.div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Buscar por nome, e-mail ou cidade..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-muted-foreground py-10 text-sm">
          Nenhum usuário encontrado
        </p>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col gap-2"
        >
          {filtered.map((u, i) => (
            <motion.div
              key={u.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: i * 0.02 }}
            >
              <UserRow
                user={u}
                isOnline={onlineSet.has(u.id)}
                onEdit={() => openEdit(u)}
                onReset={() => setResetTarget(u)}
                onSuspend={() => openSuspend(u)}
                onUnsuspend={() => handleUnsuspend(u.id)}
                onWarn={() => { setWarnTarget(u); setWarnReason(""); }}
                onHistory={() => openHistory(u)}
                onPromote={() => setPromoteTarget(u)}
                onDemote={() => setDemoteTarget(u)}
                onPromoteColaborador={() => setPromoteColaboradorTarget(u)}
                onDemoteColaborador={() => setDemoteColaboradorTarget(u)}
              />
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* ── Dialogs ─────────────────────────────────────────────────────────── */}

      {/* Edit */}
      <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar perfil</DialogTitle>
            <DialogDescription>
              {editTarget?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-name">Nome completo</Label>
              <Input
                id="edit-name"
                value={editForm.name}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-display">Apelido / display name</Label>
              <Input
                id="edit-display"
                value={editForm.display_name}
                onChange={(e) => setEditForm((f) => ({ ...f, display_name: e.target.value }))}
                placeholder="Opcional"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-city">Cidade/UF</Label>
              <Input
                id="edit-city"
                value={editForm.city_uf}
                onChange={(e) => setEditForm((f) => ({ ...f, city_uf: e.target.value }))}
                placeholder="Ex: São Paulo/SP"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-phone">Telefone</Label>
              <Input
                id="edit-phone"
                value={editForm.phone}
                onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="(11) 99999-9999"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-birth">Data de nascimento</Label>
              <Input
                id="edit-birth"
                type="date"
                value={editForm.birth_date}
                onChange={(e) => setEditForm((f) => ({ ...f, birth_date: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit} disabled={saving || !editForm.name.trim()}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Promote to admin confirm */}
      <AlertDialog open={!!promoteTarget} onOpenChange={(o) => !o && setPromoteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Promover para administrador</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{promoteTarget?.display_name || promoteTarget?.name}</strong> terá acesso
              completo ao painel administrativo e poderá gerenciar todos os usuários. Confirma?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-violet-600 hover:bg-violet-700 text-white"
              onClick={handlePromote}
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Promover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Demote admin confirm */}
      <AlertDialog open={!!demoteTarget} onOpenChange={(o) => !o && setDemoteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover privilégios de admin</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{demoteTarget?.display_name || demoteTarget?.name}</strong> perderá acesso
              ao painel administrativo imediatamente. Esta ação pode ser revertida depois.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDemote}
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Remover admin
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Promote to colaborador confirm */}
      <AlertDialog open={!!promoteColaboradorTarget} onOpenChange={(o) => !o && setPromoteColaboradorTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tornar colaborador</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{promoteColaboradorTarget?.display_name || promoteColaboradorTarget?.name}</strong> poderá
              enviar novas estações OSCE pela plataforma. As estações ficam pendentes até revisão de um
              administrador antes de irem ao ar. Esta ação pode ser revertida a qualquer momento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-amber-500 hover:bg-amber-600 text-white"
              onClick={handlePromoteColaborador}
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Tornar colaborador
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Demote from colaborador confirm */}
      <AlertDialog open={!!demoteColaboradorTarget} onOpenChange={(o) => !o && setDemoteColaboradorTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover acesso de colaborador</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{demoteColaboradorTarget?.display_name || demoteColaboradorTarget?.name}</strong> perderá
              acesso ao portal de colaboradores e não poderá mais enviar estações. As estações já enviadas
              por este usuário serão mantidas. Esta ação pode ser revertida depois.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDemoteColaborador}
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Remover acesso
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset metrics confirm */}
      <AlertDialog open={!!resetTarget} onOpenChange={(o) => !o && setResetTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Resetar métricas</AlertDialogTitle>
            <AlertDialogDescription>
              Isso vai zerar XP, nível, streak, histórico de sessões e avaliações de{" "}
              <strong>{resetTarget?.display_name || resetTarget?.name}</strong>. A conta não será
              deletada. Esta ação é irreversível.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleReset}
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Resetar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Suspend */}
      <Dialog open={!!suspendTarget} onOpenChange={(o) => !o && setSuspendTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Suspender usuário</DialogTitle>
            <DialogDescription>
              {suspendTarget?.display_name || suspendTarget?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Duração</Label>
              <Select value={suspendDays} onValueChange={setSuspendDays}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUSPEND_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="suspend-reason">Motivo</Label>
              <Textarea
                id="suspend-reason"
                placeholder="Descreva o motivo da suspensão..."
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuspendTarget(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleSuspend}
              disabled={saving || !suspendReason.trim()}
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Suspender
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Warn */}
      <Dialog open={!!warnTarget} onOpenChange={(o) => !o && setWarnTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Advertir usuário</DialogTitle>
            <DialogDescription>
              {warnTarget?.display_name || warnTarget?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="warn-reason">Motivo da advertência</Label>
            <Textarea
              id="warn-reason"
              placeholder="Descreva o motivo..."
              value={warnReason}
              onChange={(e) => setWarnReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWarnTarget(null)}>
              Cancelar
            </Button>
            <Button
              onClick={handleWarn}
              disabled={saving || !warnReason.trim()}
              className="bg-amber-500 hover:bg-amber-600 text-white"
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Registrar advertência
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History sheet */}
      <Sheet open={!!historyTarget} onOpenChange={(o) => !o && setHistoryTarget(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle>
              Histórico — {historyTarget?.display_name || historyTarget?.name}
            </SheetTitle>
          </SheetHeader>

          {historyLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {/* Advertências */}
              <div>
                <p className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  Advertências ({warnings.length})
                </p>
                {warnings.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhuma advertência registrada.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {warnings.map((w) => (
                      <div key={w.id} className="rounded-lg border p-3 text-sm">
                        <p className="font-medium">{w.reason}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{fmtFull(w.created_at)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Separator />

              {/* Sessões */}
              <div>
                <p className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  Últimas sessões ({sessions.length})
                </p>
                {sessions.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhuma sessão registrada.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {sessions.map((s) => (
                      <div key={s.id} className="rounded-lg border p-3 text-sm flex justify-between items-start gap-2">
                        <div className="min-w-0">
                          <p className="font-medium truncate">{s.checklist_nome}</p>
                          <p className="text-xs text-muted-foreground">
                            {s.papel === "medico" ? "Médico" : "Paciente"} · {s.area ?? "Geral"} · {fmtFull(s.ended_at)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                          <span className="font-semibold">{Number(s.nota).toFixed(1)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
