import { useRef, useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { formatInitials } from "@/lib/format";
import {
  LogOut,
  User as UserIcon,
  Mail,
  Calendar,
  MapPin,
  Phone,
  ShieldCheck,
  Pencil,
  X,
  Camera,
  Loader2,
  Check,
  Trophy,
  Clock,
  CalendarDays,
  CreditCard,
  Gem,
  TriangleAlert,
  KeyRound,
  Eye,
  EyeOff,
  MessageCircle,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { uploadFile, resolveImage } from "@/lib/storageService";
import { logError } from "@/lib/errorLogger";
import { getUserTitles, equipTitle, type DbTitle, type DbUserTitle } from "@/lib/titleService";
import { fetchSessions } from "@/lib/sessionService";
import { resetAccount } from "@/lib/resetService";
import { supabase } from "@/lib/supabase";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TitleBadge } from "@/components/gamification/TitleBadge";
import {
  fetchAchievements,
  fetchUserAchievements,
  type DbAchievement,
} from "@/lib/achievementService";
import { AchievementBadge, type AchievementBadgeData } from "@/components/gamification/AchievementBadge";
import { ACHIEVEMENTS } from "@/lib/gamificationStorage";

type EditForm = {
  name: string;
  display_name: string;
  city_uf: string;
  phone: string;
  birth_date: string;
};

export default function Perfil() {
  const { user, profile, logout, updateProfile, reloadProfile } = useAuth();
  const {
    subscription: sub,
    status:       subStatus,
    isLoading:    subLoading,
    daysLeft,
    expiryLabel,
    refresh:      refreshSubscription,
  } = useSubscription();
  const [, setLocation] = useLocation();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<EditForm>({
    name: "",
    display_name: "",
    city_uf: "",
    phone: "",
    birth_date: "",
  });

  const [userTitles, setUserTitles]         = useState<(DbUserTitle & { title: DbTitle })[]>([]);
  const [equippingId, setEquippingId]       = useState<string | null>(null);
  const [allAchs, setAllAchs]               = useState<DbAchievement[]>([]);
  const [unlockedAchSlugs, setUnlockedAchSlugs] = useState<Set<string>>(new Set());
  const [usageStats, setUsageStats] = useState<{ totalHours: number; totalDays: number } | null>(null);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState("");
  const [isResetting, setIsResetting] = useState(false);

  // ── Alterar Senha ─────────────────────────────────────────────────────────
  const [pwdForm, setPwdForm] = useState({ nova: "", confirma: "" });
  const [pwdErrors, setPwdErrors] = useState<{ nova?: string; confirma?: string }>({});
  const [savingPassword, setSavingPassword] = useState(false);
  const [showNovaPwd, setShowNovaPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    Promise.all([
      getUserTitles(user.id).catch(() => [] as (DbUserTitle & { title: DbTitle })[]),
      fetchAchievements().catch(() => [] as DbAchievement[]),
      fetchUserAchievements(user.id).catch(() => [] as Awaited<ReturnType<typeof fetchUserAchievements>>),
      fetchSessions(user.id).catch(() => []),
    ]).then(([titles, achs, userAchs, sessions]) => {
      setUserTitles(titles);
      setAllAchs(achs);
      setUnlockedAchSlugs(new Set(userAchs.map((ua) => ua.achievement.slug)));
      const totalMinutes = sessions.length * 10;
      const totalDays = new Set(sessions.map((s) => s.endedAt.slice(0, 10))).size;
      setUsageStats({ totalHours: totalMinutes / 60, totalDays });
    });
  }, [user?.id]);

  const handleEquip = async (titleId: string) => {
    if (!user?.id || equippingId) return;
    setEquippingId(titleId);
    try {
      await equipTitle(user.id, titleId);
      const updated = await getUserTitles(user.id);
      setUserTitles(updated);
      toast.success("Título equipado!");
    } catch {
      toast.error("Erro ao equipar título");
    } finally {
      setEquippingId(null);
    }
  };

  const handleChangePassword = async () => {
    const errors: { nova?: string; confirma?: string } = {};
    if (pwdForm.nova.length < 6) errors.nova = "A senha deve ter ao menos 6 caracteres";
    if (!pwdForm.confirma) errors.confirma = "Confirme a nova senha";
    else if (pwdForm.nova && pwdForm.nova !== pwdForm.confirma) errors.confirma = "As senhas não coincidem";
    setPwdErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: pwdForm.nova });
    setSavingPassword(false);

    if (error) {
      toast.error("Não foi possível alterar a senha. Tente novamente.");
      return;
    }

    toast.success("Senha alterada com sucesso!");
    setPwdForm({ nova: "", confirma: "" });
    setPwdErrors({});
    setShowNovaPwd(false);
    setShowConfirmPwd(false);
  };

  const handleReset = async () => {
    if (!user?.id || resetConfirmText !== "REINICIAR" || isResetting) return;
    setIsResetting(true);
    try {
      await resetAccount(user.id);
      toast.success("Conta reiniciada com sucesso! Seu progresso foi zerado.");
      setShowResetModal(false);
      setResetConfirmText("");
      setUsageStats({ totalHours: 0, totalDays: 0 });
      setUserTitles([]);
      setUnlockedAchSlugs(new Set());
      await reloadProfile();
    } catch (err) {
      toast.error("Erro ao reiniciar conta. Tente novamente.");
      logError("generic", err instanceof Error ? err.message : String(err), user?.id);
    } finally {
      setIsResetting(false);
    }
  };

  const isAdmin = user?.role === "admin";
  const avatarUrl = profile?.avatar_url ?? user?.avatarUrl;
  const [avatarVersion, setAvatarVersion] = useState(0);
  const resolvedAvatarSrc = avatarUrl
    ? resolveImage(avatarUrl, "avatars") + (avatarVersion ? `?v=${avatarVersion}` : "")
    : "";

  const handleLogout = async () => {
    await logout();
    toast.info("Você saiu da sua conta");
    setLocation("/login");
  };

  const handleEdit = () => {
    setForm({
      name: user?.name ?? "",
      display_name: user?.displayName ?? "",
      city_uf: user?.cityUf ?? "",
      phone: user?.phone ?? "",
      birth_date: user?.birthDate ?? "",
    });
    setEditing(true);
  };

  const handleCancel = () => setEditing(false);

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("O nome é obrigatório");
      return;
    }
    setSaving(true);
    const success = await updateProfile({
      name: form.name.trim(),
      display_name: form.display_name.trim() || null,
      city_uf: form.city_uf.trim() || null,
      phone: form.phone.trim() || null,
      birth_date: form.birth_date || null,
    });
    setSaving(false);
    if (success) {
      toast.success("Perfil atualizado!");
      setEditing(false);
    }
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validar tipo e tamanho (máx 5MB)
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowed.includes(file.type)) {
      toast.error("Formato inválido. Use JPG, PNG ou WebP.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 5MB.");
      return;
    }

    setUploadingAvatar(true);

    const result = await uploadFile({ file, bucket: "avatars", userId: user.id, slug: "avatar" });

    if (result.error) {
      toast.error("Falha no upload da foto. Verifique se o bucket 'avatars' está configurado.");
      logError("avatar_upload_failure", result.error, user.id);
      setUploadingAvatar(false);
      e.target.value = "";
      return;
    }

    const saved = await updateProfile({ avatar_url: result.storagePath });
    if (saved) {
      await reloadProfile();
      setAvatarVersion(Date.now());
      toast.success("Foto de perfil atualizada!");
    } else {
      toast.error("Foto enviada, mas não foi possível salvar a URL.");
    }

    setUploadingAvatar(false);
    e.target.value = "";
  };

  if (!user) {
    return (
      <div className="flex flex-col gap-6">
        <div className="px-1 pt-2 pb-1">
          <h1 className="text-3xl font-bold tracking-tight">Perfil</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="px-1 pt-2 pb-1">
        <h1 className="text-3xl font-bold tracking-tight">Perfil</h1>
        <p className="text-muted-foreground mt-1 font-medium">Gerencie suas informações</p>
      </div>

      <Card className="overflow-hidden border-border/50 shadow-sm">
        <div className="h-24 w-full gradient-primary opacity-20" />
        <CardContent className="pt-0 relative">

          {/* Avatar + nome */}
          <div className="flex flex-col items-center -mt-12 mb-6">
            {/* Avatar com botão de upload */}
            <div className="relative mb-4">
              <Avatar className="h-24 w-24 border-4 border-background shadow-lg">
                {resolvedAvatarSrc && (
                  <AvatarImage src={resolvedAvatarSrc} alt={user.name} className="object-cover" />
                )}
                <AvatarFallback className="gradient-primary text-white text-3xl font-bold">
                  {formatInitials(user.name)}
                </AvatarFallback>
              </Avatar>

              {/* Botão câmera sobreposto */}
              <button
                onClick={handleAvatarClick}
                disabled={uploadingAvatar}
                aria-label="Alterar foto de perfil"
                className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-background border-2 border-border/70 flex items-center justify-center shadow-sm hover:bg-muted transition-colors disabled:opacity-60"
              >
                {uploadingAvatar
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                  : <Camera className="w-3.5 h-3.5 text-muted-foreground" />
                }
              </button>

              {/* Input oculto */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </div>

            <h2 className="text-2xl font-bold text-center">{user.name}</h2>
            {user.displayName && user.displayName !== user.name && (
              <p className="text-muted-foreground font-medium mt-1">"{user.displayName}"</p>
            )}
            <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold border border-primary/20">
              {isAdmin ? <ShieldCheck className="w-3.5 h-3.5" /> : <UserIcon className="w-3.5 h-3.5" />}
              {isAdmin ? "Administrador" : "Estudante"}
            </div>
          </div>

          {/* Seção de informações */}
          {!editing ? (
            /* ── MODO VISUALIZAÇÃO ── */
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b pb-2">
                <h3 className="font-semibold text-lg">Informações Pessoais</h3>
                <Button variant="outline" size="sm" onClick={handleEdit} className="gap-1.5 h-8">
                  <Pencil className="w-3.5 h-3.5" /> Editar
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-start gap-3">
                  <Mail className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium leading-none mb-1">E-mail</p>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                  </div>
                </div>

                {user.phone && (
                  <div className="flex items-start gap-3">
                    <Phone className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium leading-none mb-1">Telefone</p>
                      <p className="text-sm text-muted-foreground">{user.phone}</p>
                    </div>
                  </div>
                )}

                {user.birthDate && (
                  <div className="flex items-start gap-3">
                    <Calendar className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium leading-none mb-1">Data de nascimento</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(user.birthDate).toLocaleDateString("pt-BR", { timeZone: "UTC" })}
                      </p>
                    </div>
                  </div>
                )}

                {(user.cityUf || user.country) && (
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium leading-none mb-1">Localização</p>
                      <p className="text-sm text-muted-foreground">
                        {[user.cityUf, user.country].filter(Boolean).join(", ")}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* ── MODO EDIÇÃO ── */
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b pb-2">
                <h3 className="font-semibold text-lg">Editar perfil</h3>
                <Button variant="ghost" size="sm" onClick={handleCancel} className="gap-1.5 h-8 text-muted-foreground">
                  <X className="w-3.5 h-3.5" /> Cancelar
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="name">Nome completo <span className="text-destructive">*</span></Label>
                  <Input
                    id="name"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Seu nome"
                    className="h-10 bg-background"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="display_name">Apelido / Nickname</Label>
                  <Input
                    id="display_name"
                    value={form.display_name}
                    onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
                    placeholder="Como você quer ser chamado"
                    className="h-10 bg-background"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="city_uf">Cidade / Estado</Label>
                  <Input
                    id="city_uf"
                    value={form.city_uf}
                    onChange={(e) => setForm((f) => ({ ...f, city_uf: e.target.value }))}
                    placeholder="Ex: São Paulo/SP"
                    className="h-10 bg-background"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    placeholder="(11) 99999-9999"
                    className="h-10 bg-background"
                  />
                </div>

                <div className="flex flex-col gap-1.5 md:col-span-2">
                  <Label htmlFor="birth_date">Data de nascimento</Label>
                  <Input
                    id="birth_date"
                    type="date"
                    value={form.birth_date}
                    onChange={(e) => setForm((f) => ({ ...f, birth_date: e.target.value }))}
                    className="h-10 bg-background"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 h-11 gradient-primary text-white border-0 glow-primary disabled:opacity-70"
                >
                  {saving ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvando…</>
                  ) : (
                    <><Check className="w-4 h-4 mr-2" /> Salvar alterações</>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Meus Títulos */}
          {userTitles.length > 0 && (
            <div className="mt-6 pt-6 border-t">
              <div className="flex items-center gap-2 mb-3">
                <Trophy className="w-4 h-4 text-amber-500" />
                <h3 className="font-semibold text-base">Meus Títulos</h3>
                <span className="text-xs text-muted-foreground font-medium ml-auto">
                  {userTitles.length} desbloqueado{userTitles.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {userTitles.map((ut) => {
                  const isEquipped = ut.is_equipped;
                  const isLoading = equippingId === ut.title_id;
                  return (
                    <button
                      key={ut.id}
                      onClick={() => !isEquipped && handleEquip(ut.title_id)}
                      disabled={isEquipped || !!equippingId}
                      title={isEquipped ? "Equipado" : "Equipar"}
                      className={[
                        "transition-all rounded-full border",
                        isEquipped
                          ? "ring-2 ring-offset-1 cursor-default opacity-100"
                          : "opacity-70 hover:opacity-100 hover:scale-105 cursor-pointer",
                        isLoading ? "animate-pulse" : "",
                      ].join(" ")}
                      style={{ borderColor: ut.title.color, outlineColor: ut.title.color }}
                    >
                      <TitleBadge title={ut.title} size="md" />
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Clique num título para equipá-lo. O título equipado aparece no seu perfil e rankings.
              </p>
            </div>
          )}

          {/* ── Estatísticas de Uso ─────────────────────────────────────── */}
          <div className="mt-6 pt-6 border-t isolate">
            <div className="flex items-center gap-2 mb-4">
              <CalendarDays className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-base">Estatísticas de Uso</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
              {/* Total de Horas Logadas */}
              <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-[#06181d] md:bg-card/90 p-4 shadow-sm [transform:translateZ(0)]">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Horas de Treino
                  </span>
                  <Clock className="w-4 h-4 text-primary/70 shrink-0" />
                </div>
                {usageStats !== null ? (
                  <div>
                    <p className="text-3xl font-bold tabular-nums leading-none text-foreground">
                      {Math.floor(usageStats.totalHours)}
                      <span className="text-lg font-semibold text-muted-foreground ml-0.5">h</span>
                      {usageStats.totalHours % 1 > 0 && (
                        <span className="text-lg font-semibold text-muted-foreground ml-0.5">
                          {" "}{Math.round((usageStats.totalHours % 1) * 60)}min
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1.5">
                      {usageStats.totalHours === 0
                        ? "Nenhuma sessão registrada"
                        : `${Math.round(usageStats.totalHours * 6)} sessões estimadas`}
                    </p>
                  </div>
                ) : (
                  <div className="h-9 rounded-md bg-muted/40 animate-pulse" />
                )}
              </div>

              {/* Total de Dias Logados */}
              <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-[#06181d] md:bg-card/90 p-4 shadow-sm [transform:translateZ(0)]">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Dias Ativos
                  </span>
                  <CalendarDays className="w-4 h-4 text-primary/70 shrink-0" />
                </div>
                {usageStats !== null ? (
                  <div>
                    <p className="text-3xl font-bold tabular-nums leading-none text-foreground">
                      {usageStats.totalDays}
                      <span className="text-lg font-semibold text-muted-foreground ml-0.5">dias</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-1.5">
                      {usageStats.totalDays === 0
                        ? "Nenhuma sessão registrada"
                        : "com pelo menos 1 treino concluído"}
                    </p>
                  </div>
                ) : (
                  <div className="h-9 rounded-md bg-muted/40 animate-pulse" />
                )}
              </div>
            </div>
          </div>

          {/* ── Gestão da Assinatura ────────────────────────────────────── */}
          {(() => {
            const STATUS_CONFIG: Record<string, { label: string; classes: string }> = {
              ativo:     { label: "Ativo",     classes: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400" },
              pendente:  { label: "Pendente",  classes: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400" },
              expirado:  { label: "Expirado",  classes: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400" },
              cancelado: { label: "Cancelado", classes: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" },
            };

            const PAYMENT_LABEL: Record<string, string> = {
              cartao: "Cartão de Crédito",
              pix:    "Pix",
              boleto: "Boleto",
            };

            const statusCfg = subStatus !== "none"
              ? (STATUS_CONFIG[subStatus] ?? STATUS_CONFIG.expirado)
              : null;

            const renewalLine = (() => {
              if (!sub?.expires_at || daysLeft === null) return null;
              if (daysLeft < 0)  return "Plano expirado";
              if (daysLeft === 0) return "Expira hoje";
              if (daysLeft === 1) return "Expira amanhã";
              if (daysLeft <= 30) return `Restam ${daysLeft} dias`;
              return `Renova em ${expiryLabel}`;
            })();

            const needsAttention =
              subStatus === "pendente" || subStatus === "expirado" || subStatus === "cancelado";

            return (
              <div className="mt-6 pt-6 border-t">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Gem className="w-4 h-4 text-primary" />
                    <h3 className="font-semibold text-base">Meu Plano</h3>
                  </div>
                  {sub && (
                    <button
                      onClick={() => void refreshSubscription()}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      title="Atualizar status da assinatura"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Atualizar
                    </button>
                  )}
                </div>

                <div className="rounded-xl border border-border/60 bg-card/60 shadow-sm overflow-hidden">
                  {subLoading ? (
                    /* skeleton */
                    <div className="p-4 space-y-3">
                      <div className="h-5 w-32 rounded-md bg-muted/50 animate-pulse" />
                      <div className="h-4 w-48 rounded-md bg-muted/40 animate-pulse" />
                      <div className="h-4 w-40 rounded-md bg-muted/40 animate-pulse" />
                    </div>
                  ) : sub === null ? (
                    /* empty state — sem assinatura */
                    <div className="p-5 flex flex-col items-center text-center gap-3">
                      <Gem className="w-8 h-8 text-muted-foreground/40" />
                      <div>
                        <p className="text-sm font-medium text-foreground">Nenhum plano ativo</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Adquira um plano e desbloqueie recursos exclusivos.
                        </p>
                      </div>
                      <span
                        onClick={() => setLocation("/assinatura")}
                        className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary border border-primary/20 cursor-pointer hover:bg-primary/20 transition-colors"
                      >
                        <Gem className="w-3 h-3" />
                        Tornar-se Premium
                      </span>
                    </div>
                  ) : (
                    /* populated */
                    <div className="divide-y divide-border/50">
                      {/* Plan name + status badge */}
                      <div className="flex items-center justify-between p-4">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                            Plano
                          </p>
                          <p className="text-xl font-bold text-foreground leading-tight">{sub.plan_name}</p>
                        </div>
                        {statusCfg && (
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusCfg.classes}`}>
                            {statusCfg.label}
                          </span>
                        )}
                      </div>

                      {/* Payment method */}
                      {sub.payment_method && (
                        <div className="flex items-center gap-3 px-4 py-3">
                          <CreditCard className="w-4 h-4 text-muted-foreground shrink-0" />
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                              Forma de pagamento
                            </p>
                            <p className="text-sm text-foreground font-medium mt-0.5">
                              {PAYMENT_LABEL[sub.payment_method] ?? sub.payment_method}
                              {sub.payment_method === "cartao" && sub.payment_last4 && (
                                <span className="text-muted-foreground font-normal ml-1">
                                  **** {sub.payment_last4}
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Expiry / countdown */}
                      {sub.expires_at && (
                        <div className="flex items-center gap-3 px-4 py-3">
                          <CalendarDays className="w-4 h-4 text-muted-foreground shrink-0" />
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                              Validade
                            </p>
                            <p className={`text-sm font-medium mt-0.5 ${
                              daysLeft !== null && daysLeft <= 7
                                ? "text-red-600 dark:text-red-400"
                                : daysLeft !== null && daysLeft <= 30
                                ? "text-yellow-600 dark:text-yellow-400"
                                : "text-foreground"
                            }`}>
                              {renewalLine}
                              <span className="text-muted-foreground font-normal ml-1.5">
                                ({expiryLabel})
                              </span>
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Botões de ação para assinaturas com problema */}
                      {needsAttention && (
                        <div className="flex flex-col sm:flex-row gap-2 p-4">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 gap-2"
                            onClick={() => setLocation("/assinatura")}
                          >
                            <Gem className="w-3.5 h-3.5" />
                            {subStatus === "pendente" ? "Finalizar pagamento" : "Renovar assinatura"}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 gap-2 border-green-600/40 text-green-700 hover:bg-green-600 hover:text-white dark:text-green-400 dark:border-green-500/40 dark:hover:bg-green-700"
                            onClick={() =>
                              window.open(
                                "https://wa.me/5511999999999?text=Olá%2C%20preciso%20de%20ajuda%20com%20minha%20assinatura%20Revalida%202ª%20Fase",
                                "_blank"
                              )
                            }
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            Suporte WhatsApp
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Minhas Medalhas — removido da view privada (mantido no perfil público/lobby) */}
          {/* {(() => {
            const TIER_ORDER: Record<string, number> = { platina: 0, ouro: 1, prata: 2, bronze: 3 };
            const source = allAchs.length > 0 ? allAchs : ACHIEVEMENTS.map((a) => ({
              id: a.id, slug: a.id, title: a.titulo, description: a.descricao,
              tier: a.tier, icon: null, color: null,
              required_streak: a.requiredStreak ?? null,
              required_stations: a.requiredEstacoes ?? null,
              required_average: a.requiredMedia ?? null,
              is_active: true, created_at: "", updated_at: "",
            } as DbAchievement));

            const sorted = [...source].sort((a, b) => {
              const tierDiff = (TIER_ORDER[a.tier] ?? 4) - (TIER_ORDER[b.tier] ?? 4);
              if (tierDiff !== 0) return tierDiff;
              const aU = unlockedAchSlugs.has(a.slug);
              const bU = unlockedAchSlugs.has(b.slug);
              return aU === bU ? 0 : aU ? -1 : 1;
            });

            const badgeData = (a: DbAchievement): AchievementBadgeData => ({
              id: a.id, slug: a.slug, title: a.title, description: a.description,
              tier: a.tier as AchievementBadgeData["tier"],
              icon: a.icon, color: a.color,
              requirementLabel: a.required_streak
                ? `${a.required_streak} dias seguidos`
                : a.required_stations
                  ? `${a.required_stations} estações`
                  : a.required_average
                    ? `Média ${a.required_average.toFixed(1)}`
                    : undefined,
            });

            return (
              <div className="mt-6 pt-6 border-t">
                <div className="flex items-center gap-2 mb-3">
                  <Trophy className="w-4 h-4 text-emerald-500" />
                  <h3 className="font-semibold text-base">Minhas Medalhas</h3>
                  <span className="text-xs text-muted-foreground font-medium ml-auto">
                    {unlockedAchSlugs.size} / {source.length}
                  </span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {sorted.map((a) => (
                    <AchievementBadge
                      key={a.slug}
                      achievement={badgeData(a)}
                      unlocked={unlockedAchSlugs.has(a.slug)}
                    />
                  ))}
                </div>
              </div>
            );
          })()}*/}

          {/* ── Alterar Senha ────────────────────────────────────────────── */}
          <div className="mt-8 pt-6 border-t">
            <div className="flex items-center gap-2 mb-4">
              <KeyRound className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold">Alterar Senha</h3>
            </div>
            <div className="flex flex-col gap-3">
              {/* Nova senha */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pwd-nova" className="text-xs font-medium text-muted-foreground">
                  Nova senha
                </Label>
                <div className="relative">
                  <Input
                    id="pwd-nova"
                    type={showNovaPwd ? "text" : "password"}
                    placeholder="••••••••"
                    value={pwdForm.nova}
                    onChange={(e) => { setPwdForm((p) => ({ ...p, nova: e.target.value })); setPwdErrors((p) => ({ ...p, nova: undefined })); }}
                    className="h-10 pr-10"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowNovaPwd((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showNovaPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {pwdErrors.nova && (
                  <p className="text-xs text-destructive">{pwdErrors.nova}</p>
                )}
              </div>

              {/* Confirmar senha */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pwd-confirma" className="text-xs font-medium text-muted-foreground">
                  Confirmar nova senha
                </Label>
                <div className="relative">
                  <Input
                    id="pwd-confirma"
                    type={showConfirmPwd ? "text" : "password"}
                    placeholder="••••••••"
                    value={pwdForm.confirma}
                    onChange={(e) => { setPwdForm((p) => ({ ...p, confirma: e.target.value })); setPwdErrors((p) => ({ ...p, confirma: undefined })); }}
                    className="h-10 pr-10"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowConfirmPwd((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showConfirmPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {pwdErrors.confirma && (
                  <p className="text-xs text-destructive">{pwdErrors.confirma}</p>
                )}
              </div>

              <Button
                onClick={handleChangePassword}
                disabled={savingPassword || (!pwdForm.nova && !pwdForm.confirma)}
                className="w-full sm:w-auto sm:self-end h-10"
              >
                {savingPassword ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvando…</>
                ) : (
                  <><KeyRound className="w-4 h-4 mr-2" /> Salvar nova senha</>
                )}
              </Button>
            </div>
          </div>

          {/* ── Zona de Perigo ──────────────────────────────────────────── */}
          <div className="mt-8 pt-6 border-t border-destructive/25">
            <div className="flex items-center gap-2 mb-3">
              <TriangleAlert className="w-4 h-4 text-destructive" />
              <h3 className="text-sm font-semibold text-destructive">Zona de Perigo</h3>
            </div>
            <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">Reiniciar Minha Conta</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    Apaga permanentemente seu histórico de treinos, missões, medalhas,
                    títulos e estatísticas. Sua assinatura e perfil não são afetados.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-destructive/40 text-destructive hover:bg-destructive hover:text-destructive-foreground shrink-0 self-start sm:self-center"
                  onClick={() => setShowResetModal(true)}
                >
                  <TriangleAlert className="w-3.5 h-3.5 mr-1.5" />
                  Reiniciar
                </Button>
              </div>
            </div>
          </div>

          {/* Logout */}
          <div className="mt-6 pt-4 border-t flex justify-center">
            <Button variant="destructive" onClick={handleLogout} className="w-full sm:w-auto min-w-[200px] h-11">
              <LogOut className="w-4 h-4 mr-2" />
              Sair da conta
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Reset Confirmation Dialog ──────────────────────────────────── */}
      <Dialog
        open={showResetModal}
        onOpenChange={(open) => {
          setShowResetModal(open);
          if (!open) setResetConfirmText("");
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <TriangleAlert className="w-5 h-5 shrink-0" />
              Reiniciar Minha Conta
            </DialogTitle>
            <DialogDescription asChild>
              <div className="text-sm leading-relaxed pt-1 space-y-2">
                <p>
                  Esta ação é <strong className="text-foreground">permanente e irreversível</strong>.
                  Serão apagados:
                </p>
                <ul className="list-disc list-inside space-y-0.5 text-muted-foreground pl-1">
                  <li>Histórico de sessões de treino</li>
                  <li>Progresso de missões e desafios</li>
                  <li>Medalhas e títulos desbloqueados</li>
                  <li>XP, nível e streak acumulados</li>
                </ul>
                <p className="font-medium text-foreground pt-1">
                  Sua assinatura e dados de perfil não serão afetados.
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5 py-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
              Digite{" "}
              <span className="text-destructive font-bold tracking-normal">REINICIAR</span>{" "}
              para confirmar
            </label>
            <input
              type="text"
              value={resetConfirmText}
              onChange={(e) => setResetConfirmText(e.target.value)}
              placeholder="REINICIAR"
              disabled={isResetting}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              autoComplete="off"
              spellCheck={false}
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="ghost"
              onClick={() => { setShowResetModal(false); setResetConfirmText(""); }}
              disabled={isResetting}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleReset}
              disabled={resetConfirmText !== "REINICIAR" || isResetting}
            >
              {isResetting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <TriangleAlert className="w-4 h-4 mr-2" />
              )}
              Confirmar Reinicialização
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
